from fastapi.testclient import TestClient

from apps.api.app.main import app


def test_health_endpoint() -> None:
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "vectorspace-api"}
    assert response.headers["x-request-id"]

def test_the_browser_app_origin_is_allowed_to_call_the_api() -> None:
    reply = TestClient(app).options(
        "/me",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert reply.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "authorization" in reply.headers["access-control-allow-headers"].lower()
