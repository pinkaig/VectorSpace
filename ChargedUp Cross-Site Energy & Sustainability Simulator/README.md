# ChargedUp Simulator

Baseline architecture for a cross-site fleet charging simulator.

## Local commands

Frontend: `cd frontend`, `npm ci`, `npm run typecheck`, `npm run build`, `npm run test`.

Backend: `cd backend`, create a Python 3.12 environment, install `requirements.txt`, then run `python -m pytest` from `backend` or `uvicorn app.main:app --reload`.

Database topology: `docker compose up -d db`. Migrations are a separate setup step. The baseline simulation results are request-scoped and are not persisted.

The local baseline has no authentication. Do not expose it beyond the configured local CORS origin without an approved production security design.
