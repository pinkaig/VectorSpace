"""What media the API accepts: the upload allowlist and the external-link parser.

MEDIA_KIND_SPECS must match packages/assets/src/mediaKinds.ts for every kind this API
uploads. A mismatch is a security bug, so tests/test_media_policy.py reads both lists and
fails if they drift. Adding a content type or a link host is a security decision: write it
down in the PR. image/svg+xml stays out because SVG can carry script.

Only image and video are uploaded here. Audio has its own library and text is inline project
data, so neither goes through this API.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

MEDIA_KIND_SPECS: dict[str, dict[str, object]] = {
    "image": {"content_types": ("image/png", "image/jpeg", "image/webp"), "max_bytes": 10_000_000},
    "video": {"content_types": ("video/mp4", "video/webm"), "max_bytes": 200_000_000},
}

# a YouTube video id is exactly 11 of these characters
_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_YOUTUBE_WATCH_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com"}
_YOUTUBE_SHORT_HOSTS = {"youtu.be"}
MAX_LINK_LENGTH = 500


@dataclass(frozen=True)
class ParsedLink:
    provider: str
    provider_id: str
    kind: str

    @property
    def canonical_url(self) -> str:
        """Rebuilt from the id, never the pasted text, so nothing extra can ride along."""
        return f"https://www.youtube.com/watch?v={self.provider_id}"


class LinkError(ValueError):
    """The link is not one we play. The message is safe to show the teacher."""


def parse_media_link(url: str) -> ParsedLink:
    """Turn a pasted link into (provider, id). Allowed: YouTube watch, youtu.be, embed and shorts links over https."""
    if not isinstance(url, str) or not url.strip() or len(url) > MAX_LINK_LENGTH:
        raise LinkError("Paste a link to a YouTube video")
    try:
        parts = urlsplit(url.strip())
    except ValueError as error:
        raise LinkError("That is not a valid link") from error
    if parts.scheme != "https":
        raise LinkError("Only https links can be added")
    # a username/password or port in the link is never needed and hides the real host
    if parts.username or parts.password or parts.port is not None:
        raise LinkError("That is not a valid link")
    host = (parts.hostname or "").lower()
    segments = [segment for segment in parts.path.split("/") if segment]

    video_id: str | None = None
    if host in _YOUTUBE_SHORT_HOSTS and len(segments) == 1:
        video_id = segments[0]
    elif host in _YOUTUBE_WATCH_HOSTS:
        if segments == ["watch"]:
            values = parse_qs(parts.query).get("v", [])
            video_id = values[0] if len(values) == 1 else None
        elif len(segments) == 2 and segments[0] in ("embed", "shorts"):
            video_id = segments[1]
    else:
        raise LinkError("Only YouTube links can be added for now")

    if video_id is None or not _YOUTUBE_ID.match(video_id):
        raise LinkError("That YouTube link does not point at a video")
    return ParsedLink(provider="youtube", provider_id=video_id, kind="video")
