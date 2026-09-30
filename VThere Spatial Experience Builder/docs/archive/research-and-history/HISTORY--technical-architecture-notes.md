# VThere x DigiPen — Spatial Experience Builder
## Technical Architecture & Scope

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.

### 1. Scope Confirmation

**Confirmed: this technical scope is sufficient to meet the project's stated MVP and engineering requirements**, provided the team keeps the boundaries below and does not expand into excluded areas.

The project requires a browser-based no-code spatial authoring tool where a user can place and manipulate 3D assets, attach content, define WHEN → DO interactions, create multiple scenes, preview the experience, save it, publish it, and let another person open the published result.

The architecture below directly covers those demands:

| Project demand | Architectural coverage |
|---|---|
| Browser 3D authoring | Editor + Spatial/Viewport systems |
| Visual object manipulation | Gizmo + Selection + Spatial systems |
| No-code behaviour | Interaction Builder + Interaction Engine |
| Text/image/audio/video | Components + Runtime presentation |
| Multiple scenes | Project + Scene systems + Navigation |
| Save/load/autosave | Serialization + Persistence |
| Preview = published | Shared Project/Interaction/Runtime core |
| Shareable URL | Publishing + Runtime |
| Analytics | Runtime analytics |
| DigiPen custom technical component | Gizmo mathematics + Serialization + Interaction dispatch + Undo/Redo |
| Stability | Validation, persistence, deterministic interaction, testing |
| Scalability | Modular shared core, stateless API, database/object-storage separation |

The brief explicitly requires the editor and runtime to use the same project representation, requires a substantial custom-built technical component, and identifies the key MVP loop as placing an object, manipulating it, saving it, and reloading it identically.

---

# 2. Architecture Overview

```text
                         SPATIAL EXPERIENCE BUILDER
                                      |
                +---------------------+---------------------+
                |                                           |
             EDITOR                                     RUNTIME
                |                                           |
                +---------------------+---------------------+
                                      |
                                SHARED CORE
                                      |
          +-------------+-------------+-------------+-------------+
          |             |             |             |             |
       Project       Scene        Spatial      Interaction   Serialization
        Model        Model         Types          Engine       / Validation
          |             |             |             |             |
          +-------------+-------------+-------------+-------------+
                                      |
                              BACKEND / INFRA
                                      |
                +-------------+-------+--------+-------------+
                |             |                |             |
               API          Database        Storage       Publishing
```

### Core architectural rule

**Editor creates and modifies the project. Runtime reads and executes the project. Shared systems define what the project actually is.**

---

# 3. Repository Layout

```text
spatial-experience-builder/
│
├── apps/
│   ├── editor/
│   ├── runtime/
│   └── api/
│
├── packages/
│   ├── project/
│   ├── scene/
│   ├── spatial/
│   ├── interaction/
│   ├── serialization/
│   ├── validation/
│   ├── commands/
│   └── assets/
│
├── infrastructure/
│
└── tests/
```

The important idea is to organise code by **responsibility and dependency**, not simply by UI screen.

---

# 4. EDITOR REGION

The Editor contains functionality that exists because an **author is constructing an experience**.

```text
EDITOR
│
├── Editor Application
├── Editor UI
├── Viewport
├── Selection
├── Gizmos
├── Scene Tree
├── Asset Browser
├── Inspector
├── Interaction Builder
├── Preview Mode
└── Editor State
```

## 4.1 Editor Application

**Responsibility:** Coordinate the editor.

```text
EditorApplication
├── startup / shutdown
├── project loading
├── project saving
├── editor state
└── mode switching
```

Possible classes:

```text
EditorApplication
EditorSession
EditorContext
```

---

## 4.2 Editor UI

**Responsibility:** Present authoring controls and receive user input.

```text
EditorUI
├── Toolbar
├── ProjectPanel
├── SceneTreePanel
├── AssetPanel
├── InspectorPanel
├── InteractionPanel
├── SceneTabs
└── SaveStatus
```

UI should normally request a system operation rather than directly modifying arbitrary project data.

```text
UI
 ↓
Command / System
 ↓
Project Data
```

---

## 4.3 Viewport

**Responsibility:** Display and navigate the 3D editing environment.

```text
Viewport
├── Renderer
├── CameraController
├── Input
├── Raycaster
├── Selection
└── GizmoSystem
```

---

## 4.4 Selection System

**Responsibility:** Determine and maintain the currently selected object.

```text
Selection
├── screen → object selection
├── selected object state
└── synchronisation with Scene Tree
```

Relationship:

