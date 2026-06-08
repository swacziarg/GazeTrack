from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.health import router as health_router
from app.api.router import api_router
from app.core.config import settings
from app.db import initialize_database


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
