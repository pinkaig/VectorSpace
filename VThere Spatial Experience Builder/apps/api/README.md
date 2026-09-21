# API baseline

**Baseline phase:** Stage 3 (backend HTTP surface). See [8-stage baseline overview](../../docs/code/baseline-phases.md).

Run from this directory with `uvicorn app.main:app --reload`. The `/health` route is the Phase 0 startup contract; authentication and project persistence are added in later phases.