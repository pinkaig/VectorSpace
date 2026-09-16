# GitHub Settings Setup Guide

## Purpose

This guide describes the GitHub-side controls recommended for the
Project5_DoReMi-yaki_MockPrototype repository. The repository contains several
project folders, so settings and automation should be introduced deliberately
rather than assuming one toolchain or one package layout.

This document is a setup guide. Reading it does not change GitHub settings.
A repository administrator must apply the web settings, and selected files
must be added to the repository before the controls become active.

## Current state

The local repository currently has no confirmed:

- branch protection rule or ruleset;
- pull-request CI workflow;
- `.github/CODEOWNERS` file;
- checked-in runtime standard such as `.nvmrc` or `devcontainer.json`.

Confirm these items in the GitHub repository before applying changes, because
settings may already exist outside the local checkout.

## Recommended implementation order

1. Decide the default integration branch. Use `main` if it exists; otherwise
   document the currently used branch before creating protection rules.
2. Inventory the commands for each project: install, lint, typecheck, build,
   and test. Do not create a generic CI job with commands that only work for
   one project.
3. Add and test pull-request CI.
4. Add CODEOWNERS after the owners and folder boundaries are agreed.
5. Protect the integration branch and require the relevant checks.
6. Review Actions permissions, secret handling, and repository access.

This order keeps branch protection from blocking contributors with checks that
have not yet been created or tested.

## Branch protection or rulesets

In GitHub, open **Settings > Rules > Rulesets** or the branch protection area
for the repository. Create a rule for the integration branch.

Recommended controls:

- Require a pull request before merging.
- Require at least one approving review.
- Dismiss stale approvals when new commits are pushed, if the team needs that
  level of review freshness.
- Require all selected CI checks to pass before merging.
- Require branches to be up to date before merging only if the team accepts
  the extra merge friction.
- Block force pushes and branch deletion.
- Permit administrators to bypass the rule only when an emergency policy is
  explicitly agreed.

Do not require CODEOWNERS approval until `.github/CODEOWNERS` exists and its
patterns have been tested against real pull requests.

### Branch naming

Use `agent/<task>-<YYYYMMDD>` for agent-driven branches, with a short lowercase
hyphenated task slug. Branch protection does not validate this convention by
itself. Enforce it through review practice or a later validation workflow if it
becomes important enough to justify that maintenance.

## Pull-request checks

Add a workflow under `.github/workflows/` for pull requests. Because this is a
multi-project repository, the workflow should either:

- run independent jobs for each project with changed files; or
- run a documented repository-wide verification command.

Each job should identify its working directory and record the command it runs.
A reasonable job may include:

- dependency installation using the project's lockfile;
- linting;
- typechecking;
- frontend build or backend test execution;
- focused tests for the changed project.

Use path filters only after confirming that they cannot skip shared files such
as `Agent Skills/` guidance or common configuration. A pull request that edits
workflow files should still run the workflow checks.

Before marking a check as required in branch protection:

1. Open a pull request containing a harmless test change.
2. Confirm the workflow starts and reports the expected check names.
3. Confirm a failing command blocks merging.
4. Confirm a passing rerun allows merging.

## CODEOWNERS

Create `.github/CODEOWNERS` only after identifying GitHub usernames or teams and
agreeing on ownership. The file is a routing and review requirement; it does
not replace technical review or explain why a boundary exists.

Example structure, with placeholders that must be replaced:

```text
# Default review owner
* @OWNER_OR_TEAM

# Agent workflow and repository guidance
/Agent Skills/ @OWNER_OR_TEAM

# Project-specific ownership should use real paths and real owners
# /VThere Spatial Experience Builder/packages/ @VTHERE_TEAM
# /ChargedUp Cross-Site Energy & Sustainability Simulator/backend/ @ENERGY_TEAM
```

Paths containing spaces should be tested in a real pull request. Keep the
patterns narrow enough that a project owner is not requested for unrelated
projects. Do not copy package paths from another repository or from an
architecture plan unless those paths exist here.

## Actions permissions and secrets

In **Settings > Actions > General**:

- Allow only the actions and reusable workflows the team trusts.
- Prefer read-only repository permissions for workflows, granting write access
  only to the job that needs it.
- Never commit API keys, passwords, tokens, or production configuration.
- Store required credentials as GitHub Actions secrets or environments with
  appropriate reviewers.
- Keep pull-request workflows from untrusted forks away from write-capable
  secrets.

If a workflow needs cloud or deployment access, use the narrowest environment
and permission scope available and document who can approve it.

## Repository access and merge policy

Review **Settings > Collaborators and teams**:

- Give contributors the minimum repository role needed for their work.
- Use teams rather than individual accounts for long-lived ownership where
  practical.
- Decide whether squash, merge, or rebase is the preferred merge method.
- Require a meaningful pull-request title and description for shared work.
- Keep direct pushes to the protected integration branch disabled once the team
  is ready to work through pull requests.

These settings affect collaboration and cannot be reproduced by committing a
Markdown file.

## Local files versus GitHub settings

| Change | Where it happens | Effect on Git |
| --- | --- | --- |
| Branch protection or ruleset | GitHub repository settings | No local file change |
| Required status checks | GitHub settings after CI exists | No local file change |
| CI workflow | `.github/workflows/*.yml` | Normal tracked commit and pull request |
| CODEOWNERS | `.github/CODEOWNERS` | Normal tracked commit and pull request |
| Runtime standard | `.nvmrc`, `devcontainer.json`, or project equivalent | Normal tracked commit and pull request |
| Commit and branch conventions | Team practice and documentation | No automatic enforcement |

GitHub settings are stored by GitHub, not in this working tree. Local workflow
files and CODEOWNERS are ordinary repository files and should be reviewed,
committed, and changed through pull requests once branch protection is active.

## Completion checklist

The setup is complete when:

- the integration branch is identified and protected;
- pull-request CI runs the correct commands for each affected project;
- required checks have been tested with both passing and failing changes;
- CODEOWNERS contains real owners and only real repository paths;
- Actions permissions and secrets follow least privilege;
- the chosen merge policy is documented;
- `Agent Skills/GIT_AND_HANDOFF_CONVENTIONS.md` still describes the actual
  controls rather than planned controls.

Record the final settings, workflow names, owners, and verification results in
an appropriate project `SESSION.md` or repository handoff document.
