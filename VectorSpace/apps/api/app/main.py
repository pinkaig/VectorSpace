"""FastAPI application entry point.

The API behind the multi-user platform: who is signed in (/me), classes, projects and their
saved revisions, and the admin area's schools and accounts (/admin). The M1 editor does not
need it and still runs on localStorage alone; the browser
app only calls it when VITE_API_URL is set. Delete and activate/publish are not built yet and
return HTTP 501. The /health route and the request-id middleware are tested.

Documentation: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki
"""

import logging
import time
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .config import get_settings
from .routers import admin, analytics, classes, me, media, projects, publish, rules, showcase, submissions


logger = logging.getLogger("vectorspace.api")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid4()))
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("request_failed request_id=%s method=%s path=%s", request_id, request.method, request.url.path)
            raise
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers["x-request-id"] = request_id
        logger.info(
            "request_completed request_id=%s method=%s path=%s status_code=%s duration_ms=%s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(title="VectorSpace API", version="0.1.0")
app.add_middleware(RequestLoggingMiddleware)
# the browser app is on another address (localhost:5173 in development), so it must be allowed in
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in get_settings().cors_origins.split(",") if origin.strip()],
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["x-request-id", "X-Total-Count"],
)

app.include_router(me.router)
app.include_router(admin.router)
app.include_router(classes.router)
app.include_router(projects.router)
app.include_router(media.router)
app.include_router(publish.router)
app.include_router(analytics.router)
app.include_router(rules.router)
app.include_router(showcase.router)
app.include_router(submissions.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vectorspace-api"}