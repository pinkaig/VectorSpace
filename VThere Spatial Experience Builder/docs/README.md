# VThere Documentation Map

This folder is organized by the question an agent or contributor is trying to answer. Start here before opening a document.

## Where to look

| Need | Folder | Start with |
|---|---|---|
| Product purpose, requirements, scope, or proposal | [`01-product/`](01-product/) | [`proposal`](01-product/2026-09-10--FOUNDATION--proposal.md), [`project scope`](01-product/UNDATED--FOUNDATION--project-scope.md) |
| Architecture, boundaries, contracts, or technology | [`02-architecture/`](02-architecture/) | [`architecture`](02-architecture/UNDATED--FOUNDATION--architecture.md), [`contracts`](02-architecture/UNDATED--FOUNDATION--contracts.md) |
| Milestones, ownership, implementation phases, or testing strategy | [`03-delivery/`](03-delivery/) | [`deliverables`](03-delivery/2026-09-10--CURRENT--deliverables.md), [`implementation plan`](03-delivery/UNDATED--FOUNDATION--implementation-plan.md) |
| Coding workflow, setup, debugging, or engineering rules | [`04-engineering/`](04-engineering/) | [`development guide`](04-engineering/UNDATED--CURRENT--development-guide.md), [`CI/CD and build/test guide`](04-engineering/CURRENT--CI-CD-build-and-test-guide.md), [`environment setup`](04-engineering/UNDATED--CURRENT--environment-setup.md), [`source-file header standard`](04-engineering/source-file-header-standard.md) |
| A subsystem's technical contract or teaching guide | [`05-subsystems/`](05-subsystems/) | [`authoring engine`](05-subsystems/authoring-engine.md), [`project serialization`](05-subsystems/project-serialization.md), [`3D viewport`](05-subsystems/viewport.md), [`asset library`](05-subsystems/UNDATED--CURRENT--asset-library-contract.md) |
| AI use and verification record | Project documentation root | [`AI declaration`](ai-declaration.md) |
| Product design, UX flows, wireframes, or mockups | [`06-design/`](06-design/) | Add approved design artifacts here. |
| Historical plans, research, lessons, or superseded notes | [`07-research-and-history/`](07-research-and-history/) | Treat these as context, not current authority. |

## Authority order

When documents disagree, use this order:

1. Approved scope and proposal in `01-product/`.
2. Current architecture and contracts in `02-architecture/`.
3. Current deliverables and implementation plan in `03-delivery/`.
4. Engineering guidance in `04-engineering/`.
5. Subsystem contracts in `05-subsystems/`.
6. Research and history only for background unless a current document explicitly adopts it.

## Agent workflow

1. Read this map.
2. Read the relevant product scope and architecture before changing behavior.
3. Find the owning deliverable in `03-delivery/`.
4. Inspect the source and tests named by that deliverable.
5. Update the relevant contract or plan when the implementation changes an architectural boundary.

The filename prefixes are intentional: `FOUNDATION` identifies baseline design, `CURRENT` identifies active operational guidance, `GOVERNANCE` identifies team/process material, `RESEARCH` identifies exploratory material, and `HISTORY` identifies historical context.
