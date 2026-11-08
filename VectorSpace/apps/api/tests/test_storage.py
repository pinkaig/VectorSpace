"""storage.public_url: the address of a public-prefix object, or a loud error when none is configured."""

import pytest
from apps.api.app import storage
from apps.api.app.config import Settings


def use_base(monkeypatch, base: str) -> None:
    monkeypatch.setattr(storage, "get_settings", lambda: Settings(s3_public_base_url=base))


def test_public_url_joins_base_and_key(monkeypatch) -> None:
    use_base(monkeypatch, "https://assets.example.com")
    assert storage.public_url("library/abc/Pedestal.glb") == "https://assets.example.com/library/abc/Pedestal.glb"


def test_public_url_tolerates_a_trailing_slash(monkeypatch) -> None:
    use_base(monkeypatch, "https://assets.example.com/")
    assert storage.public_url("library/abc/a.png") == "https://assets.example.com/library/abc/a.png"


def test_public_url_without_a_base_is_a_configuration_error(monkeypatch) -> None:
    use_base(monkeypatch, "")
    with pytest.raises(RuntimeError, match="S3_PUBLIC_BASE_URL"):
        storage.public_url("library/abc/a.png")


def test_library_keys_go_to_the_library_bucket_when_one_is_set(monkeypatch) -> None:
    monkeypatch.setattr(storage, "get_settings", lambda: Settings(s3_bucket="media", s3_library_bucket="library-pub"))
    assert storage.bucket_for("library/abc/a.png") == "library-pub"
    assert storage.bucket_for("projects/1/a.png") == "media"


def test_without_a_library_bucket_everything_stays_in_one_bucket(monkeypatch) -> None:
    monkeypatch.setattr(storage, "get_settings", lambda: Settings(s3_bucket="media", s3_library_bucket=""))
    assert storage.bucket_for("library/abc/a.png") == "media"
