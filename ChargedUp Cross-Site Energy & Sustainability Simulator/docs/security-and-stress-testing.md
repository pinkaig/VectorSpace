# Security and Stress Testing

## Document status

- Status: ACTIVE BASELINE REQUIREMENT
- Applies to: baseline generation and every implementation phase
- Owner: implementation agent for the current phase; architecture owner for policy changes
- Last reviewed: 2026-09-06
- Source: pre-baseline architecture review and current contracts/integration documents

This document is part of the engineering package. It is not a future hardening note. Step 4 must establish the controls and test harness that are applicable to the baseline. Step 5 must run the relevant checks for every changed boundary.

## Security posture

The baseline is a local, no-auth development application. It must still fail safely under malformed input and accidental exposure. Production authentication, TLS, cloud deployment, and persistent result storage remain deferred, but their absence must not be mistaken for a security control.

## Trust boundaries

```text
Untrusted browser input
        |
        v
HTTP/CORS boundary
        |
        v
Pydantic/API validation
        |
        v
Application services
        |              \
        v               v
Authoritative data   Simulation domain
        |               |
        v               v
PostgreSQL/PostGIS  Result serializer
        \              /
         v            v
          Browser response
```

The browser is never authoritative for site capacity, tariffs, emissions factors, database identifiers, or simulation rules.

## Vulnerability register

| ID | Severity | Risk | Current state | Required disposition |
|---|---|---|---|---|
| SEC-001 | HIGH | Unbounded scenario size/timestep can cause CPU, memory, or response exhaustion. | Open until limits and tests exist. | Implement request limits, simulation timeout, and bounded validation in the baseline. |
| SEC-002 | HIGH | Client-supplied site capacity, price, or emissions data can manipulate results. | Open contract risk. | Backend loads authoritative site data; permit only documented scenario overrides. |
| SEC-003 | HIGH | Comparison contract is ambiguous while results are in memory. | Open contract risk. | Baseline comparison accepts two validated result objects or is deferred; no unsupported IDs. |
| SEC-004 | MEDIUM | CORS/no-auth settings could be carried into an exposed deployment. | Deferred production risk. | Explicit local allowlist, no wildcard credentials, startup warning/failure for unsafe production configuration. |
| SEC-005 | MEDIUM | Error details could disclose SQL, paths, stack traces, or secrets. | Open response risk. | Return stable safe errors; log diagnostics server-side only. |
| SEC-006 | MEDIUM | SQL/database boundary could become injectable or over-privileged. | Design control required. | Parameterized SQL/SQLAlchemy expressions, restricted DB role, no runtime DDL. |
| SEC-007 | MEDIUM | WGS84/GeoJSON axis order and SRID are underspecified at the data boundary. | Open integration risk. | Enforce EPSG:4326, longitude/latitude ordering, coordinate ranges, and geometry validation. |
| SEC-008 | MEDIUM | Time-series interval semantics can create 96/97-point or unit mismatches. | Open contract risk. | Define interval-start semantics and test energy/cost conversion. |
| SEC-009 | LOW | Dependency and container versions can drift or introduce vulnerable packages. | Partially controlled by locks. | Commit lockfiles, pin image tags/digests, run npm audit and pip-audit in CI. |
| SEC-010 | LOW | In-memory results disappear across refreshes or multiple backend workers. | Accepted baseline limitation. | Use direct result comparison in one request; document single-process baseline limitation. |

## Mandatory baseline controls

### Input and resource limits

The API must reject requests exceeding explicit limits. Initial limits should be conservative and configurable through server settings, not user input:

- maximum request body: 1 MiB;
- maximum sites: 32;
- maximum chargers per site: 64;
- maximum fleet size: 10,000 vehicles;
- simulation horizon: one day for baseline;
- allowed timestep: 5, 10, 15, 30, or 60 minutes;
- maximum generated intervals: 288 for a one-day request;
- maximum comparison payload: two results within the same limits;
- request execution timeout: 10 seconds for the baseline;
- maximum concurrent simulation jobs: 1 per local process.

Requests exceeding a limit return a structured `400` or `413` error without entering the simulation loop. The implementation may choose lower limits if the documented baseline scenario remains valid.

### Authoritative data

`ScenarioRequest` must not allow the browser to redefine server-owned facts. The preferred baseline shape is:

```text
ScenarioRequest
├── fleet assumptions
├── site_ids
├── user-editable charging strategy
├── optional approved scenario overrides
└── simulation configuration
```

The backend resolves site position, capacity, charger power, tariff, and emissions assumptions from the repository. Any override must be explicitly named, bounded, and included in the result assumptions.

### Comparison safety

For the in-memory baseline, `POST /api/scenarios/compare` must accept two validated `SimulationResult` values in one bounded request, or remain unimplemented with a clear `501` response. It must not accept unsupported simulation IDs or trust client-provided metric differences.

### CORS and local exposure

