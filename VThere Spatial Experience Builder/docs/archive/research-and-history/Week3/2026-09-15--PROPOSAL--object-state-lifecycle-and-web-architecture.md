# Object State, Lifecycle, and Web Application Architecture Proposal

**Status:** Proposed focused addition; not yet an implementation contract  
**Date:** 2026-09-15  
**Terminology:** Use `Object` for this phase. Do not rename the concept to `Entity` yet.

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../../code/baseline-phases.md) for the full sequence.

## Scope

This proposal intentionally covers only:

- separate `visible` and `enabled`/active state;
- object creation and duplication;
- object removal;
- where object logic should live in the web application;
- how browser state, server state, rendering, and persistence interact;
- failure modes and engineering practices for non-procedural web behavior.

Parent-child hierarchy, grouping, and a broader ECS component model remain
separate design work. This proposal leaves room for those features without
requiring them now.

## Recommendation in one paragraph

Keep the canonical object state inside the immutable `ProjectData` snapshot
owned by `packages/project`. Add pure object operations and commands near the
authoring-engine boundary. Do not make a mutable global `ObjectManager` the
source of truth. If an application-level facade is useful, call it
`ObjectOperations` or `ObjectService` and make it accept a project snapshot,
return a new snapshot, and report typed failures. Let `App.tsx` coordinate UI
state, let `Viewport.tsx` render a disposable cache of the snapshot, and let a
future API own durable multi-user revisions.

```text
React event
    -> Object command / pure operation
    -> validated ProjectData snapshot
    -> command history
    -> persistence adapter
    -> renderer synchronization
```

The order is important: rendering and storage should observe an accepted
object change; they should not decide what the change means.

## Current starting point

The current implementation has a useful but incomplete separation:

- `packages/project/src/index.ts` defines `SceneObject` and stores objects in
  `SceneData.objects`.
- `src/App.tsx` currently creates objects and directly maps arrays for edits.
- `packages/authoring-engine` provides a generic immutable snapshot timeline,
  but object commands have not yet moved into it.
- `src/Viewport.tsx` reconstructs Three.js objects from the current array.
- `src/serializer.ts` validates, serializes, autosaves, backs up, and reloads
  the project through browser storage.

This means object behavior is currently partly domain data, partly React
orchestration, and partly renderer behavior. That is manageable for a small
prototype, but it becomes risky when the same object can be created, copied,
hidden, disabled, deleted, undone, autosaved, reloaded, rendered, and later
edited by more than one browser or user.

## Object state contract

Add these fields to the canonical object model in a schema migration:

```ts
export interface SceneObject {
  id: string
  name: string
  assetId: string
  assetKind: AssetKind
  visible: boolean
  enabled: boolean
  transform: TransformData
}
```

Use `enabled` as the canonical field name in stored data. The UI may label it
`Active` if that is clearer for authors, but the model should not alternate
between `active`, `enabled`, and `isActive`.

### `visible`

`visible` controls whether the object is presented by a renderer.

- `true`: the viewport/runtime may draw it.
- `false`: the object remains in the project but is not drawn.
- Hidden objects remain available in the scene tree and inspector so authors
  can recover them.
- Hidden objects should not be selectable by ordinary viewport raycasting.
- Explicit scene-tree selection may still inspect a hidden object.

### `enabled`

`enabled` controls whether the object participates in object behavior.

- `true`: object systems may process it.
- `false`: object systems skip it.
- The object remains serialized and can remain visible for authoring inspection.
- Disabled objects should not receive runtime interactions, triggers, or
  visitor input.
- The editor must define whether disabled objects can still be transformed;
  the recommended default is yes, with a clear disabled indicator, because an
  author may need to prepare staged content.

These are intentionally independent states:

| `visible` | `enabled` | Meaning |
| --- | --- | --- |
| true | true | Drawn and active |
| true | false | Drawn but behavior disabled |
| false | true | Hidden but logically active; useful for staged or conditional content |
| false | false | Hidden and inactive |

Visibility is a presentation decision. Enabled state is a participation
decision. Combining them into one flag would make staged content, debugging,
runtime rules, and future conditional presentation harder to express.

