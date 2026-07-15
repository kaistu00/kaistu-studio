"""Clean (noise reduction) pipeline module."""
import logging
import os
import shutil
import tempfile
import subprocess
from datetime import datetime, timezone

from app.pipelines.ffmpeg_ops import extract_frames, recombine_video

logger = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi", ".mkv", ".gif"}

def _is_video(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in VIDEO_EXTENSIONS

async def run_clean(input_path: str, output_path: str, params: dict, db, execution) -> None:
    """Run noise reduction cleaning on image or video."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        from app.routers.upscalers import ensure_ffmpeg
        ffmpeg = await ensure_ffmpeg(db)
    
    noise_strength = params.get("noiseStrength", params.get("noise_strength", 5))
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if execution:
        execution.progress = 10
        db.commit()

    if _is_video(input_path):
        tmp = tempfile.mkdtemp(prefix="kaistu-clean-video-")
        frames_dir = os.path.join(tmp, "frames")
        cleaned_dir = os.path.join(tmp, "cleaned")
        os.makedirs(frames_dir)
        os.makedirs(cleaned_dir)

        try:
            frame_count = extract_frames(ffmpeg, input_path, frames_dir)
            if frame_count == 0:
                raise RuntimeError("no frames extracted from video")

            if execution:
                execution.progress = 20
                db.commit()

            frame_pat = os.path.join(frames_dir, "frame_%06d.png")
            cleaned_pat = os.path.join(cleaned_dir, "frame_%06d.png")
            clean_cmd = [ffmpeg, "-i", frame_pat, "-vf", f"hqdn3d={noise_strength}", cleaned_pat, "-y"]
            logger.info("clean video: denoising frames")
            result = subprocess.run(clean_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise RuntimeError(f"frame clean failed: {result.returncode}")

            if execution:
                execution.progress = 80
                db.commit()

            recombine_video(ffmpeg, cleaned_pat, output_path, input_path)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        clean_cmd = [ffmpeg, "-i", input_path, "-vf", f"hqdn3d={noise_strength}", output_path, "-y"]
        logger.info("clean image: denoising")
        result = subprocess.run(clean_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            err = result.stderr[:500] if result.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg clean failed: {err}")

    if execution and os.path.isfile(output_path):
        execution.status = "completed"
        execution.progress = 100
        execution.completed_at = datetime.now(timezone.utc)
        db.commit()