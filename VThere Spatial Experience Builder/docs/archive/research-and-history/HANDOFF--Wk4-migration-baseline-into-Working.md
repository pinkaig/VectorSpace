# Handoff: Wk4 Baseline → Working Migration

**Branch:** `Wk4_Migration_BaseLine_Into_TechnicalSpike`
**Base:** `Working` (`868837e`) + `weian_branch` parent-child slices 1–2
**Source of migrated code:** `Full-Skeleton-ver-2-Industry-Project-5---Spatial-Experience-Builder` ("FS")
**State at handoff:** pushed to origin, working tree clean, 210/210 tests passing, `tsc --noEmit` clean, production build succeeds.

## What this branch is

`Working` is the hand-written, code-of-record editor. FS is the AI-generated
8-stage baseline (backend, asset manager, WHEN→DO engine, sync engine, deploy
infra) built on an earlier snapshot of `Working`. This branch merges FS's
additions onto current `Working` under one hard constraint: **gizmo,
rendering, and camera logic must not change** relative to `Working`. Where FS's
changes were purely additive, they were ported directly; where a change
touched gizmo/camera/render code, it was deferred and tracked, then completed
once the constraint could be verified safely (see "Parent-child rendering"
below).

## Commit log (`868837e..HEAD`)

```
267bfe0 Add zones/rules to the project schema; migrate parent-child validation
3a917f3 Split authoring-engine into objectAccess/transformMath, add command service
5ae18ef Add packages/assets, packages/interaction and packages/sync
1fddb10 Add scene tree, project sync client and asset resolution to the editor
1b13382 Add WHEN->DO Tier 1 events and asset-gated picking to the interaction controller
eac21b8 Wire the WHEN->DO runtime and command service into App and Viewport
7b83b5e Add backend HTTP surface, auth/storage/db, and deploy infrastructure
b78a241 Move DEFERRED--parent-child-rendering.md to docs/code/subsystems
6d368a7 Migration of docs
891e6bf Adopt the docs/code + docs/archive restructure from the baseline branch
95d65f3 Link the parent-child deferral doc from the docs README
0f4e4c8 Finish parent-child rendering: nest meshes, world-space gizmo, drag conversion
```

Each commit is scoped to one concern and should read cleanly on its own —
prefer `git log -p <sha>` per-commit over one giant diff if reviewing.

## What landed

- **Schema**: `zones`, `rules`, `ZoneShape`/`ZoneDefinition`/`ActionSpec`/`InteractionRule`
  types in `packages/project/src/index.ts`, all optional; `schemaVersion` stayed
  at `1`. Backfilled on load in `src/serializer.ts`.
- **Authoring engine**: `packages/authoring-engine/src/index.ts` split into
  `objectAccess.ts` (error types, `requireScene`/`requireObject`,
  `collectSubtreeIds`) and `transformMath.ts` (`composeWorldTransform`,
  `localTransformForNewParent` — framework-free, no `three` dependency, XYZ
  Euler↔quaternion reimplemented to match `THREE.Euler`). Added
  `commands/{types,transformCommands,commandService}.ts` — reversible
  transform commands that reject instead of writing NaN.
- **New packages**: `packages/assets` (resolver chain), `packages/interaction`
  (WHEN→DO dispatch: Tier 1 input events, Tier 2 zone tracking, Tier 3 action
  sequencing — gated behind `runtimeMode === 'play'`), `packages/sync`
  (`SyncClient`/`SyncQueue`/`SyncService`).
- **Editor/UI**: `src/editor/sceneTree.ts`, `src/sync/projectSync.ts`,
  `src/viewport/assetResolution.ts`, `AssetStatusBadge.tsx`, WHEN→DO wiring in
  `Viewport.tsx`/`RuntimeView.tsx`/`App.tsx`.
- **Backend + infra**: `apps/api/**` (auth/config/db/models/storage/routers),
  Alembic migrations, `Dockerfile`s, `docker-compose*.yml`, `deploy/`,
  `.github/workflows/deploy.yml` — entirely new, zero conflict with `Working`'s
  42-line health stub.
- **Docs**: restructured from the old numbered `01-product`…`07-research-and-history`
  layout to FS's `docs/code/` (current, code-tied reference) +
  `docs/archive/` (historical, not authority) split. See
  [`docs/README.md`](../../README.md) for the map.