## Object creation and duplication

### Creation

Creation should be a domain operation with one command boundary:

```ts
interface CreateObjectInput {
  assetKind: AssetKind
  name?: string
  transform?: TransformData
  visible?: boolean
  enabled?: boolean
}

interface ObjectOperationResult {
  project: ProjectData
  objectId?: string
}
```

The operation should:

1. validate the target scene and asset kind;
2. allocate a stable, collision-resistant object ID;
3. apply defaults (`visible: true`, `enabled: true`);
4. append the object at a deterministic scene position;
5. return the new project snapshot and created object ID;
6. be committed as one history entry;
7. allow the UI to select the new object after the state commit.

The ID generator must be injected or owned at the application boundary. Avoid
using `Date.now()` plus an array index as the long-term identity strategy. That
approach is hard to test, can collide in fast or concurrent operations, and
mixes identity with presentation order.

### Duplication

Duplication is not creation with the old ID. It is a distinct operation:

```ts
duplicateObject(project, sceneId, sourceObjectId, options)
```

It should:

- create a fresh ID every time;
- copy asset, transform, visibility, and enabled state;
- copy the name with a deterministic readable suffix;
- apply a small deterministic offset only if the UX requires one;
- never mutate the source object;
- select the copy after commit;
- be undone and redone as one command;
- define explicit behavior for future references such as interactions,
  content, media, and navigation targets.

For this focused phase, duplication should copy only the object data currently
in the schema. Once dependent components exist, duplication must use a
reference policy rather than blindly copying IDs:

| Reference type | Suggested duplicate behavior |
| --- | --- |
| Asset ID | Share the same approved asset |
| Object self-reference | Remap to the new object ID |
| Reference to an outside object | Preserve only if the product defines shared references |
| Interaction targeting the source | Copy only after explicit product approval |

## Object removal

Removal should also be a command, not a direct `filter()` inside a React event
handler.

```ts
removeObject(project, sceneId, objectId): ObjectOperationResult
```

The command must capture enough information to restore the exact prior state:

- complete object record;
- original array position;
- previous selection state;
- future parent/group relationship if added;
- dependent references once those exist.

The recommended first policy is:

- delete one object as one undoable operation;
- remove the selection if the selected object is deleted;
- do not silently delete or orphan dependent data;
- when references are introduced, either reject removal with a typed conflict
  or execute a compound removal that explicitly reports what was removed;
- undo restores the same ID, data, and ordering;
- redo repeats the captured removal and does not create a new interpretation.

The UI should provide a confirmation only for destructive cases where the
operation affects dependent state or multiple objects. A confirmation dialog
is not a substitute for a reversible command and reliable undo.

## Should this be an `ObjectManager`?

### Recommendation: not as a central mutable manager

An `ObjectManager` often becomes a "god object" that owns identity, arrays,
selection, rendering, persistence, undo/redo, and UI callbacks. That creates
unclear authority and makes bugs difficult to localize.

Do not create a long-lived singleton such as:

```ts
objectManager.create()
objectManager.delete()
objectManager.save()
objectManager.render()
```

That style hides which project version is being changed and encourages
renderer, React, and storage concerns to leak into the same module.

### Preferred split

Use small boundaries with explicit inputs and outputs:

| Boundary | Responsibility |
| --- | --- |
| `packages/project` | Object types, defaults, ID contract, pure lookup helpers |
| `packages/authoring-engine` | Create, duplicate, visibility, enabled-state, and removal commands; undo/redo |
| `src/App.tsx` | React state, selection UI, dispatching commands, status messages |
| `src/Viewport.tsx` | Three.js rendering, picking, and renderer cache synchronization |
| `src/serializer.ts` or future `packages/serialization` | Validation, migration, import/export, draft persistence |
| Future API | Durable revisions, authorization, conflict handling, publication |

An `ObjectOperations` module can be useful as a narrow facade over pure
operations and commands. It should not own a second object collection. Its
methods should resemble:

