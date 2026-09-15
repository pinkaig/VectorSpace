# Future-Proof Rendering System Plan

**Date:** 2026-09-15  
**Category:** Plan  
**Status:** Proposed; implementation requires approval of the data and ownership decisions below

## Purpose

Plan a rendering system that can be inspected and customised while supporting:

- different rendering responsibilities for exhibition environments and artefacts;
- future parent-child relationships between authored objects;
- consistent editor and runtime scene reconstruction;
- renderer replacement in the future if measurable requirements justify it;
- clear ownership of Three.js resources, picking, and disposal.

The system must preserve the canonical project snapshot as the source of truth. Renderer objects are disposable projections of that snapshot.

## Current Situation

The current prototype uses React and Three.js together. `Viewport.tsx` already creates separate scene groups for:

```text
Three.Scene
├── environmentGroup
├── objectsGroup
└── gizmoGroup
```

The separation is useful, but the viewport still owns most of the following responsibilities:

- Three.js scene and renderer creation;
- environment loading and cleanup;
- artefact geometry and material creation;
- object synchronisation;
- picking and raycasting;
- gizmos and selection outlines;
- camera controls and animation lifecycle.

The current environment loader is already a useful ownership boundary because it handles procedural environments, GLB loading, progress, and disposal. The artefact reconstruction path is less separated and currently rebuilds the complete object group when the project signature changes.

## Architectural Goal

```text
ProjectData
    |
    v
Validated render description
    |
    +--> EnvironmentRenderer
    |      exhibition shell, lighting, background, navigation surfaces
    |
    +--> ArtefactRenderer
    |      assets, transforms, hierarchy, visibility
    |
    +--> Interaction/Picking
    |      raycasting, selection, gizmos, runtime input
    |
    +--> Presentation overlays
           selection outlines, editor guides, debug visuals
```

The environment and artefact renderers share a Three.js scene but have different ownership:

- **Environment:** the exhibition space in which the experience exists.
- **Artefact:** authored content placed inside that space.
- **Gizmos and outlines:** editor-only presentation, not authored content.
- **Camera and lighting:** rendering policy unless the product explicitly makes them editable.

## Rendering Responsibilities

### Render host

Owns:

- `THREE.Scene`;
- camera and WebGL renderer;
- resize handling;
- animation frame lifecycle;
- renderer disposal.

Must not own project mutations or object semantics.

### Environment renderer

Owns:

- floors, walls, ceilings, and exhibition architecture;
- environment assets and loading progress;
- environment-specific background, fog, and lighting recommendations;
- collision or navigation surfaces when required;
- replacement and disposal of the active environment.

Must not own artefact identity, editor history, selection, or gizmos.

A future local interface could be:

```ts
interface EnvironmentRenderer {
  load(input: EnvironmentRenderInput): Promise<LoadedEnvironment>
  replace(environment: LoadedEnvironment): void
  dispose(): void
}
```

### Artefact renderer

Owns:

- asset-to-geometry and material construction;
- authored object transforms;
- parent-child scene graph relationships;
- effective visibility;
- entity-to-`THREE.Object3D` mapping;
- artefact resource disposal.

It must not own persistence, undo/redo, or authoritative project state.

```ts
interface ArtefactRenderer {
  sync(input: ArtefactRenderInput[]): void
  getRenderObject(id: string): THREE.Object3D | undefined
  disposeEntity(id: string): void
  dispose(): void
}
```

### Picking controller

Owns:

- pointer-to-ray conversion;
- artefact hit testing;
- gizmo hit testing;
- filtering hidden or disabled objects;
- conversion of Three.js hits into stable entity IDs.

It should return renderer-neutral results:

```ts
type PickResult =
  | { kind: 'artefact'; entityId: string }
  | { kind: 'gizmo'; axis: 'x' | 'y' | 'z'; mode: GizmoMode }
  | { kind: 'none' }
```

It should not decide how a transform is committed. That belongs to the authoring-engine command path.

