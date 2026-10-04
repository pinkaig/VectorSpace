# API baseline

> **Not part of M1.** The M1 deliverable is the frontend editor, which runs in
> the browser and saves to localStorage. This service is scaffolding for a later
> milestone: its business route handlers return HTTP 501 and nothing in the M1
> build calls it. Running it is not required to build, test, or demonstrate M1 —
> use `run.sh` / `run.bat` at the repository root for that.

**Baseline phase:** Stage 3 (backend HTTP surface). See [8-stage baseline overview](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Baseline-Implementation-8-Stages).

Run from this directory with `uvicorn app.main:app --reload`. The `/health` route is the Phase 0 startup contract; authentication and project persistence are added in later phases.