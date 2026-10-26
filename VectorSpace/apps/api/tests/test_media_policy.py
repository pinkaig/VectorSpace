"""The upload allowlist must match the client's, and the link parser must refuse anything unexpected."""

import re
from pathlib import Path

import pytest

from apps.api.app.media_policy import MEDIA_KIND_SPECS, LinkError, parse_media_link

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
    assert all("image/svg+xml" not in spec["content_types"] for spec in MEDIA_KIND_SPECS.values())


@pytest.mark.parametrize(
    "url",
    [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ?si=abc",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        "  https://YOUTU.BE/dQw4w9WgXcQ  ",
    ],
)
def test_youtube_links_parse_to_the_same_id(url) -> None:
    parsed = parse_media_link(url)
    assert (parsed.provider, parsed.provider_id, parsed.kind) == ("youtube", "dQw4w9WgXcQ", "video")
    assert parsed.canonical_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
        "https://evil.test/youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com@evil.test/watch?v=dQw4w9WgXcQ",
        "https://user@www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=short",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&v=aaaaaaaaaaa",
        "https://www.youtube.com/watch?v=dQw4w9WgXc%22",
        "https://www.youtube.com/channel/UC123",
        "https://youtu.be/",
        "https://youtu.be/dQw4w9WgXcQ/extra",
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        "",
        "https://youtu.be/" + "a" * 600,
    ],
)
def test_hostile_or_unsupported_links_are_refused(url) -> None:
    with pytest.raises(LinkError):
        parse_media_link(url)
