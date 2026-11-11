"""
TinyCLIP image embeddings. Only the image tower is used: photos are compared with photos.

Runs the ONNX export of the model (see export_onnx.py) with onnxruntime, so the service needs no
PyTorch and fits in 512 MB. Produces the same embeddings as transformers' CLIPModel.
"""
import io
import os
import threading

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

MODEL_NAME = os.environ.get("TINYCLIP_MODEL", "wkcn/TinyCLIP-ViT-39M-16-Text-19M-YFCC15M")
ONNX_PATH = os.environ.get("TINYCLIP_ONNX", os.path.join(os.path.dirname(__file__), "model", "tinyclip-vision.onnx"))
# The model's projection size; must match vector(512) in the migration.
EMBEDDING_DIM = 512
# From the model's preprocessor_config.json.
IMAGE_SIZE = 224
MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32).reshape(3, 1, 1)
# Embeddings running at once. Each needs ~20 MB; the cap keeps a burst of searches inside 512 MB.
MAX_CONCURRENT = int(os.environ.get("TINYCLIP_MAX_CONCURRENT", "2"))


class TinyClip:
    def __init__(self, name: str = MODEL_NAME, onnx_path: str = ONNX_PATH):
        # `name` is stored with each embedding, so switching models re-indexes everything.
        self.name = name
        options = ort.SessionOptions()
        options.intra_op_num_threads = max(1, min(4, os.cpu_count() or 1))
        # Keep memory flat on a 512 MB instance: don't cache freed buffers or pre-plan big blocks.
        options.enable_mem_pattern = False
        options.enable_cpu_mem_arena = False
        self.session = ort.InferenceSession(onnx_path, options, providers=["CPUExecutionProvider"])
        self._slots = threading.BoundedSemaphore(MAX_CONCURRENT)
        width = self.session.get_outputs()[0].shape[-1]
        if width != EMBEDDING_DIM:
            raise RuntimeError(f"{onnx_path} makes {width}-d embeddings, expected {EMBEDDING_DIM}")

    @staticmethod
    def load_image(data: bytes) -> Image.Image:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
        # Pad to a square instead of center-cropping, so a tall photo of a dress keeps its top and
        # bottom. Listings and searches go through the same step.
        side = max(image.size)
        square = Image.new("RGB", (side, side), (255, 255, 255))
        square.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
        return square

    @staticmethod
    def pixels(image: Image.Image) -> np.ndarray:
        """CLIP preprocessing for a square image: bicubic resize, scale to 0-1, normalize, CHW."""
        resized = image.resize((IMAGE_SIZE, IMAGE_SIZE), Image.Resampling.BICUBIC)
        array = np.asarray(resized, dtype=np.float32).transpose(2, 0, 1) / 255.0
        return (array - MEAN) / STD

    def embed(self, images: list[Image.Image]) -> list[list[float]]:
        batch = np.stack([self.pixels(image) for image in images]).astype(np.float32)
        with self._slots:
            (embeddings,) = self.session.run(["embedding"], {"pixel_values": batch})
        return embeddings.tolist()

    def embed_bytes(self, data: bytes) -> list[float]:
        return self.embed([self.load_image(data)])[0]
