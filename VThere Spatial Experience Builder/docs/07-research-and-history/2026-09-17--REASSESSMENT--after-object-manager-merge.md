# Reassessment: Infrastructure Plan After Object Manager Merge

**Date:** 2026-09-17  
**Context:** Object manager (parentId, lifecycle, operations) merged from `weian_branch`. Reassessing
[2026-09-17--EXPLORATION--asset-manager-when-do-cloud-sync-guidelines.md](2026-09-17--EXPLORATION--asset-manager-when-do-cloud-sync-guidelines.md)
against actual current state.

## What changed

The 2026-09-17 ponytail review flagged two blockers before wiring Asset Manager / WHEN→DO into `SceneObject`:

1. **Phase 2 command-path slice completes** — still open ✗
2. **Entity-ID/render-map question resolves** — **now answered** ✓

Merged work:
- `SceneObject.parentId?: string` for hierarchy (optional, top-level if absent)
- `SceneObject.visible`, `enabled` for lifecycle
- `reparentObject`, subtree-aware `removeObject`/`duplicateObject` operations
- Validation: no missing parents, no cycles, no self-parenting
- 36 tests passing; undo/redo works automatically (CommandTimeline stores full snapshots)

## What this unblocks

With a **stable object-identity model**, these can now move from **Postpone → Approve**:

1. **Asset Manager resolver interface design** (paper) — can be concrete now, targeting real
   `SceneObject` ids.
2. **WHEN→DO event/action vocabulary design** (paper) — `objectId` and `zoneId` can reference real
   objects with known lifecycle.
3. **`MediaAsset` / `Component` schema** (paper) — `Component.assetId` pointing at stable objects
   is no longer a guess.
4. **`packages/components` type skeleton** — content types can reference `SceneObject` ids
   directly.

These still require **Phase 2 command path to merge** before becoming working code (not paper).

## Updated Approve/Postpone

### Approve (do this week if Phase 2 is still pending)

**Paper-only work (no buildable code):**
- Asset Manager resolver interface design, targeting real `SceneObject.id` and lifecycle
- WHEN→DO event/action vocabulary, with concrete trigger/action kinds and acceptance rules
- `MediaAsset` / `ContentSnapshot` / `InteractionRule` column shapes (referencing `SceneObject.id`)

**Infrastructure-only code (unchanged from original plan):**
- Stage 1: Docker Compose, `.env`, `config.py`, `db.py`, Alembic init (no project-schema dependency)

### Postpone (waiting on Phase 2)

**Type skeletons and implementation code:**
- `packages/components` / `packages/interaction` as buildable skeletons (they need Phase 2 + paper design first)
- Backend routers for `/projects/media`, `/publish` (need schema finalized)
- `MediaRepository`, `PublishingService`, `AccessControl` skeletons (need final column shapes)

**Until:**
- Phase 2 command-path slice merges and passes CI

## Recommended sequencing (right now)

**This week, in parallel:**

1. **Object-manager stability proof** — commit the current work to `Working`, run CI, merge. This
   is already done except for the PR/CI step.

2. **Asset Manager design** (paper, not code) — sketch the resolver interface, the three backing
   implementations (primitive/local-catalog/remote), the `resolve(ref) → descriptor` contract,
   and the loading/error/ready states. One page, one diagram. No code.

3. **WHEN→DO vocabulary design** (paper) — list the trigger kinds (click, sceneStart, zoneEnter,
   timer?), the action kinds (showPanel, playAudio, navigateScene?), and the acceptance rules.
   No code, just the vocabulary.

4. **Infrastructure Stage 1** (real code) — `docker-compose.yml`, Postgres, MinIO, auth0 setup,
   `.env.example`. Verify Compose starts and health-checks pass. This moves forward regardless
   of Phase 2.

**Next week, after Phase 2 merges:**

5. Finalize `MediaAsset`/`Component` schemas against the Asset Manager and WHEN→DO designs.
6. Scaffold `packages/components` + `packages/interaction` type skeletons.
7. Backend routers + repositories.

## Verdict

**The object manager arriving early is a net win.** It resolves one blocker outright and means
the Asset Manager and WHEN→DO designs can be concrete (paper) instead of speculative. Infrastructure
can keep moving. Wait only for Phase 2 before writing code that depends on a stable command path.

Don't try to wire attachments or WHEN→DO into production code yet — the paper designs are free,
code is not.
