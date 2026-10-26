"""Media library routes: who may upload, add links, approve and see what. Storage is faked."""

import pytest

from apps.api.app import storage


def as_user(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


@pytest.fixture
def fake_storage(monkeypatch):
    """Stands in for MinIO: records objects the 'browser' uploaded, hands out fake signed URLs."""
    objects: dict[str, tuple[int, str]] = {}
    monkeypatch.setattr(storage, "generate_presigned_upload_url", lambda key, content_type, expires_in=900: f"https://store.test/put/{key}")
    monkeypatch.setattr(storage, "generate_presigned_download_url", lambda key, expires_in=900: f"https://store.test/get/{key}?expires={expires_in}")
    monkeypatch.setattr(storage, "head_object", lambda key: objects.get(key))
    monkeypatch.setattr(storage, "delete_object", lambda key: objects.pop(key, None))
    return objects


@pytest.fixture
def project(client, school):
    """A template the teacher t1 owns; templates are what teachers build cards on."""
    response = client.post("/projects", json={"name": "Museum", "kind": "template"}, headers=as_user("t1"))
    assert response.status_code == 201, response.text
    body = response.json()
    client.patch(f"/projects/{body['id']}", json={"status": "published"}, headers=as_user("t1"))
    return body


def media_url(project, suffix=""):
    return f"/projects/{project['id']}/media{suffix}"


def request_upload(client, project, key="t1", **overrides):
    body = {"kind": "image", "content_type": "image/png", "size_bytes": 1000, "filename": "stone.png", **overrides}
    return client.post(media_url(project), json=body, headers=as_user(key))


def upload(client, project, fake_storage, **overrides):
    response = request_upload(client, project, **overrides)
    assert response.status_code == 201, response.text
    ticket = response.json()
    fake_storage[ticket["storage_key"]] = (overrides.get("size_bytes", 1000), overrides.get("content_type", "image/png"))
    confirmed = client.post(media_url(project, f"/{ticket['media_asset_id']}/confirm"), headers=as_user("t1"))
    assert confirmed.status_code == 200, confirmed.text
    return confirmed.json()


def test_teacher_uploads_a_file_in_three_steps(client, project, fake_storage) -> None:
    entry = upload(client, project, fake_storage)
    assert entry["status"] == "uploaded" and entry["source"] == "file"
    assert entry["label"] == "stone.png"
    opened = client.get(media_url(project, f"/{entry['id']}"), headers=as_user("s1")).json()
    assert opened["download_url"].startswith("https://store.test/get/projects/")
    assert opened["download_expires_in"] == 900


def test_student_cannot_upload_or_add_links(client, project, fake_storage) -> None:
    assert request_upload(client, project, key="s1").status_code == 403
    link = client.post(media_url(project, "/links"), json={"url": "https://youtu.be/dQw4w9WgXcQ"}, headers=as_user("s1"))
    assert link.status_code == 403


def test_wrong_content_type_is_rejected(client, project, fake_storage) -> None:
    assert request_upload(client, project, content_type="image/svg+xml").status_code == 422
    assert request_upload(client, project, kind="video", content_type="image/png").status_code == 422
    assert request_upload(client, project, kind="audio", content_type="audio/mpeg").status_code == 422


def test_over_cap_file_is_rejected_before_any_upload_url(client, project, fake_storage) -> None:
    assert request_upload(client, project, size_bytes=10_000_001).status_code == 413
    assert request_upload(client, project, kind="video", content_type="video/mp4", size_bytes=200_000_000).status_code == 201


def test_confirm_fails_when_storage_holds_something_else(client, project, fake_storage) -> None:
    ticket = request_upload(client, project).json()
    confirm = media_url(project, f"/{ticket['media_asset_id']}/confirm")
    assert client.post(confirm, headers=as_user("t1")).status_code == 409  # nothing arrived yet
    fake_storage[ticket["storage_key"]] = (999_999_999, "image/png")  # bigger than declared
    assert client.post(confirm, headers=as_user("t1")).status_code == 422
    assert ticket["storage_key"] not in fake_storage
    listed = client.get(media_url(project), headers=as_user("t1")).json()
    assert [entry["status"] for entry in listed] == ["failed"]


def test_storage_key_cannot_escape_the_project_folder(client, project, fake_storage) -> None:
    ticket = request_upload(client, project, filename="../../other/evil.png").json()
    assert ticket["storage_key"].startswith(f"projects/{project['id']}/media/")
    assert ".." not in ticket["storage_key"].split("/")


def test_students_see_only_uploaded_files_and_approved_links(client, project, fake_storage) -> None:
    upload(client, project, fake_storage)
    request_upload(client, project, filename="unfinished.png")  # stays pending
    link = client.post(media_url(project, "/links"), json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}, headers=as_user("t1")).json()
    assert link["approval"] == "pending"

    assert len(client.get(media_url(project), headers=as_user("t1")).json()) == 3
    student_view = client.get(media_url(project), headers=as_user("s1")).json()
    assert [entry["source"] for entry in student_view] == ["file"]
    assert client.get(media_url(project, f"/{link['id']}"), headers=as_user("s1")).status_code == 404

    approved = client.patch(media_url(project, f"/links/{link['id']}"), json={"approval": "approved"}, headers=as_user("t2"))
    assert approved.status_code == 200 and approved.json()["approval"] == "approved"
    assert len(client.get(media_url(project), headers=as_user("s1")).json()) == 2


