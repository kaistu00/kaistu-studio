---
name: ltx-2
description: "Expert knowledge for Lightricks LTX-2.3 — an open-source DiT-based audio-video foundation model. Covers PyTorch API (ltx-pipelines), HuggingFace Diffusers integration, ComfyUI workflows, LoRA/IC-LoRA adapters, inpainting/outpainting, training, and generation parameter tuning. Use when working with LTX-2 video generation, building Python pipelines, or creating ComfyUI workflows."
---

# LTX-2.3 — Video + Audio Generation Skill

## When to Use This Skill

Trigger this skill when the user asks to:
- Generate video+audio using LTX-2.3 PyTorch API (native or Diffusers)
- Set up ComfyUI with LTX-2 nodes
- Use LoRA or IC-LoRA adapters for style/control/VFX
- Run inpainting or outpainting workflows
- Train custom LoRAs with ltx-trainer
- Tune generation parameters (guidance, resolution, frames)
- Optimize memory usage with FP8 quantization

## Quick Reference

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU VRAM | 32GB+ | 80GB (A100/H100) |
| RAM | 32GB | 64GB+ |
| Storage | 100GB | 200GB+ SSD |
| CUDA | 11.8+ | 12.1+ |
| Python | 3.10+ | — |

### Install & Setup

```bash
git clone https://github.com/Lightricks/LTX-2.git
cd LTX-2
uv sync --frozen
source .venv/bin/activate
```

### Download Models

```bash
# Distilled (fast, recommended)
huggingface-cli download Lightricks/LTX-2.3 \
  --include "ltx-2.3-22b-distilled-1.1.safetensors" \
  --local-dir models/

# Full (better quality, slower)
huggingface-cli download Lightricks/LTX-2.3 \
  --include "ltx-2.3-22b-dev.safetensors" \
  --local-dir models/

# FP8 (less VRAM)
huggingface-cli download Lightricks/LTX-2.3-fp8 \
  --include "ltx-2.3-22b-dev-fp8.safetensors" \
  --local-dir models/
```

---

## 1. Native PyTorch API (ltx-pipelines)

### Available Pipelines

| Pipeline | Use Case |
|----------|----------|
| `TI2VidTwoStagesPipeline` | T2V/I2V with two-stage upscaling. Best quality. |
| `TI2VidTwoStagesRes2sPipeline` | Two-stage with res_2s sampler. Fewer steps. |
| `TI2VidOneStagePipeline` | Single-stage for quick prototyping. |
| `DistilledPipeline` | Fast two-stage using distilled checkpoint. |
| `ICLoraPipeline` | Video-to-video with IC-LoRA adapters. |
| `A2VidPipelineTwoStage` | Audio-to-video generation. |
| `RetakePipeline` | Regenerate specific time regions. |
| `KeyframeInterpolationPipeline` | Interpolate between keyframe images. |

### Text-to-Video Example

```python
import torch
from ltx_pipelines.distilled_pipeline import DistilledPipeline

pipeline = DistilledPipeline.from_config("path/to/config.yaml")

output = pipeline(
    prompt="A golden retriever running through a sunlit meadow, "
           "wildflowers swaying in a gentle breeze. "
           "Camera follows at ground level, tracking the dog. "
           "Warm afternoon light with soft bokeh in the background.",
    width=768,
    height=512,
    num_frames=97,
    fps=24.0,
    seed=42,
)
```

### Dimension Constraints

- **Width/height**: must be divisible by 32
- **Frame count**: must follow `8n + 1` (valid: 1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81, 89, 97, 121, 161, 257...)

### Guidance Parameters (MultiModalGuiderParams)

| Parameter | Range | Description |
|-----------|-------|-------------|
| `cfg_scale` | 2.0–5.0 | Classifier-Free Guidance. Higher = more prompt adherence. 1.0 = disabled. |
| `stg_scale` | 0.5–1.5 | Spatio-Temporal Guidance for temporal coherence. 0.0 = disabled. |
| `stg_blocks` | e.g. `[29]` | Transformer blocks for STG. `[]` = disabled. |
| `rescale_scale` | ~0.7 | Prevents over-saturation from guidance. |
| `modality_scale` | 1.0–3.0 | Audio-visual sync strength. >1.0 for audio. |

