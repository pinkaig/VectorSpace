from fastapi.testclient import TestClient

from app.main import app


def test_oversized_content_length_is_rejected():
    response = TestClient(app).post("/api/scenarios/validate", headers={"content-length": str(1024 * 1024 + 1)}, content=b"x")
    assert response.status_code == 413
    assert response.json()["code"] == "request_too_large"


def test_authoritative_site_fields_are_not_client_owned():
    response = TestClient(app).get("/api/sites/depot-north")
    assert response.status_code == 200
    assert response.json()["power_limit_kw"] == 240
