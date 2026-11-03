"""scripts/sync_library.py: a folder on this computer becomes the cloud library. Storage is faked."""

import hashlib
import json

import pytest

from apps.api.app import storage
from apps.api.app.config import Settings
from apps.api.scripts import sync_library

PUBLIC_BASE = "https://assets.test"
IMMUTABLE = "public, max-age=31536000, immutable"


class FakeBucket(dict):
    """Objects 'uploaded' by the script, keyed by storage key; .headers records what each PUT was sent."""

    def __init__(self) -> None:
        super().__init__()
        self.headers: dict[str, dict[str, str]] = {}
        self.fail_next = False

    def upload(self, url: str, headers: dict[str, str], data: bytes) -> None:
        if self.fail_next:
            self.fail_next = False
            raise sync_library.httpx.HTTPError("the bucket refused the upload")
        key = url.removeprefix("https://store.test/put/")
        self[key] = (len(data), headers["Content-Type"])
        self.headers[key] = headers


@pytest.fixture
def bucket(monkeypatch) -> FakeBucket:
    objects = FakeBucket()
    monkeypatch.setattr(storage, "generate_presigned_upload_url", lambda key, content_type, expires_in=900, cache_control=None: f"https://store.test/put/{key}")
    monkeypatch.setattr(storage, "head_object", lambda key: objects.get(key))
    monkeypatch.setattr(storage, "delete_object", lambda key: objects.pop(key, None))
    monkeypatch.setattr(storage, "get_settings", lambda: Settings(s3_public_base_url=PUBLIC_BASE))
    return objects


@pytest.fixture
def admin(client, school):
    client.headers["Authorization"] = "Bearer admin"
    return client


@pytest.fixture
def folder(tmp_path):
    """A control copy: two props, a room, an image, and four files the script must not upload."""
    for relative, content in {
        "models/Pedestal.glb": b"glTF pedestal", "models/arrow.glb": b"glTF arrow",
        "environments/museum.glb": b"glTF museum", "images/poster.png": b"png poster",
        "models/scene.gltf": b"{}", "notes.txt": b"hello", "loose.glb": b"glTF loose", "images/room.glb": b"glTF wrong place",
    }.items():
        path = tmp_path / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    return tmp_path


def run(client, folder, bucket, apply=True, **kwargs):
    lines: list[str] = []
    code = sync_library.sync(client, folder, apply, upload=bucket.upload, out=lines.append, **kwargs)
    return code, "\n".join(lines)


def listing(client):
    return client.get("/library").json()


def test_a_dry_run_reports_the_plan_and_writes_nothing(admin, bucket, folder) -> None:
    code, output = run(admin, folder, bucket, apply=False)
    assert code == 0
    assert "would upload" in output and "4 would be uploaded" in output and "Dry run" in output
    assert listing(admin) == [] and bucket == {}


def test_apply_uploads_each_file_under_its_folders_kind_with_the_signed_headers(admin, bucket, folder) -> None:
    code, output = run(admin, folder, bucket)
    assert code == 0 and "4 uploaded" in output
    kinds = {asset["filename"]: asset["kind"] for asset in listing(admin)}
    assert kinds == {"Pedestal.glb": "model", "arrow.glb": "model", "museum.glb": "environment", "poster.png": "image"}
    assert all(asset["status"] == "uploaded" and asset["url"] for asset in listing(admin))
    sha = hashlib.sha256(b"glTF pedestal").hexdigest()
    assert bucket.headers[f"library/{sha}/Pedestal.glb"] == {"Content-Type": "model/gltf-binary", "Cache-Control": IMMUTABLE}


def test_files_the_library_cannot_take_are_skipped_with_a_reason(admin, bucket, folder) -> None:
    _, output = run(admin, folder, bucket)
    assert "models/scene.gltf  (.gltf is not accepted" in output
    assert "notes.txt  (not inside" in output
    assert "loose.glb  (not inside" in output
    assert "images/room.glb  (a .glb file does not belong in image)" in output
    assert "4 skipped" in output


def test_running_it_again_uploads_nothing(admin, bucket, folder) -> None:
    run(admin, folder, bucket)
    puts = dict(bucket)
    code, output = run(admin, folder, bucket)
    assert code == 0 and "0 uploaded" in output and "4 already in the cloud" in output
    assert dict(bucket) == puts and len(listing(admin)) == 4


def test_identical_files_are_uploaded_once(admin, bucket, tmp_path) -> None:
    (tmp_path / "models").mkdir()
    (tmp_path / "models" / "a.glb").write_bytes(b"glTF same")
    (tmp_path / "models" / "b.glb").write_bytes(b"glTF same")
    _, output = run(admin, tmp_path, bucket)
    assert "same     models/b.glb" in output and len(listing(admin)) == 1


def test_a_flat_folder_can_be_given_a_kind(admin, bucket, tmp_path) -> None:
    (tmp_path / "Stanchion.glb").write_bytes(b"glTF stanchion")
    code, _ = run(admin, tmp_path, bucket, kind_override="model")
    assert code == 0 and [a["kind"] for a in listing(admin)] == ["model"]


def test_library_json_sets_title_on_upload_and_later_changes_reach_the_cloud(admin, bucket, folder) -> None:
    (folder / "library.json").write_text(json.dumps({"models/Pedestal.glb": {"title": "Plinth", "attribution": "CC-BY Jane"}}))
    run(admin, folder, bucket)
    pedestal = next(a for a in listing(admin) if a["filename"] == "Pedestal.glb")
    assert (pedestal["title"], pedestal["attribution"]) == ("Plinth", "CC-BY Jane")

    (folder / "library.json").write_text(json.dumps({"models/Pedestal.glb": {"title": "Pedestal base", "attribution": "CC-BY Jane"}}))
    _, dry = run(admin, folder, bucket, apply=False)
    assert "would update" in dry and next(a for a in listing(admin) if a["filename"] == "Pedestal.glb")["title"] == "Plinth"
    _, output = run(admin, folder, bucket)
    assert "update" in output
    assert next(a for a in listing(admin) if a["filename"] == "Pedestal.glb")["title"] == "Pedestal base"


def test_a_failed_upload_is_reported_and_the_next_run_finishes_it(admin, bucket, folder) -> None:
    bucket.fail_next = True
    code, output = run(admin, folder, bucket)
    assert code == 1 and "FAILED" in output and "1 failed" in output
    assert len(bucket) == 3  # the other three still went up
    code, _ = run(admin, folder, bucket)
    assert code == 0 and len(bucket) == 4 and all(a["status"] == "uploaded" for a in listing(admin))


def test_cloud_entries_missing_from_the_folder_are_listed_and_never_deleted(admin, bucket, folder, tmp_path_factory) -> None:
    run(admin, folder, bucket)
    smaller = tmp_path_factory.mktemp("smaller")
    (smaller / "models").mkdir()
    (smaller / "models" / "arrow.glb").write_bytes(b"glTF arrow")
    _, output = run(admin, smaller, bucket)
    assert output.count("cloud only") == 3 and "left alone" in output
    assert len(listing(admin)) == 4 and len(bucket) == 4


def test_a_login_that_is_not_an_admin_stops_before_touching_anything(client, school, bucket, folder) -> None:
    client.headers["Authorization"] = "Bearer t1"
    code, output = run(client, folder, bucket)
    assert code == 1 and "must be an active admin" in output and bucket == {}
