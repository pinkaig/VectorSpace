"""Start the API on 127.0.0.1:8000 against local Docker data, ready for the Postman collection.

apps/api/.env points at Neon and R2. This script overrides every setting that matters with environment
variables (they win over .env), so the run never touches the hosted database, the bucket or real Auth0:
local Postgres + MinIO, APP_ENV=test, AUTH_DEV_BYPASS=true, Auth0 values blank.

Steps: docker compose up postgres + minio, wait for Postgres, create the media bucket, alembic upgrade,
reseed the synthetic Demo School, then run uvicorn in the foreground (Ctrl+C stops it).

Run from VectorSpace/:  apps/api/.venv/Scripts/python apps/api/postman/run_local_api.py
Add --no-seed to keep the data from the last run, and --port 8001 when 8000 is taken (then point the
web app at it with VITE_API_URL=http://127.0.0.1:8001, and newman with --env-var baseUrl=...:8001).
"""

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = API_DIR.parents[1]  # VectorSpace/, where docker-compose.yml lives
PY = sys.executable

LOCAL_ENV = {
    "APP_ENV": "test",
    "AUTH_DEV_BYPASS": "true",
    "DATABASE_URL": "postgresql://vectorspace_app:vectorspace_local@localhost:5432/vectorspace",
    "S3_ENDPOINT_URL": "http://localhost:9000",
    "S3_ACCESS_KEY_ID": "vectorspace_minio",
    "S3_SECRET_ACCESS_KEY": "vectorspace_minio_local",
    "S3_BUCKET": "vectorspace-media",
    "S3_LIBRARY_BUCKET": "",
    "S3_PUBLIC_BASE_URL": "",
    "AUTH0_DOMAIN": "",
    "AUTH0_AUDIENCE": "",
    "AUTH0_MGMT_CLIENT_ID": "",
    "AUTH0_MGMT_CLIENT_SECRET": "",
    "CORS_ORIGINS": "http://localhost:5173",
}


def run(cmd: list[str], cwd: Path, env: dict[str, str]) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, env=env, check=True)


def wait_for_port(port: int, seconds: int = 60) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(1)
    sys.exit(f"Nothing is listening on port {port} after {seconds} s. Is Docker Desktop running?")


def main() -> None:
    args = sys.argv[1:]
    port = args[args.index("--port") + 1] if "--port" in args else "8000"
    env = {**os.environ, **LOCAL_ENV}
    run(["docker", "compose", "up", "-d", "--wait", "postgres", "minio"], REPO_DIR, env)
    wait_for_port(5432)
    wait_for_port(9000)
    run([PY, "postman/ensure_bucket.py"], API_DIR, env)
    run([PY, "-m", "alembic", "upgrade", "head"], API_DIR, env)
    if "--no-seed" not in args:
        run([PY, "-m", "app.seed", "--apply"], API_DIR, env)
    print(f"\nAPI on http://127.0.0.1:{port}  (docs: http://127.0.0.1:{port}/docs). Ctrl+C to stop.\n", flush=True)
    try:
        run([PY, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", port], API_DIR, env)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
