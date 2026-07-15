"""Shared FFmpeg operations for pipelines (clean, downscale, rescale)."""
import logging
import os
import subprocess
import tempfile
import shutil

logger = logging.getLogger(__name__)

def extract_frames(ffmpeg: str, input_path: str, output_dir: str) -> int:
    """Extract video frames using ffmpeg. Returns frame count."""
    frame_pat = os.path.join(output_dir, "frame_%06d.png")
    cmd = [ffmpeg, "-i", input_path, "-pix_fmt", "rgb24", frame_pat, "-y"]
    logger.info("ffmpeg extract frames: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        err = result.stderr[:500] if result.stderr else "unknown error"
        raise RuntimeError(f"ffmpeg extract failed: {err}")
    return len([f for f in os.listdir(output_dir) if f.endswith(".png")])

def recombine_video(ffmpeg: str, input_pattern: str, output_path: str, audio_from: str | None = None) -> None:
    """Recombine frames into video using ffmpeg."""
    cmd = [ffmpeg, "-i", input_pattern.replace("\\", "/"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18", output_path, "-y"]
    
    if audio_from:
        audio_file = os.path.join(tempfile.gettempdir(), "kaistu-audio-temp.aac")
        audio_cmd = [ffmpeg, "-i", audio_from, "-vn", "-c:a", "aac", "-b:a", "128k", audio_file, "-y"]
        if subprocess.run(audio_cmd, capture_output=True, text=True).returncode == 0 and os.path.isfile(audio_file):
            cmd = [ffmpeg, "-i", input_pattern.replace("\\", "/"), "-i", audio_file, "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18", output_path, "-y"]
    
    logger.info("ffmpeg recombine: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        err = result.stderr[:500] if result.stderr else "unknown error"
        raise RuntimeError(f"ffmpeg recombine failed: {err}")