def test_link_is_stored_by_id_never_as_pasted(client, project, fake_storage) -> None:
    pasted = "https://youtu.be/dQw4w9WgXcQ?si=tracking&t=42"
    link = client.post(media_url(project, "/links"), json={"url": pasted}, headers=as_user("t1")).json()
    assert link["provider"] == "youtube" and link["provider_id"] == "dQw4w9WgXcQ"
    assert link["url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert link["label"] == "YouTube video dQw4w9WgXcQ"
    again = client.post(media_url(project, "/links"), json={"url": "https://www.youtube.com/embed/dQw4w9WgXcQ"}, headers=as_user("t1"))
    assert again.status_code == 409


def test_bad_links_are_rejected(client, project, fake_storage) -> None:
    for bad in ["javascript:alert(1)", "http://youtu.be/dQw4w9WgXcQ", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "https://vimeo.com/1"]:
        response = client.post(media_url(project, "/links"), json={"url": bad}, headers=as_user("t1"))
        assert response.status_code == 422, bad


def test_student_cannot_review_and_review_needs_a_valid_state(client, project, fake_storage) -> None:
    link = client.post(media_url(project, "/links"), json={"url": "https://youtu.be/dQw4w9WgXcQ"}, headers=as_user("t1")).json()
    review = media_url(project, f"/links/{link['id']}")
    assert client.patch(review, json={"approval": "approved"}, headers=as_user("s1")).status_code == 403
    assert client.patch(review, json={"approval": "maybe"}, headers=as_user("t1")).status_code == 422
    sent_back = client.patch(review, json={"approval": "rejected", "comment": "Please pick a shorter clip"}, headers=as_user("t1")).json()
    assert sent_back["approval"] == "rejected" and sent_back["review_comment"] == "Please pick a shorter clip"


def test_other_school_cannot_see_the_library(client, project, fake_storage) -> None:
    assert client.get(media_url(project), headers=as_user("other")).status_code == 404
    assert request_upload(client, project, key="other").status_code == 404


def test_delete_removes_the_row_and_the_stored_file(client, project, fake_storage) -> None:
    entry = upload(client, project, fake_storage)
    assert client.delete(media_url(project, f"/{entry['id']}"), headers=as_user("s1")).status_code == 403
    assert client.delete(media_url(project, f"/{entry['id']}"), headers=as_user("t1")).status_code == 204
    assert fake_storage == {}
    assert client.get(media_url(project, f"/{entry['id']}"), headers=as_user("t1")).status_code == 404


def test_a_students_copy_plays_the_templates_media(client, project, fake_storage, school) -> None:
    """The copy keeps the card's media ids; entries stay with the template and are shared through it."""
    image = upload(client, project, fake_storage)
    approved = client.post(media_url(project, "/links"), json={"url": "https://youtu.be/dQw4w9WgXcQ"}, headers=as_user("t1")).json()
    client.patch(media_url(project, f"/links/{approved['id']}"), json={"approval": "approved"}, headers=as_user("t1"))
    pending = client.post(media_url(project, "/links"), json={"url": "https://youtu.be/M7lc1UVf-VE"}, headers=as_user("t1")).json()

    sent = client.post(f"/projects/{project['id']}/assign", json={"student_id": str(school["s1"].id)}, headers=as_user("t1"))
    assert sent.status_code == 201, sent.text
    copy = sent.json()

    opened = client.get(media_url(copy, f"/{image['id']}"), headers=as_user("s1"))
    assert opened.status_code == 200 and opened.json()["download_url"]
    assert client.get(media_url(copy, f"/{approved['id']}"), headers=as_user("s1")).status_code == 200
    assert client.get(media_url(copy, f"/{pending['id']}"), headers=as_user("s1")).status_code == 404
    assert {entry["id"] for entry in client.get(media_url(copy), headers=as_user("s1")).json()} == {image["id"], approved["id"]}

    # revoking on the template reaches the copy at once
    client.patch(media_url(project, f"/links/{approved['id']}"), json={"approval": "rejected"}, headers=as_user("t1"))
    assert client.get(media_url(copy, f"/{approved['id']}"), headers=as_user("s1")).status_code == 404

    # the copy cannot delete or confirm what the template owns
    assert client.delete(media_url(copy, f"/{image['id']}"), headers=as_user("t1")).status_code in (403, 404)


def test_another_projects_media_is_not_reachable(client, project, fake_storage, school) -> None:
    image = upload(client, project, fake_storage)
    other = client.post("/projects", json={"name": "Unrelated", "kind": "template"}, headers=as_user("t2")).json()
    client.patch(f"/projects/{other['id']}", json={"status": "published"}, headers=as_user("t2"))
    assert client.get(media_url(other, f"/{image['id']}"), headers=as_user("t2")).status_code == 404
