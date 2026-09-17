# Learning: Docker & the Local Dev Environment

**Category:** Learning notes (concept explainer, not a spec or plan)
**Related:** [environment-setup.md](UNDATED--CURRENT--environment-setup.md), `docker-compose.yml`, `apps/api/app/config.py`, `apps/api/app/db.py`

---

## What this is for

`docker-compose.yml` gives the API two backing services locally, without installing anything
on your machine directly:

| Service | Image | Role |
|---|---|---|
| `postgres` | `postgres:16` | Relational database (projects, media metadata, users — tables land in Stage 2) |
| `minio` | `quay.io/minio/minio:latest` | S3-compatible object store; stand-in for AWS S3 in production, used for uploaded media via presigned URLs (Stage 3) |

Both declare **health checks** (so dependents know when they're actually ready, not just
"container started") and **named volumes** (`vthere_postgres_data`, `vthere_minio_data`) so
data survives restarts.

> Note: Docker Hub's `minio/minio` image is delisted. MinIO now distributes via
> `quay.io/minio/minio`, which is what this compose file uses.

---

## The mechanism

```
docker-compose.yml
├── postgres service
│     env: POSTGRES_DB/USER/PASSWORD   ← from .env, via ${VAR:-default}
│     healthcheck: pg_isready
│     volume: vthere_postgres_data → /var/lib/postgresql/data
│
└── minio service
      command: server /data --console-address ":9001"
      env: MINIO_ROOT_USER/PASSWORD
      healthcheck: mc ready local
      volume: vthere_minio_data → /data
```

The FastAPI app never talks to Compose directly. It reads connection info from environment
variables, which flow through the stack like this:

```
.env  →  Settings (pydantic-settings, config.py)  →  SQLAlchemy engine (db.py)  →  routes, via get_db()
```

- `.env.example` documents every variable the stack reads — copy it to `.env` for local use
  (already git-ignored).
- `config.py`'s `Settings.sqlalchemy_database_url` prefers an explicit `DATABASE_URL` if set,
  otherwise builds one from the individual `POSTGRES_*` fields.

---

## Everyday commands

```bash
docker compose up -d       # start postgres + minio in the background
docker compose ps          # check health status
docker compose down        # stop and remove containers (volumes persist)
docker compose config      # validate the compose file without starting anything
```

Once the containers are healthy, run migrations from `apps/api/`:

```bash
python -m alembic upgrade head
```

---

## How to customize it

**Add a new service** (redis, another API, a worker) — add a block to `docker-compose.yml`:

```yaml
  redis:
    image: redis:7
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
```

**Change credentials, ports, or the database name** — edit `.env` (never `.env.example`,
that's the template) and/or the `${VAR:-default}` fallbacks in `docker-compose.yml`.

**Add a variable the app should read** — add it to `.env.example` for documentation, then add
a matching field on `Settings` in `config.py`.

**Run the API itself inside Compose** (today it runs locally via `uvicorn`, not containerized)
— add an `api` service:

```yaml
  api:
    build: ./apps/api
    env_file: .env
    ports:
      - "127.0.0.1:8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
```

**Point the API at a different database or bucket** — override `DATABASE_URL` / `MINIO_*` in
`.env`; no code changes needed.

---

## Gotchas encountered

- `minio/minio` on Docker Hub returns `pull access denied` — it's delisted. Use
  `quay.io/minio/minio` instead.
- Docker Desktop must actually be running (the daemon), not just installed, before
  `docker compose up` will work — `docker info` is a quick way to check.
