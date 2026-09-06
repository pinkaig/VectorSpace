from datetime import timedelta

from app.schemas.models import NetworkResult, ScenarioRequest, SimulationResult, SiteResult, SustainabilityResult


class SimulationEngine:
    def run(self, scenario: ScenarioRequest, sites: list) -> SimulationResult:
        config = scenario.simulation_config
        interval_count = int((config.end_time - config.start_time).total_seconds() // 60 // config.timestep_minutes)
        timestamps = [config.start_time + timedelta(minutes=config.timestep_minutes * index) for index in range(interval_count)]
        ev_energy = scenario.fleet.total_vehicles * scenario.fleet.ev_percentage / 100 * scenario.fleet.energy_requirement_kwh
        active_intervals = max(1, scenario.charging_strategy.charging_window_end - scenario.charging_strategy.charging_window_start)
        interval_energy = ev_energy / active_intervals
        site_results = []
        total_cost = 0.0
        total_peak = 0.0
        peak_time = timestamps[0]
        violations = 0
        for site in sites:
            share = scenario.charging_strategy.depot_share if site.type == "depot" else scenario.charging_strategy.external_share
            load = [interval_energy * share * 60 / config.timestep_minutes if scenario.charging_strategy.charging_window_start <= timestamp.hour < scenario.charging_strategy.charging_window_end else 0.0 for timestamp in timestamps]
            energy = [value * config.timestep_minutes / 60 for value in load]
            utilisation = [value / site.power_limit_kw for value in load]
            exceeded = [value > site.power_limit_kw for value in load]
            costs = [value * site.price_per_kwh for value in energy]
            total_cost += sum(costs)
            violations += sum(exceeded)
            if max(load, default=0) > total_peak:
                total_peak = max(load)
                peak_time = timestamps[load.index(total_peak)]
            site_results.append(SiteResult(site_id=site.id, load_kw=load, energy_kwh=energy, utilisation=utilisation, cost=costs, capacity_limit_kw=site.power_limit_kw, capacity_exceeded=exceeded, grid_import_kw=load, solar_generation_kw=[0.0] * interval_count, bess_power_kw=[0.0] * interval_count))
        emissions = ev_energy * scenario.sustainability.electricity_emissions_factor
        return SimulationResult(scenario_id=scenario.scenario_id or "baseline", timestep_minutes=config.timestep_minutes, start_time=config.start_time, end_time=config.end_time, timestamps=timestamps, sites=site_results, network=NetworkResult(total_energy_kwh=ev_energy, peak_demand_kw=total_peak, peak_time=peak_time, total_cost=total_cost, total_emissions=emissions, fuel_displaced=scenario.sustainability.fuel_displaced, capacity_violation_count=violations), sustainability=SustainabilityResult(electricity_consumption=ev_energy, emissions=emissions, ice_baseline_emissions=scenario.sustainability.ice_baseline_emissions, emissions_reduction=scenario.sustainability.ice_baseline_emissions - emissions))
