"""
Exports TinyCLIP's image tower to ONNX so the service can run without PyTorch (it fits Render's free
512 MB that way). Runs in the Docker build stage, or locally:

    pip install -r requirements-export.txt && python export_onnx.py
"""
import os
from pathlib import Path

import torch
from transformers import CLIPModel

MODEL_NAME = os.environ.get("TINYCLIP_MODEL", "wkcn/TinyCLIP-ViT-39M-16-Text-19M-YFCC15M")
OUT = Path(os.environ.get("TINYCLIP_ONNX", "model/tinyclip-vision.onnx"))


class ImageEncoder(torch.nn.Module):
    """Pixels in, L2-normalized image embedding out: exactly what the index stores."""

    def __init__(self, clip: CLIPModel):
        super().__init__()
        self.vision = clip.vision_model
        self.projection = clip.visual_projection

    def forward(self, pixel_values):
        pooled = self.vision(pixel_values=pixel_values).pooler_output
        return torch.nn.functional.normalize(self.projection(pooled), dim=-1)


def main():
    clip = CLIPModel.from_pretrained(MODEL_NAME).eval()
    size = clip.config.vision_config.image_size
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with torch.inference_mode():
        torch.onnx.export(
            ImageEncoder(clip),
            (torch.zeros(1, 3, size, size),),
            str(OUT),
            input_names=["pixel_values"],
            output_names=["embedding"],
            dynamic_axes={"pixel_values": {0: "batch"}, "embedding": {0: "batch"}},
            opset_version=17,
            dynamo=False,
        )
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
