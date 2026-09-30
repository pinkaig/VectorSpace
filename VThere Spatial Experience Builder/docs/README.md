# VThere Documentation Map

**Baseline phase:** All 8 stages complete. See [8-stage baseline overview](code/FOUNDATION--baseline-phases.md).

This folder is code documentation first: reference material tied to real files, modules, and contracts. Start in [`code/`](code/). Everything else is archived background, not authority.

## GitHub wiki

Finished, audit-grade M1 deliverables (Toolchain Decision Document, Architecture v0.1, etc.) live on the project's [GitHub wiki](../../../wiki), not in this folder — team feedback flagged dense agent-produced analysis docs sitting in the repo as unwanted evidence of AI use. This `docs/` folder stays working notes and source-of-truth reference material tied to real code; finished/reviewed docs get vetted and moved to the wiki instead of accumulating here.

## code/ — reference docs (start here)

| Need | Folder | Start with |
|---|---|---|
| Architecture, boundaries, contracts, tech stack, build system | [`code/architecture/`](code/architecture/) | [`architecture`](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Architecture-v0.1) (wiki), [`tech stack`](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Toolchain-Decision-Document) (wiki), [`contracts`](code/architecture/FOUNDATION--contracts.md) |
| Coding workflow, setup, debugging, CI/CD, engineering rules | [`code/engineering/`](code/engineering/) | [`development guide`](code/engineering/CURRENT--development-guide.md), [`CI/CD and build/test guide`](code/engineering/CURRENT--CI-CD-build-and-test-guide.md), [`environment setup`](code/engineering/CURRENT--environment-setup.md) |
| A subsystem's technical contract | [`code/subsystems/`](code/subsystems/) | [`authoring engine`](code/subsystems/FOUNDATION--authoring-engine.md), [`project serialization`](code/subsystems/CURRENT--project-serialization.md), [`viewport`](code/subsystems/CURRENT--viewport.md), [`asset library`](code/subsystems/CURRENT--asset-library-contract.md) |

**Known stale content:** [`asset-manager.md`](code/subsystems/CURRENT--asset-manager.md), [`sync-engine.md`](code/subsystems/CURRENT--sync-engine.md), and [`when-do-dispatch-engine.md`](code/subsystems/CURRENT--when-do-dispatch-engine.md) describe themselves as "planned, not yet implemented." That's no longer true — `packages/assets`, `packages/sync`, and `packages/interaction` (dispatcher) all have real source now. Treat these three docs as needing a rewrite against the current code before trusting them; don't take their status claims at face value.

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
