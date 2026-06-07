import os

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "GazeTrack"
    app_version: str = "0.1.0"
    app_status: str = "local_demo"
    api_prefix: str = "/api/v1"
    database_url: str = os.getenv(
        "GAZETRACK_DATABASE_URL",
        os.getenv("DATABASE_URL", "sqlite:///./gazetrack_demo.db"),
    )
    cors_allowed_origins: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "GAZETRACK_CORS_ALLOWED_ORIGINS",
            "http://localhost:5173,http://localhost:5174,http://localhost:5175,"
            "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175",
        ).split(",")
        if origin.strip()
    ]


settings = Settings()
