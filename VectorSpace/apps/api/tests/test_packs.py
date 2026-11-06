"""Asset packs: draft, publish (manifest first, then the revision), per-school grants, the delete
guard on library files a pack holds. Storage is faked, as in test_library.py."""

import hashlib
import json

import pytest
from apps.api.app import storage
from apps.api.app.config import Settings
from test_library import PUBLIC_BASE, as_user, upload_and_confirm

ADMIN = as_user("admin")


@pytest.fixture
def fake_storage(monkeypatch):
    from test_library import FakeStore

    objects = FakeStore()
    objects.written = {}

    def presign(key, content_type, expires_in=900, cache_control=None):
        objects.puts.append((key, content_type, cache_control))
        return f"https://store.test/put/{key}"

    def put_object(key, body, content_type, cache_control=None):
        # a published manifest must exist before the database points at it, so the test can see
        # the order: the revision is checked against what is already written
        objects.written[key] = (body, content_type, cache_control)

    monkeypatch.setattr(storage, "generate_presigned_upload_url", presign)
    monkeypatch.setattr(storage, "head_object", lambda key: objects.get(key))
    monkeypatch.setattr(storage, "delete_object", lambda key: objects.pop(key, None))
    monkeypatch.setattr(storage, "put_object", put_object)
    monkeypatch.setattr(storage, "get_settings", lambda: Settings(s3_public_base_url=PUBLIC_BASE))
    return objects


def a_file(client, fake_storage, name: str, kind: str = "model"):
    return upload_and_confirm(
        client, fake_storage, content_sha256=hashlib.sha256(name.encode()).hexdigest(), filename=f"{name}.glb", kind=kind,
    )


def make_pack(client, slug="fossils", title="Fossils", **extra):
    response = client.post("/packs", json={"slug": slug, "title": title, **extra}, headers=ADMIN)
    assert response.status_code == 201, response.text
    return response.json()


def test_a_pack_is_a_draft_until_it_is_published(client, school, fake_storage) -> None:
    pack = make_pack(client, description="Six CC0 scans")
    assert pack["published_revision"] is None and pack["manifest_url"] is None
    assert pack["unpublished_changes"] is True
    trex, mammoth = a_file(client, fake_storage, "TRex_Skull"), a_file(client, fake_storage, "Mammoth")

    filled = client.put("/packs/fossils/assets", json={"asset_ids": [mammoth["id"], trex["id"]]}, headers=ADMIN)
    assert filled.status_code == 200, filled.text
    assert filled.json()["asset_ids"] == [mammoth["id"], trex["id"]]
    assert fake_storage.written == {}  # nothing in the bucket for a draft

    published = client.post("/packs/fossils/publish", headers=ADMIN)
    assert published.status_code == 200, published.text
    body = published.json()
    assert body["published_revision"] == 1
    assert body["manifest_url"] == f"{PUBLIC_BASE}/library/packs/fossils/1.json"
    assert body["unpublished_changes"] is False

    raw, content_type, cache = fake_storage.written["library/packs/fossils/1.json"]
    assert content_type == "application/json" and "immutable" in cache
    manifest = json.loads(raw)
    assert (manifest["slug"], manifest["revision"], manifest["kind"]) == ("fossils", 1, "objects")
    assert [a["title"] for a in manifest["assets"]] == ["Mammoth", "TRex_Skull"]  # the order the admin set
    assert manifest["assets"][0]["url"] == mammoth["url"]
    assert manifest["assets"][0]["sha256"] == mammoth["content_sha256"]


def test_publishing_again_writes_a_new_revision_and_keeps_the_old_file(client, school, fake_storage) -> None:
    make_pack(client)
    one = a_file(client, fake_storage, "Ammonite")
    client.put("/packs/fossils/assets", json={"asset_ids": [one["id"]]}, headers=ADMIN)
    client.post("/packs/fossils/publish", headers=ADMIN)

    edited = client.patch("/packs/fossils", json={"title": "Fossil hall"}, headers=ADMIN).json()
    assert edited["unpublished_changes"] is True
    second = client.post("/packs/fossils/publish", headers=ADMIN).json()
    assert second["published_revision"] == 2
    assert set(fake_storage.written) == {"library/packs/fossils/1.json", "library/packs/fossils/2.json"}
    assert json.loads(fake_storage.written["library/packs/fossils/2.json"][0])["title"] == "Fossil hall"


def test_an_empty_pack_cannot_be_published(client, school, fake_storage) -> None:
    make_pack(client)
    assert client.post("/packs/fossils/publish", headers=ADMIN).status_code == 422


def test_pack_contents_are_checked(client, school, fake_storage) -> None:
    make_pack(client)
    model = a_file(client, fake_storage, "Trilobite")
    room = a_file(client, fake_storage, "Gallery", kind="environment")
    put = lambda ids: client.put("/packs/fossils/assets", json={"asset_ids": ids}, headers=ADMIN)
    assert put([room["id"]]).status_code == 422  # a room shell is not an object
    assert put([model["id"], model["id"]]).status_code == 422  # once only
    assert put(["00000000-0000-0000-0000-000000000000"]).status_code == 422  # not in the library
    pending = client.post("/library/tickets", headers=ADMIN, json={
        "content_sha256": hashlib.sha256(b"half").hexdigest(), "filename": "Half.glb", "kind": "model",
        "content_type": "model/gltf-binary", "size_bytes": 10,
    }).json()["asset"]
    assert put([pending["id"]]).status_code == 422  # never confirmed
    assert put([model["id"]]).status_code == 200
    assert put([]).json()["asset_ids"] == []  # replacing with nothing empties the draft


