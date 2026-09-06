from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.data.repository import InMemoryAuthoritativeRepository
from app.schemas.models import CompareRequest, ComparisonResult, ScenarioRequest
from app.simulation import SimulationEngine

settings = get_settings()
repository = InMemoryAuthoritativeRepository()
engine = SimulationEngine()
app = FastAPI(title="ChargedUp Simulator", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.middleware("http")
async def request_size_limit(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.max_request_bytes:
        return JSONResponse(status_code=413, content={"code": "request_too_large", "message": "request body exceeds the configured limit"})
    return await call_next(request)


@app.exception_handler(Exception)
async def safe_exception_handler(request: Request, exception: Exception):
    return JSONResponse(status_code=500, content={"code": "internal_error", "message": "an unexpected service error occurred"})


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "database": "degraded", "environment": settings.app_env}


@app.get("/api/sites")
def sites():
    return repository.list_sites()


@app.get("/api/sites/{site_id}")
def site(site_id: str):
    result = repository.get_site(site_id)
    if result is None:
        return JSONResponse(status_code=404, content={"code": "site_not_found", "message": "site was not found"})
    return result


@app.get("/api/fleet")
def fleet():
    return repository.get_fleet()


def resolve_sites(scenario: ScenarioRequest):
    resolved = [repository.get_site(site_id) for site_id in scenario.site_ids]
    if any(site is None for site in resolved):
        raise ValueError("one or more site references are invalid")
    if scenario.fleet.depot_site_id not in scenario.site_ids:
        raise ValueError("depot site must be included in site_ids")
    return resolved


@app.post("/api/scenarios/validate")
def validate_scenario(scenario: ScenarioRequest):
    try:
        resolve_sites(scenario)
    except ValueError as error:
        return JSONResponse(status_code=400, content={"code": "invalid_scenario", "message": str(error)})
    return {"valid": True, "scenario": scenario}


@app.post("/api/scenarios/simulate")
def simulate(scenario: ScenarioRequest):
    try:
        return engine.run(scenario, resolve_sites(scenario))
    except ValueError as error:
        return JSONResponse(status_code=400, content={"code": "invalid_scenario", "message": str(error)})


@app.post("/api/scenarios/compare", response_model=ComparisonResult)
def compare(request: CompareRequest):
    if request.first.timestamps != request.second.timestamps or [site.site_id for site in request.first.sites] != [site.site_id for site in request.second.sites]:
        return JSONResponse(status_code=400, content={"code": "incompatible_results", "message": "results must have matching timestamps and sites"})
    return ComparisonResult(scenario_a_id=request.first.scenario_id, scenario_b_id=request.second.scenario_id, metric_differences={"total_energy_kwh": request.second.network.total_energy_kwh - request.first.network.total_energy_kwh, "total_cost": request.second.network.total_cost - request.first.network.total_cost, "total_emissions": request.second.network.total_emissions - request.first.network.total_emissions})
