# Boundary Contracts

**Baseline phase:** Not stage-specific — describes the system the 8 stages implement. See [8-stage baseline overview](../baseline-phases.md).

**Proposed, not built.** [`attachment-integration.md`](../subsystems/attachment-integration.md) and its four companion docs (audio, image, text, video) propose additions to `ProjectData` (`Attachment`, `MediaKind`, per-kind meta arrays) and new action kinds. None of that is implemented; the contracts below describe only what is built today.

## Project document

The editor and runtime exchange the canonical `ProjectData` document defined in `packages/project/src/index.ts`. The real shape (as implemented, schema version 1) is:

```ts
interface ProjectData {
  schemaVersion: 1
  id: string
  name: string
  scenes: SceneData[]
  activeSceneId: string
  rules?: InteractionRule[]   // absent in older files; serializer backfills to []
}

interface SceneData {
  id: string
  name: string
  objects: SceneObject[]
  environmentId: string
  startCamera: CameraPose
  zones?: ZoneDefinition[]    // absent in older files; serializer backfills to []
}

interface SceneObject {
  id: string
  name: string
  assetId: string
  assetKind: 'cube' | 'sphere' | 'cylinder'
  visible: boolean
  enabled: boolean
  parentId?: string           // absent = top-level object
  transform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }
}

interface InteractionRule {
  id: string
  objectId?: string
  zoneId?: string
  triggers: string[]
  actions: { kind: string; params?: Record<string, unknown> }[]
  priority?: number
}
```

This is materially fuller than the originally planned minimum shape: objects, transforms, zones, and WHEN->DO rules are implemented and part of `ProjectData` today (added by additive migration — new fields are optional and backfilled, so `schemaVersion` stayed `1`). Not yet implemented: a `components` concept distinct from `SceneObject`, and a navigation/wayfinding graph beyond `activeSceneId` + per-scene `startCamera`. `EnvironmentDefinition` (procedural or GLB) is implemented but referenced by ID (`environmentId`), not embedded per-scene.

Unknown schema versions should be rejected and migrations explicit; the only migration behavior actually implemented today is the additive-field backfill in the serializer (`src/serializer.ts`) — there is no `packages/serialization/` package or versioned-migration framework yet.

## API resources

The baseline API is resource-oriented HTTPS JSON, mounted directly under `/` (not `/api/v1/`) per `apps/api/app/main.py`:

```text
GET    /health

GET    /projects
POST   /projects
GET    /projects/{project_id}
PATCH  /projects/{project_id}
DELETE /projects/{project_id}

GET    /projects/{project_id}/versions
POST   /projects/{project_id}/versions              (publish)
GET    /projects/{project_id}/versions/{version_id}
POST   /projects/{project_id}/versions/{version_id}/activate

GET    /projects/{project_id}/media
POST   /projects/{project_id}/media                  (request upload URL)
GET    /projects/{project_id}/media/{media_id}
DELETE /projects/{project_id}/media/{media_id}

GET    /projects/{project_id}/rules
POST   /projects/{project_id}/rules
GET    /projects/{project_id}/rules/{rule_id}
PATCH  /projects/{project_id}/rules/{rule_id}
DELETE /projects/{project_id}/rules/{rule_id}

POST   /projects/{project_id}/analytics/events
GET    /projects/{project_id}/analytics/events
GET    /projects/{project_id}/analytics/summary
```

**Implementation status:** `GET /health` is the only route with a real handler. Every other route above is real FastAPI routing with typed Pydantic request/response models (`apps/api/app/routers/projects.py`, `publish.py`, `media.py`, `rules.py`, `analytics.py`) but each handler body is `raise not_implemented(...)`, returning **HTTP 501** (`apps/api/app/routers/_skeleton.py`). There is no `/published/{publicationSlug}` route yet for unauthenticated visitor reads — the runtime currently loads `ProjectData` client-side rather than from a published-read endpoint.

