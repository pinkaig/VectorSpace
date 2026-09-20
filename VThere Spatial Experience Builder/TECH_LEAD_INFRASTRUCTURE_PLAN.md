# Tech Lead Infrastructure Plan
**VThere Spatial Experience Builder — Phase Baseline Completion**

**Date:** 2026-09-17  
**Scope:** Stabilize Phase 1–2 baseline so M1 can be built on solid infrastructure, not future rework.  
**Responsibility:** Tech Lead  
**Target:** Complete before team expands Phase 3 work.

**Baseline phase:** All 8 stages complete. See [8-stage baseline overview](docs/code/baseline-phases.md).

---

## Executive Summary

The team is building M1 milestone (foundation + one vertical slice). You are returning to tech lead the baseline infrastructure that M1 depends on.

**Current state:**
- Phase 0 ✓ (repo, build, health endpoint)
- Phase 1 ✓ (serialization, validation, persistence adapter)
- Phase 2 ~70% (viewport, selection, gizmos done; **command path incomplete**)
- Phase 3–6 blocked until Phase 2 is stable

**Critical blocker:** Phase 2's command-path slice (move/rotate/scale) is not yet routed through a shared service. The current code mutates project state directly in React event handlers. This creates **three risks:**
1. **Undo/redo duplication:** each mutation handler copies history logic.
2. **Parity drift:** editor and runtime have no guarantee of seeing the same transforms.
3. **Persistence coupling:** save/load lives in handlers, not in the command service.

**What needs to happen this week:**
1. Install `.claude/` config (1 × 10 min) so skeleton/agent tools work.
2. Build Phase 2's command-path slice (move/rotate/scale) — ~3 hours concentrated work.
3. Verify CI/CD automation and branch protection rules.
4. Set up `.claude/CLAUDE.md` at repo root so your skeleton/subagent contracts persist.

**Why now:** Once the command path is stable and testable, the team can confidently:
- Build Phase 3 (interactions) on top of known, stable transform semantics.
- Add more commands (delete, duplicate, hierarchy) without revisiting the foundation.
- Route all edits through the same verified pipeline.

---

## Phase Breakdown & Current Status

### Phase 0 — Baseline skeleton ✓

**Completed:** repo structure, monorepo layout, FastAPI health endpoint, TypeScript package imports, `npm ci` + `npm run build` working, Playwright smoke test configured.

**CI status:** `.github/workflows/ci.yml` runs on `Working` branch, checks `npm ci`, typecheck, test, build, and smoke test. Passes locally.

---

### Phase 1 — Shared project foundation ✓

**Completed:**
- Versioned schema in `packages/project/src/index.ts`
- Serialization/deserialization in `packages/serialization/`
- Strict validation in `packages/validation/` (IDs, references, transforms, sizes)
- Draft/backup persistence adapter (browser localStorage)
- Fixture tests for round-trip, corruption recovery

**Status:** All Phase 1 acceptance criteria met. Schema is stable and tested.

---

### Phase 2 — Editor foundation ⚠️ **INCOMPLETE**

**Completed:**
- React/Vite editor shell
- Three.js viewport with resource cleanup
- Selection system (raycasting, scene tree)
- Gizmos (move, rotate, scale visual handles)
- Asset browser with search
- Inspector for editing properties
- Save/load UI
- Undo/redo timeline

**MISSING — The Command-Path Slice:**

Current problem:
```text
Viewport drag → gizmo mutation callback → direct project state update → React rerender
                                          ↓
                                    autosave on mutate
```

What it should be:
```text
Viewport drag → gizmo → transform service → Command.execute() → new project snapshot
                                            ↓
                                      undo/redo history
                                      ↓
                                      autosave on commit
```

**Why this matters:**
- **Undo correctness:** right now, each handle tracks its own undo logic. One command-path service owns history.
- **Testability:** the engine is currently embedded in React. A framework-free service is independently testable.
- **Parity safety:** when Phase 4 builds the runtime, both editor and runtime read from the same project snapshot. Commands ensure transforms stay identical.

**Work required (Phase 2 completion):**
1. Define `TransformCommand` interface: `execute(project) → new project`, `undo(project) → original`.
2. Implement move, rotate, scale as stateless functions returning new `SceneObject`.
3. Wrap transform sessions to emit one command per drag release, not per pointer event.
4. Add unit tests (framework-free) for transform precision, undo behavior, history branching.
5. Verify existing Playwright smoke test still passes.

**Acceptance:** `npm run test -- packages/authoring-engine` passes; gizmo drags create one undo entry; invalid transforms are rejected.

---

### Phase 3 — Experience system (NOT STARTED)

Depends on: Phase 2 command path.

This is where the team adds interactions (click rules, zone-entry triggers, show-panel actions). Cannot start safely until transforms are routed through a command service.

---

### Phases 4–6 — Runtime, API, verification (NOT STARTED)

Blocked on Phase 3. Each phase's acceptance depends on the previous working.

