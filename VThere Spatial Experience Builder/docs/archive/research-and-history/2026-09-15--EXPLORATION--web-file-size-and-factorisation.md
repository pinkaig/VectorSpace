# Web File Size, Factorisation, and Package Boundaries

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.

## Purpose

This note records the exploration of why web-development files can become
large, how that differs between CSS and TSX, and how to apply C++-style
factorisation, abstraction, and interfaces without creating unnecessary
complexity.

The current examples are the VThere editor's [Viewport component](../../src/Viewport.tsx)
and [global stylesheet](../../src/styles.css).

## Why these files become large

### CSS is declarative but still expresses many independent decisions

CSS grows because a user interface has many visual states and layout rules:

- layout, sizing, spacing, alignment, and responsive behavior;
- typography, color, borders, and surfaces;
- interaction states such as hover, focus, disabled, selected, and loading;
- component variants and empty/error states;
- browser normalization and accessibility requirements;
- responsive constraints and sometimes a second runtime or presentation mode.

The browser needs the final rules, but the source does not need to be one
large file. CSS is often bulky because it is describing a visual system, not
because the code is algorithmically complex.

### TSX combines composition, behavior, and markup

TSX can become large when one component owns several responsibilities at once:

1. React lifecycle and refs.
2. Three.js scene and renderer creation.
3. Resource disposal.
4. Project-object synchronization.
5. Selection and raycasting.
6. Free dragging and transform gizmos.
7. Orbit and walk camera controls.
8. Environment loading and retry state.
9. The small React overlay rendered above the canvas.

That is the shape of the current [Viewport component](../../src/Viewport.tsx).
Its size is not primarily caused by JSX. It is caused by several ownership
boundaries being placed inside one React component and one long effect.

## The C++ analogy

The useful C++ analogy is not "make everything a class." The useful ideas are:

| C++ idea | TypeScript/React equivalent |
|---|---|
| Header/interface | Exported TypeScript types and narrow function contracts |
| Implementation file | A focused `.ts` or `.tsx` module |
| Composition over inheritance | A component composed from hooks and child components |
| RAII/resource ownership | A setup function returning a cleanup function |
| Pure utility/library | A framework-independent function in a package or module |
| Dependency inversion | Pass callbacks, state readers, or adapters instead of importing UI state |
| Translation unit | A module with a small public export surface |
| Linkage/package boundary | A workspace package with explicit dependencies and exports |

TypeScript interfaces describe shape and contracts at compile time. They do not
provide runtime polymorphism or automatically reduce the shipped bundle. A
good interface still helps because it makes ownership, dependencies, and tests
visible.

## Does a TSX file need one function scope?

No. A `.tsx` file may contain many exported or private components, hooks, and
helper functions. A React component function does not need to contain all of
its implementation.

For example, this is a normal decomposition:

```text
Viewport.tsx                 React boundary and overlay
viewport/
  useViewportScene.ts        lifecycle and Three.js setup
  useViewportInteraction.ts  pointer and keyboard interaction
  useViewportCamera.ts       orbit/walk camera behavior
  syncSceneObjects.ts        project data to Three.js meshes
  syncGizmo.ts               gizmo visibility and placement
  viewportTypes.ts           local contracts and drag state types
```

The parent component can remain small:

```tsx
function Viewport(props: ViewportProps) {
  const scene = useViewportScene(props)
  useViewportInteraction(scene, props)

  return (
    <div className="viewport" ref={scene.mountRef}>
      <ViewportOverlay status={scene.environmentStatus} />
      <ViewportHint cameraMode={props.cameraMode} interactive={props.interactive} />
    </div>
  )
}
```

The extraction should preserve a single owner for each resource. For example,
the module that creates the renderer should also dispose it. Splitting code
without splitting ownership only moves complexity around.

## A practical refactor for `Viewport.tsx`

The smallest useful sequence is:

### Step 1: Extract pure code first

Move code that does not need React or a live scene into ordinary TypeScript
modules:

- movement key maps and camera movement calculations;
- object geometry/material creation;
- pointer coordinate conversion;
- selection and transform math;
- drag-state types;
- hint text selection.

These modules are easy to unit test and have low lifecycle risk.

