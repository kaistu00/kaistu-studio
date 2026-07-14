"""Face enhancement via GFPGAN (Python torch).
Auto-downloads model weights on first use.
"""

import logging
import os
from pathlib import Path

import httpx
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


def _ensure_model():
    if os.path.isfile(_MODEL_PATH):
        return
    os.makedirs(_WEIGHTS_DIR, exist_ok=True)
    logger.info("[face_enhance] downloading GFPGAN model from %s", _MODEL_URL)
    # httpx sync download with progress
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
    _ensure_model()
    import cv2
    from gfpgan import GFPGANer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info("[face_enhance] using device=%s, model=%s, upscale=%d",
                device, _MODEL_PATH, upscale)

    old_cwd = os.getcwd()
    os.chdir(_WEIGHTS_DIR)
    try:
        model = GFPGANer(
            model_path=_MODEL_PATH,
            upscale=upscale,
            arch="clean",
            channel_multiplier=2,
            bg_upsampler=None,
            device=device,
        )
    finally:
        os.chdir(old_cwd)

    img = cv2.imread(input_path)
    if img is None:
        logger.error("[face_enhance] could not read input: %s", input_path)
        return False

    logger.info("[face_enhance] enhancing %dx%d image", img.shape[1], img.shape[0])
    cropped_faces, restored_faces, output = model.enhance(
        img, has_aligned=False, only_center_face=False, paste_back=True
    )

    face_count = len(restored_faces) if isinstance(restored_faces, list) else 0
    cropped_count = len(cropped_faces) if isinstance(cropped_faces, list) else 0
    logger.info("[face_enhance] detected %d face(s), restored %d face(s)", cropped_count, face_count)

    if output is None:
        logger.warning("[face_enhance] GFPGAN returned None output (no faces or enhancement failed), saving original")
        output = img

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    cv2.imwrite(output_path, output)
    logger.info("[face_enhance] saved to %s", output_path)
    return True
