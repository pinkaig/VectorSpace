# VThere Architecture-Mapping Prompt

A reusable prompt for mapping the implemented and planned architecture of
`VThere Spatial Experience Builder/`. Run it against that project root after a
meaningful architecture change, or when onboarding from the existing map would
be misleading.

## Before running

Confirm these facts with the human owner before generating the final guide:

- AI tool used and the phase or dates in which it was used.
- What the AI tool was asked to do, such as inventory, dependency analysis, or
  documentation drafting.
- What the human reviewed, tested, compiled, or cross-checked.
- Whether personal data or unpublished third-party work was included in any
  prompt. Do not infer or claim that none was used.

If any fact is unknown, mark the architecture analysis as pending human
confirmation and ask for the missing fact before publishing the AI provenance
section. Do not invent verification claims.

## The prompt

```
You are documenting the architecture of the VThere Spatial Experience Builder
for team onboarding. This is a read-and-report task. Do not write application
code, refactor source files, install dependencies, or modify planning documents.

PROJECT ROOT:
VThere Spatial Experience Builder/

Analyze this project independently from the other folders in the parent
repository. The project currently contains a root frontend prototype in src/,
an API scaffold in apps/api/, a README-only runtime area in apps/runtime/, and
shared packages under packages/. Some planned folders do not exist yet. Treat
the repository on disk as authoritative and label planned, missing, and
implemented areas clearly.

The reader comes from a C/C++ procedural game-engine background and thinks in
terms of ECS, data-oriented design, and explicit frame-by-frame update loops.
Where a pattern maps to an ECS or systems-programming concept, explain the
analogy and its limits without implying that the TypeScript object model is
cache-friendly when it is not.

STEP 0 - Establish the analysis boundary.
Record:
  - the project root and commit hash;
  - the analysis date;
  - the planning and architecture documents included;
  - the source roots inspected;
  - existing generated guides and SESSION.md status.
Do not analyze sibling projects unless explicitly asked.

STEP 1 - Inventory planning documents.
Read the relevant planning and architecture documents under this project,
including projectscope.md, techstack.md, the technical architecture document,
layout and technology analysis documents, and applicable docs/*.md files.
Summarize what each claims about layering, data flow, ownership, and maturity.
Separate requirements and planned design from implemented behavior.

STEP 2 - Inventory the actual source tree.
Inspect the root package.json and workspace configuration. Walk src/, apps/,
packages/, and any backend or shared source roots that actually exist. For each
major folder, record what it contains, its public entry points, its imports, and
its known consumers. Use package exports, TypeScript configuration, and actual
imports rather than folder names alone.

STEP 3 - Compare plan with reality.
List concrete drift with file paths:
  - planned folders or packages that are absent;
  - implemented code that is not described by the plans;
  - imports that cross documented boundaries;
  - root prototype code that is expected to move into a package or app;
  - verification or documentation claims that are stale.
Use the labels IMPLEMENTED, PLANNED, MISSING, or DRIFTED.

STEP 4 - Produce a dependency-ordered reading map.
Order folders and entry-point files from foundations to consumers using actual
imports and workspace dependencies. For each entry state what it owns and what
the reader should understand first. Include the current root src/ prototype,
apps/api/, apps/runtime/, and existing packages where applicable. Do not list
planned folders as implemented.

STEP 5 - Translate the key patterns for a systems-programming reader.
For each pattern actually present, such as the scene graph, command/history
model, interaction system, event mechanism, serialization boundary, or React
state flow, explain:
  - its closest ECS or explicit-update analogy;
  - where that analogy breaks down;
  - any real performance, consistency, or ownership implication.
Only describe patterns supported by source evidence. If a pattern is only
planned, label it PLANNED and cite the planning document.

STEP 6 - Build a task-to-files ownership table.
For each applicable task area - authoring UI and gizmos, WHEN/DO interaction,
project model and serialization, asset pipeline, runtime or visitor mode,
API/backend, debugging, and analytics - list:
  - primary folders and entry points to edit;
  - dependencies to understand but rarely edit;
  - boundaries that should not be crossed without an architecture decision;
  - whether the area is IMPLEMENTED, PARTIAL, or PLANNED.
Do not invent folders for absent subsystems.

STEP 7 - Record verification and AI provenance.
Include a short section titled "AI Use and Verification" at the end of the
guide. Use only facts supplied by the human owner:
  - AI tool and analysis date or phase;
  - AI-assisted activities;
  - files or decisions affected;
  - human review and verification actually completed;
  - personal-data or unpublished-work prompt handling;
  - commands run and their results.
If a fact is not supplied, write "Pending human confirmation" and do not claim
that the guide is verified or that no personal data was used.

STEP 8 - Output.
Write the full guide to:
  VThere Spatial Experience Builder/CODEBASE_GUIDE.md

Refresh the existing:
  VThere Spatial Experience Builder/SESSION.md

The SESSION.md update must remain factual and concise. Include the analysis
objective, commit analyzed, decisions, generated guide, verification status,
open questions, and next recommended step. Do not modify any other file.
```

## Why this version is scoped

- It prevents the VThere map from accidentally describing the ChargedUp
  project or the parent `Agent Skills/` folder.
- It treats the existing root `src/` prototype and missing planned packages as
  explicit architecture findings rather than silently treating plans as code.
- It uses the project workspace configuration and imports as evidence for
  dependency order.
- It makes the AI disclosure a factual provenance section, consistent with
  `Agent Skills/ai_disclosure.md`, without turning the technical guide into a
  legal or compliance document.
- It keeps `SESSION.md` as the active handoff record because VThere already has
  one and the repository's handoff command is topic-specific.

## Expected output review

Before accepting the generated files, verify that:

- every referenced path exists or is labeled PLANNED or MISSING;
- the guide names the commit it analyzed;
- dependency order follows real imports and workspace relationships;
- planned architecture is not presented as implemented architecture;
- commands and human verification claims are accurate;
- AI-use and data-care statements were confirmed by the human owner;
- `SESSION.md` records any unresolved architecture or product decisions.
