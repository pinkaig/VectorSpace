"""The shared asset library: admin-only, hash-first uploads, dedup, allowlist. Storage is faked."""

import hashlib

import pytest

from apps.api.app import storage
from apps.api.app.config import Settings

GLB = b"glTF fake bytes"
SHA = hashlib.sha256(GLB).hexdigest()
PUBLIC_BASE = "https://assets.test"


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


class FakeStore(dict):
    """Objects the 'browser' uploaded, keyed by storage key; .puts lists every presigned PUT handed out."""

    def __init__(self) -> None:
        super().__init__()
        self.puts: list[tuple[str, str, str | None]] = []


@pytest.fixture
def fake_storage(monkeypatch):
    objects = FakeStore()

    def presign(key, content_type, expires_in=900, cache_control=None):
        objects.puts.append((key, content_type, cache_control))
        return f"https://store.test/put/{key}"

    monkeypatch.setattr(storage, "generate_presigned_upload_url", presign)
    monkeypatch.setattr(storage, "head_object", lambda key: objects.get(key))
    monkeypatch.setattr(storage, "delete_object", lambda key: objects.pop(key, None))
    monkeypatch.setattr(storage, "get_settings", lambda: Settings(s3_public_base_url=PUBLIC_BASE))
    return objects


def ticket_body(**overrides):
    return {
        "content_sha256": SHA, "filename": "Pedestal.glb", "kind": "model",
        "content_type": "model/gltf-binary", "size_bytes": len(GLB), **overrides,
    }


def post_ticket(client, key="admin", **overrides):
    return client.post("/library/tickets", json=ticket_body(**overrides), headers=as_user(key))


def upload_and_confirm(client, fake_storage, **overrides):
    ticket = post_ticket(client, **overrides)
    assert ticket.status_code == 201, ticket.text
    asset = ticket.json()["asset"]
    fake_storage[asset["storage_key"]] = (overrides.get("size_bytes", len(GLB)), overrides.get("content_type", "model/gltf-binary"))
    confirmed = client.post(f"/library/{asset['id']}/confirm", headers=as_user("admin"))
    assert confirmed.status_code == 200, confirmed.text
    return confirmed.json()


def test_admin_uploads_a_glb_in_two_calls_and_gets_a_public_url(client, school, fake_storage) -> None:
    ticket = post_ticket(client)
    assert ticket.status_code == 201
    body = ticket.json()
    assert body["asset"]["storage_key"] == f"library/{SHA}/Pedestal.glb"
    assert body["asset"]["status"] == "pending"
    assert body["asset"]["url"] is None  # nothing is public until the bytes are confirmed
    assert body["upload_url"] == f"https://store.test/put/library/{SHA}/Pedestal.glb"
    # the immutable cache header is signed into the PUT, and the browser is told to send it
    assert body["upload_headers"]["Cache-Control"] == "public, max-age=31536000, immutable"
    assert fake_storage.puts[-1][2] == "public, max-age=31536000, immutable"

    confirmed = upload_and_confirm_existing(client, fake_storage, body["asset"])
    assert confirmed["status"] == "uploaded"
    assert confirmed["url"] == f"{PUBLIC_BASE}/library/{SHA}/Pedestal.glb"
    assert confirmed["title"] == "Pedestal"


def upload_and_confirm_existing(client, fake_storage, asset):
    fake_storage[asset["storage_key"]] = (len(GLB), "model/gltf-binary")
    response = client.post(f"/library/{asset['id']}/confirm", headers=as_user("admin"))
    assert response.status_code == 200, response.text
    return response.json()


def test_reuploading_the_same_file_returns_the_existing_row_and_no_upload_url(client, school, fake_storage) -> None:
    first = upload_and_confirm(client, fake_storage)
    puts_before = len(fake_storage.puts)

    again = post_ticket(client, filename="renamed.glb")
    assert again.status_code == 200
    body = again.json()
    assert body["asset"]["id"] == first["id"]
    assert body["asset"]["filename"] == "Pedestal.glb"  # the first filename wins
    assert body["upload_url"] is None and body["upload_headers"] is None
    assert len(fake_storage.puts) == puts_before  # no second PUT was signed
    assert len(client.get("/library", headers=as_user("admin")).json()) == 1


def test_an_unfinished_upload_can_be_ticketed_again(client, school, fake_storage) -> None:
    first = post_ticket(client).json()["asset"]
    again = post_ticket(client)  # never confirmed, so the hit is not a dedup
    assert again.status_code == 201
    assert again.json()["asset"]["id"] == first["id"]
    assert again.json()["upload_url"]


def test_only_admins_reach_the_library(client, school, fake_storage) -> None:
    for key in ("t1", "s1", "other"):
        assert post_ticket(client, key=key).status_code == 403
        assert client.get("/library", headers=as_user(key)).status_code == 403
    asset = upload_and_confirm(client, fake_storage)
    for key in ("t1", "s1"):
        assert client.patch(f"/library/{asset['id']}", json={"title": "x"}, headers=as_user(key)).status_code == 403
        assert client.delete(f"/library/{asset['id']}", headers=as_user(key)).status_code == 403
        assert client.post(f"/library/{asset['id']}/confirm", headers=as_user(key)).status_code == 403


