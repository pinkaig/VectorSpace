# VThere Spatial Experience Builder — Project Scope

**Stage:** 1 of 5
**Source:** `VThere_DigiPen_Spatial_Experience_Builder_Project_5.docx`
**Status:** Draft for human approval

**Baseline phase:** Not stage-specific — see [8-stage baseline overview](../../code/baseline-phases.md) for the full sequence.

## Domain concepts you may want first

- **Spatial authoring:** constructing a scene by placing and arranging objects in a navigable 3D environment.
- **Transform:** an object's position, rotation, and scale in 3D space.
- **Scene graph:** the named hierarchy of objects that make up one scene.
- **Hotspot and interactive zone:** a visible object or invisible region that can trigger visitor behaviour.
- **WHEN → DO interaction:** a no-code rule connecting a visitor or scene event to an action.
- **Preview/published parity:** the authored experience must behave the same in editor preview and visitor playback.
- **Curated asset library:** a controlled set of supplied or openly licensed 3D assets with known scale, orientation, and pivot conventions.

These are domain concepts, not code mechanisms. If any are unfamiliar, ask before approving this scope — approving a scope you can't evaluate is worse than a delay.

## 1. Project Overview

### Project name

VThere Spatial Experience Builder.

### Purpose

Provide a browser-based no-code authoring application that allows a student or educator to construct a small interactive 3D exhibition, preview it, publish it, and share the resulting visitor experience.

### Problem being solved

Non-technical authors need to create spatial exhibitions without writing code or using a professional 3D authoring tool. The system must make object placement, content attachment, visitor interactions, scene navigation, saving, previewing, and publishing understandable and dependable.

### Intended users

- **REQUIRED — Author:** a student or educator who creates and edits an experience without writing code.
- **REQUIRED — Visitor:** a person who opens a published experience, potentially without an account and on another device.
- **REQUIRED — Administrator / organisation owner:** provisions the organisation, accounts, environments, and approved asset library.
- **UNDEFINED — Organisation permissions:** the brief identifies administration and authenticated access, but does not define the complete permission model.

### High-level system description

The system consists of a browser authoring application, a structured project document describing the authored experience, a visitor runtime that reads that same document, and services for persistence, publishing, access control, and lightweight analytics.

## 2. Objectives

### Primary objectives

- **REQUIRED — Browser authoring:** enable an author to build an experience in a browser without writing code.
- **REQUIRED — Visual 3D editing:** enable an author to place, select, move, rotate, and scale curated 3D assets visually.
- **REQUIRED — Shared project representation:** describe authored work in one versioned structured project document consumed by both editor and runtime.
- **REQUIRED — Interactive experiences:** enable no-code WHEN → DO rules for object clicks, zone entry, scene start, content presentation, media, and navigation within the approved vocabulary.
- **REQUIRED — Preview and publish:** enable an author to test an experience in visitor mode and publish a shareable result with equivalent behaviour.
- **REQUIRED — Persistence:** preserve authored work through save, load, and autosave behaviour.
- **REQUIRED — Technical component:** implement substantial custom engineering in transform manipulation, scene serialisation, interaction dispatch, or undo/redo rather than assembling a ready-made editor framework that provides those systems.

### Secondary objectives

- **REQUIRED — Multiple scenes:** support a guided exhibition spanning more than one scene.
- **REQUIRED — Templates:** provide at least one Virtual Exhibition starter structure.
- **REQUIRED — Basic analytics:** record visits, time spent, hotspot clicks, and scenes reached.
- **OPTIONAL — Visual polish:** provide coherent visual language, iconography, and asset presentation suitable for a student-facing tool.
- **FUTURE — Broader creation platform:** extend beyond the MVP only after the core author-preview-publish loop is stable.

## 3. Functional Requirements

### Authoring

- **REQUIRED — Project creation and opening:** an author can create or open an assigned project.
- **REQUIRED — Environment loading:** the authoring environment loads in a browser.
- **REQUIRED — Asset discovery:** the author can browse an approved, curated 3D asset library.
- **REQUIRED — Asset placement:** the author can place a library asset into a scene.
- **REQUIRED — Object selection:** an object can be selected from the 3D view and scene tree.
- **REQUIRED — Transform manipulation:** the author can move, rotate, and scale an object using visual controls.
- **REQUIRED — Object naming and hierarchy:** placed objects appear in a scene tree and can be named or selected there.
- **REQUIRED — Property inspection:** the author can inspect and edit supported object properties.
- **REQUIRED — Undo and redo:** editing operations can be reversed and reapplied, including restoration of an object's attached content and interaction rules after deletion.
- **REQUIRED — Content attachment:** an author can attach text, image, audio, and video content to an object.
- **REQUIRED — Interactive zones:** an author can place an invisible zone and define its spatial extent.
- **REQUIRED — Multiple scenes:** an author can create, order, and switch between multiple scenes.
- **REQUIRED — Scene navigation:** an author can define links between scenes.
- **REQUIRED — Starter template:** an author can start from a Virtual Exhibition structure rather than only an empty scene.

