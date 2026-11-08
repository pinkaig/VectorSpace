# Performance budget (M2) — PROJ5-199

| Area | Budget | How it is checked | Measured |
|---|---|---|---|
| API response time | ≤ 2000 ms per request, all routes | Newman time-budget check in CI | CI passes (fill in slowest route ms) |
| API request body | ≤ 5 MB, larger returns 413 | Guard test | Enforced |
| Imported 3D models | triangle/texture cap | Import pipeline rejects oversize | Enforced |
| Editor frame rate | ≥ 30 FPS on a school laptop | Target only — not yet in CI | TODO: measure (Chrome Performance tab, 10 objects / 50 objects) |
| Deployed page load | < 5 s on a normal connection | Target only | TODO: Lighthouse on the Render URL |

Earlier renderer measurements: wiki page *Renderer-Performance-Test*.