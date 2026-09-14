# Project Serialization

## Contents

- [Overview](#overview)
- [Responsibilities](#responsibilities)
- [Data structures](#data-structures)
- [Public functions](#public-functions)
- [Load and save flow](#load-and-save-flow)
- [Validation and error handling](#validation-and-error-handling)
- [Security and data limits](#security-and-data-limits)
- [Sample usage](#sample-usage)
- [Testing](#testing)
- [Related files](#related-files)

## Overview

The serializer converts the typed `ProjectData` object into JSON and reconstructs it from JSON or browser storage. It is the boundary between in-memory application state and a portable project file.

This page documents the larger persistence system. Implementation details for each file belong in the source headers and code, especially [src/serializer.ts](../../src/serializer.ts), [src/model.ts](../../src/model.ts), and [src/App.tsx](../../src/App.tsx).

Current implementation: [src/serializer.ts](../../src/serializer.ts)

The prototype uses `localStorage`. The planned production architecture will replace browser-only persistence with a server-backed versioned API while preserving the project contract.

## Responsibilities

The module owns:

- JSON serialization and deserialization
- Project shape validation
- Import-file size and type checks
- Current-draft and backup-draft recovery
- Explicit save and local autosave support
- JSON download/export
- Persistence result reporting

The module does not own:

- React UI state
- Three.js rendering
- User authentication
- Server authorization
- Database transactions
- Published-version lifecycle

## Data structures

```ts
export interface ProjectData {
  schemaVersion: 1
  id: string
  name: string
  scenes: SceneData[]
  activeSceneId: string
}

export interface SceneData {
  id: string
  name: string
  objects: SceneObject[]
}

export interface SceneObject {
  id: string
  name: string
  assetId: string
  assetKind: 'cube' | 'sphere' | 'cylinder'
  transform: TransformData
}

export interface TransformData {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}
```

The schema version is part of the data so a future migration can distinguish old project formats from current ones.

## Public functions

| Function | Input | Output | Responsibility |
|---|---|---|---|
| `serializeProject` | `ProjectData` | `string` | Produces formatted canonical JSON. |
| `deserializeProject` | JSON string | `ProjectData` | Parses and validates JSON. |
| `importProjectFile` | Browser `File` | `Promise<ProjectData>` | Checks file metadata and imports its text. |
| `loadProjectWithSource` | None | `ProjectLoadResult` | Loads current draft, backup, or default project. |
| `saveProject` | `ProjectData` | `PersistenceResult` | Writes primary and backup storage records. |
| `downloadProject` | `ProjectData` | `void` | Creates a browser download containing project JSON. |
| `copyProject` | `ProjectData` | `ProjectData` | Makes an independent snapshot for history. |

Example:

```ts
const json = serializeProject(project)
const restored = deserializeProject(json)
```

## Load and save flow

### Loading

```text
loadProjectWithSource()
  -> read current localStorage record
  -> deserialize and validate
  -> return draft if valid
  -> try backup if current record is missing or invalid
  -> return default project if both are unavailable
```

The returned source is visible to the UI so the user knows whether the project came from the current draft, backup, or a clean default.

### Saving

```text
saveProject(project)
  -> serialize project
  -> preserve previous primary record as backup
  -> write new primary record
  -> report saved
  -> if primary fails, attempt backup-only save
  -> report failure if both writes fail
```

`App.tsx` debounces autosaving so every keystroke does not immediately write to storage.

## Validation and error handling

Validation happens after `JSON.parse` because valid JSON syntax does not guarantee a valid project.

Rejected examples include:

- Unsupported `schemaVersion`
- Missing project identity
- Empty or excessive scene count
- Duplicate scene IDs
- Duplicate object IDs
- Unsupported asset kinds
- Invalid transform tuples
- Excessive object count
- Oversized import files
- Non-JSON file extensions or MIME types

Example error boundary:

```ts
try {
  const imported = await importProjectFile(file)
  setProject(imported)
} catch (error) {
  setSavedAt('Import rejected')
  setPersistenceState(
    error instanceof Error
      ? error.message
      : 'Project file could not be verified',
  )
}
```

Expected invalid input becomes user feedback. It does not become an unhandled application crash.

## Security and data limits

The serializer applies size and count limits to reduce accidental resource exhaustion. It also rejects unexpected asset kinds and malformed transforms before they reach the renderer.

This is validation, not authorization. A future server must still enforce project ownership and access control independently of browser code.

## Sample usage from `App`

```ts
useEffect(() => {
  const timer = window.setTimeout(() => {
    persist(project, 'Autosaved')
  }, 750)

  return () => window.clearTimeout(timer)
}, [project])
```

This demonstrates a React effect with a cleanup function. When `project` changes, a delayed save is scheduled. When another change occurs before the delay finishes, the previous timer is cancelled.

## Testing

The serializer should have focused tests for:

- Serialize and deserialize round trips
- Invalid JSON
- Unsupported schema versions
- Duplicate IDs
- Invalid transforms
- File size and extension restrictions
- Current-draft recovery from a valid backup
- Failure of primary and backup writes
- Export filename generation

The test should assert both behaviour and user-visible persistence status. A log message alone is not proof that a save succeeded.

## Related files

- [Project model](../../packages/project/src/index.ts)
- [Application coordinator](../../src/App.tsx)
- [Debugging logger](../../packages/debugging/src/index.ts)
- [Testing strategy](../03-delivery/UNDATED--FOUNDATION--testing-strategy.md)
- [Architecture contract](../02-architecture/UNDATED--FOUNDATION--architecture.md)

## Change history

| Date | Change |
|---|---|
| 2026-09-13 | Expanded documentation with data contract, public functions, flow, errors, and testing guidance. |
