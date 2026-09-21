# Object Lifecycle Scaffolding and Next-Agent Guide

**Date:** 2026-09-15  
**Status:** Handoff and implementation guide  
**Scope:** Canonical project data, authoring operations, object lifecycle, and the future ECS/query boundary.

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../../code/baseline-phases.md) for the full sequence.

## Purpose

This document records what the current scaffolding is meant to express and gives
 the next agent a constrained implementation path. The goal is to keep the
project model authoritative while moving object-edit behavior into the
authoring-engine package.

The intended architecture is:

```text
ProjectData snapshot
    |
    | canonical authored state
    v
@vthere/authoring-engine
    |
    | immutable object operations and command history
    v
App.tsx / editor UI
    |
    +--> serializer and persistence adapter
    +--> Viewport renderer projection
    +--> future runtime and API consumers
```

The C++ ECS files in this folder are research references. They are not the
browser application's source of truth and must not be copied as a global
mutable registry.

## Package Responsibilities

### `packages/project`

This package owns the canonical, renderer-independent project contract.

It should contain:

- `AssetKind`;
- `TransformData`;
- `SceneObject`;
- `SceneData`;
- `ProjectData`;
- `EnvironmentDefinition` and camera data;
- default constructors such as `makeScene`, `defaultProject`, and `makeObject`;
- defensive snapshot cloning;
- small read-only lookup helpers when they become necessary.

The project package answers:

> What data does a saved project contain?

It must not own:

- React state;
- selection state;
- Three.js objects;
- browser storage;
- undo/redo timelines;
- a singleton `ObjectManager`;
- mutable global object collections;
- editor command policy.

The commented pseudocode in
[`packages/project/src/index.ts`](../../../packages/project/src/index.ts)
documents this ownership. It is intentionally not executable lifecycle logic.

### `packages/authoring-engine`

This package owns how an author changes a project snapshot.

It should contain:

- immutable object operations;
- command inputs and typed operation results;
- validation of operation targets;
- injected object ID generation;
- undo/redo metadata;
- the existing `CommandTimeline`;
- future create, duplicate, remove, rename, transform, visibility, enabled,
  and re-parent commands.

The authoring engine answers:

> How does an accepted authoring action produce the next project snapshot?

Operations should accept a `ProjectData` value and return a new value. They
should never mutate the caller's project, React state, or renderer objects.

### `src/App.tsx`

The application layer should own:

- current React snapshot state;
- selected object ID;
- active scene UI state;
- dispatching authoring operations;
- save status and user-facing errors;
- calling the command timeline and persistence adapter.

It should not reimplement object lifecycle rules with direct array edits once
those rules are available in the authoring engine.

### `src/Viewport.tsx`

The viewport should own:

- Three.js scene and renderer lifecycle;
- picking and pointer translation;
- disposable renderer objects or an entity-to-render cache;
- gizmos and camera controls.

It should observe project snapshots. A Three.js mesh is a projection/cache, not
canonical object state.

### Serializer and future API

The serializer owns JSON validation, migration, import/export, local draft
storage, and backup recovery. A future API owns authorization, durable
revisions, conflict handling, and publication.

Neither layer decides what an object operation means.

## Current Scaffolding Features

### Canonical project scaffolding

The project index currently provides:

- stable typed project, scene, object, transform, environment, and camera data;
- default project and scene construction;
- primitive object construction with default resting heights;
- defensive project cloning;
- commented pseudocode describing future object lifecycle fields such as
  `visible`, `enabled`, `status`, and `parentId`;
- a clear boundary saying those future fields require an explicit schema
  migration before they become stored data.

### Existing command timeline

The authoring engine already provides:

- generic immutable current state;
- past and future history entries;
- configurable history limit;
- commit;
- undo;
- redo;
- defensive cloning of current, past, and future states;
- redo invalidation after a new commit.

### Intended object operations

The lifecycle API described by the scaffolding is:

```ts
interface ObjectIdFactory {
  nextId(project: ProjectData, sceneId: string): string
}

interface CreateObjectInput {
  sceneId: string
  assetKind: AssetKind
  name?: string
}

interface ObjectTargetInput {
  sceneId: string
  objectId: string
}

interface ObjectOperationResult {
  project: ProjectData
  objectId?: string
  removedObject?: SceneObject
  originalIndex?: number
}

createObject(project, input, idFactory)
duplicateObject(project, input, idFactory)
removeObject(project, input)
```

Expected behavior:

### Create

```text
require the target scene
validate the asset kind
request a fresh ID from the injected ID factory
make a default object through the project package
apply an optional display name
append it deterministically to the scene
return a new project snapshot and the new object ID
```

### Duplicate

```text
require the source scene and object
clone the object data, including independent transform tuples
request a fresh ID
give the copy a deterministic readable name
append the copy without changing the source
return a new snapshot and the copied object ID
```

### Remove