### Step 2: Extract scene synchronization

Create a module such as `viewport/syncSceneObjects.ts` with a contract like:

```ts
interface SceneObjectSync {
  group: THREE.Group
  objects: SceneObject[]
  selectedId: string | null
}

function syncSceneObjects(input: SceneObjectSync): void
```

The function should own mesh creation and disposal for the object group. The
React component should provide current data, not know every geometry detail.

### Step 3: Extract the Three.js lifecycle boundary

Create a setup function or hook that owns the renderer, scene, camera,
controls, animation frame, event listeners, and cleanup:

```ts
function createViewportRuntime(input: ViewportRuntimeInput): ViewportRuntime {
  // create external resources
  // register listeners
  // return handles and dispose()
}
```

Returning `dispose()` makes the ownership contract explicit and is analogous
to deterministic cleanup in C++. The function should not import React state.

### Step 4: Separate interaction controllers

The current pointer handler contains several state machines. They can become
focused controllers with narrow callbacks:

```ts
interface ViewportInteractionCallbacks {
  select(id: string | null): void
  commitMove(id: string, position: Position): void
  commitScale(id: string, scale: Scale): void
  commitRotate(id: string, rotation: Rotation): void
}
```

Free drag, axis move, scale, rotate, and walk navigation do not need to be
separate React components. They can be separate controller modules that share
raycasting and camera services.

### Step 5: Keep the React surface thin

The final `Viewport.tsx` should primarily:

- define the public props and ref handle;
- connect React values to the runtime;
- render the loading/error/retry overlay;
- render the interaction hint.

It should not be required to know how an axis handle is colored or how a mesh
geometry is selected.

## Splitting `styles.css`

CSS can be split by ownership rather than by arbitrary file size:

```text
src/styles/
  tokens.css       colors, fonts, spacing, shared variables
  reset.css        box sizing, body defaults, form inheritance
  shell.css        app-shell, topbar, workspace rails
  viewport.css     stage, canvas, overlay, hint, loading states
  inspector.css    panels, fields, asset cards
  runtime.css      runtime-only presentation
  index.css        imports the files above
```

Useful CSS factoring techniques include:

- CSS custom properties for repeated design tokens;
- shared utility classes only for genuinely repeated behavior;
- component-local styles when a component has a clear owner;
- cascade layers such as `@layer reset, tokens, components, utilities`;
- grouping related states beside their base selector;
- avoiding deeply nested selectors and selector duplication.

Splitting CSS does not inherently reduce the browser's final CSS. It improves
navigation, ownership, and parallel work. Build tools can still bundle the
files together. The goal is lower cognitive bulk, not pretending that the UI
has fewer visual rules than it actually has.

CSS Modules, CSS-in-JS, or a utility framework should be introduced only if
they solve a current problem. Changing styling technology can add build and
team overhead without making the design system smaller.

## Should more code become packages?

Packages are valuable when they establish a real boundary, not merely because
a file is large. A candidate should meet several of these conditions:

- it has a stable public API;
- it is useful to more than one application or subsystem;
- it can be tested without the editor UI;
- it has an independent dependency direction;
- it may be versioned, replaced, or published separately;
- the boundary prevents accidental imports from the wrong layer.

Good package candidates for this project are:

- `packages/project`: canonical project data and constructors;
- `packages/spatial`: vectors, bounds, ray/plane and transform math;
- `packages/authoring-engine`: commands, history, and edit sessions;
- `packages/serialization`: JSON format, validation, and migrations;
- `packages/validation`: framework-free project invariants.

Poor early package candidates are tiny one-file wrappers, CSS fragments used by
only one application, or modules whose API is still changing every day. A
workspace package creates API and dependency maintenance costs, so local
modules should come first.

The planned architecture already points in this direction: shared packages
should own data, spatial math, interaction contracts, serialization,
validation, commands, and assets, while the editor owns React and Three.js
adapters. That direction is sound, but the migration should follow tested
boundaries rather than move every current file immediately.

## Recommended dependency direction

```text
packages/project
packages/spatial
packages/validation
packages/serialization
        |
        v
packages/authoring-engine
        |
        v
src/Viewport.tsx and src/App.tsx
        |
        v
React/Three.js presentation adapters
```