- Local development uses an explicit origin allowlist.
- Wildcard origins are forbidden when credentials are enabled.
- Production mode must reject an empty or wildcard CORS allowlist.
- PostgreSQL must be reachable from the application network, not publicly exposed by default.
- No authentication is acceptable only for the local baseline and must be labelled in startup output.

### Error handling and logging

- Client responses contain stable error codes and safe messages.
- Never return exception strings, SQL, stack traces, filesystem paths, environment values, or credentials.
- Server logs may contain diagnostics but must redact passwords, tokens, and connection strings.
- Readiness failures must not expose database configuration.

### Database safety

- Use SQLAlchemy expressions or parameterized SQL only.
- Do not concatenate user input into SQL, table names, sort clauses, or migration commands.
- Application runtime uses a least-privilege database role.
- Migrations run as a separate setup step, not from every request.
- Seed scripts are deterministic and must not consume untrusted paths or URLs.

### Spatial and numeric validation

- Accept only EPSG:4326 WGS84 coordinates at the API boundary.
- Use GeoJSON `[longitude, latitude]` ordering.
- Enforce longitude `[-180, 180]` and latitude `[-90, 90]`.
- Reject NaN, infinity, negative capacities, negative power, invalid percentages, and malformed timestamps.
- Define interval energy as `energy_kwh = load_kw * timestep_minutes / 60`.

## Stress-test plan

Stress tests are bounded abuse and capacity tests, not production-scale benchmarking. They must run against a local test instance and synthetic data only.

| Test ID | Scenario | Expected result | Evidence |
|---|---|---|---|
| ST-001 | Maximum valid baseline-sized request | Completes within 10 seconds and stays within configured memory budget. | Test command, duration, peak memory. |
| ST-002 | Request body over 1 MiB | Rejected before simulation with `413` or documented equivalent. | HTTP response and server log. |
| ST-003 | Sites/chargers/fleet above configured maxima | Rejected with field-specific validation errors. | API test output. |
| ST-004 | Timestep below 5 or above 60 minutes | Rejected before execution. | API test output. |
| ST-005 | One-day request with 288 intervals | Completes deterministically within timeout. | Two-run result comparison and duration. |
| ST-006 | Malformed nested JSON and unknown fields | Rejected safely without traceback or 500 response. | API test and log inspection. |
| ST-007 | Client attempts altered tariff/capacity/emissions values | Server ignores/rejects unauthorized changes and uses authoritative values. | Result assumption assertion. |
| ST-008 | Comparison with mismatched timestamps/site IDs | Rejected as incompatible; no fabricated differences. | API/unit test output. |
| ST-009 | Repeated simulation submissions at local concurrency limit | Excess jobs fail or queue according to documented policy; process remains healthy. | Load-test summary and health result. |
| ST-010 | Database unavailable during health and site requests | Liveness remains distinguishable from readiness; no secret leakage. | HTTP status/body and logs. |
| ST-011 | SQL metacharacters in names/IDs | Treated as data; no query alteration or server error. | Repository/API test. |
| ST-012 | Invalid coordinates, NaN, infinity, and CRS mismatch | Rejected before persistence/rendering. | Validation output. |

## Test execution guidance

Baseline tools:

- `pytest` for simulation, API, validation, and repository tests.
- FastAPI/httpx test client for HTTP boundary tests.
- Vitest for frontend result/time-controller validation.
- Docker Compose for database-backed integration tests.
- A small Python or shell load harness may submit bounded requests; do not add a load-testing framework unless the test volume justifies it.

Required baseline commands once the repository exists:

```text
python -m pytest tests/security
python -m pytest tests/stress
npm run test -- security
npm audit --audit-level=high
python -m pip_audit -r backend/requirements.txt
```

If a command or test directory does not exist yet, Step 4 must create the corresponding harness or explicitly record the blocked check. It must not claim security verification from documentation alone.

## Exit criteria

The security/stress gate passes only when:

- [ ] SEC-001 through SEC-003 have implemented controls and tests.
- [ ] SEC-004 through SEC-008 have either implemented baseline controls or an approved documented deferral.
- [ ] Maximum valid requests complete within the configured timeout.
- [ ] Oversized and malformed requests are rejected without 500 errors or sensitive output.
- [ ] Authoritative site/economic data cannot be overridden by the client.
- [ ] Comparison behavior matches the in-memory persistence policy.
- [ ] Coordinates, timestamps, units, and result arrays pass contract tests.
- [ ] Dependency audit commands have run, or the missing tool is recorded as a blocker.
- [ ] Results, durations, memory observations, and known limitations are recorded.

## Phase change rule

If a phase needs to relax a limit, expose a new trust boundary, persist results, add authentication, or change the comparison/data contract, stop and report an `ARCHITECTURAL CONFLICT`. Update this document and the affected contracts before implementation continues.

## Evidence log

| Date | Phase | Tests/commands | Result | Findings | Owner |
|---|---|---|---|---|---|
| 2026-09-06 | Pre-baseline review | Document audit | OPEN | SEC-001 through SEC-010 recorded; no implementation evidence yet. | Architecture |