def test_slugs_are_unique_and_url_safe(client, school, fake_storage) -> None:
    make_pack(client)
    assert client.post("/packs", json={"slug": "fossils", "title": "Again"}, headers=ADMIN).status_code == 409
    assert client.post("/packs", json={"slug": "Has Spaces", "title": "x"}, headers=ADMIN).status_code == 422
    assert client.post("/packs", json={"slug": "rooms", "title": "x", "kind": "props"}, headers=ADMIN).status_code == 422


def test_only_admins_manage_packs(client, school, fake_storage) -> None:
    make_pack(client)
    for key in ("t1", "s1"):
        who = as_user(key)
        assert client.get("/packs", headers=who).status_code == 403
        assert client.post("/packs", json={"slug": "x", "title": "x"}, headers=who).status_code == 403
        assert client.post("/packs/fossils/publish", headers=who).status_code == 403
        assert client.get(f"/admin/schools/{school['admin'].organisation_id}/packs", headers=who).status_code == 403


def test_a_library_file_in_a_pack_cannot_be_deleted(client, school, fake_storage) -> None:
    make_pack(client)
    held = a_file(client, fake_storage, "Pedestal")
    loose = a_file(client, fake_storage, "Sign")
    client.put("/packs/fossils/assets", json={"asset_ids": [held["id"]]}, headers=ADMIN)
    refused = client.delete(f"/library/{held['id']}", headers=ADMIN)
    assert refused.status_code == 409
    assert "Fossils" in refused.json()["detail"]
    assert client.delete(f"/library/{loose['id']}", headers=ADMIN).status_code == 204


def test_a_draft_can_be_deleted_but_a_published_pack_cannot(client, school, fake_storage) -> None:
    make_pack(client, slug="scratch", title="Scratch")
    assert client.delete("/packs/scratch", headers=ADMIN).status_code == 204
    make_pack(client)
    one = a_file(client, fake_storage, "Ammonite")
    client.put("/packs/fossils/assets", json={"asset_ids": [one["id"]]}, headers=ADMIN)
    client.post("/packs/fossils/publish", headers=ADMIN)
    assert client.delete("/packs/fossils", headers=ADMIN).status_code == 409


def published_pack(client, fake_storage, slug="fossils"):
    pack = make_pack(client, slug=slug, title=slug.title())
    one = a_file(client, fake_storage, f"{slug}-file")
    client.put(f"/packs/{slug}/assets", json={"asset_ids": [one["id"]]}, headers=ADMIN)
    client.post(f"/packs/{slug}/publish", headers=ADMIN)
    return pack


def test_a_school_switch_is_stored_and_reaches_teachers_and_students(client, school, fake_storage) -> None:
    pack = published_pack(client, fake_storage)
    make_pack(client, slug="draft-only", title="Draft only")  # never published: never offered
    org = school["admin"].organisation_id

    listed = client.get(f"/admin/schools/{org}/packs", headers=ADMIN).json()
    assert [(p["slug"], p["enabled"]) for p in listed] == [("fossils", False)]
    assert client.get("/packs/mine", headers=as_user("t1")).json() == []

    on = client.patch(f"/admin/schools/{org}/packs/{pack['id']}", json={"enabled": True}, headers=ADMIN)
    assert on.status_code == 200 and on.json()["enabled"] is True
    # stored, so a fresh read (a reload, a second browser) sees it
    assert client.get(f"/admin/schools/{org}/packs", headers=ADMIN).json()[0]["enabled"] is True
    for key in ("t1", "s1"):
        mine = client.get("/packs/mine", headers=as_user(key)).json()
        assert [(p["slug"], p["revision"], p["item_count"]) for p in mine] == [("fossils", 1, 1)]
        assert mine[0]["manifest_url"] == f"{PUBLIC_BASE}/library/packs/fossils/1.json"
    # another school did not get it
    assert client.get("/packs/mine", headers=as_user("other")).json() == []

    client.patch(f"/admin/schools/{org}/packs/{pack['id']}", json={"enabled": False}, headers=ADMIN)
    assert client.get("/packs/mine", headers=as_user("t1")).json() == []


def test_an_admin_switches_packs_only_for_their_own_school(client, school, fake_storage) -> None:
    pack = published_pack(client, fake_storage)
    other_org = school["other"].organisation_id
    assert client.get(f"/admin/schools/{other_org}/packs", headers=ADMIN).status_code == 404
    assert client.get("/admin/schools/all/packs", headers=ADMIN).status_code == 404
    assert client.patch(
        f"/admin/schools/{other_org}/packs/{pack['id']}", json={"enabled": True}, headers=ADMIN
    ).status_code == 404


def test_a_draft_cannot_be_switched_on(client, school, fake_storage) -> None:
    draft = make_pack(client)
    org = school["admin"].organisation_id
    assert client.patch(f"/admin/schools/{org}/packs/{draft['id']}", json={"enabled": True}, headers=ADMIN).status_code == 404


def test_admins_list_packs_and_read_one(client, school, fake_storage) -> None:
    published_pack(client, fake_storage)
    make_pack(client, slug="dinosaurs", title="Dinosaurs")
    listed = client.get("/packs", headers=ADMIN)
    assert listed.status_code == 200
    assert [(p["slug"], p["published_revision"]) for p in listed.json()] == [("dinosaurs", None), ("fossils", 1)]
    one = client.get("/packs/fossils", headers=ADMIN)
    assert one.status_code == 200 and len(one.json()["asset_ids"]) == 1
    assert client.get("/packs/nope", headers=ADMIN).status_code == 404