- **Parent-child rendering** (`0f4e4c8`, the last commit): originally deferred
  (schema-only) to keep gizmo/render/camera byte-identical to `Working` during
  the bulk migration, then completed once it could be ported and verified in
  isolation. `syncArtefacts.ts` now nests meshes by `parentId`;
  `syncGizmo.ts` places the gizmo at the selected mesh's world position;
  `interactionController.ts` traverses the full mesh tree for picking and
  converts world-space drag math to local space before writing/committing.
  Full history and the original step-by-step plan:
  [`docs/code/subsystems/DEFERRED--parent-child-rendering.md`](../../code/subsystems/DEFERRED--parent-child-rendering.md)
  (kept as a reference despite the work being done — the title still says
  "deferred" in some older links but the doc's status header says
  "implemented").

## What did NOT change

Verified via `git diff Working HEAD -- <path>` returning empty, re-checked
after every subsequent commit including the parent-child work:

- `src/gizmo/**`
- `src/viewport/cameraController.ts`
- `src/viewport/environmentController.ts`
- `src/viewport/createGizmoSet.ts`
- `src/viewport/overlayWidgets.ts`
- `src/environments.ts`
- `src/ReferenceViewport.tsx`

`src/viewport/syncArtefacts.ts`, `syncGizmo.ts`, and `interactionController.ts`
**do** now diverge from `Working` — that divergence is the parent-child
rendering work itself, and is expected/accepted (see the deferral doc's
"Constraint check" section for the exact rationale).

## Known gaps / things not yet done

1. **Parent-child manual QA not run.** The deferral doc's "new behaviour"
   checklist (items 5–12: parent B to A and confirm on-screen pose preserved,
   drag A and confirm B follows, non-uniform parent scale, undo/redo across
   reparent/delete/duplicate, save/reload with nested hierarchy) has not been
   exercised by hand or by an e2e test. This is the single highest-risk
   untested surface on the branch.
2. **`npm run test:e2e`** (`tests/e2e/smoke.spec.ts`) has not been run this
   session — only `npx vitest run`, `npx tsc --noEmit`, and `npx vite build`
   were verified.
3. **`pytest` in `apps/api`** has not been run this session.
4. **Three subsystem docs still describe stale status claims**, flagged in
   `docs/README.md`'s "Known stale content" note:
   `docs/code/subsystems/asset-manager.md` and `sync-engine.md` say "planned,
   not yet implemented" for code that now exists (`packages/assets`,
   `packages/sync`). Needs a rewrite pass against current code, not a
   correctness bug.
5. **`npm audit`: 1 high-severity vulnerability in `vite`** (dev-server path
   traversal family, e.g. GHSA-g4jq-h2w9-997c). Dev-only surface. Fix
   available via `npm audit fix --force` but that bumps to `vite@6.4.3`,
   outside the currently declared range — a deliberate upgrade decision, not
   a blind fix.
6. **`package-lock.json`** was regenerated with `npm install` rather than
   taken from FS, to avoid unrelated lockfile churn — if a fresh
   `npm ci` ever diverges from what's committed, that's the place to look.

## Constraints and conventions to keep respecting

- **Gizmo/camera/render files stay byte-identical to `Working`** unless a
  change is explicitly scoped and verified (as parent-child rendering was).
  Re-run the `git diff Working HEAD -- <path>` checks listed above before
  merging any further work on this branch.
- **`packages/authoring-engine`'s `package.json` `exports` is a single
  string** — subpath imports like `@vthere/authoring-engine/commands` will
  not resolve. Everything must be re-exported from `index.ts`.
- **Concurrent GitHub Desktop writes**: this repo has another git client
  (GitHub Desktop) that has auto-committed mid-session more than once during
  this migration, under generic messages like "Migration work to be done" or
  "Migration of docs." If you see an unexpected commit landing under
  `gsherman01` with a generic message, diff its content against what you
  expected before assuming anything was lost — in every case so far the
  content matched what was already staged.

## Suggested next steps

1. Run the parent-child manual QA checklist (deferral doc, "Manual — the new
   behaviour," items 5–12) in `npm run dev`.
2. Run `npm run test:e2e` and `pytest` in `apps/api` — neither has been
   exercised against this branch's final state.
3. Rewrite `asset-manager.md` / `sync-engine.md` status claims to match
   current code.
4. Decide on the `vite` audit fix (upgrade now vs. track as tech debt).
5. When ready, open the PR from `Wk4_Migration_BaseLine_Into_TechnicalSpike`
   against whatever the intended target is — `Working` was explicitly never
   pushed to or merged into during this work, per the original constraint.