### Memory Optimization

```python
from ltx_core.quantization.policy import QuantizationPolicy

# FP8 Cast (broad GPU compatibility)
pipeline = DistilledPipeline.from_config(
    "path/to/config.yaml",
    quantization=QuantizationPolicy.fp8_cast(),
)

# FP8 Scaled MM (Hopper GPUs H100+)
# Requires: uv sync --frozen --extra fp8-trtllm
pipeline = DistilledPipeline.from_config(
    "path/to/config.yaml",
    quantization=QuantizationPolicy.fp8_scaled_mm(),
)
```

**Tip:** Set `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` for better memory management.

### Sampling Parameters

| Parameter | Distilled Model | Full Model |
|-----------|-----------------|------------|
| Steps | 4–8 | 20–50 |
| CFG Scale | 1.0 | 2.0–5.0 |
| Recommended | 3.0–3.5 | 3.0–3.5 |

### Resolution Reference

| Resolution | Aspect Ratio | Use Case |
|------------|--------------|----------|
| 768×512 | 3:2 | Wide shots, default |
| 512×768 | 2:3 | Vertical/mobile |
| 704×512 | 4:3 | Classic frame |
| 640×640 | 1:1 | Social media |

---

## 2. HuggingFace Diffusers Integration

```python
import torch
from diffusers import LTX2Pipeline

pipeline = LTX2Pipeline.from_pretrained(
    "Lightricks/LTX-2",
    torch_dtype=torch.bfloat16,
)
pipeline.to("cuda")

result = pipeline(
    prompt="A golden retriever running through a sunlit meadow",
    width=768,
    height=512,
    num_frames=97,
)
```

**Limitations:** Diffusers API is simpler but doesn't expose all features (IC-LoRA, advanced guidance). Use native pipelines for full control.

---

## 3. ComfyUI Integration

### Installation

1. Clone custom nodes:
   ```bash
   cd ComfyUI/custom_nodes
   git clone https://github.com/Lightricks/ComfyUI-LTXVideo.git
   pip install -r ComfyUI-LTXVideo/requirements.txt
   ```
2. Restart ComfyUI
3. Models auto-download on first use, or manually:
   ```bash
   huggingface-cli download Lightricks/LTX-2.3 \
     --include "ltx-2.3-22b-distilled-1.1.safetensors" \
     --local-dir ComfyUI/models/checkpoints/LTX-Video
   ```

### Example Workflows

Located at `ComfyUI/custom_nodes/ComfyUI-LTXVideo/example_workflows/`:

- `LTX-2.3_T2V_I2V_Single_Stage_Distilled_Full.json` — basic T2V/I2V
- `LTX-2.3_T2V_I2V_Two_Stage_Distilled.json` — with upsampling
- `LTX-2.3_ICLoRA_Union_Control_Distilled.json` — depth/pose/edge control

### Node Categories

- `LTXVideo/loaders` — model loaders
- `LTXVideo/samplers` — video samplers
- `LTXVideo/conditioning` — text/image/video conditioning
- `LTXVideo/utils` — preprocessing, blending, masks

---

## 4. LoRA Usage

### Available Camera Control LoRAs (LTX-2)

| LoRA | HuggingFace |
|------|-------------|
| Dolly In | `Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-In` |
| Dolly Out | `Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-Out` |
| Dolly Left | `Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-Left` |
| Dolly Right | `Lightricks/LTX-2-19b-LoRA-Camera-Control-Dolly-Right` |
| Jib Down | `Lightricks/LTX-2-19b-LoRA-Camera-Control-Jib-Down` |
| Jib Up | `Lightricks/LTX-2-19b-LoRA-Camera-Control-Jib-Up` |
| Static Camera | `Lightricks/LTX-2-19b-LoRA-Camera-Control-Static` |

### LoRA Strength Guide