### Interaction authoring

- **REQUIRED — No-code rule creation:** an author can create a WHEN → DO rule without writing code.
- **REQUIRED — Trigger selection:** the supported trigger vocabulary includes at least visitor click, zone entry, and scene start.
- **REQUIRED — Action selection:** the supported action vocabulary includes at least showing a panel, playing audio, moving or transitioning the camera, and navigating to another scene.
- **REQUIRED — Target and parameter editing:** an author can choose a source/target and configure the parameters required by the supported rule.
- **REQUIRED — Predictable ordering:** multiple rules on one object execute in a predictable order.
- **REQUIRED — Zone edge detection:** a zone-entry rule fires once on entry rather than continuously every frame while the visitor remains inside.
- **REQUIRED — Loop protection:** author-created scene navigation loops are guarded against unsafe runtime behaviour.
- **UNDEFINED — Final trigger/action vocabulary:** the brief sets examples and a guardrail but does not fix the complete list.

### Persistence and publishing

- **REQUIRED — Project serialisation:** the project document contains project identity, scenes, objects, components, zones, interactions, and navigation.
- **REQUIRED — Versioning:** saved projects have a format version and a defined approach for loading older versions.
- **REQUIRED — Save and load:** an author can save and later reload a project with object placement preserved.
- **REQUIRED — Autosave:** unsaved work is preserved where the product claims it has been autosaved, or the product clearly reports that it has not.
- **REQUIRED — Preview:** the author can run a visitor-mode preview from the editor.
- **REQUIRED — Publish:** an author can publish an experience and receive a shareable URL.
- **REQUIRED — Access settings:** published experiences support public, unlisted, or authenticated access as specified by the brief.
- **REQUIRED — Visitor runtime:** a published URL opens a runtime with no editing capability, including no hidden editing controls.
- **REQUIRED — Cross-device consumption:** a visitor can open a published result on another device, including a phone in the stated scenario.

### Analytics

- **REQUIRED — Basic visit analytics:** record number of visits.
- **REQUIRED — Basic engagement analytics:** record time spent, hotspot clicks, and scenes reached.
- **UNDEFINED — Analytics retention and reporting:** the brief does not define retention duration, aggregation, export, or reporting screens.

### Inputs and outputs

- **REQUIRED — Inputs:** author actions, curated asset references, supported content references, scene/object properties, interaction definitions, project metadata, and visitor events.
- **REQUIRED — Authoring output:** a versioned structured project document and saved project state.
- **REQUIRED — Publishing output:** a shareable URL resolving to a published project accessible under its configured access setting.
- **REQUIRED — Runtime output:** rendered scenes, presented content, executed actions, navigation, and lightweight analytics events.

## 4. Non-Functional Requirements

Only constraints implied by the brief are included here.

- **REQUIRED — Platform:** the authoring application and visitor runtime are browser-based.
- **REQUIRED — Usability:** a non-programmer, including a teenage student, can construct a small exhibition without engineering assistance.
- **REQUIRED — Runtime separation:** the visitor runtime contains no editing capability.
- **REQUIRED — Behavioural consistency:** preview and published output behave identically.
- **REQUIRED — Data integrity:** saving and loading reconstruct authored structure and transforms correctly.
- **REQUIRED — Interaction determinism:** rules fire predictably, including multiple rules on one object and zone-entry edge detection.
- **REQUIRED — Performance:** the experience loads and runs reasonably on a three-year-old school laptop, as stated in the scenario.
- **REQUIRED — Responsive viewing:** published experiences support browser viewing on a phone.
- **REQUIRED — Maintainability:** the system must have a clear shared project representation and independently gradeable subsystem ownership.
- **REQUIRED — Asset compliance:** assets must be supplied by VThere or openly licensed.
- **REQUIRED — Security and isolation:** separate students' projects must not be visible to or affect one another.
- **UNDEFINED — Quantitative performance targets:** the brief does not define load time, frame rate, project size, or concurrent visitor targets.

