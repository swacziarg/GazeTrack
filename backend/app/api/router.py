from fastapi import APIRouter

from app.api import events, meta, sessions, studies

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(meta.router)
api_router.include_router(studies.router)
api_router.include_router(sessions.router)
api_router.include_router(events.router)
