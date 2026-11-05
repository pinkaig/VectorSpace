"""Harvest one real request and response per endpoint from the test suite, for the OpenAPI examples.

Hand-written examples drift: someone renames a field and the example keeps the old one. These are
copied from what the API actually answered while the tests ran, so they match the code on the day
they were recorded. Recording is opt-in, because the IDs in a test run are random and the committed
file must not change on every run:

    VS_RECORD_EXAMPLES=1 python -m pytest apps/api/tests -q     (from VectorSpace/)
    cd apps/api && python scripts/export_openapi.py             (then re-export the spec)

The file it writes, app/openapi_examples.json, is read by app/main.py when it builds the spec.
The first successful (2xx) exchange per "METHOD /route/{template}" wins; tests run in a fixed order,
so the same test supplies the same endpoint each time. A route that is not built yet never answers
2xx, so its 501 is recorded instead, until a 2xx replaces it. Headers are never recorded, so no token is.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

from fastapi.testclient import TestClient
from starlette.routing import Match

EXAMPLES_PATH = Path(__file__).resolve().parents[1] / "app" / "openapi_examples.json"
# a list in an example only needs to show the shape: two items say "this is a list of these"
LIST_LIMIT = 2
# presigned storage URLs carry a signature and the access key id in their query string
SIGNED_QUERY = re.compile(r"\?[^\"]*X-Amz-Signature=[^\"]*")


def _trim(value):
    if isinstance(value, list):
        return [_trim(item) for item in value[:LIST_LIMIT]]
    if isinstance(value, dict):
        return {key: _trim(item) for key, item in value.items()}
    if isinstance(value, str):
        return SIGNED_QUERY.sub("?X-Amz-Signature=...", value)
    return value


def _route_for(app, method: str, path: str):
    scope = {"type": "http", "path": path, "method": method}
    for route in app.routes:
        match, child = route.matches(scope)
        if match == Match.FULL:
            return route.path_format, child.get("path_params", {})
    return None, {}


class Recorder:
    def __init__(self) -> None:
        self.examples: dict[str, dict] = {}
        self._original = TestClient.request

    def start(self) -> None:
        recorder = self

        def request(client: TestClient, method: str, url, *args, **kwargs):
            response = recorder._original(client, method, url, *args, **kwargs)
            recorder.record(client, response)
            return response

        TestClient.request = request

    def stop(self) -> None:
        TestClient.request = self._original

    def record(self, client: TestClient, response) -> None:
        ok = 200 <= response.status_code < 300
        if not ok and response.status_code != 501:
            return
        method = response.request.method
        parts = urlsplit(str(response.request.url))
        template, path_params = _route_for(client.app, method, parts.path)
        key = f"{method} {template}"
        if template is None:
            return
        held = self.examples.get(key)
        if held is not None and (held["status"] != 501 or not ok):
            return
        body = response.request.content
        try:
            reply = response.json() if response.content else None
        except ValueError:
            return  # not JSON, so not something the spec can show as an example
        self.examples[key] = {
            "path_params": {name: str(value) for name, value in path_params.items()},
            "query": dict(parse_qsl(parts.query)),
            "request": _trim(json.loads(body)) if body else None,
            "status": response.status_code,
            "response": _trim(reply),
        }

    def write(self) -> None:
        # merge, so an endpoint the tests stop covering keeps its last example until someone notices
        existing = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8")) if EXAMPLES_PATH.exists() else {}
        existing.update(self.examples)
        EXAMPLES_PATH.write_text(json.dumps(dict(sorted(existing.items())), indent=2) + "\n", encoding="utf-8", newline="\n")