```text
Scene Tree ↔ Selection ↔ Viewport
```

---

## 4.5 Gizmo System

**Responsibility:** Visually and mathematically manipulate object transforms.

```text
GizmoSystem
├── TranslationGizmo
├── RotationGizmo
├── ScaleGizmo
├── HandleHitTesting
├── ConstraintSolver
├── Snapping
└── TransformManipulator
```

Main flow:

```text
Mouse Input
 ↓
Handle Hit Test
 ↓
3D Constraint
 ↓
Transform Calculation
 ↓
Transform Command
 ↓
Project State
```

---

## 4.6 Scene Tree

**Responsibility:** Provide a hierarchical view of objects in the current scene.

```text
SceneTree
├── TreeNode
├── hierarchy display
├── rename
├── create/delete
└── selection synchronisation
```

---

## 4.7 Asset Browser

**Responsibility:** Browse and place the approved asset library.

```text
AssetBrowser
├── AssetRegistry
├── AssetMetadata
├── categories
├── search
├── thumbnails
└── AssetLoader
```

The editor places an asset by reference/ID rather than making the project responsible for storing the actual large model.

---

## 4.8 Inspector

**Responsibility:** Edit properties of the selected object.

```text
Inspector
├── TransformInspector
├── ContentInspector
├── InteractionInspector
└── ObjectInspector
```

---

## 4.9 Interaction Builder

**Responsibility:** Let the author construct no-code rules.

```text
InteractionBuilder
├── TriggerSelector
├── ActionSelector
├── TargetSelector
├── ParameterEditor
└── RuleList
```

Example:

```text
WHEN [visitor clicks] [Exhibit]
DO   [show panel]    [History]
```

The Builder creates an interaction definition.

It does **not** contain the actual runtime behaviour.

```text
Author Input
 ↓
Interaction Definition
 ↓
Project Data
```

---

## 4.10 Preview

**Responsibility:** Let the author test the experience using visitor-style behaviour.

```text
Editor
 ↓
Preview
 ↓
Shared Runtime Behaviour
```

Preview should reuse the same project and interaction systems used by the published runtime.

---

# 5. SHARED REGION

The Shared region defines the **experience itself**, independently of whether an editor or visitor is using it.

```text
SHARED
│
├── Project Model
├── Scene Model
├── Object / Component Model
├── Spatial Types
├── Interaction Engine
├── Serialization
├── Validation
└── Commands / Undo-Redo
```

---

# 6. Project Model

**Responsibility:** Define the complete authored experience.

```text
Project
├── metadata
├── scenes
├── template
├── publication state
└── access settings
```

The Project Model is the central domain object.

---

# 7. Scene Model

**Responsibility:** Define one spatial experience area.

```text
Scene
├── Environment
├── Starting Camera
├── Objects
├── Zones
└── Navigation
```

Relationship:

```text
Project
 ├── Scene
 │    ├── Object
 │    ├── Components
 │    ├── Zones
 │    └── Navigation
 └── Scene
```

---

# 8. Object / Component Model

**Responsibility:** Represent things placed into the scene and their attached content.

```text
SceneObject
├── ID
├── Name
├── AssetID
├── Transform
└── Components
```

Components:

```text
Components
├── Hotspot
├── Text
├── Image
├── Audio
├── Video
├── 3D Exhibit
└── Navigation
```

---

# 9. Spatial System

**Responsibility:** Provide the fundamental 3D mathematics and spatial data types.

```text
Spatial
├── Transform
├── Position
├── Rotation
├── Scale
├── Ray
├── Plane
├── Bounds
└── Intersection
```

The Gizmo system uses these primitives rather than owning its own separate spatial representation.

---

# 10. Interaction Engine

**Responsibility:** Execute authored WHEN → DO behaviour.

```text
Interaction
├── Event
├── Trigger
├── Rule
├── Action
├── Dispatcher
├── ExecutionQueue
└── RuntimeState
```

Main flow:

```text
Event
 ↓
Trigger Matching
 ↓
Matching Rules
 ↓
Action
 ↓
Execution
```

Examples:

```text
Click Object
 → Show Panel

Enter Zone
 → Play Audio

Scene Start
 → Move Camera

Click Object
 → Navigate Scene
```

The interaction engine should be shared by Editor Preview and Runtime wherever practical.

---

# 11. Serialization System

**Responsibility:** Convert the live project into persistent data and reconstruct it.

```text
Serialization
├── ProjectSerializer
├── ProjectDeserializer
├── Schema
├── Version
└── Migration
```

Flow:

