from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Coordinate(BaseModel):
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)


class Charger(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    power_kw: float = Field(gt=0)


class Site(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    type: Literal["depot", "external"]
    position: Coordinate
    power_limit_kw: float = Field(gt=0)
    price_per_kwh: float = Field(ge=0)
    chargers: list[Charger] = Field(min_length=1, max_length=64)


class FleetInput(BaseModel):
    total_vehicles: int = Field(ge=0, le=10_000)
    ev_percentage: float = Field(ge=0, le=100)
    energy_requirement_kwh: float = Field(ge=0)
    depot_site_id: str = Field(min_length=1, max_length=64)


class ChargingStrategyInput(BaseModel):
    depot_share: float = Field(ge=0, le=1)
    external_share: float = Field(ge=0, le=1)
    charging_window_start: int = Field(ge=0, le=23)
    charging_window_end: int = Field(ge=1, le=24)
    strategy_type: str = Field(default="baseline", max_length=32)

    @model_validator(mode="after")
    def validate_shares_and_window(self) -> "ChargingStrategyInput":
        if abs(self.depot_share + self.external_share - 1) > 1e-6:
            raise ValueError("charging shares must sum to 1")
        if self.charging_window_start >= self.charging_window_end:
            raise ValueError("charging window must have positive duration")
        return self


class EnergyResourcesInput(BaseModel):
    grid_enabled: bool = True
    bess_enabled: bool = False
    solar_enabled: bool = False


class SustainabilityInput(BaseModel):
    electricity_emissions_factor: float = Field(ge=0)
    ice_baseline_emissions: float = Field(ge=0)
    fuel_displaced: float = Field(ge=0)
    reporting_period: str = Field(min_length=1, max_length=64)


class SimulationConfigInput(BaseModel):
    start_time: datetime
    end_time: datetime
    timestep_minutes: Literal[5, 10, 15, 30, 60] = 15
    seed: int | None = None

    @model_validator(mode="after")
    def validate_horizon(self) -> "SimulationConfigInput":
        duration_minutes = (self.end_time - self.start_time).total_seconds() / 60
        if duration_minutes <= 0 or duration_minutes > 24 * 60:
            raise ValueError("simulation horizon must be positive and no longer than one day")
        if duration_minutes % self.timestep_minutes != 0:
            raise ValueError("simulation horizon must align with timestep")
        if duration_minutes / self.timestep_minutes > 288:
            raise ValueError("simulation exceeds maximum interval count")
        return self


class ScenarioRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario_id: str | None = Field(default=None, max_length=64)
    fleet: FleetInput
    site_ids: list[str] = Field(min_length=1, max_length=32)
    charging_strategy: ChargingStrategyInput
    energy_resources: EnergyResourcesInput
    sustainability: SustainabilityInput
    simulation_config: SimulationConfigInput

    @field_validator("site_ids")
    @classmethod
    def unique_sites(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("site_ids must be unique")
        return value


class SiteResult(BaseModel):
    site_id: str
    load_kw: list[float]
    energy_kwh: list[float]
    utilisation: list[float]
    cost: list[float]
    capacity_limit_kw: float
    capacity_exceeded: list[bool]
    grid_import_kw: list[float]
    solar_generation_kw: list[float]
    bess_power_kw: list[float]


class NetworkResult(BaseModel):
    total_energy_kwh: float
    peak_demand_kw: float
    peak_time: datetime
    total_cost: float
    total_emissions: float
    fuel_displaced: float
    capacity_violation_count: int


class SustainabilityResult(BaseModel):
    electricity_consumption: float
    emissions: float
    ice_baseline_emissions: float
    emissions_reduction: float


class SimulationResult(BaseModel):
    scenario_id: str
    timestep_minutes: int
    start_time: datetime
    end_time: datetime
    timestamps: list[datetime]
    sites: list[SiteResult]
    network: NetworkResult
    sustainability: SustainabilityResult


class CompareRequest(BaseModel):
    first: SimulationResult
    second: SimulationResult


class ComparisonResult(BaseModel):
    scenario_a_id: str
    scenario_b_id: str
    metric_differences: dict[str, float]
    compatibility: str = "compatible"
