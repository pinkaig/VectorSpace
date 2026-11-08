# Contributing — who did what (M2)

This page maps each Jira ticket to the person who owns it and the pull requests that delivered it.
The PR links come from merge commits on `Working`, dated 20 Oct to 8 Nov 2026.
Status is taken from the Jira board as of 8 Nov. Many tickets still say "To Do" there even though a PR has already merged them.

## Team

| Jira initials | Name | Git login | Branch |
|---|---|---|---|
| SH | Sherman | gsherman01 | sherman-branch, sherman-* |
| DT | Daniel Tee | DTeeMZ | Daniel-EXTRA-EXPERIMENTAL |
| PG | Pinkai (PK) | pinkaig | pk_branch |
| CA | Weian Ching | weian-ching | weian_branch |
| CR | Chloe | chloelau / lchloereyen / chlv33 | chloe-branch, chloe-* |

> CHECK: the initials-to-name mapping was inferred by matching each ticket's subject to the branch that delivered it. Confirm CA and CR before submitting.

## Ticket → owner → evidence

| Jira | Task | Owner | Delivered in |
|---|---|---|---|
| PROJ5-159 | Initial UI look: TopBar and Catalogue | DT | #53, #62, #79 |
| PROJ5-160 | Rework Object Inspector UI (visual) | CA | #58 |
| PROJ5-161 | Admin landing page (overview, accounts) | SH | #89 (schools and classes); in progress |
| PROJ5-166 | Interaction subtab in Object Inspector | CR | — (no PR found) |
| PROJ5-167 | Finalise Catalogue (mock models) | DT | #62, #79 |
| PROJ5-168 | TopBar shows rooms and navigates | DT | #62, #79 |
| PROJ5-169 | Project Template for Mission Brief | DT | #53, #68 |
| PROJ5-172 | Image system | CA | #49 |
| PROJ5-173 | Video system | CA | #49 |
| PROJ5-174 | Info section in Object Inspector | CA | #49, #58 |
| PROJ5-175 | CD pipeline for deployment (extra) | PG | — (Render deploy done by SH in #75) |
| PROJ5-191 | Admin dashboard totals match DB (F03) | SH | #89 |
| PROJ5-192 | Role permissions in UI and API (F05) | SH | #88 |
| PROJ5-193 | Upload/list/delete assets in cloud (F06) | PG → SH | #71, #87, #88, #90 |
| PROJ5-194 | Student submits for review (F12) | CA | #65, #67 (CR's branch) |
| PROJ5-195 | Teacher returns or approves (F12) | PG | #63 (publish), #65 |
| PROJ5-196 | Lint step in CI, TS + Python (H2) | SH | #84 |
| PROJ5-197 | Package README/CHANGELOG/example (D1, D3) | SH | #91 (commit 4c33f5f) |
| PROJ5-198 | Architecture v1.0 + wiki link (D3, G2) | SH | `ARCHITECTURE.md` (this change) |
| PROJ5-199 | Performance budget + measured numbers | PG | `PERFORMANCE.md` (numbers still owed) |
| PROJ5-200 | PR template, branch naming, review rules | unassigned | this file, sections below |

## How to contribute

- **Branches:** use `<name>-branch` for day-to-day work and `<name>-<topic>` for one feature. Open a PR into `Working`. `main` only gets milestone merges.
- **PR title:** start it with the Jira key, e.g. `(PROJ5-193) Upload assets to cloud`. Put `(Additional PROJ5-xxx)` for follow-up work.
- **PR body:** say what changed, how you tested it, and which Jira tickets and rubric rows it covers.
- **Review:** someone other than the author approves the PR. CI (tests, ESLint, Ruff, tsc, Newman) must be green before merging.
- **Every API route** that is added or changed gets a Postman request in the same PR.
- **File headers:** follow the wiki's Source-File-Header-Standard, with `@author` set to whoever actually wrote the code.
- **Package changes** get a line in that package's `CHANGELOG.md`.
