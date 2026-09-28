# VThere Documentation Map

**Baseline phase:** All 8 stages complete. See [8-stage baseline overview](code/baseline-phases.md).

This folder is code documentation first: reference material tied to real files, modules, and contracts. Start in [`code/`](code/). Everything else is archived background, not authority.

## code/ — reference docs (start here)

| Need | Folder | Start with |
|---|---|---|
| Architecture, boundaries, contracts, tech stack, build system | [`code/architecture/`](code/architecture/) | [`architecture`](code/architecture/UNDATED--FOUNDATION--architecture.md), [`contracts`](code/architecture/UNDATED--FOUNDATION--contracts.md) |
| Coding workflow, setup, debugging, CI/CD, engineering rules | [`code/engineering/`](code/engineering/) | [`development guide`](code/engineering/UNDATED--CURRENT--development-guide.md), [`CI/CD and build/test guide`](code/engineering/CURRENT--CI-CD-build-and-test-guide.md), [`environment setup`](code/engineering/UNDATED--CURRENT--environment-setup.md) |
| A subsystem's technical contract | [`code/subsystems/`](code/subsystems/) | [`authoring engine`](code/subsystems/authoring-engine.md), [`project serialization`](code/subsystems/project-serialization.md), [`viewport`](code/subsystems/viewport.md), [`asset library`](code/subsystems/UNDATED--CURRENT--asset-library-contract.md) |
| Which attachment types (image, text, video, audio, 3D) can be loaded, and how | [`code/subsystems/`](code/subsystems/) | [`attachment types and asset manager`](code/subsystems/attachment-types-and-asset-manager.md) |
| How attachments fit the project data, scene objects, asset kinds, resolvers and libraries — proposed, not built | [`code/subsystems/`](code/subsystems/) | [`attachment integration`](code/subsystems/attachment-integration.md) |
| The audio system design (channels, spatial/360, captions, state, memory) — proposed, not built | [`code/subsystems/`](code/subsystems/) | [`audio system`](code/subsystems/audio-system.md) |
| The image, text and video system designs — proposed, not built | [`code/subsystems/`](code/subsystems/) | [`image`](code/subsystems/image-system.md), [`text`](code/subsystems/text-system.md), [`video`](code/subsystems/video-system.md) |

**Known stale content:** [`asset-manager.md`](code/subsystems/asset-manager.md), [`sync-engine.md`](code/subsystems/sync-engine.md), and [`when-do-dispatch-engine.md`](code/subsystems/when-do-dispatch-engine.md) describe themselves as "planned, not yet implemented." That's no longer true — `packages/assets`, `packages/sync`, and `packages/interaction` (dispatcher) all have real source now. Treat these three docs as needing a rewrite against the current code before trusting them; don't take their status claims at face value.

## Authority order (within code/)

1. Architecture and contracts in `code/architecture/`.
2. Engineering guidance in `code/engineering/`.
3. Subsystem contracts in `code/subsystems/` (see staleness note above).

## Agent workflow

1. Read this map.
2. Read `code/architecture/` before changing behavior that crosses a module boundary.
3. Inspect the source and tests for the subsystem you're touching.
4. Update the relevant contract in `code/` when the implementation changes an architectural boundary — keep it in sync with the code, not the other way around.

## archive/ — background, not authority

Product proposals, delivery plans, governance/roles material, and research/history notes live in [`archive/`](archive/). This is context for *why* a decision was made, not a source of current truth. Don't cite it as an implementation contract — if something in `archive/` still matters operationally, it belongs in `code/` instead, and should be moved there deliberately, not read as-is.

- [`archive/product/`](archive/product/) — proposal, project scope, project context
- [`archive/delivery/`](archive/delivery/) — deliverables, implementation plan, testing strategy, roles
- [`archive/research-and-history/`](archive/research-and-history/) — plans, handoffs, exploration notes, Week 2/3 scratch work
- [`archive/week2-prof-parminder-wants/`](archive/week2-prof-parminder-wants/) — early duplicate drafts, superseded by `code/architecture/` and `archive/product/`
- [`archive/VThere_DigiPen_Spatial_Experience_Builder_Project_5.docx`](archive/VThere_DigiPen_Spatial_Experience_Builder_Project_5.docx) — original source brief
- [`archive/tentative_orunnecessary_ai-declaration.md`](archive/tentative_orunnecessary_ai-declaration.md) — unresolved AI-use declaration draft

The filename prefixes are intentional where they still appear: `FOUNDATION` identifies baseline design, `CURRENT` identifies active operational guidance, `GOVERNANCE` identifies team/process material, `RESEARCH` identifies exploratory material, `HISTORY` identifies historical context.
