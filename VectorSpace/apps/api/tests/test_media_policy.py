"""The upload allowlist must match the client's, and the link parser must refuse anything unexpected."""

import json
import re
from pathlib import Path

import pytest

from apps.api.app.media_policy import LIBRARY_KIND_SPECS, MEDIA_KIND_SPECS, LinkError, parse_media_link

CLIENT_TABLE = Path(__file__).resolve().parents[3] / "packages" / "assets" / "src" / "mediaKinds.ts"


def client_spec(kind: str) -> tuple[set[str], int]:
    """Reads one kind's contentTypes and maxBytes out of mediaKinds.ts."""
    source = CLIENT_TABLE.read_text(encoding="utf-8")
    block = re.search(rf"\n  {kind}: \{{(.*?)\n  \}}", source, re.S)
    assert block, f"{kind} not found in mediaKinds.ts"
    types = set(re.findall(r"'([^']+)'", re.search(r"contentTypes: \[(.*?)\]", block.group(1), re.S).group(1)))
    max_bytes = int(re.search(r"maxBytes: ([\d_]+)", block.group(1)).group(1).replace("_", ""))
    return types, max_bytes


@pytest.mark.parametrize("kind", sorted(MEDIA_KIND_SPECS))
def test_backend_allowlist_matches_the_client(kind) -> None:
    types, max_bytes = client_spec(kind)
    assert set(MEDIA_KIND_SPECS[kind]["content_types"]) == types
    assert MEDIA_KIND_SPECS[kind]["max_bytes"] == max_bytes


def test_svg_is_never_allowed() -> None:
    assert all("image/svg+xml" not in spec["content_types"] for spec in LIBRARY_KIND_SPECS.values())


def library_model_spec(kind: str) -> tuple[set[str], int]:
    """Reads one kind out of LIBRARY_MODEL_KIND_SPECS in mediaKinds.ts."""
    source = CLIENT_TABLE.read_text(encoding="utf-8")
    table = re.search(r"LIBRARY_MODEL_KIND_SPECS = \{(.*?)\n\} as const", source, re.S)
    assert table, "LIBRARY_MODEL_KIND_SPECS not found in mediaKinds.ts"
    row = re.search(rf"{kind}: \{{(.*?)\}}", table.group(1), re.S)
    assert row, f"{kind} not found in LIBRARY_MODEL_KIND_SPECS"
    types = set(re.findall(r"'([^']+)'", re.search(r"contentTypes: \[(.*?)\]", row.group(1), re.S).group(1)))
    return types, int(re.search(r"maxBytes: ([\d_]+)", row.group(1)).group(1).replace("_", ""))


@pytest.mark.parametrize("kind", ["model", "environment"])
def test_library_model_kinds_match_the_client(kind) -> None:
    types, max_bytes = library_model_spec(kind)
    assert set(LIBRARY_KIND_SPECS[kind]["content_types"]) == types
    assert LIBRARY_KIND_SPECS[kind]["max_bytes"] == max_bytes


def test_library_models_are_glb_only() -> None:
    """A .gltf fetches sibling files by relative path, which in a shared bucket is an uncontrolled fetch."""
    for kind in ("model", "environment"):
        assert LIBRARY_KIND_SPECS[kind]["content_types"] == ("model/gltf-binary",)
    assert all("gltf+json" not in t for spec in LIBRARY_KIND_SPECS.values() for t in spec["content_types"])


def test_library_keeps_everything_project_media_allows() -> None:
    for kind, spec in MEDIA_KIND_SPECS.items():
        assert LIBRARY_KIND_SPECS[kind] == spec


# the same list the browser's parser is tested against, so the two can never disagree
LINK_CASES = json.loads((Path(__file__).resolve().parents[3] / "packages" / "assets" / "src" / "mediaLinkCases.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("url", LINK_CASES["accept"])
def test_youtube_links_parse_to_the_same_id(url) -> None:
    parsed = parse_media_link(url)
    assert (parsed.provider, parsed.provider_id, parsed.kind) == ("youtube", "dQw4w9WgXcQ", "video")
    assert parsed.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


@pytest.mark.parametrize("url", LINK_CASES["reject"])
def test_hostile_or_unsupported_links_are_refused(url) -> None:
    with pytest.raises(LinkError):
        parse_media_link(url)
