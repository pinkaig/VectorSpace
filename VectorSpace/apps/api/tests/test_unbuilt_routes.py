# Routes that exist in the contract but are not built yet answer 501, never 200 or a crash. Each call
# sends a valid body, so it is the missing handler that refuses, not validation (that would be 422).
import uuid

import pytest

PROJECT = uuid.uuid4()
ITEM = uuid.uuid4()
RULE = {"object_id": "door-1", "zone_id": None, "triggers": [{"type": "click"}], "actions": [{"type": "show-card", "cardId": "card-1"}], "priority": 0}
EVENT = {"session_id": "visit-7f3a", "event_type": "room-entered", "payload": {"roomId": "room-2"}, "occurred_at": "2026-11-04T09:30:00Z"}

UNBUILT = [
    ("get", f"/projects/{PROJECT}/rules", None),
    ("post", f"/projects/{PROJECT}/rules", RULE),
    ("get", f"/projects/{PROJECT}/rules/{ITEM}", None),
    ("patch", f"/projects/{PROJECT}/rules/{ITEM}", RULE),
    ("delete", f"/projects/{PROJECT}/rules/{ITEM}", None),
    ("post", f"/projects/{PROJECT}/analytics/events", EVENT),
    ("get", f"/projects/{PROJECT}/analytics/events", None),
    ("get", f"/projects/{PROJECT}/analytics/summary", None),
    ("post", f"/projects/{PROJECT}/versions/{ITEM}/activate", None),
]


@pytest.mark.parametrize(("method", "path", "body"), UNBUILT)
def test_an_unbuilt_route_answers_501(client, method, path, body) -> None:
    reply = client.request(method, path, json=body)
    assert reply.status_code == 501
    assert "not implemented" in reply.json()["detail"]


def test_adding_a_school_answers_501_with_the_way_round_it(client, school) -> None:
    reply = client.post("/admin/schools", headers={"Authorization": "Bearer admin"})
    assert reply.status_code == 501
    assert "app.provision" in reply.json()["detail"]
