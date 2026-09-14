from functools import lru_cache
import os

from pydantic import BaseModel, Field


class Settings(BaseModel):
    app_env: str = Field(default="local", alias="APP_ENV")
    cors_origins: list[str] = Field(default=["http://localhost:5173"], alias="CORS_ORIGINS")
    max_request_bytes: int = 1024 * 1024
    max_sites: int = 32
    max_chargers_per_site: int = 64
    max_fleet_size: int = 10_000
    simulation_timeout_seconds: float = 10.0
    max_concurrent_simulations: int = 1

    @classmethod
    def from_environment(cls) -> "Settings":
        origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
        return cls(CORS_ORIGINS=[origin.strip() for origin in origins.split(",") if origin.strip()])


@lru_cache
def get_settings() -> "Settings":
    return Settings.from_environment()
