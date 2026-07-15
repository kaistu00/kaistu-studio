import asyncio
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.upscaler import Upscaler
from app.models.runtime import Runtime
from app.models.execution import Execution
from app.pipelines.clean import run_clean as clean_pipeline
from app.pipelines.downscale import run_downscale as downscale_pipeline
from app.pipelines.rescale import run_rescale as rescale_pipeline

logger = logging.getLogger(__name__)
router = APIRouter()

_UPSCALE_DIR = os.path.join(
    os.environ.get("APPDATA", os.path.expanduser("~")),
    "kaistu-studio",
    "models",
    "upscale",
)

_BIN_DIR = os.path.join(
    os.environ.get("APPDATA", os.path.expanduser("~")),
    "kaistu-studio",
    "bin",
)

_PLATFORM_MAP = {"win32": "windows", "linux": "ubuntu", "darwin": "macos"}

VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi", ".mkv", ".gif"}

MODEL_FILE_PREFIXES = {
    "realesrgan-x4plus": ["realesrgan-x4plus"],
    "realesrnet-x4plus": ["realesrnet-x4plus"],
    "realesrgan-x4plus-anime": ["realesrgan-x4plus-anime"],
    "realesr-animevideov3": [
        "realesr-animevideov3-x2",
        "realesr-animevideov3-x3",
        "realesr-animevideov3-x4",
    ],
}

RUNTIME_SEED = {
    "name": "realesrgan-ncnn-vulkan",
    "version": "0.2.5.0",
    "platforms_json": json.dumps({
        "windows": {
            "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip",
            "binary": "realesrgan-ncnn-vulkan.exe",
        },
        "ubuntu": {
            "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip",
            "binary": "realesrgan-ncnn-vulkan",
        },
        "macos": {
            "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip",
            "binary": "realesrgan-ncnn-vulkan",
        },
    }),
}

FFMPEG_RUNTIME_SEED = {
    "name": "ffmpeg",
    "version": "7.1",
    "platforms_json": json.dumps({
        "windows": {
            "url": "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
            "binary": "ffmpeg.exe",
        },
        "ubuntu": {
            "url": "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz",
            "binary": "ffmpeg",
        },
        "macos": {
            "url": "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-macos64-gpl.zip",
            "binary": "ffmpeg",
        },
    }),
}

MODEL_ZIP_URL = (
    "https://github.com/xinntao/Real-ESRGAN/releases/download/"
    "v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip"
)

SEED_DATA = [
    {
        "model_id": "realesrgan-x4plus",
        "name": "Real ESRGAN",
        "short_desc": "General — Fotos reales, paisajes, objetos",
        "usage": "Fotos reales, imágenes generales, restauración. 4× con buen equilibrio entre nitidez y artefactos. Es el modelo más robusto para contenido variado.",
        "size": "150 MB",
        "downloads_to": "/models/upscale/realesrgan-x4plus",
        "scales": json.dumps([4]),
        "default_scale": 4,
        "runtime_name": "realesrgan-ncnn-vulkan",
        "author": "Xintao Wang (xinntao)",
        "author_url": "https://github.com/xinntao/Real-ESRGAN",
    },
    {
        "model_id": "realesrnet-x4plus",
        "name": "Real ESRNet",
        "short_desc": "Suave — Menos artefactos GAN, más natural",
        "usage": "Versión sin el componente GAN agresivo. Resultados más suaves y naturales. Ideal cuando buscas fidelidad y no tanta nitidez artificial.",
        "size": "150 MB",
        "downloads_to": "/models/upscale/realesrnet-x4plus",
        "scales": json.dumps([4]),
        "default_scale": 4,
        "runtime_name": "realesrgan-ncnn-vulkan",
        "author": "Xintao Wang (xinntao)",
        "author_url": "https://github.com/xinntao/Real-ESRGAN",
    },
    {
        "model_id": "realesrgan-x4plus-anime",
        "name": "Real ESRGAN Anime",
        "short_desc": "Anime estático — Ilustraciones, manga, arte 2D",
        "usage": "Entrenado específicamente para anime. Mantiene líneas, contornos y colores planos sin introducir ruido. Modelo pequeño y rápido.",
        "size": "50 MB",
        "downloads_to": "/models/upscale/realesrgan-x4plus-anime",
        "scales": json.dumps([4]),
        "default_scale": 4,
        "runtime_name": "realesrgan-ncnn-vulkan",
        "author": "Xintao Wang (xinntao)",
        "author_url": "https://github.com/xinntao/Real-ESRGAN",
    },
    {
        "model_id": "realesr-animevideov3",
        "name": "Real ESR Anime Video",
        "short_desc": "Anime video — Estable entre frames, sin parpadeos",
        "usage": "Optimizado para vídeo de anime con estabilidad entre frames. Evita parpadeos, cambios de color y artefactos típicos de usar modelos de imágenes en vídeo.",
        "size": "100 MB",
        "downloads_to": "/models/upscale/realesr-animevideov3",
        "scales": json.dumps([2, 4]),
        "default_scale": 4,
        "runtime_name": "realesrgan-ncnn-vulkan",
        "author": "Xintao Wang (xinntao)",
        "author_url": "https://github.com/xinntao/Real-ESRGAN",
    },
]


