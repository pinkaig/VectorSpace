from fastapi.testclient import TestClient

from apps.api.app.main import API_PREFIX, app


def test_health_endpoint() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "vectorspace-api"}
    assert response.headers["x-request-id"]


def test_health_is_also_served_under_the_version_prefix() -> None:
    response = TestClient(app).get(f"{API_PREFIX}/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "vectorspace-api"}


def test_routes_are_only_served_under_the_version_prefix() -> None:
    assert TestClient(app).get("/me").status_code == 404

def test_the_browser_app_origin_is_allowed_to_call_the_api() -> None:
    reply = TestClient(app).options(
        f"{API_PREFIX}/me",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert reply.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "authorization" in reply.headers["access-control-allow-headers"].lower()