The important rule is that framework-free packages should not import React,
Three.js, DOM APIs, or browser storage. The editor may depend on those
packages, but the shared logic should remain portable and testable.

## What not to do

- Do not split code only to make line counts look smaller.
- Do not create a class for every noun in the scene.
- Do not hide all state in a generic "manager" object.
- Do not make shared packages depend on editor implementation details.
- Do not extract a hook that still requires half of the parent component's
  local variables through a large argument object.
- Do not optimize bundle size by adding abstraction that prevents tree
  shaking or causes every feature to import every other feature.
- Do not replace a coherent CSS system with many tiny files that are harder to
  discover.

## Suggested migration order

1. Add tests for pure viewport math and object-to-mesh mapping.
2. Extract local `src/viewport/` modules without changing public behavior.
3. Extract CSS tokens and viewport-owned styles from `styles.css`.
4. Measure the resulting module boundaries and testability.
5. Promote stable, framework-free modules into `packages/spatial` or another
   existing package only when a second consumer or clear ownership need exists.
6. Update the viewport subsystem documentation when ownership changes.

## Conclusion

Large web files are normal when they describe a rich interface, but a file can
still be too responsible. `Viewport.tsx` is the clearest current extraction
target because its React boundary contains rendering, lifecycle, input, camera,
and domain interaction concerns. The best C++-style improvement is explicit
interfaces plus deterministic ownership and composition, not a blanket class
or package conversion.

For this project, local modules should be the first move, framework-free
workspace packages the second, and independently versioned packages only when
reuse and stability justify them.

## Sustainability against the project target

### Short answer

The current coding method is sustainable as a technical spike and unsuitable
as the final application structure. The problem is not that `Viewport.tsx` is
large or that CSS has many selectors. The problem is that the current file is
becoming the owner of concerns that the project specifications explicitly
assign to different boundaries.

The current implementation can continue long enough to prove the primitive
editing loop. It should not be extended by adding content attachment, zones,
interaction rules, publishing, collaboration, or runtime-specific behavior
directly into the same component.

### Where the current method will fail

| Current pattern | Why it becomes unsustainable | Target requirement affected |
|---|---|---|
| `Viewport.tsx` handles rendering, camera, picking, gizmos, drag sessions, and environment loading | Every new interaction becomes another branch in one lifecycle closure; testing requires a browser and a live WebGL scene | Framework-agnostic authoring engine and focused tests |
| Pointer handlers call `onMove`, `onScale`, and `onRotate` directly | UI actions can bypass a shared command path, making undo, checkpoints, validation, and persistence inconsistent | One command path for editor actions |
| `App.tsx` owns snapshot history and direct object mutation callbacks | Scene tree, inspector, viewport, and future rule builder can implement subtly different mutation semantics | Shared commands and reversible project edits |
| `syncObjects()` rebuilds the complete object group | It will become expensive and will lose renderer identity as scenes grow, become hierarchical, or include attached content | Incremental render synchronization and nested entities |
| Runtime reuses the editor viewport through `interactive={false}` | This preserves visual parity now, but risks making visitor behavior a collection of editor exceptions | Separate editor/runtime applications with shared presentation |
| `src/model.ts` and `src/serializer.ts` remain application-local adapters | API, publishing, runtime, and migration code can drift from the browser draft format | Canonical versioned project document |
| One global `styles.css` owns editor and runtime presentation | Ownership becomes unclear as `apps/editor` and `apps/runtime` become real applications | Independent application boundaries and maintainable UI work |

These are architectural risks, not evidence that the current prototype was a
mistake. The prototype has already demonstrated useful behavior. It now needs
an extraction path before more product requirements are layered onto it.

### The most important sustainability test

Every authoring action should be expressible without React, Three.js, the DOM,
or persistence:

```text
pointer or button input
  -> adapter translates input into an engine operation
  -> authoring engine creates a project command
  -> command produces a new canonical project document
  -> editor and renderer observe the new document
  -> persistence receives a checkpoint request
```

The current path is closer to:

```text
pointer input -> Three.js mesh mutation -> App callback -> cloned project -> autosave
```