| Range | Effect |
|-------|--------|
| 0.9–1.1 | Subtle, preserves base model |
| 1.2–1.4 | Balanced (recommended) |
| 1.5–1.6 | Strong, max style transfer |

**Best practices:** Keep combined strength under 2.0. Test incrementally.

### IC-LoRA vs LoRA

| Feature | LoRA | IC-LoRA |
|---------|------|---------|
| Purpose | Style/effects | Control/VFX/restoration/transforms |
| Input | Text only | Text + reference (video or control signal) |
| Strength | 0.5–1.5 adjustable | 0.0–1.0 (global + spatial mask) |
| Control | Global style | Frame-level spatial |

### IC-LoRA Strength Parameters

- **`attention_strength`** (0.0–1.0): Global IC-LoRA influence. 1.0 = full adherence.
- **`attention_mask`** (optional): Spatiotemporal mask for region-level control.

### IC-LoRA Adapters

Official adapters include: Union Control, Motion Control, Water Simulation, Deblurring, Colorization, Decompression, Day to Night, Instant Shave, Cross-Eyed.

All available at [Lightricks/LTX-2.3 HuggingFace collection](https://huggingface.co/collections/Lightricks/ltx-23).

---

## 5. Inpainting / Outpainting

Uses `ltx-2.3-22b-ic-lora-in-outpainting-0.9.safetensors` IC-LoRA + mask-aware processing.

### Key ComfyUI Nodes

| Node | Purpose |
|------|---------|
| `LTXAddVideoICLoRAGuideAdvanced` | Mask-aware IC-LoRA conditioning |
| `ImagePadForOutpaintTargetSize` | Pads video for outpainting |
| `LTXVInpaintPreprocess` | Prepares masked input per stage |
| `LTXVDilateVideoMask` | Expands mask (inpainting only) |
| `LTXVLaplacianPyramidBlend` | Blends generated + original with Laplacian pyramid |

### Best Practices

- **Prompts describe the full scene**, not the edit.
- For outpainting, leave prompt empty for natural extension.
- For inpainting replacement, use **I2V mode** with a composited first frame.
- Tune `dilation` in `LTXVLaplacianPyramidBlend` for boundary quality.
- Adjust `spatial_radius` in `LTXVDilateVideoMask` if mask is too tight.

---

## 6. Training (ltx-trainer)

### Prerequisites

- Linux + CUDA (triton dependency)
- 80GB GPU (recommended) or 32GB with low-VRAM config
- Model checkpoint + Gemma text encoder

### Quick Start

```bash
cd packages/ltx-trainer

# Preprocess dataset
uv run python scripts/process_dataset.py dataset.json \
  --resolution-buckets "960x544x49" \
  --model-path /path/to/ltx-2-model.safetensors \
  --text-encoder-path /path/to/gemma-model

# Train
uv run python scripts/train.py configs/t2v_lora.yaml
```

### Config Files

| Config | Mode |
|--------|------|
| `t2v_lora.yaml` | Text-to-video LoRA |
| `t2v_lora_low_vram.yaml` | ~32GB VRAM optimized |
| `v2v_ic_lora.yaml` | IC-LoRA video-to-video |
| `video_inpainting_lora.yaml` | Video inpainting |
| `video_outpainting_lora.yaml` | Video outpainting |
| `a2v_lora.yaml` | Audio-to-video |

---

## 7. FPS & Duration Reference

| Frames | Duration @24fps | Duration @25fps |
|--------|-----------------|-----------------|
| 65 | ~2.7s | ~2.6s |
| 97 | ~4.0s | ~3.9s |
| 121 | ~5.0s | ~4.8s |
| 161 | ~6.7s | ~6.4s |
| 257 | ~10.7s | ~10.3s |

---

## 8. Resources

- **GitHub repo:** https://github.com/Lightricks/LTX-2
- **Docs:** https://lightricks-preview-feature-add-outpaint-handler.docs.buildwithfern.com
- **HuggingFace models:** https://huggingface.co/Lightricks/LTX-2.3
- **Research paper:** https://arxiv.org/abs/2601.03233
- **ComfyUI nodes:** https://github.com/Lightricks/ComfyUI-LTXVideo
