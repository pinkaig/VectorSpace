# Build System

## Current client commands

Run from `VThere Spatial Experience Builder/`:

```text
npm install
npm run build
npm run dev
```

These commands are defined in `package.json`. They were not executable in the authoring environment when this document was drafted because Node.js/npm was unavailable. Install Node.js 22 LTS, run `npm install`, commit `package-lock.json`, then record the real output here before baseline approval.

## Planned verification commands

```text
npm run test
npm run test:e2e
python -m pytest
uvicorn app.main:app --reload
docker compose up -d postgres minio
```

The test scripts and API directory are planned baseline outputs, not yet verified commands. Do not mark them verified until the corresponding files exist and the commands complete successfully.

## Acceptance path

Fresh checkout -> install Node.js 22 LTS and Python 3.12 -> install npm/Python dependencies -> start PostgreSQL and MinIO -> run migrations -> build shared/client packages -> run Vitest, pytest, and Playwright -> start editor, runtime, and API -> execute the technical-spike scenario.