def test_an_admin_of_another_school_may_edit_any_entry(client, db, school, fake_storage) -> None:
    """Decision D3: the library is platform-wide, so there is no school scope to fail."""
    from apps.api.app.models import Actor, Organisation

    org = Organisation(name="C", slug="c")
    db.add(org)
    db.flush()
    db.add(Actor(organisation_id=org.id, auth0_subject="admin-c", email="c@x.test", display_name="c", role="admin"))
    db.commit()
    asset = upload_and_confirm(client, fake_storage)
    response = client.patch(f"/library/{asset['id']}", json={"title": "Renamed"}, headers=as_user("admin-c"))
    assert response.status_code == 200 and response.json()["title"] == "Renamed"


def test_gltf_is_refused(client, school, fake_storage) -> None:
    assert post_ticket(client, filename="scene.gltf").status_code == 422
    assert post_ticket(client, filename="scene.gltf", content_type="model/gltf+json").status_code == 422
    assert post_ticket(client, kind="environment", filename="room.GLTF").status_code == 422


def test_allowlist_and_caps_are_enforced_before_any_upload_url(client, school, fake_storage) -> None:
    assert post_ticket(client, kind="other").status_code == 422
    assert post_ticket(client, content_type="image/png").status_code == 422  # wrong type for a model
    assert post_ticket(client, size_bytes=0).status_code == 422
    assert post_ticket(client, size_bytes=50_000_001).status_code == 413
    assert post_ticket(client, kind="environment", size_bytes=50_000_001).status_code == 201  # 100 MB cap
    assert post_ticket(client, content_sha256="B" * 64).status_code == 422  # must be lowercase hex
    assert post_ticket(client, content_sha256="abc").status_code == 422
    # images take the same caps as project media, and SVG stays out
    other = hashlib.sha256(b"img").hexdigest()
    ok = post_ticket(client, content_sha256=other, kind="image", filename="a.png", content_type="image/png")
    assert ok.status_code == 201
    assert post_ticket(client, kind="image", filename="a.svg", content_type="image/svg+xml").status_code == 422


def test_confirm_fails_before_the_bytes_arrive(client, school, fake_storage) -> None:
    asset = post_ticket(client).json()["asset"]
    response = client.post(f"/library/{asset['id']}/confirm", headers=as_user("admin"))
    assert response.status_code == 409


def test_confirm_rejects_a_size_mismatch_and_removes_the_object(client, school, fake_storage) -> None:
    asset = post_ticket(client).json()["asset"]
    fake_storage[asset["storage_key"]] = (len(GLB) + 1, "model/gltf-binary")
    response = client.post(f"/library/{asset['id']}/confirm", headers=as_user("admin"))
    assert response.status_code == 422
    assert asset["storage_key"] not in fake_storage
    assert client.get("/library", headers=as_user("admin")).json()[0]["status"] == "failed"
    # a failed upload is not stuck: it can be ticketed again
    assert post_ticket(client).status_code == 201


def test_confirm_rejects_the_wrong_content_type(client, school, fake_storage) -> None:
    asset = post_ticket(client).json()["asset"]
    fake_storage[asset["storage_key"]] = (len(GLB), "text/html")
    assert client.post(f"/library/{asset['id']}/confirm", headers=as_user("admin")).status_code == 422


def test_listing_filters_by_kind(client, school, fake_storage) -> None:
    upload_and_confirm(client, fake_storage)
    other = hashlib.sha256(b"room").hexdigest()
    upload_and_confirm(client, fake_storage, content_sha256=other, kind="environment", filename="Room.glb")
    admin = as_user("admin")
    assert len(client.get("/library", headers=admin).json()) == 2
    assert [a["kind"] for a in client.get("/library?kind=environment", headers=admin).json()] == ["environment"]
    assert client.get("/library?kind=nonsense", headers=admin).status_code == 422


def test_patch_edits_title_and_attribution_but_not_the_file(client, school, fake_storage) -> None:
    asset = upload_and_confirm(client, fake_storage)
    response = client.patch(
        f"/library/{asset['id']}", json={"title": "Plinth", "attribution": "CC-BY Jane"}, headers=as_user("admin")
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["title"], body["attribution"], body["storage_key"]) == ("Plinth", "CC-BY Jane", asset["storage_key"])
    cleared = client.patch(f"/library/{asset['id']}", json={"attribution": None}, headers=as_user("admin"))
    assert cleared.json()["attribution"] is None


def test_signed_visibility_is_refused_until_it_can_really_protect_something(client, school, fake_storage) -> None:
    asset = upload_and_confirm(client, fake_storage)
    response = client.patch(f"/library/{asset['id']}", json={"visibility": "signed"}, headers=as_user("admin"))
    assert response.status_code == 422


def test_delete_removes_the_row_and_the_object(client, school, fake_storage) -> None:
    asset = upload_and_confirm(client, fake_storage)
    assert asset["storage_key"] in fake_storage
    assert client.delete(f"/library/{asset['id']}", headers=as_user("admin")).status_code == 204
    assert asset["storage_key"] not in fake_storage
    assert client.get("/library", headers=as_user("admin")).json() == []
    assert client.delete(f"/library/{asset['id']}", headers=as_user("admin")).status_code == 404


def test_the_listing_still_works_when_the_public_prefix_is_not_configured(client, school, fake_storage, monkeypatch) -> None:
    upload_and_confirm(client, fake_storage)
    monkeypatch.setattr(storage, "get_settings", lambda: Settings(s3_public_base_url=""))
    listing = client.get("/library", headers=as_user("admin"))
    assert listing.status_code == 200 and listing.json()[0]["url"] is None
