from app.schemas.models import Charger, Coordinate, FleetInput, Site


class InMemoryAuthoritativeRepository:
    def __init__(self) -> None:
        self._sites = [
            Site(id="depot-north", name="North Depot", type="depot", position=Coordinate(longitude=-0.1276, latitude=51.5072), power_limit_kw=240, price_per_kwh=0.22, chargers=[Charger(id="north-1", power_kw=60), Charger(id="north-2", power_kw=60)]),
            Site(id="external-east", name="East Hub", type="external", position=Coordinate(longitude=-0.0877, latitude=51.5155), power_limit_kw=180, price_per_kwh=0.34, chargers=[Charger(id="east-1", power_kw=60), Charger(id="east-2", power_kw=60)]),
        ]
        self._fleet = FleetInput(total_vehicles=40, ev_percentage=75, energy_requirement_kwh=24, depot_site_id="depot-north")

    def list_sites(self) -> list[Site]:
        return self._sites

    def get_site(self, site_id: str) -> Site | None:
        return next((site for site in self._sites if site.id == site_id), None)

    def get_fleet(self) -> FleetInput:
        return self._fleet