def model_dir(model_id: str) -> str:
    return os.path.join(_UPSCALE_DIR, model_id)


async def ensure_binary(runtime_name: str, db: Session) -> str:
    rt = db.execute(select(Runtime).where(Runtime.name == runtime_name)).scalar_one_or_none()
    if not rt:
        raise RuntimeError(f"runtime '{runtime_name}' not found in DB")

    os_name = _PLATFORM_MAP.get(sys.platform, "ubuntu")
    info = rt.platform_info(os_name)
    if not info:
        raise RuntimeError(f"runtime '{runtime_name}' has no config for platform '{os_name}'")

    exe_name = info["binary"]
    exe = os.path.join(_BIN_DIR, exe_name)
    if os.path.isfile(exe):
        return exe

    url = info["url"]
    os.makedirs(_BIN_DIR, exist_ok=True)
    zip_cache = os.path.join(tempfile.gettempdir(), f"kaistu-{runtime_name}-{os_name}.zip")
    if not os.path.isfile(zip_cache):
        logger.info("[upscalers] downloading %s binary from %s", os_name, url)
        async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            Path(zip_cache).write_bytes(resp.content)
        logger.info("[upscalers] %s zip downloaded (%d MB)", os_name, os.path.getsize(zip_cache) // 1024 // 1024)

    with zipfile.ZipFile(zip_cache, "r") as zf:
        for name in zf.namelist():
            if name.endswith(exe_name):
                zf.extract(name, _BIN_DIR)
                extracted = os.path.join(_BIN_DIR, name)
                if extracted != exe:
                    os.rename(extracted, exe)
                break

    if not os.path.isfile(exe):
        raise RuntimeError(f"{exe_name} not found in {os_name} release zip")
    os.chmod(exe, 0o755)
    logger.info("[upscalers] binary ready at %s", exe)
    return exe


async def ensure_ffmpeg(db: Session) -> str:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return ffmpeg

    rt = db.execute(select(Runtime).where(Runtime.name == "ffmpeg")).scalar_one_or_none()
    if not rt:
        raise RuntimeError("ffmpeg runtime not found in DB")

    os_name = _PLATFORM_MAP.get(sys.platform, "ubuntu")
    info = rt.platform_info(os_name)
    if not info:
        raise RuntimeError(f"ffmpeg has no config for platform '{os_name}'")

    exe_name = info["binary"]
    exe = os.path.join(_BIN_DIR, exe_name)
    if os.path.isfile(exe):
        return exe

    url = info["url"]
    os.makedirs(_BIN_DIR, exist_ok=True)
    archive_name = os.path.basename(url)
    archive_path = os.path.join(tempfile.gettempdir(), f"kaistu-ffmpeg-{archive_name}")
    if not os.path.isfile(archive_path):
        logger.info("[upscalers] downloading ffmpeg for %s from %s", os_name, url)
        async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            Path(archive_path).write_bytes(resp.content)

    if url.endswith(".tar.xz"):
        import tarfile
        with tarfile.open(archive_path, "r:xz") as tf:
            for member in tf.getmembers():
                if member.name.endswith(exe_name):
                    tf.extract(member, _BIN_DIR)
                    extracted = os.path.join(_BIN_DIR, member.name)
                    if extracted != exe:
                        os.rename(extracted, exe)
                    break
    else:
        with zipfile.ZipFile(archive_path, "r") as zf:
            for name in zf.namelist():
                if name.endswith(exe_name):
                    zf.extract(name, _BIN_DIR)
                    extracted = os.path.join(_BIN_DIR, name)
                    if extracted != exe:
                        os.rename(extracted, exe)
                    break

    if not os.path.isfile(exe):
        raise RuntimeError(f"{exe_name} not found in {os_name} ffmpeg archive")
    os.chmod(exe, 0o755)
    logger.info("[upscalers] ffmpeg ready at %s", exe)
    return exe


def is_video_file(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in VIDEO_EXTENSIONS


CLI_FLAG_MAP = {
    "tile_size": "-t",
    "gpu_id": "-g",
    "threads": "-j",
    "tta": "-x",
    "output_format": "-f",
}


def build_cli_args(params: dict) -> list[str]:
    args = []
    for key, flag in CLI_FLAG_MAP.items():
        val = params.get(key)
        if val is None or val == "":
            continue
        if key == "tta":
            if val:
                args.append(flag)
            continue
        if key == "output_format":
            args.extend([flag, str(val)])
            continue
        args.extend([flag, str(val)])
    return args


@router.post("/upscalers/{model_id}/run")
async def run_upscaler(model_id: str, payload: dict, db: Session = Depends(get_db)):
    logger.info("[upscalers] run_upscaler called for model: %s, mode: %s", model_id, payload.get("mode"))
    mode = payload.get("mode", "upscale")
    is_ffmpeg_mode = mode in ("downscale", "rescale", "clean")
    
    # For clean mode, use realesrgan-x4plus and auto-install if needed
    if is_ffmpeg_mode and model_id == "ffmpeg" and mode == "clean":
        model_id = "realesrgan-x4plus"
        if not is_installed(model_id):
            logger.info("[upscalers] auto-installing %s for clean mode", model_id)
            from app.routers.upscalers import install_upscaler
            # Replicate core install logic inline
            prefixes = MODEL_FILE_PREFIXES.get(model_id, [model_id])
            dest = model_dir(model_id)
            os.makedirs(dest, exist_ok=True)
            zip_cache = os.path.join(tempfile.gettempdir(), "kaistu-realesrgan-models.zip")
            if not os.path.isfile(zip_cache):
                logger.info("[upscalers] downloading model bundle from %s", MODEL_ZIP_URL)
                async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
                    resp = await client.get(MODEL_ZIP_URL)
                    resp.raise_for_status()
                    Path(zip_cache).write_bytes(resp.content)
            extracted = 0
            with zipfile.ZipFile(zip_cache, "r") as zf:
                for name in zf.namelist():
                    parts = name.replace("\\", "/").split("/")
                    if len(parts) < 2 or parts[-2] != "models":
                        continue
                    filename = parts[-1]
                    stem, ext = os.path.splitext(filename)
                    if ext.lower() not in (".param", ".bin"):
                        continue
                    if any(stem == prefix for prefix in prefixes):
                        src_path = os.path.join(dest, name.replace("/", os.sep))
                        dst_path = os.path.join(dest, filename)
                        zf.extract(name, dest)
                        if os.path.isfile(src_path) and src_path != dst_path:
                            os.rename(src_path, dst_path)
                        extracted += 1
            if extracted == 0:
                raise HTTPException(500, "no model files extracted from bundle")
            row = db.execute(select(Upscaler).where(Upscaler.model_id == model_id)).scalar_one_or_none()
            if row:
                row.installed = 1
                db.commit()
            logger.info("[upscalers] auto-installed %s", model_id)
    
    row = db.execute(select(Upscaler).where(Upscaler.model_id == model_id)).scalar_one_or_none()
    if not row and not is_ffmpeg_mode:
        raise HTTPException(404, f"model not found: {model_id}")
    if not is_installed(model_id) and not is_ffmpeg_mode:
        raise HTTPException(400, "model not installed")

    input_path = payload.get("input_path")
    output_path = payload.get("output_path")
    mode = payload.get("mode", "upscale")

    if not input_path or not output_path:
        raise HTTPException(400, "input_path and output_path are required")
    if not os.path.isfile(input_path):
        raise HTTPException(400, f"input file not found: {input_path}")

    existing_id = payload.get("exec_id")
    now = datetime.now(timezone.utc)

    if existing_id:
        existing = db.query(Execution).filter(Execution.id == existing_id).first()
        if existing:
            running = db.query(Execution).filter(Execution.status == "running").count()
            status = "running" if running == 0 else "pending"
            started = now if status == "running" else None

            existing.model_id = model_id
            existing.model_name = (row and row.name) or "FFmpeg"
            existing.input_file = input_path
            existing.input_width = payload.get("input_width", 0)
            existing.input_height = payload.get("input_height", 0)
            existing.file_size = payload.get("file_size", "")
            existing.output_path = output_path
            existing.output_format = payload.get("params", {}).get("output_format", "png")
            existing.scale = payload.get("scale", 4)
            existing.mode = mode
            existing.target_width = payload.get("target_width")
            existing.target_height = payload.get("target_height")
            existing.status = status
            existing.progress = 5 if status == "running" else 0
            existing.started_at = started
            existing.queued_at = now if status == "pending" else None
            existing.completed_at = None
            existing.error_message = None
            existing.params_json = json.dumps(payload.get("params", {}))
            db.commit()

            exec_id = existing_id
            if status == "running":
                asyncio.create_task(_run_pipeline(model_id, exec_id, payload))
                logger.info("[upscalers] re-started execution %s in mode %s", exec_id, mode)
            else:
                logger.info("[upscalers] re-queued execution %s in mode %s", exec_id, mode)

            return {"id": exec_id, **existing.to_dict()}

    exec_id = str(uuid.uuid4())

    running = db.query(Execution).filter(Execution.status == "running").count()
    status = "running" if running == 0 else "pending"
    started = now if status == "running" else None

    execution = Execution(
        id=exec_id,
        model_id=model_id,
        model_name=row.name if row else "FFmpeg",
        input_file=input_path,
        input_width=payload.get("input_width", 0),
        input_height=payload.get("input_height", 0),
        file_size=payload.get("file_size", ""),
        output_path=output_path,
        output_format=payload.get("params", {}).get("output_format", "png"),
        scale=payload.get("scale", 4),
        mode=mode,
        target_width=payload.get("target_width"),
        target_height=payload.get("target_height"),
        status=status,
        progress=5 if status == "running" else 0,
        started_at=started,
        queued_at=now if status == "pending" else None,
        params_json=json.dumps(payload.get("params", {})),
    )
    db.add(execution)
    db.commit()

    if status == "running":
        asyncio.create_task(_run_pipeline(model_id, exec_id, payload))
        logger.info("[upscalers] created execution %s, pipeline launched in mode %s", exec_id, mode)
    else:
        logger.info("[upscalers] created execution %s, queued in mode %s", exec_id, mode)

    return execution.to_dict()


async def _run_pipeline(model_id: str, exec_id: str, payload: dict):
    db = SessionLocal()
    try:
        execution = db.execute(select(Execution).where(Execution.id == exec_id)).scalar_one_or_none()
        if not execution:
            logger.error("[upscalers] execution %s not found in background task", exec_id)
            return

        input_path = payload["input_path"]
        output_path = payload["output_path"]
        scale = payload.get("scale", 4)
        params = payload.get("params", {})
        mode = payload.get("mode", "upscale")
        face_enhance = payload.get("face_enhance", False)

        is_ffmpeg_mode = mode in ("downscale", "rescale", "clean")
        row = None
        if not is_ffmpeg_mode:
            row = db.execute(select(Upscaler).where(Upscaler.model_id == model_id)).scalar_one_or_none()
            if not row:
                raise RuntimeError("model not found in background")

        execution.status = "running"
        execution.progress = 5
        db.commit()

        if mode == "clean":
            logger.info("[clean] running pipeline for %s", input_path)
            await clean_pipeline(input_path, output_path, params, db, execution)
        elif mode == "rescale":
            logger.info("[rescale] running pipeline for %s", input_path)
            target_w = payload.get("target_width") or (execution.input_width * scale)
            target_h = payload.get("target_height") or (execution.input_height * scale)
            await rescale_pipeline(input_path, output_path, target_w, target_h, params, db, execution)
        elif mode == "downscale":
            logger.info("[downscale] running pipeline for %s", input_path)
            await downscale_pipeline(input_path, output_path, scale, params, db, execution)
        elif is_video_file(input_path):
            logger.info("[upscalers] video input — face enhancement not supported, skipping")
            exe = await ensure_binary(row.runtime_name or "realesrgan-ncnn-vulkan", db)
            await _run_video(exe, model_dir(model_id), model_id, scale, params, input_path, output_path, execution, db)
        else:
            effective_input = input_path
            temp_enhanced: str | None = None
            if face_enhance:
                logger.info("[upscalers] >>> PIPELINE STEP 1/2 — FACE ENHANCEMENT (GFPGAN) <<<")
                logger.info("[upscalers]   input : %s", input_path)
                from app.face_enhance import enhance_face
                temp_enhanced = os.path.join(
                    tempfile.gettempdir(), f"kaistu-face-enhanced-{uuid.uuid4().hex}.png"
                )
                ok = await asyncio.to_thread(enhance_face, input_path, temp_enhanced)
                if ok:
                    effective_input = temp_enhanced
                    logger.info("[upscalers] >>> PIPELINE STEP 1/2 — FACE ENHANCEMENT OK <<<")
                    logger.info("[upscalers]   using enhanced image as upscale input: %s", effective_input)
                else:
                    logger.warning("[upscalers] >>> PIPELINE STEP 1/2 — FACE ENHANCEMENT FAILED, falling back to ORIGINAL <<<")
                    temp_enhanced = None
                    effective_input = input_path
            else:
                logger.info("[upscalers] face enhancement NOT requested — skipping step 1/2")

            logger.info("[upscalers] >>> PIPELINE STEP 2/2 — UPSCALING (Real-ESRGAN) <<<")
            logger.info("[upscalers]   upscale input : %s", effective_input)
            logger.info("[upscalers]   upscale output: %s", output_path)
            logger.info("[upscalers]   scale=%d model=%s", scale, model_id)
            exe = await ensure_binary(row.runtime_name or "realesrgan-ncnn-vulkan", db)
            await _run_image(exe, model_dir(model_id), model_id, scale, params, effective_input, output_path, execution, db)
            logger.info("[upscalers] >>> PIPELINE STEP 2/2 — UPSCALING %s <<<",
                        "OK" if execution.status == "completed" else "FAILED")

            if temp_enhanced and os.path.isfile(temp_enhanced):
                os.remove(temp_enhanced)
                logger.info("[upscalers] cleaned up temp enhanced file")

    except Exception as e:
        logger.error("[upscalers] background pipeline failed: %s", e)
        try:
            execution = db.merge(Execution(id=exec_id))
            execution.status = "failed"
            execution.error_message = str(e)
            db.commit()
        except Exception as db_err:
            logger.error("[upscalers] failed to update execution status: %s", db_err)
    finally:
        db.close()


async def _run_image(
    exe: str, model_dir_path: str, model_id: str, scale: int,
    params: dict, input_path: str, output_path: str,
    execution: Execution, db: Session,
):
    cmd = [
        exe,
        "-i", input_path,
        "-o", output_path,
        "-s", str(scale),
        "-m", model_dir_path,
        "-n", model_id,
        *build_cli_args(params),
    ]
    logger.info("[upscalers] running: %s", " ".join(cmd))
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=_BIN_DIR)
    await _track_progress(proc, execution, db)
    proc.wait()

    if proc.returncode == 0 and os.path.isfile(output_path):
        execution.status = "completed"
        execution.progress = 100
        execution.completed_at = datetime.now(timezone.utc)
        execution.output_path = output_path
    else:
        execution.status = "failed"
        execution.error_message = f"process exited with code {proc.returncode}"
    db.commit()


async def _run_video(
    exe: str, model_dir_path: str, model_id: str, scale: int,
    params: dict, input_path: str, output_path: str,
    execution: Execution, db: Session,
):
    ffmpeg = await ensure_ffmpeg(db)
    tmp = tempfile.mkdtemp(prefix="kaistu-video-")
    frames_dir = os.path.join(tmp, "frames")
    upscaled_dir = os.path.join(tmp, "upscaled")
    os.makedirs(frames_dir)
    os.makedirs(upscaled_dir)

    frame_pat = os.path.join(frames_dir, "frame_%06d.png")

    try:
        execution.progress = 5
        db.commit()

        # 1. extract frames
        extract_cmd = [ffmpeg, "-i", input_path, "-pix_fmt", "rgb24", frame_pat, "-y"]
        logger.info("[upscalers] extracting frames: %s", " ".join(extract_cmd))
        r1 = subprocess.run(extract_cmd, capture_output=True, text=True)
        if r1.returncode != 0:
            err = r1.stderr[:500] if r1.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg extract failed: {err}")

        frame_files = sorted(f for f in os.listdir(frames_dir) if f.endswith(".png"))
        total_frames = len(frame_files)
        if total_frames == 0:
            raise RuntimeError("no frames extracted from video")
        logger.info("[upscalers] %d frames extracted", total_frames)

        execution.progress = 15
        db.commit()

        # 2. upscale frames via directory mode (force png output for frames)
        frame_params = {**params, "output_format": "png"}
        cmd = [
            exe,
            "-i", frames_dir,
            "-o", upscaled_dir,
            "-s", str(scale),
            "-m", model_dir_path,
            "-n", model_id,
            *build_cli_args(frame_params),
        ]
        logger.info("[upscalers] running on frames: %s", " ".join(cmd))

        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=_BIN_DIR)
        last_tenth = -1
        assert proc.stdout is not None
        for line in iter(proc.stdout.readline, ""):
            line = line.strip()
            if not line:
                continue
            logger.info("[upscalers] %s", line)
            m = re.search(r"(\d+)[,.]\d+\s*%", line)
            if not m:
                m = re.search(r"(\d+)\s*%", line)
            if m:
                pct = int(m.group(1))
                tenth = (pct // 10) * 10
                if tenth > last_tenth:
                    last_tenth = tenth
                    execution.progress = 15 + int(min(tenth, 100) * 0.7)
                    db.commit()

        proc.wait()
        if proc.returncode != 0:
            raise RuntimeError(f"frame upscale failed with code {proc.returncode}")

        # 3. recombine frames into output video (start at 85%)
        execution.progress = 85
        db.commit()

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        upscaled_pat = os.path.join(upscaled_dir, "frame_%06d.png").replace("\\", "/")

        viz_cmd = [
            ffmpeg, "-i", upscaled_pat,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "slow",
            "-crf", "18",
            output_path, "-y",
        ]

        audio_file = os.path.join(tmp, "audio.aac")
        audio_cmd = [ffmpeg, "-i", input_path, "-vn", "-c:a", "aac", "-b:a", "128k", audio_file, "-y"]
        if subprocess.run(audio_cmd, capture_output=True, text=True).returncode == 0 and os.path.isfile(audio_file):
            viz_cmd = [
                ffmpeg, "-i", upscaled_pat, "-i", audio_file,
                "-c:v", "libx264", "-c:a", "aac",
                "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18",
                output_path, "-y",
            ]

        logger.info("[upscalers] recombining: %s", " ".join(viz_cmd))
        r3 = subprocess.run(viz_cmd, capture_output=True, text=True)
        if r3.returncode != 0:
            err = r3.stderr[:500] if r3.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg recombine failed: {err}")

        if os.path.isfile(output_path):
            execution.status = "completed"
            execution.progress = 100
            execution.completed_at = datetime.now(timezone.utc)
            execution.output_path = output_path
        else:
            execution.status = "failed"
            execution.error_message = "output video not created"
        db.commit()

    finally:
        shutil.rmtree(tmp, ignore_errors=True)


async def _run_clean(input_path: str, output_path: str, params: dict, execution: Execution, db: Session):
    ffmpeg = shutil.which("ffmpeg") or await ensure_ffmpeg(db)
    noise_strength = params.get("noise_strength", 5)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    execution.progress = 10
    db.commit()

    if is_video_file(input_path):
        tmp = tempfile.mkdtemp(prefix="kaistu-clean-video-")
        frames_dir = os.path.join(tmp, "frames")
        cleaned_dir = os.path.join(tmp, "cleaned")
        os.makedirs(frames_dir)
        os.makedirs(cleaned_dir)

        frame_pat = os.path.join(frames_dir, "frame_%06d.png")
        extract_cmd = [ffmpeg, "-i", input_path, "-pix_fmt", "rgb24", frame_pat, "-y"]
        logger.info("[upscalers] clean video: extracting frames")
        r1 = subprocess.run(extract_cmd, capture_output=True, text=True)
        if r1.returncode != 0:
            err = r1.stderr[:500] if r1.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg extract failed: {err}")

        frame_files = sorted(f for f in os.listdir(frames_dir) if f.endswith(".png"))
        if not frame_files:
            raise RuntimeError("no frames extracted from video")

        execution.progress = 20
        db.commit()

        cleaned_pat = os.path.join(cleaned_dir, "frame_%06d.png")
        clean_cmd = [ffmpeg, "-i", frame_pat, "-vf", f"hqdn3d={noise_strength}", cleaned_pat, "-y"]
        logger.info("[upscalers] clean video: denoising frames")
        proc = subprocess.Popen(clean_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        await _track_progress(proc, execution, db)
        proc.wait()
        if proc.returncode != 0:
            raise RuntimeError(f"frame clean failed: {proc.returncode}")

        execution.progress = 80
        db.commit()

        out_pat = cleaned_pat.replace("\\", "/")
        viz_cmd = [ffmpeg, "-i", out_pat, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18", output_path, "-y"]
        logger.info("[upscalers] clean video: recombining")
        r3 = subprocess.run(viz_cmd, capture_output=True, text=True)
        if r3.returncode != 0:
            err = r3.stderr[:500] if r3.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg recombine failed: {err}")

        shutil.rmtree(tmp, ignore_errors=True)
    else:
        clean_cmd = [ffmpeg, "-i", input_path, "-vf", f"hqdn3d={noise_strength}", output_path, "-y"]
        logger.info("[upscalers] clean image: denoising")
        r = subprocess.run(clean_cmd, capture_output=True, text=True)
        if r.returncode != 0:
            err = r.stderr[:500] if r.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg clean failed: {err}")

    if os.path.isfile(output_path):
        execution.status = "completed"
        execution.progress = 100
        execution.completed_at = datetime.now(timezone.utc)
    else:
        execution.status = "failed"
        execution.error_message = "clean output not created"
    db.commit()


async def _run_downscale(input_path: str, output_path: str, scale: int, params: dict, execution: Execution, db: Session, is_video: bool):
    ffmpeg = shutil.which("ffmpeg") or await ensure_ffmpeg(db)
    fmt = params.get("output_format", "png")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    execution.progress = 10
    db.commit()

    if is_video:
        tmp = tempfile.mkdtemp(prefix="kaistu-downscale-video-")
        frames_dir = os.path.join(tmp, "frames")
        downscaled_dir = os.path.join(tmp, "downscaled")
        os.makedirs(frames_dir)
        os.makedirs(downscaled_dir)

        frame_pat = os.path.join(frames_dir, "frame_%06d.png")
        extract_cmd = [ffmpeg, "-i", input_path, "-pix_fmt", "rgb24", frame_pat, "-y"]
        logger.info("[upscalers] downscale video: extracting frames")
        r1 = subprocess.run(extract_cmd, capture_output=True, text=True)
        if r1.returncode != 0:
            err = r1.stderr[:500] if r1.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg extract failed: {err}")

        frame_files = sorted(f for f in os.listdir(frames_dir) if f.endswith(".png"))
        if not frame_files:
            raise RuntimeError("no frames extracted from video")

        execution.progress = 20
        db.commit()

        downscaled_pat = os.path.join(downscaled_dir, "frame_%06d.png")
        down_cmd = [ffmpeg, "-i", frame_pat, "-vf", f"scale=iw/{scale}:ih/{scale}:flags=lanczos", downscaled_pat, "-y"]
        logger.info("[upscalers] downscale video: scaling frames")
        proc = subprocess.Popen(down_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        await _track_progress(proc, execution, db)
        proc.wait()
        if proc.returncode != 0:
            raise RuntimeError(f"frame downscale failed: {proc.returncode}")

        execution.progress = 80
        db.commit()

        out_pat = downscaled_pat.replace("\\", "/")
        viz_cmd = [ffmpeg, "-i", out_pat, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18", output_path, "-y"]
        logger.info("[upscalers] downscale video: recombining")
        r3 = subprocess.run(viz_cmd, capture_output=True, text=True)
        if r3.returncode != 0:
            err = r3.stderr[:500] if r3.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg recombine failed: {err}")

        shutil.rmtree(tmp, ignore_errors=True)
    else:
        down_cmd = [ffmpeg, "-i", input_path, "-vf", f"scale=iw/{scale}:ih/{scale}:flags=lanczos", "-f", fmt, output_path, "-y"]
        logger.info("[upscalers] downscale image: scaling")
        r = subprocess.run(down_cmd, capture_output=True, text=True)
        if r.returncode != 0:
            err = r.stderr[:500] if r.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg downscale failed: {err}")

    if os.path.isfile(output_path):
        execution.status = "completed"
        execution.progress = 100
        execution.completed_at = datetime.now(timezone.utc)
    else:
        execution.status = "failed"
        execution.error_message = "downscale output not created"
    db.commit()


async def _run_rescale(input_path: str, output_path: str, target_w: int, target_h: int, params: dict, execution: Execution, db: Session):
    ffmpeg = shutil.which("ffmpeg") or await ensure_ffmpeg(db)
    fmt = params.get("output_format", "png")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    execution.progress = 10
    db.commit()

    if is_video_file(input_path):
        tmp = tempfile.mkdtemp(prefix="kaistu-rescale-video-")
        frames_dir = os.path.join(tmp, "frames")
        rescaled_dir = os.path.join(tmp, "rescaled")
        os.makedirs(frames_dir)
        os.makedirs(rescaled_dir)

        frame_pat = os.path.join(frames_dir, "frame_%06d.png")
        extract_cmd = [ffmpeg, "-i", input_path, "-pix_fmt", "rgb24", frame_pat, "-y"]
        logger.info("[upscalers] rescale video: extracting frames")
        r1 = subprocess.run(extract_cmd, capture_output=True, text=True)
        if r1.returncode != 0:
            err = r1.stderr[:500] if r1.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg extract failed: {err}")

        frame_files = sorted(f for f in os.listdir(frames_dir) if f.endswith(".png"))
        if not frame_files:
            raise RuntimeError("no frames extracted from video")

        execution.progress = 20
        db.commit()

        rescaled_pat = os.path.join(rescaled_dir, "frame_%06d.png")
        rescale_cmd = [ffmpeg, "-i", frame_pat, "-vf", f"scale={target_w}:{target_h}:flags=lanczos", rescaled_pat, "-y"]
        logger.info("[upscalers] rescale video: scaling frames")
        proc = subprocess.Popen(rescale_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        await _track_progress(proc, execution, db)
        proc.wait()
        if proc.returncode != 0:
            raise RuntimeError(f"frame rescale failed: {proc.returncode}")

        execution.progress = 80
        db.commit()

        out_pat = rescaled_pat.replace("\\", "/")
        viz_cmd = [ffmpeg, "-i", out_pat, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", "18", output_path, "-y"]
        logger.info("[upscalers] rescale video: recombining")
        r3 = subprocess.run(viz_cmd, capture_output=True, text=True)
        if r3.returncode != 0:
            err = r3.stderr[:500] if r3.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg recombine failed: {err}")

        shutil.rmtree(tmp, ignore_errors=True)
    else:
        rescale_cmd = [ffmpeg, "-i", input_path, "-vf", f"scale={target_w}:{target_h}:flags=lanczos", "-f", fmt, output_path, "-y"]
        logger.info("[upscalers] rescale: to %dx%d", target_w, target_h)
        r = subprocess.run(rescale_cmd, capture_output=True, text=True)
        if r.returncode != 0:
            err = r.stderr[:500] if r.stderr else "unknown error"
            raise RuntimeError(f"ffmpeg rescale failed: {err}")

    if os.path.isfile(output_path):
        execution.status = "completed"
        execution.progress = 100
        execution.completed_at = datetime.now(timezone.utc)
    else:
        execution.status = "failed"
        execution.error_message = "rescale output not created"
    db.commit()


async def _track_progress(proc: subprocess.Popen, execution: Execution, db: Session):
    last_tenth = -1
    assert proc.stdout is not None
    for line in iter(proc.stdout.readline, ""):
        line = line.strip()
        if not line:
            continue
        logger.info("[upscalers] %s", line)
        m = re.search(r"(\d+)[,.]\d+\s*%", line)
        if not m:
            m = re.search(r"(\d+)\s*%", line)
        if m:
            pct = int(m.group(1))
            tenth = (pct // 10) * 10
            if tenth > last_tenth:
                last_tenth = tenth
                execution.progress = min(tenth, 100)
                db.commit()


def is_installed(model_id: str) -> bool:
    prefixes = MODEL_FILE_PREFIXES.get(model_id, [model_id])
    d = model_dir(model_id)
    for prefix in prefixes:
        if not (os.path.isfile(os.path.join(d, f"{prefix}.param")) and
                os.path.isfile(os.path.join(d, f"{prefix}.bin"))):
            return False
    return True


def seed_runtimes(db: Session):
    for seed in [RUNTIME_SEED, FFMPEG_RUNTIME_SEED]:
        existing = db.execute(select(Runtime).where(Runtime.name == seed["name"])).first()
        if existing:
            continue
        logger.info("[upscalers] seeding runtime: %s", seed["name"])
        db.add(Runtime(**seed))
    db.commit()


def seed_upscalers(db: Session):
    existing = db.execute(select(Upscaler)).first()
    if existing:
        return
    logger.info("[upscalers] seeding default upscalers")
    for row in SEED_DATA:
        db.add(Upscaler(**row, installed=0))
    db.commit()
    logger.info("[upscalers] seeded %d upscalers", len(SEED_DATA))


def row_to_dict(row: Upscaler) -> dict:
    return {
        "model_id": row.model_id,
        "name": row.name,
        "short_desc": row.short_desc,
        "usage": row.usage,
        "size": row.size,
        "downloads_to": row.downloads_to,
        "scales": json.loads(row.scales),
        "default_scale": row.default_scale,
        "author": row.author,
        "author_url": row.author_url,
        "installed": is_installed(row.model_id),
    }


@router.get("/upscalers")
def list_upscalers(db: Session = Depends(get_db)):
    rows = db.execute(select(Upscaler).order_by(Upscaler.id)).scalars().all()
    return [row_to_dict(r) for r in rows]


@router.post("/upscalers/{model_id}/install")
async def install_upscaler(model_id: str, db: Session = Depends(get_db)):
    row = db.execute(select(Upscaler).where(Upscaler.model_id == model_id)).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="model not found")

    if is_installed(model_id):
        row.installed = 1
        db.commit()
        return row_to_dict(row)

    prefixes = MODEL_FILE_PREFIXES.get(model_id, [model_id])

    dest = model_dir(model_id)
    os.makedirs(dest, exist_ok=True)

    zip_cache = os.path.join(tempfile.gettempdir(), "kaistu-realesrgan-models.zip")
    if not os.path.isfile(zip_cache):
        logger.info("[upscalers] downloading model bundle from %s", MODEL_ZIP_URL)
        async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
            resp = await client.get(MODEL_ZIP_URL)
            resp.raise_for_status()
            Path(zip_cache).write_bytes(resp.content)
        logger.info("[upscalers] model bundle downloaded (%d MB)", os.path.getsize(zip_cache) // 1024 // 1024)

    extracted = 0
    with zipfile.ZipFile(zip_cache, "r") as zf:
        for name in zf.namelist():
            parts = name.replace("\\", "/").split("/")
            if len(parts) < 2 or parts[-2] != "models":
                continue
            filename = parts[-1]
            stem, ext = os.path.splitext(filename)
            if ext.lower() not in (".param", ".bin"):
                continue
            if any(stem == prefix for prefix in prefixes):
                src_path = os.path.join(dest, name.replace("/", os.sep))
                dst_path = os.path.join(dest, filename)
                zf.extract(name, dest)
                if os.path.isfile(src_path) and src_path != dst_path:
                    os.rename(src_path, dst_path)
                extracted += 1

    for root, dirs, files in os.walk(dest, topdown=False):
        for d in dirs:
            try:
                os.rmdir(os.path.join(root, d))
            except OSError:
                pass

    if extracted == 0:
        raise HTTPException(status_code=500, detail="no model files were extracted from bundle")

    row.installed = 1
    db.commit()
    db.refresh(row)
    logger.info("[upscalers] installed %s (%d files)", model_id, extracted)
    return row_to_dict(row)
