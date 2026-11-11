# Lendr photo search (TinyCLIP)

Embeds listing photos with [TinyCLIP](https://huggingface.co/wkcn/TinyCLIP-ViT-39M-16-Text-19M-YFCC15M) and
finds the listings closest to a photo someone takes in the app. Setup steps are in the main README,
"Photo search". Deployed on Render from `../render.yaml`.

| | |
|---|---|
| `POST /search` | `{ "image_base64": "...", "count": 30 }` with `Authorization: Bearer <Supabase access token>` → `[{ listingId, similarity }]` |
| `POST /index/{listingId}` | Called by the database trigger, with `x-index-secret`. Embeds new photos, drops removed ones. |
| `GET /health` | Warm-up check. |

The model runs as ONNX with onnxruntime (no PyTorch), so it fits in Render's free 512 MB:
`export_onnx.py` exports TinyCLIP's image tower in the Docker build's first stage. Its embeddings match
transformers' `CLIPModel` exactly.

Environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INDEX_SECRET` (see `.env.example`).
