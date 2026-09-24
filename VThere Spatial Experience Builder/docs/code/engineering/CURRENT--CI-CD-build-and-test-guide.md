# VThere CI/CD, Build, and Test Guide

**Baseline phase:** Not stage-specific, with ties to Stage 5 (production deploy). See [8-stage baseline overview](../baseline-phases.md).

## Purpose

This document explains what currently happens when VThere is installed, run,
built, tested, or checked by GitHub Actions. It also records the work that is
still needed before the project can claim broader integration, release, or
continuous delivery coverage.

Project root:

```text
VThere Spatial Experience Builder/
```

The repository workflow is:

```text
feature branch -> pull request to Working -> CI and review -> merge to Working
Working -> milestone pull request to main -> CI and review -> merge to main
```

`Working` is the current branch name and is case-sensitive in the workflow.
`main` is reserved for milestone or submission integration. The current
pipeline is continuous integration only; it does not deploy the application.

## Current CI workflow

The workflow is located at:

```text
.github/workflows/ci.yml
```

It runs on:

- pushes to `Working` or `main`;
- pull requests targeting `Working` or `main`.

The job is named `build-and-test`. It runs on `ubuntu-latest` with Node.js 22
and uses the VThere directory as its working directory.

The workflow steps are executed in this order:

1. Check out the repository.
2. Set up Node.js 22 and enable npm caching using the VThere lockfile.
3. Run `npm ci`.
4. Run `npm run typecheck`.
5. Run `npm test`.
6. Run `npm run build`.
7. Install the Chromium browser required by Playwright.
8. Run `npm run test:e2e`.

The workflow has read-only repository permissions and cancels an older run for
the same branch when a newer run starts.

## What each command does

Run these commands from `VThere Spatial Experience Builder/`. On Windows,
`npm.cmd` avoids PowerShell execution-policy issues.

### Install dependencies

```powershell
npm.cmd ci
```

`npm ci` removes and recreates installed dependencies from
`package-lock.json`. It is the reproducible install used by CI. It should be
used to verify a clean checkout. Use `npm.cmd install` only when intentionally
changing dependencies or regenerating the lockfile.

### Environment check

```powershell
npm.cmd run check:environment
```

This runs `scripts/check-environment.mjs`. It verifies:

- Node.js major version 22 or newer;
- npm major version 10 or newer;
- the `node_modules` directory exists.

The same check runs automatically before `dev` and `build` through npm
`predev` and `prebuild` hooks. It does not validate browsers, Python, API
packages, database services, or environment variables.

### Start local development

```powershell
npm.cmd run dev
```

This first runs the environment check, then starts Vite's development server.
The normal local URL is:

```text
http://localhost:5173
```

The development server supports the interactive editor and local browser
storage. It is not a production server and it does not start the API.

### Typecheck

```powershell
npm.cmd run typecheck
```

This runs `tsc --noEmit`. It checks TypeScript contracts and module usage
without writing JavaScript output. It is a static check, not a test and not a
production bundle.

The project also uses TypeScript project references during the production
build. Therefore, typecheck and build are intentionally both retained in CI.

### Unit tests

```powershell
npm.cmd test
```

This runs `vitest run` using `vitest.config.ts`. The current include pattern is:

```text
packages/**/*.test.ts
src/**/*.test.ts
```

Test files now span every baseline package (`packages/assets`, `packages/authoring-engine`,
`packages/debugging`, `packages/interaction`, `packages/sync`) plus the frontend surfaces
under `src/` (serializer, environments, editor scene tree, gizmo, sync, and viewport). Run
`npx vitest run --reporter=verbose` locally to see the current file and test count; do not
hard-code a specific count in this document since it grows with each package.

These are framework-free or focused unit tests. They do not start a browser,
run the API, exercise PostgreSQL or object storage, or prove preview/published
runtime parity.

### Production build

```powershell
npm.cmd run build
```

The command is:

```text
tsc -b && vite build
```

Before it starts, npm runs the `prebuild` environment check. The build then:

1. runs TypeScript project-reference compilation checks;
2. bundles the React, Vite, and Three.js frontend with Vite;
3. writes production files to `dist/`.

The generated bundle is not a deployment. It proves that the frontend can be
compiled and bundled. The current build passes with a known Vite warning that
the JavaScript chunk is larger than 500 kB. That warning should become a
performance or code-splitting task if load-time budgets require it.

### Browser smoke tests

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

`test:e2e` runs `playwright test` using `playwright.config.ts`. Playwright:

- starts Vite on `http://127.0.0.1:4173`;
- launches Chromium;
- runs tests from `tests/e2e/`;
- produces an HTML report and test results.

The current smoke test verifies that:

1. the application title loads;
2. the `Run simulation` control is visible;
3. simulation mode opens;
4. pressing Escape exits simulation mode (there is no on-screen exit button);
5. exiting simulation returns to the editor.

The current Playwright project covers Chromium desktop only. It does not yet
cover mobile viewports, Safari/WebKit, Firefox, accessibility, persistence
flows, object placement, selection, transforms, import rejection, or runtime
parity.

## What CI does not run yet

The following areas are planned or partially implemented but are not currently
part of `.github/workflows/ci.yml`:

- Python API tests with `pytest` and HTTPX;
- API type, lint, formatting, or dependency checks;
- PostgreSQL, MinIO, migrations, or database integration tests;
- editor/API contract tests;
- project serialization round-trip and migration coverage beyond the current focused tests;
- corrupt-draft recovery, autosave failure, retry, and revision-conflict tests;
- full editor browser workflows for placement, selection, transform, undo/redo, save, load, import, and export;
- preview versus published-runtime parity tests;
- mobile browser checks and the agreed browser/device matrix;
- accessibility checks;
- performance, bundle-size, frame-rate, asset-budget, and modest-hardware checks;
- security, authorization, project-isolation, signed-asset-URL, and publication tests;
- deployment, hosting, database migration, or rollback verification.

The architecture and testing strategy describe these as release goals. They
must not be described as passing CI checks until commands and tests are added
to the workflow and have completed successfully.

## Build, test, and run order for local verification

Use this sequence to reproduce the frontend CI job on Windows:

```powershell
cd "VThere Spatial Experience Builder"
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

For normal development, use:

```powershell
cd "VThere Spatial Experience Builder"
npm.cmd install
npm.cmd run dev
```

Use `npm.cmd install` when changing dependencies. After reviewing the change,
commit both `package.json` and `package-lock.json`, then verify with a clean
`npm.cmd ci`.

## Current CI/CD status

| Area | Status | Meaning |
|---|---|---|
| Dependency installation | Implemented | CI uses the committed npm lockfile |
| TypeScript typecheck | Implemented | `tsc --noEmit` runs in CI |
| Frontend unit tests | Implemented | Vitest runs 4 current test files |
| Production frontend build | Implemented | TypeScript build and Vite bundle run in CI |
| Chromium smoke test | Implemented | One editor-to-simulation flow runs in CI |
| API CI | Not implemented | API tests are not included in the workflow |
| Full integration testing | Not implemented | Browser/API/database contracts are still incomplete |
| Continuous delivery | Deferred | No deployment job exists |
| Release deployment from `main` | Deferred | Requires hosting, secrets, environment approvals, and rollback policy |

## What should be added next

### Highest priority: make the current pipeline trustworthy

- Confirm the `build-and-test` check is required by the `Working` and `main`
  branch rulesets (Settings > Rules), and that the required status-check name
  matches the actual job name (`build-and-test`).
- Keep Node.js 22, npm 10+, and the package engine declaration aligned.
- Review the npm audit findings before treating the dependency set as release-ready.

### Add focused frontend coverage

- Add serializer tests for malformed JSON, duplicate IDs, invalid transforms,
  file-size limits, wrong file types, and preserving the active project after
  rejection.
- Add persistence tests for primary storage, backup recovery, autosave status,
  failed writes, and retry behavior.
- Add authoring-engine tests for transform sessions, compound commands,
  delete/undo restoration, and redo invalidation.
- Extend Playwright to cover object placement, selection, transform controls,
  save/load, JSON export/import, invalid import handling, and simulation state.
- Add a mobile viewport smoke test and decide which browser matrix is required.

### Add backend and integration coverage

- Add a reproducible Python environment and install the API test dependencies.
- Add a CI job for `python -m pytest apps/api/tests`.
- Add API linting, formatting, type checks, and dependency installation from a
  locked or explicitly managed environment.
- Add contract tests between the editor, API, serializer, and project model.
- Add PostgreSQL, object-storage, migration, authorization, project-isolation,
  revision-conflict, and publication tests when those services exist.

### Continuous delivery status

`.github/workflows/deploy.yml` exists (Stage 5) as `workflow_dispatch`-only scaffolding: a
Docker Compose deploy (Caddy + frontend + API + Postgres) over SSH/rsync to a single VM. It
must not be given a `push` trigger or filled-in secrets until the following decisions are
recorded (see `SESSION.md` open question and [`deploy/README.md`](../../../deploy/README.md)):

- hosting provider and deployment target (VM owner);
- protected GitHub Environment (`production`) with required reviewers;
- environment secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`;
- database migration and rollback policy;
- health checks and post-deployment smoke tests;
- immutable release versioning and rollback procedure.

The intended direction is deployment from protected `main`, but that is a
future CD decision, not a current workflow behavior.

## Upkeep checklist

Update this document and the workflow when any of these change:

- Node.js or npm versions;
- package scripts or the lockfile;
- test directories or test runners;
- Playwright browser projects or supported devices;
- Vite port, host, build output, or environment variables;
- branch names, pull-request targets, or ruleset-required checks;
- API, database, storage, or deployment commands;
- release gates or acceptance scenarios.

For every new feature, add the narrowest relevant test in the same change and
then run the full local sequence before requesting review. Keep generated
`dist/`, `playwright-report/`, and `test-results/` output out of source control.

## Related documents

- [Development guide](UNDATED--CURRENT--development-guide.md)
- [Testing strategy](../../archive/delivery/UNDATED--FOUNDATION--testing-strategy.md)
- [Build system](../architecture/UNDATED--FOUNDATION--build-system.md)
- [Technology stack](../architecture/UNDATED--FOUNDATION--tech-stack.md)
- [Production deploy](../../../deploy/README.md)
- [Session handoff](../../../SESSION.md)
- [Git and handoff conventions](../../../../Agent%20Skills/GIT_AND_HANDOFF_CONVENTIONS.md)
