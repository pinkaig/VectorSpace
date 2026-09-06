from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app


def test_maximum_interval_request_is_bounded():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    payload = {"fleet": {"total_vehicles": 10000, "ev_percentage": 100, "energy_requirement_kwh": 1, "depot_site_id": "depot-north"}, "site_ids": ["depot-north"], "charging_strategy": {"depot_share": 1, "external_share": 0, "charging_window_start": 0, "charging_window_end": 24}, "energy_resources": {"grid_enabled": True}, "sustainability": {"electricity_emissions_factor": 0.4, "ice_baseline_emissions": 1, "fuel_displaced": 1, "reporting_period": "test"}, "simulation_config": {"start_time": start.isoformat(), "end_time": (start + timedelta(days=1)).isoformat(), "timestep_minutes": 5}}
    response = TestClient(app).post("/api/scenarios/simulate", json=payload)
    assert response.status_code == 200
    assert len(response.json()["timestamps"]) == 288


def test_invalid_timestep_is_rejected_before_simulation():
    payload = {"fleet": {"total_vehicles": 1, "ev_percentage": 100, "energy_requirement_kwh": 1, "depot_site_id": "depot-north"}, "site_ids": ["depot-north"], "charging_strategy": {"depot_share": 1, "external_share": 0, "charging_window_start": 0, "charging_window_end": 24}, "energy_resources": {"grid_enabled": True}, "sustainability": {"electricity_emissions_factor": 0.4, "ice_baseline_emissions": 1, "fuel_displaced": 1, "reporting_period": "test"}, "simulation_config": {"start_time": "2026-01-01T00:00:00Z", "end_time": "2026-01-02T00:00:00Z", "timestep_minutes": 1}}
    assert TestClient(app).post("/api/scenarios/simulate", json=payload).status_code == 422
