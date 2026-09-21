# Spatial Experience Builder File System Layout

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.

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