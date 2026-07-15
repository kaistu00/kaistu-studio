"""Face enhancement via GFPGAN (Python torch).
Auto-downloads model weights on first use.
"""

import logging
import os
import traceback
from pathlib import Path

import cv2
import httpx
import numpy as np
import torch

logger = logging.getLogger(__name__)

_WEIGHTS_DIR = os.path.join(
    os.environ.get("APPDATA", os.path.expanduser("~")),
    "kaistu-studio",
    "models",
    "face_enhance",
)

_MODEL_URL = "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth"
_MODEL_PATH = os.path.join(_WEIGHTS_DIR, "GFPGANv1.4.pth")

# Cache the model for reuse
_model_cache = None
_device_cache = None

def _ensure_model():
    if os.path.isfile(_MODEL_PATH):
        logger.info("[face_enhance] model already present at %s", _MODEL_PATH)
        return
    logger.info("[face_enhance] downloading GFPGAN model from %s", _MODEL_URL)
    os.makedirs(_WEIGHTS_DIR, exist_ok=True)
    with httpx.Client(timeout=300, follow_redirects=True) as client:
        with client.stream("GET", _MODEL_URL) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("content-length", 0))
            downloaded = 0
            with open(_MODEL_PATH, "wb") as f:
                for chunk in resp.iter_bytes(8192):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        pct = downloaded * 100 // total
                        if pct % 10 == 0:
                            logger.info("[face_enhance] download %d%%", pct)
    logger.info("[face_enhance] model ready at %s (%d MB)", _MODEL_PATH,
                os.path.getsize(_MODEL_PATH) // 1024 // 1024)

def enhance_face(input_path: str, output_path: str, upscale: int = 1) -> bool:
    """Basic face enhancement using GFPGAN defaults.

    Uses standard GFPGAN parameters (eye_dist_threshold=5, only_center_face=False).
    For advanced face detection tuning, use face_restoration endpoint instead.
    """
    global _model_cache, _device_cache

    logger.info("[face_enhance] ============================================")
    logger.info("[face_enhance] enhance_face called")
    logger.info("[face_enhance]   input : %s", input_path)
    logger.info("[face_enhance]   output: %s", output_path)
    logger.info("[face_enhance]   upscale: %d", upscale)

    _ensure_model()

    from gfpgan import GFPGANer

    # Reuse model if available and device matches
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if _model_cache is None or _device_cache != device:
        logger.info("[face_enhance] loading GFPGAN model (device=%s)", device)
        old_cwd = os.getcwd()
        os.chdir(_WEIGHTS_DIR)
        try:
            _model_cache = GFPGANer(
                model_path=_MODEL_PATH,
                upscale=upscale,
                arch="clean",
                channel_multiplier=2,
                bg_upsampler=None,
                device=device,
            )
        finally:
            os.chdir(old_cwd)
        _device_cache = device
        logger.info("[face_enhance] model loaded OK")
    else:
        logger.info("[face_enhance] reusing cached model")

    model = _model_cache

    img = cv2.imread(input_path)
    if img is None:
        logger.error("[face_enhance] FAILED: could not read input image: %s", input_path)
        return False

    h, w = img.shape[:2]
    logger.info("[face_enhance]   input image: %dx%d", w, h)

    try:
        cropped_faces, restored_faces, output = model.enhance(
            img, has_aligned=False, only_center_face=False, paste_back=True
        )
    except Exception as exc:
        logger.error("[face_enhance] FAILED during model.enhance(): %s", exc)
        logger.error("[face_enhance] traceback:\n%s", traceback.format_exc())
        return False

    cropped_count = len(cropped_faces) if isinstance(cropped_faces, list) else 0
    restored_count = len(restored_faces) if isinstance(restored_faces, list) else 0
    logger.info("[face_enhance]   detected %d face(s), restored %d face(s)",
                cropped_count, restored_count)

    if output is None:
        logger.warning("[face_enhance] no faces found, falling back to original")
        output = img

    out_h, out_w = output.shape[:2]
    logger.info("[face_enhance]   output image: %dx%d", out_w, out_h)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    cv2.imwrite(output_path, output)
    size_kb = os.path.getsize(output_path) // 1024 if os.path.isfile(output_path) else 0
    logger.info("[face_enhance] DONE: saved to %s (%d KB)", output_path, size_kb)
    logger.info("[face_enhance] ============================================")
    return True

def clear_model_cache():
    global _model_cache, _device_cache
    _model_cache = None
    _device_cache = None