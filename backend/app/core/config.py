from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "GazeTrack"
    app_version: str = "0.1.0"
    app_status: str = "placeholder"
    api_prefix: str = "/api/v1"


settings = Settings()