## 5. System Boundaries

### Inside this project

- **REQUIRED — Browser editor:** scene authoring UI, viewport, scene tree, asset library, inspector, interaction builder, preview mode, and save state.
- **REQUIRED — Shared experience model:** project, scenes, objects, components, zones, interactions, navigation, and versioned serialisation.
- **REQUIRED — Spatial authoring systems:** selection, raycasting, transform manipulation, and the custom technical component.
- **REQUIRED — Visitor runtime:** published scene reconstruction, visitor input, presentation, navigation, interaction execution, and basic analytics events.
- **REQUIRED — Supporting services:** persistence, asset storage/retrieval, publishing, access control, and analytics storage to the extent needed by the MVP.

### Outside this project

- **FORBIDDEN — Arbitrary model upload and conversion:** OBJ/FBX conversion and arbitrary model ingestion are outside MVP.
- **FORBIDDEN — Mesh and material authoring:** mesh editing and material authoring are outside MVP.
- **FORBIDDEN — Code-based authoring:** custom HTML/components, scripting, variables, and conditions are outside MVP.
- **FORBIDDEN — Real-time collaboration:** simultaneous multi-user editing is outside MVP.
- **FORBIDDEN — Commercial platform infrastructure:** billing/SaaS infrastructure is outside MVP.
- **FORBIDDEN — LMS and SCORM:** integration is outside MVP.
- **FORBIDDEN — Native applications and immersive platforms:** native mobile apps and VR/WebXR are outside MVP.
- **FORBIDDEN — Gaussian Splat generation:** generation is outside MVP.

## 6. Explicit Non-Goals

- **FORBIDDEN — Become a general-purpose 3D modelling tool.**
- **FORBIDDEN — Allow authors to write code to define behaviour.**
- **FORBIDDEN — Let the editor and runtime develop separate project representations.**
- **FORBIDDEN — Hide editing capability in the published runtime.**
- **FORBIDDEN — Make stretch features influence the baseline architecture unless a current requirement needs the extension point.**
- **FUTURE — Real-time collaboration, richer conditions/variables, arbitrary asset pipelines, and immersive output may be considered later but must not shape the MVP baseline.**

## 7. MVP / Baseline Scope

### Minimum functionality required

- **REQUIRED — Browser environment loads.**
- **REQUIRED — An author can place at least one curated 3D object.**
- **REQUIRED — The object can be selected and moved, rotated, and scaled visually.**
- **REQUIRED — The object and its transform can be serialised, saved, reloaded, and reconstructed identically.**
- **REQUIRED — A scene tree, curated asset library, viewport, inspector, save/load, and undo/redo exist for the editor foundation.**
- **REQUIRED — At least the MVP interaction/content path is represented sufficiently to build a small exhibition: text/image/audio/video content, object click, zone entry, show panel, play audio, scene navigation, and scene start.**
- **REQUIRED — Preview, publish, shareable URL, and visitor runtime use the same project representation.**
- **REQUIRED — Basic analytics are recorded.**

### Minimum demonstrable system

A non-programmer places three curated artefacts, attaches information content, previews the exhibition, publishes it, and opens the result on another device. The objects remain where placed, click and zone rules behave predictably, navigation works across two scenes, and undo restores deleted object state and dependent rules.

## 8. Future Phases

These are not baseline requirements.

- **FUTURE — Real-time collaboration.**
- **FUTURE — Variables, conditions, and scripting.**
- **FUTURE — Arbitrary model upload and conversion.**
- **FUTURE — VR/WebXR and native mobile output.**
- **FUTURE — LMS/SCORM integration.**
- **FUTURE — Billing and broader SaaS administration.**
- **FUTURE — Expanded analytics, monitoring, and reporting.**
- **FUTURE — Larger asset and template ecosystems.**

## 9. Constraints