```text
LIVE PROJECT
    ↓
 Serialize
    ↓
PROJECT FILE
    ↓
 Deserialize
    ↓
LIVE PROJECT
```

This system is one of the primary custom-built technical components.

The project format must be versioned so older projects can continue to load after schema changes.

---

# 12. Validation System

**Responsibility:** Prevent invalid projects from being saved/published.

```text
Validation
├── ProjectValidator
├── SceneValidator
├── ReferenceValidator
└── PublicationValidator
```

Examples:

```text
Does the referenced object exist?
Does the target scene exist?
Does the referenced asset exist?
Is the interaction valid?
Is the project publishable?
```

---

# 13. Command / Undo System

**Responsibility:** Make editing operations reversible.

```text
Commands
├── CreateObjectCommand
├── DeleteObjectCommand
├── TransformObjectCommand
├── AddComponentCommand
├── RemoveComponentCommand
├── ModifyInteractionCommand
├── CreateSceneCommand
└── DeleteSceneCommand
```

Flow:

```text
User Action
 ↓
Command
 ↓
Execute()
 ↓
Project changes

Undo()
 ↓
Project restored
```

Compound operations must restore dependent components and interactions as well.

---

# 14. RUNTIME REGION

The Runtime contains functionality required by a **visitor**, not an author.

```text
RUNTIME
│
├── Runtime Application
├── Project Loader
├── Runtime Scene
├── Camera / Navigation
├── Interaction Runtime
├── UI / Panels
├── Media
└── Analytics
```

It should NOT contain:

```text
Editor Inspector
Scene Tree
Asset Browser
Gizmos
Editing Commands
Undo / Redo
```

---

# 15. Runtime Application

```text
RuntimeApplication
├── startup
├── load published project
├── initialise experience
├── run visitor loop
└── shutdown
```

Flow:

```text
Published URL
 ↓
Load Project
 ↓
Deserialize
 ↓
Create Runtime Scene
 ↓
Visitor Interaction
 ↓
Analytics
```

---

# 16. Runtime Scene

**Responsibility:** Reconstruct the experience for viewing.

```text
RuntimeScene
├── Environment
├── Objects
├── Zones
├── Camera
└── Navigation
```

The runtime does not care how the author created those objects.

It only consumes the project description.

---

# 17. Runtime Interaction

**Responsibility:** Detect visitor interaction and execute project rules.

```text
Visitor Input
 ↓
Raycast / Zone Detection
 ↓
Interaction Engine
 ↓
Action
 ↓
UI / Media / Navigation
```

This is where preview/published parity is protected.

---

# 18. Runtime Presentation

**Responsibility:** Present authored content to the visitor.

```text
Presentation
├── Information Panels
├── Images
├── Audio
├── Video
├── Hotspots
└── Transitions
```

---

# 19. Runtime Analytics

**Responsibility:** Record lightweight engagement information.

```text
Analytics
├── visit
├── time spent
├── hotspot click
└── scene reached
```

Keep analytics deliberately small for MVP.

---

# 20. BACKEND / INFRASTRUCTURE

The application systems sit above infrastructure.

```text
INFRASTRUCTURE
│
├── API
├── Authentication / Access
├── Project Persistence
├── Asset Storage
├── Publishing
├── Analytics Storage
└── Monitoring
```

The backend is responsible for **storing, retrieving and distributing project data**, not for implementing 3D editor mathematics.

---

# 21. Responsibility Boundary

| Region | System | Owns |
|---|---|---|
| Editor | Editor Application | Editor lifecycle and coordination |
| Editor | UI | Author-facing controls |
| Editor | Viewport | 3D editing view |
| Editor | Selection | Selected-object state |
| Editor | Gizmos | Transform manipulation |
| Editor | Scene Tree | Scene hierarchy interface |
| Editor | Asset Browser | Approved asset discovery |
| Editor | Inspector | Property editing |
| Editor | Interaction Builder | Creating rules |
| Editor | Preview | Visitor-style testing |
| Shared | Project | Complete experience definition |
| Shared | Scene | Spatial scene definition |
| Shared | Object/Components | Scene content |
| Shared | Spatial | 3D primitives/math |
| Shared | Interaction | Trigger/action execution |
| Shared | Serialization | Project ↔ persistent representation |
| Shared | Validation | Project correctness |
| Shared | Commands | Editing + undo/redo |
| Runtime | Runtime App | Visitor playback lifecycle |
| Runtime | Runtime Scene | Experience reconstruction |
| Runtime | Navigation | Visitor movement / scene switching |
| Runtime | Presentation | Panels/media/UI |
| Runtime | Analytics | Visitor engagement data |
| Infrastructure | API | Client/server communication |
| Infrastructure | Persistence | Saving project data |
| Infrastructure | Storage | Large assets/media |
| Infrastructure | Publishing | Public experience distribution |
| Infrastructure | Access | Project/runtime permissions |

