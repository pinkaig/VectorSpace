# Git & Handoff Conventions

## Scope and status

These conventions apply to the repository root and its project folders:
`ChargedUp Cross-Site Energy & Sustainability Simulator/`, `VThere Spatial
Experience Builder/`, and `Agent Skills/`.

This file describes the workflow we intend to follow. GitHub branch protection,
pull-request checks, CODEOWNERS, and development containers are repository
settings or files that must be added separately before those controls are
enforced. Documentation alone cannot enforce them.

## Git management

- Treat `main` as the protected integration branch when it exists. Use pull
	requests for changes intended for shared history.
- For agent-driven work, use `agent/<task>-<YYYYMMDD>` where `<task>` is a
	short lowercase slug using hyphens. Human contributors may use the branch
	convention already established by the team.
- Commit per logical step. Keep commits small enough that a reviewer can
	understand and verify each one independently.
- Prefix agent-authored commit subjects with `[agent]`. Do not add a
	`Co-authored-by:` trailer unless the named identity actually contributed to
	the commit and the team has agreed to use that identity.
- Before a large refactor, create a named recovery point such as an annotated
	tag: `git tag -a pre-refactor-<name> -m "Before <name> refactor"`.
	A tag preserves a reference; it does not undo changes by itself. Recovery
	still requires a deliberate revert, reset, or branch operation.
- Record the verification command and result in the handoff record before
	calling work complete.

## GitHub controls to configure

These are recommended controls, not currently guaranteed by this document:

- Protect `main` (and `dev`, if it is introduced) against direct pushes and
	require pull requests.
- Run the relevant lint, typecheck, build, and test commands on every pull
	request. Commands should be defined by the project being changed.
- Add `.github/CODEOWNERS` only after owners and ownership boundaries are
	agreed. Paths must be project-relative and must match folders that actually
	exist; do not assume one project's `packages/` directory applies to all
	projects in this repository.

## Handoff organization

- The active handoff record is `SESSION.md` inside the topic or project
	directory. This matches the `/handoff` command and prevents unrelated topics
	from overwriting one shared file.
- A `SESSION.md` should state the objective, decisions, current implementation
	state, verification command and result, files touched, failed approaches,
	open questions, and the next recommended step.
- Use a repository-level `/handoff/` directory only when a future workflow
	explicitly needs durable cross-project summaries or architecture-mapping
	scratch files. If created, commit durable summaries and ignore disposable
	scratch files deliberately in `.gitignore`.
- Refresh handoff information at the triggers listed in `Agent Skills/CLAUDE.md`:
	after skeleton approval, at subsystem or topic completion, before changing
	topic directories, or when a session becomes long.
- Generated architecture guides and summaries should be reviewed like any
	other documentation change. Do not add a scheduled generator until an owner,
	source of truth, and stale-data policy have been agreed.

## Shared agent infrastructure

- Keep prompts and workflow guidance under `Agent Skills/`, which is the
	repository's current location. Move them to a different shared-docs folder
	only as an intentional repository-wide change.
- Treat the architecture guide's task-to-files table as a proposed ownership
	aid, not an automatic CODEOWNERS configuration. Update it when project
	boundaries change.
- Standardize runtimes with a checked-in `.nvmrc`, `devcontainer.json`, or
	equivalent only after the relevant project toolchains are known. Do not add
	a placeholder environment file that suggests reproducibility without
	defining install and verification commands.

## Pull-request checklist

Before requesting review:

- The branch has the agreed naming convention.
- Commits represent logical steps and agent-authored commits use `[agent]`.
- Relevant tests, builds, lint, or typechecks were run and recorded.
- The applicable `SESSION.md` was refreshed when a handoff trigger occurred.
- Any new GitHub-side control, ownership rule, or environment requirement is
	documented as a separate setup task rather than implied to be active.