---

## Today's Work: Three Concrete Steps

### 1. Install `.claude/` config (10 min)

**Why:** Your `Agent Skills/` folder contains custom agents and commands. Claude Code expects them in `.claude/` at the project root. This step makes `/skeleton`, `/learn`, `/next`, `/handoff` slash commands work, and loads your CLAUDE.md contract.

**Action:**
```powershell
# From project root:
mkdir .claude
mkdir .claude/agents
mkdir .claude/commands
mkdir .claude/skills

# Copy your agents
copy "Agent Skills\agents\*" ".\.claude\agents\"
copy "Agent Skills\commands\*" ".\.claude\commands\"
copy "Agent Skills\ponytail-skill\*" ".\.claude\skills\ponytail\"

# Move your CLAUDE.md to project root (it's the contract for all sessions)
copy "Agent Skills\CLAUDE.md" ".\CLAUDE.md"
```

**Verify:** `/skeleton test` should respond without "command not found."

---

### 2. Skeleton the command-path slice (30 min)

**What:** Propose (do not implement) the module boundaries and command flow for move/rotate/scale.

**Run:**
```powershell
/skeleton move-rotate-scale-command-path
```

This spawns your `architect` subagent (now loaded from `.claude/`). It will:
- Read current viewport gizmo code
- Propose a `TransformCommand` interface
- Show the data flow from drag → command → history
- List unit test contracts
- Name the acceptance check

**You review, correct, approve.** This is free to change; code changes are not.

---

### 3. Implement the slice (2–3 hours)

**Once skeleton is approved:**

**Acceptance checklist:**
- [ ] `packages/authoring-engine/src/commands/TransformCommand.ts` exists with move/rotate/scale
- [ ] Unit tests pass: `npm run test -- packages/authoring-engine`
- [ ] One drag creates exactly one undo entry
- [ ] Invalid transforms are rejected
- [ ] Playwright smoke test passes: `npm run test:e2e`
- [ ] CI passes on `sherman-branch`

**How to verify:**
```powershell
cd "VThere Spatial Experience Builder"
npm.cmd run test -- packages/authoring-engine
npm.cmd run test:e2e
```

---

## Phase 2 Completion Checklist

- [ ] `.claude/` installed and `/skeleton` working
- [ ] Command-path skeleton reviewed and approved
- [ ] `packages/authoring-engine/` implements move/rotate/scale commands
- [ ] Unit tests for transform precision, undo, history branching
- [ ] Playwright smoke test passes
- [ ] CI passes on `sherman-branch`
- [ ] SESSION.md updated: "Phase 2 complete; ready for Phase 3"

---

## Why This Unblocks M1

**Right now:**
- The team cannot confidently add transforms to Phase 3 (interactions) because the foundation is scattered.
- Delete and duplicate operations have the same problem as transforms.

**After Phase 2:**
- Every edit routes through a testable service.
- History is verifiable and reversible.
- New features (hierarchy, duplication, deletion) build on the same proven path.
- The team can implement Phase 3 knowing the transforms underneath are stable.

---

## What You're NOT Doing

- Refactoring `Viewport.tsx` for line count.
- Adding full ECS architecture.
- Building hierarchy or grouping.
- Implementing runtime or API.
- Moving files into `apps/editor/` yet.

Those are future work. Phase 2 is narrow: **one input → one command → one snapshot → one history entry.**

---

## Open Questions for the Team

After Phase 2 completes:

1. **Should delete and duplicate follow the same pattern?** Yes (Phase 2 extended).
2. **When do lifecycle fields (`visible`, `enabled`, `parentId`) get added?** After delete/duplicate are proven stable.
3. **When does the hierarchy query layer get built?** When Phase 3 needs it for zone/interaction targeting.
4. **When does the full `apps/editor/` migration happen?** After Phase 3 proves parity; don't move before.

---

## Next Steps (After Phase 2)

1. **Push to `sherman-branch`** and open PR to `Working`.
2. **Confirm CI passes** in GitHub Actions.
3. **Review and merge** once smoke test passes.
4. **Update SESSION.md:** "Phase 2 complete."
5. **Start Phase 3:** Interaction types and dispatch engine.

---

## Reference: How to Use the Agent Tools

Once `.claude/` is installed:

| Command | Use | Example |
|---|---|---|
| `/skeleton <feature>` | Propose architecture before coding | `/skeleton phase-3-interaction-dispatch` |
| `/learn <topic>` | Understand a concept before building | `/learn entity-component-systems` |
| `/next` | Status check: what should I do? | `/next` |
| `/handoff` | Save session state to SESSION.md | `/handoff` (before switching contexts) |

All four are powered by your `architect`, `tutor`, and subagent team.

---

**Ready to begin?**

1. Run the `.claude/` install step.
2. Say "skeleton ready" and I'll spawn the architect.
3. You review the skeleton; we implement once approved.

Let me know what questions come up about the phases or the infrastructure plan.
