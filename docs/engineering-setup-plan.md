# Engineering Setup and Implementation Plan

**Repository:** `Project5_DoReMi-yaki`  
**Status:** Initial team planning baseline  
**Date:** 2026-09-10  
**Source request:** Application and Mobile Teams engineering setup brief

## 1. Purpose and planning decision

This repository contains one application project:

- **VThere Spatial Experience Builder:** a browser-based spatial authoring and visitor-runtime product.

A sibling ChargedUp Cross-Site Energy & Sustainability Simulator project was once
committed here and has been removed. Rows below marked ChargedUp are retained as
the original planning record only; they describe no code in this repository.

This document is the repository-level plan for turning the team's proposal into traceable implementation work. Each project retains its own detailed scope, architecture, contracts, tests, and setup documentation in its project directory. The root repository provides shared governance, contribution rules, CI expectations, and a single index into the work.

The requested sequence is:

```text
Proposal -> Architecture -> Deliverables and ownership -> M1/M2/M3 -> Jira -> Implementation and CI/CD -> GitHub/PR -> Integration
```

No native mobile application is currently in either approved scope. Mobile work should therefore be treated as responsive browser-runtime validation for VThere and responsive dashboard validation for ChargedUp unless the proposal is formally changed.

## 2. Existing proposal and architecture anchors

| Project | Proposal / scope | Architecture | Current implementation anchor |
|---|---|---|---|
| VThere | [Architecture v0.1](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Architecture-v0.1) (wiki) | [Contracts](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Contracts) (wiki) | [`VThere Spatial Experience Builder/README.md`](<../VThere Spatial Experience Builder/README.md>) |

Before implementation expands, each project should add or maintain these local documents where applicable:

These now live on the project wiki rather than in the repository:

- [Toolchain Decision Document](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Toolchain-Decision-Document) — approved tech stack and the reasoning.
- [Architecture v0.1](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Architecture-v0.1) — system map.
- [Contracts](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Contracts) — cross-boundary behavior.
- [Testbed Spec](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Testbed-Spec) — what is tested and how.
- [M1 Capability Audit](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/M1-Capability-Audit) — source-verified status against each claimed capability.

Product design and UI/UX flows have no page yet.

## 3. Repository structure

The app keeps its own subdirectory so the repository root stays reserved for governance files and the entry-point scripts. The structure is:

