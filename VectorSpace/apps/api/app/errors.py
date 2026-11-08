"""The one shape every API failure is reported in.

Every error reply is JSON with the same fields, so the browser, Postman and a person reading logs
all look in the same place:

    detail      what went wrong, in words for a person (an object only for a save conflict, whose
                current_revision the editor reads)
    code        a short stable name for the kind of failure, for code to branch on
    apiVersion  "v1"
    source      "vectorspace-api"
    timestamp   when the API answered, UTC
    requestId   the same id as the x-request-id header, to quote when asking for help
    fields      only for bad input: [{field, message}], one per thing to fix

`detail` stays where FastAPI puts it, so nothing that already reads it breaks.
"""

import logging
from datetime import UTC, datetime
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request

logger = logging.getLogger("vectorspace.api")

API_VERSION = "v1"
SOURCE = "vectorspace-api"

CODES = {
    400: "bad_request",
    401: "unauthorised",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "too_large",
    422: "invalid_request",
    429: "rate_limited",
    500: "server_error",
    501: "not_built",
    502: "upstream_unavailable",
    503: "unavailable",
}

CRASH_MESSAGE = "Something went wrong on our side. Please try again; if it keeps happening, quote the request id."


def envelope(status: int, detail: Any, request_id: str, fields: list[dict[str, str]] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "detail": detail,
        "code": CODES.get(status, "server_error" if status >= 500 else "bad_request"),
        "apiVersion": API_VERSION,
        "source": SOURCE,
        "timestamp": datetime.now(UTC).isoformat(),
        "requestId": request_id,
    }
    if fields is not None:
        body["fields"] = fields
    return body


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "") or request.headers.get("x-request-id", "")


def _reply(request: Request, status: int, body: dict[str, Any], headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(body, status_code=status, headers={**(headers or {}), "x-request-id": body["requestId"]})


def _field_name(location: tuple) -> str:
    # ("body", "name") -> "name"; ("query", "limit") -> "limit"; ("body",) -> "body"
    parts = [str(part) for part in location if part not in ("body", "query", "path", "header")]
    return ".".join(parts) or str(location[-1] if location else "body")


def _plain_message(error: dict) -> str:
    kind = error.get("type", "")
    ctx = error.get("ctx", {})
    if kind == "missing":
        return "is required"
    if kind in ("string_too_short", "too_short"):
        return f"must have at least {ctx.get('min_length')} character(s)" if kind == "string_too_short" else f"needs at least {ctx.get('min_length')} item(s)"
    if kind in ("string_too_long", "too_long"):
        return f"must be at most {ctx.get('max_length')} {'characters' if kind == 'string_too_long' else 'items'}"
    if kind.endswith(("_type", "_parsing")):
        return "is not the right kind of value"
    return error.get("msg", "is not valid")


async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    body = envelope(exc.status_code, exc.detail, _request_id(request))
    return _reply(request, exc.status_code, body, getattr(exc, "headers", None))


async def _invalid_request(request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [{"field": _field_name(tuple(e["loc"])), "message": _plain_message(e)} for e in exc.errors()]
    sentence = "; ".join(f"{f['field']} {f['message']}" for f in fields) or "The request is not valid"
    return _reply(request, 422, envelope(422, sentence[0].upper() + sentence[1:], _request_id(request), fields))


async def _crash(request: Request, exc: Exception) -> JSONResponse:
    request_id = _request_id(request)
    logger.error("request_failed request_id=%s method=%s path=%s", request_id, request.method, request.url.path, exc_info=exc)
    return _reply(request, 500, envelope(500, CRASH_MESSAGE, request_id))


def install(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _invalid_request)
    app.add_exception_handler(Exception, _crash)


# ---- the OpenAPI side -------------------------------------------------------------------------

_SAMPLES = {
    "401": (401, "Not signed in: send an Authorization: Bearer <token> header"),
    "403": (403, "You are not allowed to do that"),
    "404": (404, "Not found"),
    "413": (413, "The request is too large to send. Shorten it and try again."),
    "422": (422, "Name must be at most 200 characters"),
    "500": (500, CRASH_MESSAGE),
}


def document_errors(spec: dict) -> dict:
    """Adds the ErrorResponse schema and the standard failures to every operation in the spec.

    A response a route already declares or was recorded with is left alone; FastAPI's own 422
    (a list in detail) is replaced, because this API no longer answers that shape.
    """
    spec["components"]["schemas"].pop("HTTPValidationError", None)
    spec["components"]["schemas"].pop("ValidationError", None)
    spec["components"]["schemas"]["ErrorResponse"] = {
        "type": "object",
        "required": ["detail", "code", "apiVersion", "source", "timestamp", "requestId"],
        "properties": {
            "detail": {"description": "What went wrong, for a person. An object only for a save conflict.", "anyOf": [{"type": "string"}, {"type": "object"}]},
            "code": {"type": "string", "description": "Stable name of the failure kind.", "enum": sorted(set(CODES.values()))},
            "apiVersion": {"type": "string", "example": API_VERSION},
            "source": {"type": "string", "example": SOURCE},
            "timestamp": {"type": "string", "format": "date-time"},
            "requestId": {"type": "string", "description": "Same as the x-request-id response header."},
            "fields": {
                "type": "array",
                "description": "Bad input only: one entry per thing to fix.",
                "items": {"type": "object", "required": ["field", "message"], "properties": {"field": {"type": "string"}, "message": {"type": "string"}}},
            },
        },
    }
    for operations in spec["paths"].values():
        for operation in operations.values():
            for status, (code, detail) in _SAMPLES.items():
                example = {**envelope(code, detail, "3f6c1f0e-0000-4000-8000-000000000000"), "timestamp": "2026-11-08T09:30:00+00:00"}
                if status == "422":
                    example["fields"] = [{"field": "name", "message": "must be at most 200 characters"}]
                reply = operation["responses"].setdefault(status, {"description": HTTPStatus(code).phrase})
                if status == "422":
                    reply["description"] = "The request is not valid"
                content = reply.setdefault("content", {}).setdefault("application/json", {})
                content["schema"] = {"$ref": "#/components/schemas/ErrorResponse"}
                content.setdefault("example", example)
    return spec