### Gizmo renderer

Owns move, rotate, and scale handles, selection outlines, and editor-only guides.

Gizmos must remain outside the authored artefact hierarchy so that selecting or manipulating an object does not alter the project scene graph.

## Render Descriptors

Introduce a renderer-facing description derived from validated project data:

```ts
interface SceneRenderInput {
  environment: EnvironmentRenderInput
  artefacts: readonly ArtefactRenderInput[]
  camera: CameraPose
}
```

```ts
interface ArtefactRenderInput {
  id: string
  assetId: string
  assetKind: string
  localTransform: TransformData
  parentId: string | null
  visible: boolean
  effectiveVisible: boolean
  enabled: boolean
  effectiveEnabled: boolean
}
```

These descriptors are not a second saved model. They are an adapter contract that allows rendering to evolve independently from persistence and React state.

## Parent-Child Design

The future object model should use one relationship:

```ts
interface SceneObject {
  id: string
  parentId: string | null
  transform: TransformData
}
```

Do not serialize both `parentId` and a `children` array. Child lists should be derived from object order and a hierarchy index.

The renderer synchronisation order should be:

1. Create missing `Object3D` instances.
2. Establish parent-child relationships.
3. Apply local transforms.
4. Apply inherited visibility and enabled state.
5. Update picking metadata.
6. Dispose stale objects.

The renderer should maintain a disposable cache:

```ts
Map<EntityId, THREE.Object3D>
```

The map may be rebuilt after reload, runtime entry, or WebGL context loss. It must never become authoritative project state.

### Environment relationship

Do not make the exhibition environment the serialized parent of every artefact. Keep separate renderer roots:

```text
Three.js environmentGroup
Three.js artefactRoot
```

If artefacts later need to attach to walls, stands, or rooms, introduce explicit authored anchor entities. This preserves the distinction between environment infrastructure and authored exhibit content.

## Implementation Phases

### Phase 1: Establish ownership

Document and agree on:

- environment versus artefact ownership;
- renderer cache versus project state;
- parent transform semantics;
- visibility and enabled-state semantics;
- picking rules;
- resource disposal ownership.

**Acceptance:** no renderer module is permitted to become a second project-state authority.

### Phase 2: Extract local rendering modules

Keep the first implementation inside the current application:

```text
src/viewport/
  RenderHost.ts
  EnvironmentRenderer.ts
  ArtefactRenderer.ts
  PickingController.ts
  syncArtefacts.ts
  renderTypes.ts
```

Start with the smallest safe extractions:

1. Move artefact geometry and material construction out of `Viewport.tsx`.
2. Move environment replacement and disposal behind an environment controller.
3. Keep the existing Three.js scene and animation loop.
4. Preserve editor and runtime behaviour.

Do not create a workspace rendering package yet. These modules initially have one consumer and evolving interfaces.

### Phase 3: Introduce render descriptors

Generate `SceneRenderInput` from validated project data. The renderer should receive resolved asset information, effective state, local transforms, parent IDs, and mode-specific presentation options without importing React state.

**Acceptance:** the renderer can be tested with a plain scene fixture and does not need to interpret the persisted project document directly.

### Phase 4: Add hierarchy-aware synchronisation

Only after `parentId` and related lifecycle fields have an approved schema migration:

- build a validated hierarchy index;
- create the `EntityId -> Object3D` cache;
- reparent objects safely;
- apply local transforms;
- calculate inherited visibility;
- test missing parents and cycles;
- verify resource disposal after subtree deletion.

### Phase 5: Share reconstruction between editor and runtime

Use the same artefact reconstruction path in both applications:

```text
shared project snapshot
        |
        v
shared scene reconstruction
        |
        +--> editor: selection, gizmos, authoring commands
        +--> runtime: visitor camera and interactions
```

Editor and runtime may differ in camera controls, picking, overlays, and interaction policy. They must agree on asset identity, transforms, hierarchy, visibility, and enabled state.

