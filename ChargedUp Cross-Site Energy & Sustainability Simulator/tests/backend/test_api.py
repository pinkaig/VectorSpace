from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app


def scenario() -> dict:
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return {"scenario_id": "test", "fleet": {"total_vehicles": 10, "ev_percentage": 80, "energy_requirement_kwh": 20, "depot_site_id": "depot-north"}, "site_ids": ["depot-north", "external-east"], "charging_strategy": {"depot_share": 0.7, "external_share": 0.3, "charging_window_start": 0, "charging_window_end": 24}, "energy_resources": {"grid_enabled": True, "bess_enabled": False, "solar_enabled": False}, "sustainability": {"electricity_emissions_factor": 0.4, "ice_baseline_emissions": 100, "fuel_displaced": 20, "reporting_period": "baseline"}, "simulation_config": {"start_time": start.isoformat(), "end_time": (start + timedelta(days=1)).isoformat(), "timestep_minutes": 15}}


def test_simulation_is_deterministic_and_returns_aligned_arrays():
    client = TestClient(app)
    first = client.post("/api/scenarios/simulate", json=scenario())
    second = client.post("/api/scenarios/simulate", json=scenario())
    assert first.status_code == 200
    assert first.json() == second.json()
    assert all(len(site["load_kw"]) == len(first.json()["timestamps"]) for site in first.json()["sites"])


def test_unknown_fields_are_rejected():
    payload = scenario()
    payload["unexpected"] = "nope"
    assert TestClient(app).post("/api/scenarios/validate", json=payload).status_code == 422