```text
Project5_Team17_DoReMi-yaki/
|-- README.md
|-- run.sh / run.bat          one-command setup, build, test, run
|-- clean.sh / clean.bat      remove generated and local-only files
|-- docs/
|   `-- engineering-setup-plan.md
|-- VThere Spatial Experience Builder/
|   |-- AI-DECLARATION.md     required AI-use declaration
|   |-- CODEBASE_GUIDE.md     orientation for reading the source
|   |-- apps/                 editor, runtime, api (api is M2 scaffolding)
|   |-- packages/             authoring-engine, assets, audio, text,
|   |                         interaction, project, sync, debugging
|   |-- src/
|   |-- docs/                 pointer to the wiki only
|   |-- tests/
|   `-- scripts/
|-- .github/workflows/
|-- .gitattributes
`-- .gitignore
```

The sibling `ChargedUp Cross-Site Energy & Sustainability Simulator/` project and
the `Agent Skills/` directory were removed for the M1 submission; this repository
now holds one product. Reference documentation moved to the
[project wiki](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki),
so the app's `docs/` folder is now only a pointer to it.

The root `.gitignore` already excludes Node/Python dependencies, build output, caches, IDE files, logs, local databases, archives, and environment secrets. Keep using `.env.example` files for non-secret configuration and never commit credentials or generated artifacts.

## 4. Major deliverables and ownership

Ownership is expressed by role until the team roster and Jira assignees are confirmed. One person may hold multiple roles, but every deliverable must have one directly responsible owner and one reviewer.

| ID | Deliverable | Project | Primary owner | Reviewer / dependency |
|---|---|---|---|---|
| VTH-01 | Shared versioned project model, serialization, migrations | VThere | VThere Domain Engineer | VThere API Engineer |
| VTH-02 | Authoring engine: selection, transforms, gizmos, commands, undo/redo | VThere | VThere Editor Engineer | VThere Domain Engineer |
| VTH-03 | Editor UI and Three.js viewport | VThere | VThere Frontend Engineer | UX/Product Designer |
| VTH-04 | Interaction engine and preview/runtime parity | VThere | VThere Runtime Engineer | VThere Domain Engineer |
| VTH-05 | API, persistence, publishing, access control, asset storage | VThere | VThere Backend Engineer | Security/Integration Reviewer |
| VTH-06 | Responsive visitor runtime and analytics | VThere | VThere Runtime Engineer | QA Engineer |
| CHG-01 | Deterministic simulation domain and validation | ChargedUp | ChargedUp Simulation Engineer | ChargedUp Backend Engineer |
| CHG-02 | FastAPI application services and typed contracts | ChargedUp | ChargedUp Backend Engineer | Simulation Engineer |
| CHG-03 | React dashboard, charts, scenario controls, and Cesium view | ChargedUp | ChargedUp Frontend Engineer | UX/Product Designer |
| CHG-04 | PostgreSQL/PostGIS repositories, seed data, and GIS preparation | ChargedUp | ChargedUp Data Engineer | Backend Engineer |
| CHG-05 | Docker Compose, CI/CD, test harness, and environment documentation | Both | DevOps/QA Engineer | All technical owners |
| GOV-01 | Product design, accessibility, responsive behavior, and evidence | Both | UX/Product Designer | Product Owner |
| GOV-02 | Jira traceability, release notes, PR review, and integration coordination | Both | Product/Integration Lead | Technical Leads |

## 5. Milestone targets

Milestones are evidence gates, not dates. Jira should use one Epic per deliverable above and Stories/Tasks beneath it. Replace role owners with named assignees after team confirmation.

### M1: Foundation and vertical slice

- **VTH-01:** versioned project schema can serialize, deserialize, validate, and round-trip a minimal scene.
- **VTH-02:** select and transform a curated object through a tested framework-agnostic command path; undo/redo works.
- **VTH-03:** editor loads with viewport, scene tree, asset browser, and inspector.
- **VTH-04:** one supported interaction is represented and runs in preview using the shared model.
- **VTH-05:** API boundary, health check, and persistence contract are documented with a local stub or baseline implementation.
- **VTH-06:** visitor runtime can load a minimal published-like project on desktop and a narrow mobile viewport.
- **CHG-01:** deterministic 24-hour simulation accepts validated input and returns typed time-series results.
- **CHG-02:** API exposes scenario validation and simulation endpoints with stable error responses.
- **CHG-03:** dashboard edits one scenario, runs it, and displays primary KPIs.
- **CHG-04:** seed data and repository boundary work through the documented local environment.
- **CHG-05:** clean-clone install, build, lint, and focused tests run in CI.
- **GOV-01/GOV-02:** approved user flows, Jira epics, ownership, and PR template/checklist are in place.

**M1 exit evidence:** a reviewer can clone the repository, follow the README, run the baseline vertical slice, and locate its proposal, architecture, tests, and owning Jira Epic.

### M2: Integrated MVP workflow

- **VTH:** author, save, reload, preview, publish, and open a shareable visitor experience using one versioned project representation; core interaction and content paths are covered by tests.
- **CHG:** complete scenario-to-simulation-to-dashboard flow, comparison of two completed runs, time-slider playback from stored results, and spatial site-state visualization.
- **Both:** API/frontend contracts are generated or checked for drift, integration tests run in CI, and responsive behavior is verified on desktop and mobile viewport targets.

**M2 exit evidence:** the primary user journey works end to end in a clean environment with reproducible test data and no manual database edits.

### M3: Hardening, demonstration, and release readiness

- **VTH:** reliable autosave/recovery behavior, access-control checks, preview/published parity evidence, basic analytics, performance checks, and release documentation.
- **CHG:** deterministic regression fixtures, capacity/emissions validation, clear assumption labels, database migration/seed verification, performance checks, and release documentation.
- **Both:** Ubuntu 24.04 server deployment verification; development/build checks on Ubuntu 24.04, macOS Tahoe, and Windows 11 where applicable; security review; accessibility review; tagged demo release.

**M3 exit evidence:** a new contributor can reproduce the build, tests, and demo from the repository, and every release claim links to code, test, CI, or deployment evidence.

## 6. Jira breakdown and traceability

Create these Jira Epics, using the IDs as stable local labels until Jira keys are available:

- `VTH-01` to `VTH-06` for VThere technical deliverables.
- `CHG-01` to `CHG-05` for ChargedUp technical deliverables.
- `GOV-01` and `GOV-02` for shared product governance and integration.

Each Epic should contain Stories/Tasks with this minimum information:

- **Outcome:** one observable behavior or artifact.
- **Owner:** one named assignee.
- **Acceptance criteria:** testable conditions, including error behavior where relevant.
- **Milestone:** M1, M2, or M3.
- **Repository path:** the source, test, or document location.
- **Evidence:** PR, CI run, screenshot/video, deployment check, or test report.
- **Dependencies:** upstream Epic/Story and integration risks.

Use the same ID in branch names, PR titles, commit scopes, and release notes, for example `VTH-02-transform-commands` and `VTH-02: add transform command history`.

## 7. Implementation, CI/CD, and GitHub workflow

1. Create or refine the project-level `docs/2026-09-10--CURRENT--2026-09-10--CURRENT--deliverables.md` from this ownership table.
2. Create Jira Epics and Stories before starting substantial feature work.
3. Create a short-lived branch from the shared integration branch using the Jira ID.
4. Keep implementation, focused tests, and relevant documentation in the same PR.
5. Require one technical reviewer and, for user-facing changes, UX review.
6. CI must install from lockfiles, run formatting/lint/type checks, run focused tests, then run integration tests where available.
7. Build artifacts must be generated in CI or deployment environments and remain untracked locally.
8. Merge only when acceptance criteria and evidence are present; update the Jira issue with the PR and CI links.
9. Integrate by vertical slice, then run the full project test suite before milestone sign-off.
10. Tag or record the M1/M2/M3 baseline after the corresponding exit evidence is reviewed.

Recommended CI matrix:

| Check | VThere | ChargedUp |
|---|---:|---:|
| Dependency install from lockfile | Yes | Yes |
| Lint and formatting | TypeScript | Python + TypeScript |
| Type/static checks | TypeScript | Python + TypeScript |
| Unit tests | Shared packages/editor/runtime | Simulation/domain/services |
| Integration tests | API/editor/runtime contract | Frontend/API/database/simulation |
| Build | Editor/runtime/API as applicable | Frontend/backend/container as applicable |
| Ubuntu 24.04 deployment check | API/container where applicable | Backend/container |

## 8. Cross-platform and environment requirements

- Document exact Node.js, Python, package-manager, Docker, and database versions in each project README or environment guide.
- Prefer npm scripts, Make targets, or documented cross-platform commands over shell-specific scripts.
- Validate development/build workflows on Ubuntu 24.04, macOS Tahoe, and Windows 11 where the project uses that toolchain.
- Server components must run in a reproducible Ubuntu 24.04 container or host deployment path.
- Keep paths, environment variables, line endings, and file watching compatible with Windows and macOS.
- Provide `.env.example` files with safe placeholder values and a startup diagnostic for missing tools/configuration.

## 9. Decisions and suggestions to adopt

1. **Keep the app separated from root governance.** Root-level governance files and entry-point scripts are useful; app code stays inside its own directory.
2. **Use vertical slices for milestones.** A working author-to-runtime path and scenario-to-dashboard path reveal integration problems earlier than isolated component completion.
3. **Treat contracts as first-class artifacts.** Version the VThere project document format and test save/load round trips for schema compatibility.
4. **Make evidence part of completion.** A Jira ticket is incomplete until its repository path, tests, CI result, and reviewer are recorded.
5. **Add mobile validation without expanding scope.** Test responsive browser experiences on phone-sized viewports; do not create a native mobile app unless the approved proposal changes.
6. **Use an architecture conflict rule.** If a change crosses a documented boundary, update the architecture and obtain a recorded decision before implementation continues.
7. **Keep generated artifacts out of Git.** CI should publish build/test evidence; source control should contain reproducible inputs and documentation.

## 10. Actions requiring external access or team confirmation

- A repository administrator must invite GitHub user **`giraphics`** as a collaborator/contributor. This cannot be completed from the repository files alone.
- The team must provide the attached Excel sheet or its path before it can be updated. No Excel file is present in the current repository tree.
- Team leads must replace role-based owners with named members and Jira account IDs.
- The product owner must confirm whether this repository is intentionally the single source of truth for both projects or whether the projects will later be split into separate repositories.
- The team must confirm the Jira project key, integration branch policy, deployment target, and milestone dates.

## Definition of done for this setup request

- Root `/docs` exists and contains this plan.
- Existing product proposals and architectures are linked and remain authoritative for product-specific decisions.
- Deliverables have owners, M1/M2/M3 targets, Jira mapping, CI/CD expectations, and integration rules.
- The root `.gitignore` remains clean and excludes generated clutter and secrets.
- GitHub collaborator invitation, Excel update, named assignments, and Jira creation are completed by the responsible people with access.
