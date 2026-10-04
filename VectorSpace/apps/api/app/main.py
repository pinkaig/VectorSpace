"""FastAPI application entry point.

NOT PART OF M1. The M1 deliverable is the frontend editor, which runs entirely
in the browser and saves to localStorage. This service is scaffolding for a
later milestone: the route handlers under app/routers/ return HTTP 501, and
nothing in the M1 build calls it. The /health route and the request-id
middleware below are real and tested; the business routes are not implemented.

Documentation: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki
"""

import logging
import time
from uuid import uuid4

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .routers import analytics, media, projects, publish, rules


logger = logging.getLogger("vthere.api")


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

app = FastAPI(title="VThere Spatial Experience Builder API", version="0.1.0")
app.add_middleware(RequestLoggingMiddleware)

app.include_router(projects.router)
app.include_router(media.router)
app.include_router(publish.router)
app.include_router(analytics.router)
app.include_router(rules.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vthere-api"}