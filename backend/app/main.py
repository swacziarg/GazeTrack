from contextlib import asynccontextmanager
import mimetypes
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from app.api.health import router as health_router
from app.api.router import api_router
from app.core.config import settings
from app.db import initialize_database

WEBGAZER_MEDIAPIPE_BASE_URL = "https://webgazer.cs.brown.edu/mediapipe"


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ = app
    initialize_database(settings.database_url)
    yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)
app.include_router(health_router)
app.include_router(api_router)


@app.get("/gazetrack-capture.js", include_in_schema=False)
def capture_script() -> FileResponse:
    script_path = Path(__file__).resolve().parents[2] / "frontend" / "public" / "gazetrack-capture.js"
    return FileResponse(script_path, media_type="application/javascript")


@app.get("/webgazer-mediapipe/{asset_path:path}", include_in_schema=False)
def webgazer_mediapipe_asset(asset_path: str) -> Response:
    if (
        not asset_path
        or not asset_path.startswith("face_mesh/")
        or any(part in {"", ".", ".."} for part in asset_path.split("/"))
    ):
        raise HTTPException(status_code=404, detail="WebGazer asset not found")

    asset_url = f"{WEBGAZER_MEDIAPIPE_BASE_URL}/{asset_path}"
    try:
        upstream = httpx.get(asset_url, timeout=10.0, follow_redirects=True)
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="WebGazer asset proxy failed") from error

    if upstream.status_code == 404:
        raise HTTPException(status_code=404, detail="WebGazer asset not found")
    if upstream.status_code >= 400:
        raise HTTPException(status_code=502, detail="WebGazer asset proxy failed")

    media_type = upstream.headers.get("content-type") or mimetypes.guess_type(asset_path)[0] or "application/octet-stream"
    return Response(
        content=upstream.content,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
