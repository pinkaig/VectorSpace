export type Site = { id: string; name: string; type: "depot" | "external"; position: { longitude: number; latitude: number }; power_limit_kw: number; price_per_kwh: number };
export type SimulationResult = { scenario_id: string; timestamps: string[]; network: { total_energy_kwh: number; peak_demand_kw: number; total_cost: number; total_emissions: number } };
