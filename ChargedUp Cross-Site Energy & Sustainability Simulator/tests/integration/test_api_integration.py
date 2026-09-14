from fastapi.testclient import TestClient

from app.main import app


def test_health_and_site_boundaries_are_reachable():
    client = TestClient(app)
    health = client.get("/api/health")
    sites = client.get("/api/sites")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    assert sites.status_code == 200
    assert {site["id"] for site in sites.json()} == {"depot-north", "external-east"}
