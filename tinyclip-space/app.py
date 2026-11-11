"""
TinyCLIP photo search API for Lendr.

POST /search          app → photo in, closest listings out. Needs the user's Supabase access token.
POST /index/{id}      database trigger → (re)embed one listing's photos. Needs x-index-secret.
GET  /health          warm-up / uptime check.
"""
import base64
import binascii
import hmac
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import TinyClip
from store import index_listing, supabase_admin

MAX_IMAGE_BYTES = 4 * 1024 * 1024
state: dict = {}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    state["clip"] = TinyClip()
    state["db"] = supabase_admin()
    state["http"] = httpx.Client()
    yield
    state["http"].close()


app = FastAPI(title="Lendr TinyCLIP", lifespan=lifespan)
# The app authenticates with a bearer token, not cookies, so any origin is fine (Expo web dev server too).
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class SearchRequest(BaseModel):
    image_base64: str = Field(max_length=MAX_IMAGE_BYTES * 4 // 3 + 4)
    count: int = Field(default=30, ge=1, le=100)


class Match(BaseModel):
    listingId: str
    similarity: float


def signed_in_user(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in to search by photo.")
    try:
        user = state["db"].auth.get_user(authorization.split(" ", 1)[1]).user
    except Exception:
        user = None
    if not user:
        raise HTTPException(401, "Sign in to search by photo.")
    return user.id


@app.get("/health")
def health():
    return {"ok": True, "model": state["clip"].name}


@app.post("/search", response_model=list[Match])
async def search(body: SearchRequest, _user_id: str = Depends(signed_in_user)):
    try:
        data = base64.b64decode(body.image_base64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "That photo couldn't be read.")
    try:
        embedding = await run_in_threadpool(state["clip"].embed_bytes, data)
    except Exception:
        raise HTTPException(400, "That photo couldn't be read.")
    rows = (
        state["db"]
        .rpc("match_listing_photos", {"query_embedding": embedding, "match_count": body.count})
        .execute()
        .data
    )
    return [Match(listingId=row["listing_id"], similarity=row["similarity"]) for row in rows]


@app.post("/index/{listing_id}")
async def index(listing_id: str, x_index_secret: str | None = Header(default=None)):
    expected = os.environ.get("INDEX_SECRET", "")
    if not expected or not x_index_secret or not hmac.compare_digest(x_index_secret, expected):
        raise HTTPException(403, "Not allowed.")
    return await run_in_threadpool(index_listing, state["db"], state["clip"], listing_id, state["http"])
