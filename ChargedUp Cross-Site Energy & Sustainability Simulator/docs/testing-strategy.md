# Testing Strategy

## Testing goals

The baseline must prove that the repository builds, the architecture instantiates, contracts are valid, integrations connect, placeholders are deterministic, and the application can start. Full feature coverage is deferred until those foundations exist.

## Selected tools

- `pytest` for Python unit and API tests.
- `Vitest` for frontend unit/component tests.
- `httpx` through FastAPI's test client path for API tests.
- Docker Compose for database-backed integration tests.
- Playwright is deferred until the end-to-end visual workflow exists.
- JSON fixtures are manually maintained; generated contract clients are deferred.

## Test layers

### Build and static checks

- Frontend TypeScript check and production build.
- Backend import/startup check.
- Dependency and lockfile installation.
- JSON Schema/fixture validation where schemas are maintained.
- Repository hierarchy and forbidden-file checks where practical.

### Simulation unit tests

Required subjects:

- simulation clock and timestep count;
- fleet demand generation;
- charging-window and allocation validation;
- site and charger models;
- capacity and utilisation;
- cost model;
- emissions model;
- result aggregation;
- deterministic seed behavior;
- optional BESS and solar components when implemented.

Tests should use explicit small inputs and assert units, array alignment, and boundary behavior.

### API tests

- health/readiness response;
- valid and invalid scenario validation;
- simulation request returns the result contract;
- structured errors for invalid fields;
- site and fleet retrieval;
- comparison contract for compatible results.

### Integration tests

At minimum prove:

```text
Frontend/API client -> FastAPI -> application service -> simulation -> JSON result
Application service -> repository -> PostgreSQL/PostGIS
```

A full browser test is useful once the visual baseline exists, but the backend integration path must be testable independently.

### Smoke/startup tests

- frontend starts;
- backend starts;
- database service becomes ready;
- health endpoint responds;
- baseline scenario completes;
- baseline result reaches at least one frontend result consumer.

### Golden baseline

Maintain canonical deterministic fixtures:

```text
shared/examples/baseline-scenario.json
shared/examples/baseline-result.json
```

The fixture must be regenerated only through an intentional decision because it represents a regression contract.

## Determinism checks

Run the same scenario twice with the same seed and compare all defined result fields. If randomness is introduced, the seed must be part of the simulation configuration. Floating-point comparison tolerances must be documented for numeric assertions.

## Invalid-input checks

Cover:

- EV percentage outside 0-100%;
- negative charger power;
- non-positive site capacity;
- invalid site references;
- invalid operating hours;
- invalid timestep;
- allocation shares that do not satisfy the contract;
- mismatched result arrays;
- incompatible scenario comparison inputs.

Invalid data must be rejected before timestep execution.

## Architecture checks

Review each change for:

- forbidden dependency direction;
- simulation coupling to transport/persistence/rendering;
- undocumented new integration;
- public contract drift;
- fixed directory movement;
- future feature implementation in the baseline.

## Deferred test tooling

Browser automation with Playwright and generated contract clients are deferred because they do not affect the backend simulation or local baseline startup. The baseline uses pytest, Vitest, FastAPI/httpx testing, Docker Compose, and JSON fixtures.

## Verification evidence

Every implementation phase must report the exact commands executed, their result, files changed, known placeholders, and any test limitations. A passing-looking structure is not evidence of a passing build.
