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

    # Any S3-compatible bucket. The defaults are the local docker-compose MinIO's, so a checkout
    # with no .env still works; a deployment points these at R2, B2 or S3 instead.
    s3_access_key_id: str = "vectorspace_minio"
    s3_secret_access_key: str = "vectorspace_minio_local"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_bucket: str = "vectorspace-media"
    # Optional second, public-read bucket for library/ keys. R2 can only make a whole bucket
    # public (r2.dev), so with no custom domain the library lives apart from private media.
    # Empty keeps library/ in s3_bucket (local MinIO, or one bucket behind a WAF rule).
    s3_library_bucket: str = ""
    # Where library/ objects are served from: the library bucket's r2.dev URL or a custom domain.
    # Empty until that is set up; storage.public_url() refuses to guess an address.
    s3_public_base_url: str = ""

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
