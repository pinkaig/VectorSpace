import os
from pathlib import Path

import pytest
import yaml
from apps.api.app.main import API_PREFIX, app

SPEC_PATH = Path(__file__).resolve().parents[1] / "openapi.yaml"


def test_every_route_but_the_probe_is_under_the_version_prefix() -> None:
    paths = app.openapi()["paths"]
    assert [path for path in paths if not path.startswith(f"{API_PREFIX}/")] == ["/health"]


@pytest.mark.skipif(os.environ.get("VS_RECORD_EXAMPLES") == "1", reason="recording new examples changes the spec; re-export after")
def test_the_committed_spec_matches_the_code() -> None:
    # the same rendering as scripts/export_openapi.py; rerun that script when this fails
    spec = yaml.safe_dump(app.openapi(), sort_keys=False, allow_unicode=True, width=100)
    assert SPEC_PATH.read_text(encoding="utf-8") == spec, "openapi.yaml is out of date: run python scripts/export_openapi.py"


def test_every_endpoint_has_an_example_response() -> None:
    # rubric E2: one example request and response per endpoint. A new route without a test that
    # calls it successfully has no example; add the test, then re-record (tests/record_examples.py)
    missing = []
    for path, operations in app.openapi()["paths"].items():
        for method, operation in operations.items():
            replies = operation["responses"].values()
            has_body_example = any("example" in media for reply in replies for media in reply.get("content", {}).values())
            only_no_content = set(operation["responses"]) <= {"204", "422"}
            if not (has_body_example or only_no_content):
                missing.append(f"{method.upper()} {path}")
            body = operation.get("requestBody", {}).get("content", {}).get("application/json")
            if body is not None and "example" not in body:
                missing.append(f"{method.upper()} {path} (request body)")
    assert missing == []
