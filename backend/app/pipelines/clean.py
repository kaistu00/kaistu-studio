"""Clean pipeline module: x4 Real-ESRGAN + x0.25 downscale for sharpening."""
import logging
import os
import re
import shutil
import tempfile
import subprocess
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi", ".mkv", ".gif"}

def _is_video(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in VIDEO_EXTENSIONS

async def run_clean(input_path: str, output_path: str, params: dict, db, execution) -> None:
    """Run clean: x4 Real-ESRGAN upscale + x0.25 downscale (sharpening)."""
    from app.routers.upscalers import ensure_binary, model_dir, _BIN_DIR, ensure_ffmpeg, build_cli_args
    
    ffmpeg = shutil.which("ffmpeg") or await ensure_ffmpeg(db)
    upscale_exe = await ensure_binary("realesrgan-ncnn-vulkan", db)
    model_id = "realesrgan-x4plus"
    model_dir_path = model_dir(model_id)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if execution:
        execution.progress = 5
        db.commit()

    tmp = tempfile.mkdtemp(prefix="kaistu-clean-")
    
    try:
        if _is_video(input_path):
            frames_dir = os.path.join(tmp, "frames")
            upscaled_dir = os.path.join(tmp, "upscaled")
            cleaned_dir = os.path.join(tmp, "cleaned")
            os.makedirs(frames_dir)
            os.makedirs(upscaled_dir)
            os.makedirs(cleaned_dir)

            frame_pat = os.path.join(frames_dir, "frame_%06d.png")
            subprocess.run([ffmpeg, "-i", input_path, "-pix_fmt", "rgb24", frame_pat, "-y"], capture_output=True, text=True, check=True)

            frame_files = sorted(f for f in os.listdir(frames_dir) if f.endswith(".png"))
            if not frame_files:
                raise RuntimeError("no frames extracted from video")

            if execution:
                execution.progress = 15
                db.commit()

            # x4 upscale all frames
            upscaled_pat = os.path.join(upscaled_dir, "frame_%06d.png")
            upscale_cmd = [upscale_exe, "-i", frame_pat, "-o", upscaled_dir, "-s", "4", "-m", model_dir_path, "-n", model_id, *build_cli_args(params)]
            logger.info("[clean] upscaling x4 with Real-ESRGAN: %s", " ".join(upscale_cmd))
            r = subprocess.run(upscale_cmd, capture_output=True, text=True, cwd=_BIN_DIR, timeout=300)
            if r.returncode != 0:
                raise RuntimeError(f"upscale failed with code {r.returncode}: {r.stderr[:300]}")

            if execution:
                execution.progress = 60
                db.commit()

            # downscale 0.25
            cleaned_pat = os.path.join(cleaned_dir, "frame_%06d.png")
            subprocess.run([ffmpeg, "-i", upscaled_pat, "-vf", "scale=iw/4:ih/4:flags=lanczos", cleaned_pat, "-y"], capture_output=True, text=True, check=True)

            if execution:
                execution.progress = 85
                db.commit()

            # recombine
            out_pat = cleaned_pat.replace("\\", "/")
            subprocess.run([ffmpeg, "-i", out_pat, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18", output_path, "-y"], capture_output=True, text=True, check=True)
        else:
            upscaled_path = os.path.join(tmp, "upscaled.png")
            upscale_cmd = [upscale_exe, "-i", input_path, "-o", upscaled_path, "-s", "4", "-m", model_dir_path, "-n", model_id, *build_cli_args(params)]
            logger.info("[clean] upscaling x4 with Real-ESRGAN (image)")
            r = subprocess.run(upscale_cmd, capture_output=True, text=True, cwd=_BIN_DIR, timeout=300)
            if r.returncode != 0:
                raise RuntimeError(f"upscale failed with code {r.returncode}: {r.stderr[:300]}")

            if execution:
                execution.progress = 60
                db.commit()

            # Log dimensions before/after
            def get_dims(path):
                try:
                    res = subprocess.run([ffmpeg, "-i", path], capture_output=True, text=True, timeout=5)
                    m = re.search(r"Stream.* (\d+)x(\d+)", res.stderr or "")
                    if m:
                        return (int(m.group(1)), int(m.group(2)))
                except:
                    pass
                return (0, 0)
            orig_size = get_dims(input_path)
            upscaled_size = get_dims(upscaled_path)
            logger.info("[clean] original: %dx%d, upscaled: %dx%d", orig_size[0], orig_size[1], upscaled_size[0], upscaled_size[1])

            # downscale 0.25
            subprocess.run([ffmpeg, "-i", upscaled_path, "-vf", "scale=iw/4:ih/4:flags=lanczos", output_path, "-y"], capture_output=True, text=True, check=True)
            final_size = get_dims(output_path)
            logger.info("[clean] final: %dx%d", final_size[0], final_size[1])

            shutil.rmtree(tmp, ignore_errors=True)

        if execution and os.path.isfile(output_path):
            execution.status = "completed"
            execution.progress = 100
            execution.completed_at = datetime.now(timezone.utc)
            execution.output_path = output_path
            db.commit()
    except Exception as e:
        shutil.rmtree(tmp, ignore_errors=True)
        raise