---

# 22. System Dependency Direction

A useful rule for preventing architectural coupling:

```text
EDITOR
   ↓
SHARED CORE
   ↓
INFRASTRUCTURE

RUNTIME
   ↓
SHARED CORE
   ↓
INFRASTRUCTURE
```

Prefer:

```text
Editor → Project
Runtime → Project
Gizmo → Spatial
Interaction Builder → Interaction definitions
Runtime → Interaction Engine
Serializer → Project
```

Avoid:

```text
Project → Editor UI
Project → Runtime UI
Gizmo → Database
Interaction Engine → React components
```

The Shared Core should not know about the Editor's UI framework or the Runtime's presentation layer.

---

# 23. Primary Technical Backbone

The most important shared dependency chain is:

```text
                  PROJECT MODEL
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
       SCENE        OBJECTS     INTERACTIONS
          │            │            │
          └────────────┼────────────┘
                       ↓
                 SERIALIZATION
                       │
              ┌────────┴────────┐
              ↓                 ↓
           EDITOR             RUNTIME
              │                 │
           modifies            reads
              │                 │
              └────────┬────────┘
                       ↓
               SAME EXPERIENCE
```

This is the architectural centre of the project.

---

# 24. Suggested Development Phases

## Phase 1 — Technical Foundation

Goal:

> Prove the core architecture works.

```text
Environment loads
      ↓
Object exists
      ↓
Object can be selected
      ↓
Object can be moved
      ↓
Project can be serialized
      ↓
Project can be reloaded
```

This is the project's highest-risk technical spike.

---

## Phase 2 — Editor Foundation

Goal:

> Make the spatial authoring loop usable.

```text
Scene Tree
Asset Browser
Viewport
Selection
Inspector
Gizmos
Undo / Redo
Save / Load
```

Milestone:

> A student can construct a basic scene.

---

## Phase 3 — Experience System

Goal:

> Turn the scene into an interactive experience.

```text
Content Components
      +
WHEN → DO
      +
Zones
      +
Multiple Scenes
      +
Navigation
```

Milestone:

> A student can construct a small interactive exhibition.

---

## Phase 4 — Preview / Persistence / Publishing

Goal:

> Make the experience end-to-end.

```text
Edit
 ↓
Save
 ↓
Preview
 ↓
Validate
 ↓
Publish
 ↓
URL
 ↓
Visitor Runtime
```

Milestone:

> A student can publish an experience and another device can open it.

---

## Phase 5 — Stability / Scale / Polish

Goal:

> Make the system reliable enough for real users.

Focus:

```text
Data integrity
Performance
Autosave
Error handling
Browser compatibility
Testing
Project isolation
Runtime reliability
Publishing reliability
Analytics
Monitoring
```

The final quality target is not simply "more features."

It is:

> **A non-technical student can use the system without engineering assistance, and the published result behaves exactly like the preview.**

---

# 25. MVP Boundary

## In scope

```text
3D environments
Curated GLB assets
Object placement
Move / rotate / scale
Scene tree
Inspector
Undo / redo
Text / image / audio / video
Hotspots
Interactive zones
WHEN → DO
Multiple scenes
Navigation
Templates
Save / load
Autosave
Preview
Publish
Visitor runtime
Basic analytics
Responsive browser viewing
```

## Explicitly outside MVP

```text
Arbitrary model upload
OBJ / FBX conversion
Mesh editing
Material authoring
Custom HTML/components
Variables / conditions / scripting
Real-time collaboration
Billing / SaaS infrastructure
LMS / SCORM
Native mobile applications
VR / WebXR
Gaussian Splat generation
```

---

# 26. Stability Goal

Stability should mean:

```text
Stable Data
     +
Stable Behaviour
     +
Stable Runtime
     +
Stable Persistence
     +
Stable Publishing
```

Key guarantees:

```text
If save says "saved" → data is saved.
If undo is used → previous state is restored.
If preview works → published version works the same way.
If a project loads → its structure is reconstructed correctly.
If a rule fires → it fires predictably.
```

---

# 27. Scalability Goal

For this student project, scalability should mean **architectural scalability**, not unnecessarily complex infrastructure.

```text
More Projects
More Assets
More Visitors
More Features
        ↓
Architecture remains maintainable
```

