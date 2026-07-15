"""Downscale pipeline module."""
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

async def run_downscale(input_path: str, output_path: str, scale: float, params: dict, db, execution) -> None:
    """Run downscaling on image or video."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        from app.routers.upscalers import ensure_ffmpeg
        ffmpeg = await ensure_ffmpeg(db)
    
    fmt = params.get("output_format", "png")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if execution:
        execution.progress = 10
        db.commit()

    if _is_video(input_path):
        tmp = tempfile.mkdtemp(prefix="kaistu-downscale-video-")
        frames_dir = os.path.join(tmp, "frames")
        downscaled_dir = os.path.join(tmp, "downscaled")
        os.makedirs(frames_dir)
        os.makedirs(downscaled_dir)

        try:
            frame_count = extract_frames(ffmpeg, input_path, frames_dir)
            if frame_count == 0:
                raise RuntimeError("no frames extracted from video")

            if execution:
                execution.progress = 20
                db.commit()

            frame_pat = os.path.join(frames_dir, "frame_%06d.png")
            downscaled_pat = os.path.join(downscaled_dir, "frame_%06d.png")
            divisor = int(1/scale) if scale > 0 and 1/scale == int(1/scale) else int(1/scale)
            down_cmd = [ffmpeg, "-i", frame_pat, "-vf", f"scale=iw/{divisor}:ih/{divisor}:flags=lanczos", downscaled_pat, "-y"]
            logger.info("downscale video: scaling frames")
            result = subprocess.run(down_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise RuntimeError(f"frame downscale failed: {result.returncode}")

            if execution:
                execution.progress = 80
                db.commit()

            recombine_video(ffmpeg, downscaled_pat, output_path, input_path)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        # scale is a ratio (0.25, 0.5, etc) - convert to divisor (4, 2, etc)
        divisor = int(1/scale) if scale > 0 and 1/scale == int(1/scale) else int(1/scale)
        down_cmd = [ffmpeg, "-i", input_path, "-vf", f"scale=iw/{divisor}:ih/{divisor}:flags=lanczos", output_path, "-y"]
        logger.info("downscale image: scaling")
        result = subprocess.run(down_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            err = result.stderr[:500] if result.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg downscale failed: {err}")

    if execution and os.path.isfile(output_path):
        execution.status = "completed"
        execution.progress = 100
        execution.completed_at = datetime.now(timezone.utc)
        db.commit()