```ts
create(project, input, dependencies): Result
duplicate(project, input, dependencies): Result
setVisible(project, objectId, visible): Result
setEnabled(project, objectId, enabled): Result
remove(project, objectId): Result
```

Each method returns a new snapshot or a typed failure. This keeps the API easy
to test and leaves the caller responsible for history and persistence policy.

## Where object state lives in a web application

There are several different meanings of "state". Confusing them is a major
source of web application bugs.

### 1. Canonical authored project state

This is the object data a user expects to save, export, undo, reload, and later
publish. It belongs in the versioned `ProjectData` document.

Examples:

- object ID and name;
- asset reference;
- transform;
- `visible` and `enabled`;
- future hierarchy, components, and interaction references.

This state must be serializable, validated, deterministic, and independent of
React and Three.js.

### 2. Editor session state

This exists only for the current authoring session:

- selected object ID;
- open panels;
- gizmo mode;
- camera pose while editing;
- hover state;
- pending drag preview;
- undo/redo cursor.

It belongs in React or an editor-session store. Do not put it in the saved
project unless the product explicitly wants it persisted.

### 3. Renderer state

This is a disposable projection of authored state:

- Three.js `Mesh` and `Object3D` instances;
- GPU geometry and materials;
- raycaster hit targets;
- selection outlines and gizmos.

It belongs in the viewport/presentation adapter. It must be rebuildable from a
project snapshot and must never be the authority for object data.

### 4. Server state

Once the backend exists, the server owns durable shared revisions and
authorization. The browser may hold a working copy, but it must not claim that
local state is saved remotely until the API confirms the write.

The server should store versioned project documents or normalized metadata with
an equivalent reconstruction contract. Published versions must be immutable.
The browser should handle revision conflicts explicitly rather than silently
overwriting a newer version.

## Why web behavior does not remain procedural

In a small procedural program, a call can appear to execute in a simple order:

```text
create object -> mutate array -> render -> save
```

In a web app, the operation crosses asynchronous and independently scheduled
boundaries:

```text
pointer event
  -> React event handler
  -> state update scheduling
  -> render/reconciliation
  -> Three.js effect or cache update
  -> debounced autosave
  -> browser storage or HTTP request
  -> server validation and revision check
```

These steps can be delayed, repeated, cancelled, reordered, or fail
independently. A component may render more than once. A user may click twice
before an autosave finishes. A browser tab may reload while a write is pending.
Two tabs may edit the same project. A network response may arrive after the
user has already made another edit.

Therefore, object operations should be modeled as deterministic state
transitions, not as a chain of side effects spread across callbacks.

## Likely bug cases

| Bug case | Root cause | Required defense |
| --- | --- | --- |
| Duplicate IDs | Timestamp/index identity or two tabs creating objects | Injected ID factory, uniqueness validation, server conflict handling |
| Object appears but is not saved | Renderer updated before persistence completed | Separate render success from save status; truthful persistence state |
| Object saves but is not visible | Renderer cache missed a state update | Snapshot-driven synchronization keyed by object ID |
| Deleted object returns after autosave | Stale debounced closure writes an older snapshot | Cancel/sequence writes and persist revisions, not arbitrary callbacks |
| Undo restores the wrong object | Delete stored only an index or regenerated an ID | Store the complete object and original position |
| Duplicate changes the source | Shared mutable object reference | Defensive cloning and pure operation tests |
| Hidden object remains clickable | Raycaster ignores `visible` policy | Filter picking by effective visible state |
| Disabled object still triggers runtime behavior | Interaction system checks existence, not enabled state | Central effective-state query before dispatch |
| UI and viewport disagree | React state and Three.js cache have separate mutation paths | One canonical snapshot and one renderer sync adapter |
| Import corrupts the active project | Validation happens after replacement | Parse, migrate, validate, then commit replacement |
| Two tabs overwrite each other | Browser localStorage has no multi-user revision authority | Server revisions/conflict responses; local draft is not collaboration |
| Delete breaks a future interaction | References are not indexed or resolved | Reference index and explicit delete policy |

## Best practices for housing logic

### Keep business rules pure and framework-free