That path works for a prototype, but it makes the renderer part of the edit
semantics. The target architecture requires the renderer to be a projection of
project state, not the authority that defines the edit.

## Best approach: a staged strangler architecture

The best solution is not a rewrite and not a premature package explosion. Keep
the working Three.js implementation, then gradually put stable boundaries
around it. Each stage should leave the application runnable and should be
validated before the next stage begins.

### Stage 1: establish the command path locally

Use the existing `packages/authoring-engine` timeline as the first seam.
Introduce typed editor operations such as:

```ts
type EditorCommand =
  | { type: 'move-object'; id: string; position: Position }
  | { type: 'scale-object'; id: string; scale: Scale }
  | { type: 'rotate-object'; id: string; rotation: Rotation }
```

The exact command representation can evolve. The non-negotiable rule is that
viewport, scene tree, and inspector actions all call the same command service.
The service returns a new project snapshot and a history result. `Viewport`
should report a completed transform session to that service rather than mutate
the project through a renderer-specific callback contract.

This stage directly protects undo/redo, delete restoration, autosave, and
future API persistence. It is more valuable than first splitting CSS or
renaming folders.

### Stage 2: extract the authoring engine's pure transform core

Move these responsibilities out of `Viewport.tsx` and into a framework-free
package, initially the existing `packages/authoring-engine` or a new
`packages/spatial` dependency:

- selection state and selection hit results;
- ray, plane, and axis constraint solving;
- move, rotate, and scale sessions;
- world/local transform policy;
- snapping policy when it is introduced;
- degenerate camera-angle handling;
- transform preview and commit deltas.

The Three.js adapter should convert a ray and camera frame into the engine's
plain input types. The engine should return plain transform values. This is
where the project gets C++-style interfaces with the greatest payoff: small,
stable contracts around deterministic operations.

### Stage 3: create a shared presentation adapter

Add a `packages/presentation` boundary only when the first runtime scene is
being built. It should own renderer-neutral scene reconstruction concepts and
Three.js-specific adapter code where that is still the selected MVP renderer.

```text
packages/presentation
  createScenePresenter(project, options)
  updateScenePresenter(snapshot)
  disposeScenePresenter()

apps/editor
  presenter + selection + gizmos + authoring input

apps/runtime
  presenter + visitor camera + interaction dispatch
```

The editor and runtime should share object reconstruction, asset resolution,
environment loading, and resource cleanup. The editor adds gizmos and command
input; the runtime adds visitor interaction. This is the strongest protection
against preview/published drift.

Keep Three.js for both editor and runtime during the MVP. An interface such as
`RuntimeRenderer` is useful as a dependency boundary, but implementing a
second rendering engine before measurable performance or deployment evidence
exists would increase maintenance rather than improve sustainability.

### Stage 4: replace full rebuilds with an entity-to-render map

The current full rebuild is acceptable as a first adapter. Before adding
hierarchy, content attachments, visibility, or thousands of entities, introduce
a renderer cache:

```ts
const renderObjects = new Map<EntityId, THREE.Object3D>()
```

The synchronizer should create, update, reparent, and dispose by stable entity
ID. The map is disposable renderer cache, never project state. This makes
reload, scene switching, and eventual WebGL context recovery explicit.

### Stage 5: migrate the application boundaries

Once the command and presentation seams are tested, move the current root
editor into the documented structure:

```text
apps/editor/
  src/ui/
  src/viewport/
  src/gizmos/
  src/EditorApplication.ts
apps/runtime/
  src/RuntimeApplication.ts
  src/RuntimeScene.ts
packages/
  project/
  spatial/
  authoring-engine/
  commands/
  serialization/
  validation/
  interaction/
  presentation/
```

The move should be mechanical after the boundaries are real. Moving files
first would only relocate coupling and make the current prototype harder to
run.

## Recommended ownership model

| Concern | Long-term owner |
|---|---|
| Canonical project entities, scenes, assets, interactions | `packages/project` |
| Versioning, validation, migrations, import/export | `packages/serialization` and `packages/validation` |
| Rays, planes, bounds, transforms, zones | `packages/spatial` |
| Selection, transform sessions, commands, history | `packages/authoring-engine` and `packages/commands` |
| Shared Three.js scene reconstruction and resource lifecycle | `packages/presentation` |
| React panels and editor workflows | `apps/editor` |
| Visitor playback and runtime-only UI | `apps/runtime` |
| API persistence, publishing, authorization, analytics | `apps/api` |
| CSS tokens and application component styles | Each app, with a small shared design-token layer if needed |

