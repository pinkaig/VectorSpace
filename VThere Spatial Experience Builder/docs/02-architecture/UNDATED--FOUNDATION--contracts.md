# Boundary Contracts

## Project document

The editor and runtime exchange a versioned JSON document. The minimum shape is:

```json
{
  "schemaVersion": 1,
  "id": "project-id",
  "name": "Exhibition title",
  "scenes": [],
  "activeSceneId": "scene-id"
}
```

The full baseline contract adds scene environment/camera, objects, components, zones, interactions, and navigation. Unknown schema versions are rejected; migrations are explicit and tested.

## API resources

The baseline API is resource-oriented HTTPS JSON:

```text
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/{projectId}
PUT    /api/v1/projects/{projectId}/draft
GET    /api/v1/projects/{projectId}/versions
POST   /api/v1/projects/{projectId}/publish
GET    /api/v1/published/{publicationSlug}
POST   /api/v1/assets/upload-url
POST   /api/v1/analytics/events
```

All author routes require an authenticated actor and server-side project authorization. Published reads enforce public/unlisted/authenticated access. Request and response models are FastAPI/Pydantic models and are the source for generated TypeScript API types.

## Interaction contract

```text
RuntimeEvent = objectClick | zoneEnter | sceneStart | timerElapsed | objectLookedAt | panelClosed
Action = showPanel | playAudioOrVideo | moveCameraToViewpoint | showOrHideObject | navigateScene | openLink
```

This is the brief's proposed six-trigger/six-action MVP vocabulary and remains a pitch approval decision. An interaction has a stable ID, trigger, source, action, target/parameters, and explicit order. Zone entry uses previous/current containment state so it dispatches on the false -> true edge only. The editor must provide immediate rule testing through visitor-mode preview without leaving the authoring workflow.

## Runtime camera and loading contract

- Authoring camera supports orbit, pan, and zoom.
- Visitor playback supports first-person-style movement unless the approved MVP decision selects camera-point navigation instead.
- Camera transitions interpolate over time; they do not teleport unless an action explicitly requests an instant move.
- Environments expose loading, progress, error, and retry states.
- Navigation loop protection prevents scene-entry rules from causing unbounded A -> B -> A execution.

## Project lifecycle contract

Project states are `draft`, `published`, and `archived`. Authors can create, open, duplicate, and archive projects subject to server-side organisation permissions. Accounts are administrator-created; public self-service signup is outside MVP. Published versions are immutable snapshots of a draft.

## Error contract

Errors use JSON with a stable code and human-readable message:

```json
{
  "error": { "code": "PROJECT_NOT_FOUND", "message": "Project was not found." }
}
```

Clients must branch on `code`, not message text. Validation failures identify field paths. Authorization failures do not disclose whether another actor's project exists.

## Asset contract

The API returns metadata and short-lived signed upload/read URLs. Binary media does not pass through the project JSON API. The project stores stable asset IDs and metadata references, never provider credentials or permanent private URLs.