- **REQUIRED — Academic:** the project is a DigiPen Software Engineering Project 5/6 with an MVP expected at Milestone 3.
- **REQUIRED — Team:** team size is 5–9, with UXGD ownership and minimum IMGD/RTIS representation as described in the brief.
- **REQUIRED — Process:** the team uses Jira and Scrum for project management and grading evidence.
- **REQUIRED — Contribution:** every team member needs substantial, separately gradeable work.
- **REQUIRED — Custom engineering:** the authoring engine must include substantial custom-built work; a ready-made editor framework supplying gizmos, serialisation, and event systems is not acceptable as the custom component.
- **REQUIRED — Assets:** use supplied or openly licensed assets unless VThere approves otherwise.
- **UNDEFINED — Hosting provider and deployment environment:** the brief allows a technology and hosting choice but does not select one.
- **UNDEFINED — Identity provider and access model details:** authenticated access is required as an option, but implementation details are not specified.
- **UNDEFINED — Demonstration subject:** the exhibition topic is a team choice subject to approval.

## 10. Acceptance Criteria

- **REQUIRED — Technical spike:** in a clean browser session, the environment loads, an asset can be placed and dragged with a working custom transform interaction, and the scene saves and reloads with identical transforms.
- **REQUIRED — Editor foundation:** an author can create/select/delete an object from the viewport or scene tree, inspect its properties, transform it, undo the deletion, and see attached dependent state restored.
- **REQUIRED — Content:** an author can attach text, image, audio, and video content to a scene object and see each supported content type in preview.
- **REQUIRED — Interaction:** an author can define a click rule and a zone-entry rule; each fires once and performs its configured action in preview.
- **REQUIRED — Scene navigation:** an author can create two scenes and navigate between them in both directions from the visitor experience.
- **REQUIRED — Preview/publish parity:** the same project opened in preview and from its published URL produces the same object placement, content, interaction, and navigation outcomes for the defined scenarios.
- **REQUIRED — Persistence:** closing and reopening the project preserves saved work; autosave status is truthful when a save has not occurred.
- **REQUIRED — Access isolation:** two projects owned by different students cannot read or modify one another's project data under the supported access paths.
- **REQUIRED — Device support:** a published URL opens and runs on a phone and on the stated three-year-old school laptop test device within agreed performance targets.
- **REQUIRED — Analytics:** a visitor session produces records for visit, time spent, hotspot clicks, and scenes reached.

## 11. Assumptions

- **ASSUMPTION — VThere can provide or approve the initial curated asset library.** If false, the project cannot demonstrate the intended content workflow without changing scope or using temporary approved assets.
- **ASSUMPTION — A browser-capable 3D rendering approach is acceptable to DigiPen and VThere.** If false, the technology and architecture must be revisited before Stage 2.
- **ASSUMPTION — Published projects can be served from a stable URL.** If false, publishing and visitor-runtime acceptance criteria must change.
- **ASSUMPTION — The initial content workflow can reference or upload supported media through a storage mechanism.** If false, text/image/audio/video scope must be narrowed.
- **ASSUMPTION — The project can use a single canonical schema shared by editor and runtime.** If false, preview/publish parity requires a different contract and likely changes the architecture.

## 12. Open Questions

- **UNDEFINED — Which exact browser and minimum device versions are supported?** This affects rendering APIs, input handling, and performance testing.
- **UNDEFINED — What are the final supported WHEN triggers and DO actions for MVP?** This affects the interaction schema and authoring UI.
- **UNDEFINED — Is visitor movement free 3D navigation, camera-point navigation, or another model?** This materially affects runtime interaction and mobile usability.
- **UNDEFINED — What are the maximum supported scene/object/media sizes?** This affects performance, storage, and validation.
- **UNDEFINED — What identity, organisation, role, and authenticated-access rules are required?** This affects backend and security architecture.
- **UNDEFINED — Which hosting, storage, database, and deployment constraints apply?** This is required for Stage 2 technology selection.
- **UNDEFINED — What quantitative targets define “reasonable time” and “runs smoothly”?** This is required for measurable performance acceptance.
- **UNDEFINED — What analytics views are required for authors or administrators?** The brief defines events, not the reporting experience.
- **UNDEFINED — What content upload formats, limits, and licensing checks are required?** This affects storage and validation.
- **UNDEFINED — What is the approved demonstration subject and template content?** This affects the initial asset/content package but not the core platform boundary.

## Closing

```text
SCOPE STATUS: BLOCKED

Domain concepts flagged:   spatial authoring, transforms, scene graph, hotspots/zones, WHEN → DO, preview/published parity, curated assets
Open questions:            10 unresolved requirement groups
Architecture-critical
unknowns:                  supported browsers/devices, interaction vocabulary, visitor movement model, identity/access, hosting/storage/deployment, performance targets
Recommended next step:     Human review and approval of this scope; resolve or explicitly accept the architecture-critical unknowns before Stage 2
```