Auth is real infrastructure, not skeleton: `apps/api/app/auth.py` fetches and caches the Auth0 tenant's JWKS, validates bearer JWTs (RS256, audience/issuer checked) via `python-jose`, and exposes `get_current_token` as a FastAPI dependency. It is not yet wired as a `Depends(...)` into any of the routers above, so authenticated-actor enforcement and per-project authorization are not yet applied at the route level. Asset upload/download URL generation (`apps/api/app/storage.py`, boto3 presigned URLs against MinIO) is also real infrastructure, called by no route yet.

Request and response models are FastAPI/Pydantic models (see each router file) and remain the intended source for generated TypeScript API types; no such generation step exists yet.

## Interaction contract

The dispatcher and rule shape are implemented in `packages/interaction`; both the trigger (`RuntimeEvent.kind`) and action (`ActionSpec.kind`) vocabularies are **open strings**, not closed enums — `dispatch()` and the action registry have no opinion about which kind values are legal, so the original six-trigger/six-action list below is the intended default vocabulary rather than an enforced contract:

```text
RuntimeEvent.kind (open string) = objectClick | zoneEnter | sceneStart | timerElapsed | objectLookedAt | panelClosed | ...
ActionSpec.kind (open string, resolved by an ActionRegistry the caller populates) = showPanel | playAudio | moveCameraToViewpoint | showOrHideObject | navigateScene | openLink | ...
```

**Resolved naming drift: `playAudioOrVideo` → `playAudio`.** The list above originally used a combined `playAudioOrVideo` example, not implemented verbatim. The real, registered and tested action kind is `playAudio` (`packages/audio/src/actions/registerAudioActions.ts`, `packages/interaction/src/actions/registry.test.ts:42`), aligned here 2026-09-27. [`attachment-integration.md`](../subsystems/attachment-integration.md) (section 9, proposed) keeps a `playAudio`/`playVideo` split rather than one combined kind, consistent with this.

An `InteractionRule` (`packages/project`) has `id`, optional `objectId`/`zoneId` (absent = wildcard match), `triggers: string[]`, `actions: ActionSpec[]`, and optional `priority`. `dispatch(event, rules, project, state)` (`packages/interaction/src/dispatcher.ts`) matches every rule whose `triggers` include the event's `kind` and whose `objectId`/`zoneId` don't contradict the event, orders matches by priority (descending) then authoring order (stable sort), and returns a `DispatchResult` — it performs no I/O and executes no action itself.