### Phase 6: Measure before optimising

The current full rebuild is acceptable for the prototype. Introduce incremental synchronisation when measurements justify it.

Measure:

- frame time;
- object count and draw calls;
- asset loading time;
- memory after entering and exiting runtime;
- hierarchy update cost;
- raycasting cost;
- disposal correctness.

The entity-to-render map should be in place before complex hierarchy or large scenes, but not merely to reduce file size.

### Phase 7: Consider alternate renderers

Keep Three.js for both editor and runtime during the MVP.

Consider a renderer-neutral runtime boundary only if evidence shows a need for:

- very large scenes;
- specialised streaming;
- advanced physics;
- mobile performance constraints;
- deployment requirements better supported by another engine.

A second renderer should be introduced behind the same project, render-description, and interaction contracts. It should not require a second project model.

## Critical Questions

### Product

1. Is the exhibition environment a selectable preset or editable authored content?
2. Can authors edit environment geometry, or only choose an environment?
3. Can artefacts attach to walls, stands, rooms, or other environment anchors?
4. Should environment lighting be fixed, configurable, or authored per scene?
5. Can groups of artefacts be transformed together?

### Data model

1. Should `parentId`, `visible`, and `enabled` be added in the next schema version?
2. Should re-parenting preserve world position or local position by default?
3. What happens when a parent is deleted?
4. What is the maximum hierarchy depth?
5. Can a renderable artefact also be a parent?
6. Are environment anchors ordinary authored entities or renderer-only objects?

### Rendering

1. Which artefact types come first: primitives, GLB models, images, or video panels?
2. Do artefacts need different materials, lighting, render passes, or post-processing?
3. Which objects can be selected or raycasted?
4. Should hidden or disabled objects remain visible in the editor?
5. Are selection outlines and gizmos always separate from authored hierarchy?
6. Will runtime require shadows, reflections, instancing, or post-processing?

### Performance and operations

1. Which browsers and devices are release targets?
2. What scene size and asset budgets are expected?
3. Do environments require progressive or streamed loading?
4. What frame-rate target is required?
5. How will WebGL failure or asset-loading failure be presented?
6. How will renderer resources be tested after repeated editor/runtime transitions?

## Decisions Recommended Now

- Keep Three.js for both editor and runtime.
- Keep environment and artefact rendering separate.
- Keep the canonical project snapshot renderer-independent.
- Start with local rendering modules before creating `packages/presentation`.
- Introduce parent-child support through an explicit schema migration.
- Keep gizmos and selection overlays outside authored hierarchy.
- Use an entity-to-render map when hierarchy is implemented.
- Avoid a full ECS registry until profiling or runtime complexity justifies it.

## Counterproductive Warning Signs

Pause or reverse an extraction if:

- a module still requires most of `Viewport.tsx`'s local variables;
- a renderer cache starts storing authoritative project data;
- editor and runtime develop separate artefact reconstruction logic;
- environment geometry is forced into the artefact entity model;
- a package is created without a second consumer or stable API;
- incremental complexity increases without performance evidence;
- parent-child support is added before schema migration and cycle validation exist.

## Immediate Next Slice

```text
ownership contract
    -> local EnvironmentRenderer
    -> local ArtefactRenderer
    -> render descriptors
    -> hierarchy-aware entity map
```

This sequence provides customisable and inspectable rendering while preserving the current prototype and avoiding premature renderer replacement.

## Related Documents

- [Runtime rendering options](Wk2--FUTURE--runtime-rendering-options.md)
- [3D viewport subsystem](../../05-subsystems/viewport.md)
- [Authoring engine](../../05-subsystems/authoring-engine.md)
- [Object/entity architecture proposal](../Week3/2026-09-15--PROPOSAL--object-entity-and-ecs-architecture.md)
- [Object state and lifecycle proposal](../Week3/2026-09-15--PROPOSAL--object-state-lifecycle-and-web-architecture.md)