Object creation, duplication, visibility, enabled state, and removal should be
testable without a browser, React, Three.js, localStorage, or HTTP. A pure
operation should receive a project and return a new project or a typed error.

### Make commands the mutation boundary

Every user-visible object change should have one command label and one history
entry. Drag previews may be transient; the committed transform is one command.
Create, duplicate, hide, disable, and delete should use the same discipline.

### Use typed outcomes

Prefer domain errors or result types such as `OBJECT_NOT_FOUND`,
`OBJECT_ID_CONFLICT`, `INVALID_ASSET`, `OBJECT_ALREADY_DELETED`, and
`DEPENDENCY_CONFLICT`. UI text should be adapted from the result; domain code
should not depend on English messages.

### Keep side effects at adapters

React state updates, localStorage, API calls, logging, and Three.js resource
creation belong at the edges. The object operation should not call `setState`,
write storage, or dispose a mesh.

### Make time and randomness injectable

ID allocation, clocks, autosave scheduling, and network responses need stable
test seams. Do not make correctness depend on `Date.now()`, render timing, or
the order in which promises happen to resolve.

### Validate at every trust boundary

Validate when loading JSON, before replacing the active project, at API input,
and before publishing. Client validation improves feedback; server validation
is still authoritative for shared projects.

### Separate optimistic UI from confirmed persistence

The editor may show a newly created object immediately as an optimistic local
edit, but the UI must distinguish:

```text
local edit accepted -> save pending -> save confirmed
                                  \-> save failed/conflict
```

A visible object is not proof that it has been durably saved.

### Log transitions, not private data

Log operation names, object IDs, project IDs, revisions, durations, and failure
codes. Do not log complete project documents, credentials, access tokens, or
asset contents.

### Test at the owning boundary

Use pure tests for object operations, command tests for undo/redo, serializer
fixtures for migration and round trips, component tests for React wiring,
viewport tests for picking/render synchronization, and API tests for
authorization and revision conflicts. Do not use an end-to-end browser test to
prove a pure array operation.

## Suggested implementation sequence

1. Add `visible` and `enabled` with defaults and schema migration.
2. Add validation for both booleans and preserve them through import/export,
   backup recovery, and clone operations.
3. Extract pure `createObject`, `duplicateObject`, `setObjectVisible`,
   `setObjectEnabled`, and `removeObject` operations.
4. Add focused tests for stable IDs, fresh duplicate IDs, source immutability,
   removal restoration, invalid IDs, and state round trips.
5. Wrap those operations in authoring-engine commands and connect `App.tsx` to
   commands rather than direct array maps.
6. Add inspector/tree controls and ensure viewport picking respects visibility
   and enabled state according to the approved semantics.
7. Add renderer synchronization keyed by object ID; keep Three.js objects as a
   disposable cache.
8. Add browser smoke coverage for create, duplicate, hide, disable, delete,
   undo, redo, save, reload, and runtime preview.
9. When the API exists, add revision-aware persistence and conflict tests.

## Acceptance criteria

This focused proposal is ready for implementation when:

- the canonical field name `enabled` is approved;
- visible and enabled behavior is documented for editor and runtime;
- creation and duplication allocate fresh stable IDs;
- removal is undoable and restores exact object data;
- no object operation requires React or Three.js to run;
- object changes pass through one command/history boundary;
- serializer migration and round-trip tests preserve the new fields;
- the viewport never becomes the source of truth;
- local save status is distinct from future server confirmation;
- the implementation has no mutable singleton `ObjectManager` holding a second
  copy of project objects.

## Related sources

- [Current project model](../../../packages/project/src/index.ts)
- [Current editor coordinator](../../../src/App.tsx)
- [Current serializer](../../../src/serializer.ts)
- [Current viewport](../../../src/Viewport.tsx)
- [Authoring engine contract](../../05-subsystems/authoring-engine.md)
- [Project serialization contract](../../05-subsystems/project-serialization.md)
- [Engineering practices](../../04-engineering/UNDATED--FOUNDATION--engineering-practices.md)
- [Broader object/entity and hybrid ECS proposal](2026-09-15--PROPOSAL--object-entity-and-ecs-architecture.md)
