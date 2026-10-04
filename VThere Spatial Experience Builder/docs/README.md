# VThere Documentation

Reference documentation lives on the project wiki, not in this repository:

**https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki**

Architecture, subsystem contracts, engineering practices, the build and release
pipeline, and the M1 deliverables are all there. Source files link to it from
their `@documentation` headers.

## Why the wiki and not this folder

Dense written analysis sitting in the repository reads as unwanted evidence of
AI use. Documentation that has been reviewed goes to the wiki; the repository
keeps code, tests, and the scripts needed to build and run the project.

## What is still in the repository

| Path | What it is |
|---|---|
| `AI-DECLARATION.md` (app root) | Required AI-use declaration. Kept beside the code it describes. |
| `CODEBASE_GUIDE.md` (app root) | Orientation for reading the source. |
| `docs/engineering-setup-plan.md` (repo root `docs/`) | Repository layout and the one-command scripts. |

## Previously here

`docs/code/**` was migrated to the wiki and removed. `docs/archive/**` held
historical planning material and was removed as well. Both remain in git
history if a specific file is ever needed again:

```bash
git log --diff-filter=D --name-only -- "VThere Spatial Experience Builder/docs/"
git show <commit>^:"<path>" > recovered.md
```
