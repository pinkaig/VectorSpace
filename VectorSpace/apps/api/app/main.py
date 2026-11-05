"""FastAPI application entry point.

The API behind the multi-user platform: who is signed in (/me), classes, projects and their
saved revisions, and the admin area's schools and accounts (/admin). Every route is under
/api/v1 (API_PREFIX); only /health is also served bare, for Render and the Docker HEALTHCHECK. The M1 editor does not
need it and still runs on localStorage alone; the browser
app only calls it when VITE_API_URL is set. Delete and activate/publish are not built yet and
return HTTP 501. The /health route and the request-id middleware are tested.

Documentation: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki
"""

import json
import logging
import time
from http import HTTPStatus
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .config import get_settings
from .routers import (
    admin,
    analytics,
    classes,
    library,
    me,
    media,
    projects,
    publish,
    rules,
    showcase,
    submissions,
    visit,
)

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

# The one version prefix. Adding a field is a v1 change (API_CHANGELOG.md); renaming or removing
# one means a second router under /api/v2 next to this one, not an edit here.
API_PREFIX = "/api/v1"
v1 = APIRouter(prefix=API_PREFIX)

for router in (
    me.router,
    admin.router,
    classes.router,
    projects.router,
    media.router,
    library.router,
    publish.router,
    analytics.router,
    analytics.results_router,
    rules.router,
    showcase.router,
    submissions.router,
    visit.router,
):
    v1.include_router(router)


def health() -> dict[str, str]:
    return {"status": "ok", "service": "vectorspace-api"}


# versioned for clients; bare for the infrastructure probes (render.yaml healthCheckPath, the
# Dockerfile HEALTHCHECK), which should not move when the API version does
v1.add_api_route("/health", health, methods=["GET"])
app.add_api_route("/health", health, methods=["GET"])
app.include_router(v1)


# One real request and response per endpoint, recorded from the test suite by
# tests/record_examples.py, so the spec's examples are what the API actually answers.
EXAMPLES_PATH = Path(__file__).with_name("openapi_examples.json")


def _with_examples(spec: dict, examples: dict) -> dict:
    for path, operations in spec["paths"].items():
        for method, operation in operations.items():
            example = examples.get(f"{method.upper()} {path}")
            if example is None:
                continue
            # the request: a value for every path and query parameter it used, and its JSON body
            values = {**example["path_params"], **example["query"]}
            for parameter in operation.get("parameters", []):
                if parameter["name"] in values:
                    parameter["example"] = values[parameter["name"]]
            body = operation.get("requestBody", {}).get("content", {}).get("application/json")
            if body is not None and example["request"] is not None:
                body["example"] = example["request"]
            # the response, under the status code it came back with. A route may answer a code its
            # decorator does not declare (a 201 set on the Response, a 501 from an unbuilt
            # handler), so that code gets its own entry rather than losing its example.
            if example["response"] is not None:
                reply = operation["responses"].setdefault(str(example["status"]), {"description": HTTPStatus(example["status"]).phrase})
                reply.setdefault("content", {}).setdefault("application/json", {})["example"] = example["response"]
    return spec


def openapi() -> dict:
    if app.openapi_schema is None:
        spec = FastAPI.openapi(app)
        examples = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8")) if EXAMPLES_PATH.exists() else {}
        app.openapi_schema = _with_examples(spec, examples)
    return app.openapi_schema


app.openapi = openapi