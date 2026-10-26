"""App configuration, loaded from environment variables / .env."""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    cors_origins: str = "http://localhost:5173"

    postgres_db: str = "vectorspace"
    postgres_user: str = "vectorspace_app"
    postgres_password: str = "vectorspace_local"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    database_url: str | None = None

    minio_root_user: str = "vectorspace_minio"
    minio_root_password: str = "vectorspace_minio_local"
    minio_endpoint_url: str = "http://localhost:9000"
    minio_bucket: str = "vectorspace-media"

    auth0_domain: str = ""
    auth0_audience: str = ""
    # Machine-to-Machine app used only by the roster provisioning script (app/provision.py).
    auth0_mgmt_client_id: str = ""
    auth0_mgmt_client_secret: str = ""
    auth0_connection: str = "Username-Password-Authentication"
    # Local testing before an Auth0 tenant exists: accept a bearer value "dev|<name>" as that subject.
    # Refused outright outside local/test (see below), so it cannot be switched on in a deployment.
    auth_dev_bypass: bool = False

    @model_validator(mode="after")
    def _bypass_only_locally(self) -> "Settings":
        if self.auth_dev_bypass and self.app_env not in ("local", "test"):
            raise ValueError("AUTH_DEV_BYPASS may only be on when APP_ENV is local or test")
        return self

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url:
            # hosted Postgres (Neon, Render) hands out postgres:// or postgresql:// URLs, which
            # SQLAlchemy would read as psycopg2; this app ships psycopg 3
            for scheme in ("postgres://", "postgresql://"):
                if self.database_url.startswith(scheme):
                    return "postgresql+psycopg://" + self.database_url[len(scheme):]
            return self.database_url
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