**Resolved (2026-09-28): `showPanel` takes `attachmentId`, with `componentId` accepted as an alias.** The executor is now implemented and registered: `registerTextActions` (`packages/text/src/actions/registerTextActions.ts`, wired in `src/Viewport.tsx` beside `registerAudioActions`) registers `showPanel`, `hidePanel` and `advancePanel`. `showPanel` accepts `attachmentId` (preferred), `componentId` (alias, so existing example rules keep working, per `ActionSpec`'s doc comment in `packages/project/src/index.ts`), or a bare `assetId` for a hostless panel. `showPanel`'s `wait: true` is accepted but not yet honored — the sequencer has no wait-for-close primitive; the executor warns instead of silently ignoring it.

Zone entry is edge-triggered as originally specified: `packages/interaction/src/zoneTracker.ts`'s `createZoneTracker()` tracks previous/current occupancy per zone and only emits a `zoneEnter` `RuntimeEvent` on the false -> true transition; `RuntimeState.visitedZones` then remembers that a zone was ever entered, independent of whether a rule matched at that moment. Action execution and sequencing (multi-step DO chains, waits) are implemented separately in `packages/interaction/src/ActionSequencer.ts` (`createActionSequencer`, `waitSeconds`). Immediate rule testing through an in-editor visitor-mode preview is not confirmed as implemented — the runtime (`src/RuntimeView.tsx`) reuses the shared viewport, but a dedicated "preview without leaving the authoring workflow" mode is not verified in source.

## Runtime camera and loading contract

- Authoring camera supports orbit, pan, and zoom, and a walk/first-person mode — implemented in `src/viewport/cameraController.ts` (camera poses, walk movement) and driven by `src/viewport/interactionController.ts`.
- Visitor playback (`src/RuntimeView.tsx`) reuses the same viewport/camera controller as the editor rather than a separate camera-point navigation mode; per-scene `startCamera` (`CameraPose` in `packages/project`) sets the entry pose.
- Camera transition interpolation is not confirmed as implemented beyond `cameraController.ts`'s pose handling; treat instant-vs-interpolated transitions as unverified until checked against that file directly.
- Environments expose loading, progress, error, and retry states via `src/viewport/environmentController.ts` and `src/viewport/ViewportOverlay.tsx` (`ViewportOverlay` presentation component).
- Navigation loop protection for scene-entry rules is not confirmed as implemented in `packages/interaction` — mark as planned, not verified, until traced through the dispatcher/action executors directly.

## Project lifecycle contract

Project states are `draft`, `published`, and `archived` in the data model (`apps/api/app/models.py`, `Project.status` with a check constraint enforcing exactly these three values). The service-layer behavior described here (create/open/duplicate/archive subject to organisation permissions, administrator-created accounts, immutable published snapshots) is the intended contract the schema supports; the routes that would implement it (`projects.py`, `publish.py`) are still 501 skeletons, so none of this lifecycle is enforced end-to-end yet.

## Error contract

```json
{
  "error": { "code": "PROJECT_NOT_FOUND", "message": "Project was not found." }
}
```

This stable-code error envelope is the intended contract; it is not yet observable because the routes that would return domain errors currently return FastAPI's default 501 body (`{"detail": "..."}`) via `not_implemented()` in `apps/api/app/routers/_skeleton.py`, not the `{"error": {"code", "message"}}` shape above. Implement the envelope when the first real handler is built. Clients must still branch on a stable `code`, not message text, once it exists. Validation failures should identify field paths; authorization failures should not disclose whether another actor's project exists — both remain unverified until authorization is wired into a router.

## Asset contract

Two related but distinct asset systems exist:

- **Client-side resolution** (`packages/assets`, implemented): `AssetRef { assetId, kind }` is resolved by an `AssetResolver` (`resolve(ref): Promise<AssetDescriptor>`) to an `AssetDescriptor { ref, status, contentType?, url?, blob?, errorMessage?, expiresAt? }`. Three concrete resolvers exist — `PrimitiveResolver` (built-in cube/sphere/cylinder), `LocalCatalogResolver` (a fixed local dev catalog), and `RemoteMediaResolver` (fetches from a remote media backend) — plus `CachingAssetResolver` (wraps any resolver with `AssetCache`) and `PlaceholderAssetResolver` (returns a placeholder descriptor while the real one loads). None of these call the API's presigned-URL endpoints today.
- **Server-side storage** (`apps/api/app/storage.py`, real boto3 infrastructure; `apps/api/app/routers/media.py`, route skeleton): the intended contract — API returns metadata and short-lived signed upload/read URLs via MinIO/S3, binary media never passes through the project JSON API, and the project stores stable asset IDs rather than provider credentials or permanent private URLs — is implemented at the storage-helper level (`generate_presigned_upload_url`, `generate_presigned_download_url`) but not yet wired to a working route: `media.py`'s `request_media_upload` handler, which would call `storage.py` and persist a `MediaAsset` row, still raises `not_implemented`.

## Usage

Authoring a rule and resolving the asset it targets, using only real exports:

```ts
import type { InteractionRule } from '@vthere/project'
import { dispatch, createRuntimeState } from '@vthere/interaction'
import { PrimitiveResolver, CachingAssetResolver, AssetCache } from '@vthere/assets'

const rule: InteractionRule = {
  id: 'rule-1',
  objectId: 'cube-123',
  triggers: ['objectClick'],
  actions: [{ kind: 'showPanel', params: { panelId: 'info-panel' } }],
}

const resolver = new CachingAssetResolver(new PrimitiveResolver(), new AssetCache())
const descriptor = await resolver.resolve({ assetId: 'primitive-cube', kind: 'cube' })
// descriptor.status === 'ready' once resolved; descriptor.url/contentType describe the payload.

const result = dispatch(
  { kind: 'objectClick', objectId: 'cube-123' },
  [rule],
  project,
  createRuntimeState(project.activeSceneId),
)
// result.actions === [{ kind: 'showPanel', params: { panelId: 'info-panel' } }]
```