The key interface is the project snapshot. The editor writes it through
commands; the runtime reads a validated published snapshot; the renderer
projects it. No renderer object, React component state, or local-storage record
should become a second source of truth.

## Package decision rule

For this project, use the following rule:

> Extract to a local module when the concern has one consumer. Promote it to a
> workspace package when it has a stable contract, a second consumer, or a
> framework-independence requirement. Publish or independently version it only
> when release independence is demonstrated.

Applied now:

- `Viewport` interaction helpers should first become local modules or the
  existing authoring-engine implementation.
- Transform math belongs in `packages/spatial` once the authoring engine and
  runtime both consume it.
- Shared scene reconstruction deserves `packages/presentation` before the
  runtime gains its own rendering implementation.
- CSS should remain app-local until editor and runtime have demonstrably shared
  tokens or components.

## Decision

Continue the current prototype only for the narrow primitive-editing slice.
Do not add the next major requirements directly to `Viewport.tsx` or `App.tsx`.
The next implementation work should be:

1. Put move, rotate, and scale commits behind one command service.
2. Add unit tests for transform sessions and command results without React or
   Three.js.
3. Extract the viewport's pure math and interaction state into the authoring
   engine.
4. Introduce a stable entity-ID render map before hierarchy and content.
5. Build the runtime on the same presentation adapter before adding runtime
   features.
6. Migrate the root prototype into `apps/editor` only after those seams work.

This approach preserves current progress, satisfies the required custom
engineering component, protects editor/runtime parity, and keeps package
creation tied to actual architectural value.

## Ponytail second opinion

### Review position

The recommendations above are directionally correct, but they are slightly too
ambitious for Week 2 of a 10-week development cycle. The greatest risk is
spending several weeks reorganizing code before proving the author-to-preview-
to-publish workflow.

The current `Viewport.tsx` approach is sustainable only for the primitive
editing prototype. It becomes risky when the team adds content attachments,
interaction rules, zones, navigation, runtime parity, publishing, persistence,
and more complex object hierarchy.

The architectural mismatch is that viewport callbacks currently mutate project
state directly, while the project specification expects framework-independent
commands and reversible edits.

### Revised recommendation

Use a vertical-slice-first approach:

1. **Create one command path.** Move, rotate, scale, delete, and inspector edits
  should all use the same command service. This is more urgent than splitting
  `Viewport.tsx` because it protects undo/redo, autosave, validation, and
  future API persistence.
2. **Extract only proven framework-free logic.** Move transform math and
  drag-session logic into `packages/authoring-engine` or `packages/spatial`.
  Keep Three.js scene creation in the viewport temporarily, and add tests
  before adding more editor features.
3. **Prove editor/runtime parity with one shared renderer path.** Keep Three.js
  for both editor and runtime. Do not build a second runtime renderer. A
  `packages/presentation` package should wait until the runtime actually needs
  to consume shared scene reconstruction code.
4. **Defer broad restructuring.** Do not move everything into `apps/editor`
  yet. Do not create every planned package at once. Promote modules into
  packages when they have a second consumer or a stable contract.

### Three questions for the team

1. What is the smallest complete author-preview-publish slice we can
  demonstrate by Week 5?
2. Which actions must use the shared command path before new features are
  added?
3. Which package boundary has an actual second consumer today, rather than a
  predicted future consumer?

### Week 2 decision

Approve:

- a command-path spike;
- pure transform tests;
- one shared project-document contract;
- a short vertical slice proving editor changes appear identically in preview.

Postpone:

- a complete file split of `Viewport.tsx`;
- full migration into `apps/editor`;
- a new presentation package;
- ECS/entity-system expansion;
- alternate rendering engines.

This keeps the current prototype useful while reducing the risk of building
architecture ahead of evidence. The next step should be the smallest tested
command-path slice, not a broad repository restructuring.