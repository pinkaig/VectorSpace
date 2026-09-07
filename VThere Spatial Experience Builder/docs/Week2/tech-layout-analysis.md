# Technical Layout Analysis & Recommended Approach

## Verdict

The proposed monorepo (`apps/editor`, `apps/runtime`, `apps/api`, shared `packages/`) is structurally sound for a browser-based no-code 3D editor. It gets the two decisions right that matter most for this brief: the no-code UI is separated from the engine underneath it, and editor/runtime are two apps sharing core packages rather than one app with a preview flag. It has real gaps, all fixable without a redesign.

## Strengths

- **No-code surface separated from engine.** `apps/editor/ui` (SceneTreePanel, AssetPanel, InspectorPanel) is what Aisyah touches; `gizmos/`, `viewport/`, `packages/interaction` are the engineering underneath, invisible to her. That split is exactly what the brief's "small vocabulary, deep combinations" principle requires — the vocabulary lives at the UI layer, not hard-wired into the engine.
- **Editor/runtime as genuinely separate consumers of shared packages.** `packages/project`, `packages/interaction`, `packages/serialization` are shared; each app only adds its own concerns on top. This is the "editor writes it, runtime reads it" model from Section 1.
- **Serialization treats versioning as first-class.** `Version.ts` and `Migration.ts` sitting alongside `ProjectSerializer`/`ProjectDeserializer` directly answers Section 10's "older saved projects still open after the format changes."

## Gaps

1. **No dedicated WHEN→DO builder UI.** `packages/interaction` has the data model and dispatch engine (`Trigger`, `Action`, `InteractionEngine`), but nothing under `apps/editor/ui` renders the plain-sentence rule builder the brief specifically asks for (not a node graph). This is a UX design surface as much as an engineering one — it needs its own component.
2. **Presentation/rendering looks duplicated, not shared — the highest-risk gap.** `apps/editor` has its own `Viewport.ts`; `apps/runtime` has its own `RuntimeScene.ts` / `RuntimeCamera.ts` / `presentation/`. If these are two independently written render paths, you've built exactly the failure mode the brief calls "the most damaging kind of bug this product can have": preview and published silently drifting apart.
3. **No explicit home for the trigger/action vocabulary as data.** The six triggers and six actions need labels, icons, and parameter shapes so the rule-builder UI can render generically instead of six hardcoded panels. Nothing in the tree currently owns that.
4. **Zones aren't named anywhere.** Interactive zones (invisible regions that fire on visitor entry, Section 6.5) need a spatial representation and a home — currently absent from both `packages/spatial` and `packages/interaction`.
5. **No template storage.** The required starter "Virtual Exhibition" template (Section 6.6) needs somewhere to live — not visible in `packages/project` or elsewhere.
6. **Analytics is undersized.** Only `apps/runtime/analytics/` appears; there's no aggregation service on the API side and no display surface in the editor. (See the companion lesson file for what to scope this to.)

## Recommended structural additions

- `packages/presentation/` — the shared Three.js/Babylon scene-construction layer, consumed by both `apps/editor` and `apps/runtime`. Editor adds gizmos/selection on top; runtime adds interaction dispatch on top. This is the direct fix for gap 2.
- `apps/editor/ui/RuleBuilderPanel.tsx` — the sentence-style WHEN→DO UI, reading from a new vocabulary registry rather than being hand-built per trigger/action.
- `packages/interaction/vocabulary.ts` — data-driven definitions of the six triggers and six actions (label, icon, required parameters), so adding/removing one is a data change, not a UI rewrite.
- `Zone.ts` — add to `packages/spatial` (it's a spatial primitive: a region plus enter/exit testing) and reference it from `packages/interaction` as a trigger source.
- `packages/project/templates/` (or seed data alongside it) — for the Virtual Exhibition starter structure.
- `apps/api/services/analyticsService.ts` plus a persisted events table, and a small `AnalyticsPanel` under `apps/editor/ui`.

## Recommended build order

The ordering logic: build shared foundations first so editor and runtime can never diverge, build the visible/testable milestones next, and push the lowest-payoff, lowest-risk features to the end.

1. **`packages/project` + `packages/spatial`** — the data model and math primitives everything else depends on.
2. **`packages/serialization`** — get save/load working early against a stub scene, so persistence risk (the centre of the whole system per Section 7) is retired first, not last.
3. **`packages/presentation` (new)** — the shared render layer, built once, consumed by both apps. This is the single most important sequencing decision: build this *before* either app has its own rendering code, so there's never a fork to reconcile later.
4. **`apps/editor` viewport + gizmos** — wrap `packages/presentation`, then layer `GizmoSystem`, hit testing, and the manipulator on top. This is your first visible, demoable milestone.
5. **`packages/commands`** (undo/redo) — wraps the manipulation operations from step 4 once they're stable.
6. **`packages/interaction` + vocabulary + `RuleBuilderPanel`** — the brief's "intellectual core," built once the object model is stable enough to attach rules to.
7. **`apps/runtime`**, consuming the same `packages/presentation` and `packages/interaction` for dispatch. Explicitly test preview-equals-published here — it's the brief's own recommended acceptance test (Section 9, last scenario).
8. **`apps/api`** — accounts/projects CRUD, publish endpoint.
9. **Simple engagement analytics** (scoped per the companion lesson file) — last, since it's self-contained and gates nothing else.
10. **Explicitly do not build:** SCORM/LMS integration, institutional SSO — out of scope per Section 12 and the companion lesson file.

## Risk register

- **Preview/published divergence** — mitigated structurally by step 3 (shared `packages/presentation`); this is the risk worth protecting first, not discovering late.
- **WHEN→DO scope creep** — the brief itself flags that a seventh trigger or action roughly doubles build/test/document cost. Freeze the six-and-six vocabulary early; treat any expansion as an explicit stretch goal, not a default.
- **Analytics/LMS scope creep** — see the companion lesson file (`engagement-analytics-lesson.md`) for the reasoning behind keeping analytics small and excluding SCORM/institutional integration entirely.
