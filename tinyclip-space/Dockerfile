# Lendr photo search (TinyCLIP). Runs on Render's free tier (512 MB) or any container host.

# Stage 1: export TinyCLIP's image tower to ONNX. PyTorch only lives here, not in the final image.
FROM python:3.12-slim AS export
WORKDIR /build
COPY requirements-export.txt .
RUN pip install --no-cache-dir -r requirements-export.txt
COPY export_onnx.py .
RUN python export_onnx.py

# Stage 2: the service. onnxruntime + numpy, ~300 MB in use.
FROM python:3.12-slim
RUN useradd -m -u 1000 app
WORKDIR /home/app/service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=export /build/model/tinyclip-vision.onnx model/tinyclip-vision.onnx
COPY *.py ./
USER app
ENV PYTHONUNBUFFERED=1
# Render sets PORT; 7860 elsewhere.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860}"]