The design supports this through:

```text
Shared domain model
Modular systems
Versioned project format
Stateless API
Database for structured data
Object storage for large assets
Reusable runtime
```

Do not introduce microservices, Kubernetes, real-time collaboration, or other infrastructure complexity unless a genuine requirement appears.

---

# 28. Final Engineering Model

The entire system can be understood as four questions:

```text
1. WHAT IS THE EXPERIENCE?
   → Project / Scene / Objects / Components

2. HOW DO WE EDIT IT?
   → Editor / Gizmos / Inspector / Commands

3. HOW DOES IT BEHAVE?
   → Interaction Engine / Runtime

4. HOW DOES IT SURVIVE AND GET DELIVERED?
   → Serialization / Persistence / Publishing / Infrastructure
```

Or, as the project's fundamental loop:

```text
AUTHOR
  ↓
EDIT
  ↓
PROJECT DATA
  ↓
SAVE
  ↓
PREVIEW
  ↓
PUBLISH
  ↓
RUNTIME
  ↓
VISITOR
```

**This loop should be treated as the primary architecture.**

Everything else should support this loop rather than become a separate product.



### Final File Layout of Repository
# Spatial Experience Builder File System Layout

```text
spatial-experience-builder/
│
├── apps/
│   │
│   ├── editor/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── EditorApplication.ts
│   │   │   ├── EditorContext.ts
│   │   │   │
│   │   │   ├── ui/
│   │   │   │   ├── EditorShell.tsx
│   │   │   │   ├── Toolbar.tsx
│   │   │   │   ├── SceneTreePanel.tsx
│   │   │   │   ├── AssetPanel.tsx
│   │   │   │   └── InspectorPanel.tsx
│   │   │   │
│   │   │   ├── viewport/
│   │   │   │   ├── Viewport.ts
│   │   │   │   ├── CameraController.ts
│   │   │   │   ├── SelectionSystem.ts
│   │   │   │   └── Raycaster.ts
│   │   │   │
│   │   │   ├── gizmos/
│   │   │   │   ├── GizmoSystem.ts
│   │   │   │   ├── TranslationGizmo.ts
│   │   │   │   ├── RotationGizmo.ts
│   │   │   │   ├── ScaleGizmo.ts
│   │   │   │   ├── GizmoHitTest.ts
│   │   │   │   └── TransformManipulator.ts
│   │   │   │
│   │   │   └── ...
│   │   │
│   │   └── tests/
│   │
│   ├── runtime/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── RuntimeApplication.ts
│   │   │   ├── RuntimeScene.ts
│   │   │   ├── RuntimeCamera.ts
│   │   │   ├── RuntimeInteraction.ts
│   │   │   ├── presentation/
│   │   │   └── analytics/
│   │   └── tests/
│   │
│   └── api/
│       ├── src/
│       │   ├── server.ts
│       │   ├── routes/
│       │   ├── services/
│       │   └── repositories/
│       └── tests/
│
├── packages/
│   │
│   ├── project/
│   │   ├── Project.ts
│   │   ├── Scene.ts
│   │   ├── SceneObject.ts
│   │   ├── Component.ts
│   │   └── ...
│   │
│   ├── spatial/
│   │   ├── Transform.ts
│   │   ├── Ray.ts
│   │   ├── Plane.ts
│   │   └── ...
│   │
│   ├── interaction/
│   │   ├── Interaction.ts
│   │   ├── Trigger.ts
│   │   ├── Action.ts
│   │   ├── InteractionEngine.ts
│   │   └── ...
│   │
│   ├── serialization/
│   │   ├── ProjectSerializer.ts
│   │   ├── ProjectDeserializer.ts
│   │   ├── ProjectSchema.ts
│   │   ├── Version.ts
│   │   └── Migration.ts
│   │
│   ├── commands/
│   │   ├── Command.ts
│   │   ├── CommandHistory.ts
│   │   ├── CreateObjectCommand.ts
│   │   ├── DeleteObjectCommand.ts
│   │   ├── TransformObjectCommand.ts
│   │   └── ...
│   │
│   ├── validation/
│   │   ├── ProjectValidator.ts
│   │   ├── SceneValidator.ts
│   │   └── ...
│   │
│   └── assets/
│       ├── Asset.ts
│       ├── AssetRegistry.ts
│       ├── AssetLoader.ts
│       └── ...
│
├── infrastructure/
│   ├── database/
│   ├── storage/
│   ├── deployment/
│   └── docker/
│
└── tests/
    ├── integration/
    ├── e2e/
    └── performance/
```