```text
require the target scene and object
capture the object and original array index for undo
return a new snapshot without that object
never mutate the caller's snapshot
```

Future remove behavior must account for dependent references before hierarchy,
interactions, media, or navigation are added.

## Important Current Mismatch

At the time of this handoff:

- `packages/authoring-engine/src/index.test.ts` already imports and tests
  `createObject`, `duplicateObject`, `removeObject`, and `ObjectOperationError`;
- `packages/authoring-engine/src/index.ts` currently contains the command
  timeline but does not yet export those lifecycle symbols;
- therefore the next agent must reconcile the test contract and implementation
  before claiming the object-operation slice is complete.

This is the first concrete task. Do not hide the mismatch by weakening or
removing the tests.

## Instructions for the Next Agent

### Step 1: Inspect before editing

Read these files first:

- [`packages/project/src/index.ts`](../../../packages/project/src/index.ts)
- [`packages/authoring-engine/src/index.ts`](../../../packages/authoring-engine/src/index.ts)
- [`packages/authoring-engine/src/index.test.ts`](../../../packages/authoring-engine/src/index.test.ts)
- [`packages/authoring-engine/package.json`](../../../packages/authoring-engine/package.json)
- [`src/App.tsx`](../../../src/App.tsx)
- [`src/serializer.ts`](../../../src/serializer.ts)
- [`src/Viewport.tsx`](../../../src/Viewport.tsx)

Confirm which changes are already present in the working tree before applying
anything. Do not revert unrelated user changes.

### Step 2: Keep the package boundary

Implement the lifecycle operations in `@vthere/authoring-engine`.
Do not put executable `createObject`, `duplicateObject`, or `removeObject`
functions in `packages/project`.

The project package may document contracts and provide constructors, but it
must remain data-oriented and serialization-friendly.

### Step 3: Implement the smallest compatible API

Add the types and operations expected by the existing tests:

- `ObjectIdFactory` with an injected `nextId` function;
- `CreateObjectInput`;
- `ObjectTargetInput`;
- `ObjectOperationResult`;
- `ObjectOperationError`;
- `createObject`;
- `duplicateObject`;
- `removeObject`.

Use `cloneProject` at the operation boundary. Use `makeObject` for defaults.
Do not add `visible`, `enabled`, `status`, or `parentId` to `SceneObject` in
this slice because that requires schema migration and serializer changes.

### Step 4: Preserve immutable behavior

Every operation must satisfy:

```text
input project remains unchanged
result.project is a separate snapshot
source object remains unchanged after duplication
new IDs are supplied by the caller's ID factory
missing scenes and objects produce typed operation errors
```

Do not use a module-level ID counter or global registry.

### Step 5: Connect history only after the pure operations pass

First test the operations independently. Then, if the surrounding editor
wiring is ready, wrap one operation in the existing timeline:

```text
current snapshot
  -> authoring operation
  -> result.project
  -> timeline.commit(label, result.project)
  -> React receives timeline.current
  -> serializer and viewport observe the accepted snapshot
```

Do not rewrite `App.tsx` or `Viewport.tsx` in the same slice unless a focused
integration task explicitly requires it.

### Step 6: Validate narrowly, then broadly

Run from `VThere Spatial Experience Builder/`:

```powershell
npm.cmd test -- packages/authoring-engine/src/index.test.ts
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The focused test must pass before broadening validation. The build may retain
the known Vite large-chunk warning; record it, but do not mix bundle splitting
into this lifecycle task.

### Step 7: Update documentation

After implementation, update this handoff with:

- the actual exported API;
- whether package dependencies changed;
- test counts and commands run;
- known limitations;
- the next smallest safe slice.

Do not claim hierarchy, ECS runtime behavior, visibility inheritance, or
preview/published parity until those features have tests and implementation.

## Deferred Work

The following work is intentionally outside this handoff:

- schema migration for `visible`, `enabled`, `status`, and `parentId`;
- parent validation and cycle detection;
- groups and subtree duplication/deletion;
- interaction/media/navigation reference rewriting;
- incremental `EntityId -> THREE.Object3D` synchronization;
- runtime interaction filtering;
- a separate `packages/commands` package;
- API persistence and multi-user conflict handling;
- replacing the flat project snapshot with a mutable ECS registry.

A separate `packages/commands` package should be considered only when command
families become broad enough to justify another stable package boundary. For
now, object lifecycle commands belong beside the existing authoring timeline.

## Acceptance Criteria

The next implementation is complete when:

- project data remains the only authoritative object state;
- object lifecycle functions live in `@vthere/authoring-engine`;
- the existing lifecycle tests compile and pass;
- operations return immutable snapshots;
- IDs are injectable and never derived from array position alone;
- invalid targets fail explicitly;
- the command timeline remains passing;
- typecheck and build pass;
- no renderer, React, browser storage, or API dependency enters the authoring
  engine.
