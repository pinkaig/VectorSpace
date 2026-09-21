# Baseline Implementation: 8 Stages

Canonical stage breakdown for the full-stack baseline, as planned in [`archive/research-and-history/2026-09-17--PLAN--infrastructure-skeleton-extended.md`](../archive/research-and-history/2026-09-17--PLAN--infrastructure-skeleton-extended.md) and completed per commit history. Stage 4 splits into three parallel sub-tracks (4a/4b/4c); all 8 stages are complete.

| Stage | Name | What it built | Commit |
|---|---|---|---|
| 1 | Local dev environment | `docker-compose.yml`, `.env.example`, `config.py`, `db.py`, Alembic init | `0ad9c20` |
| 2 | Data model | SQLAlchemy models (Organisation, Actor, Project, ProjectVersion, MediaAsset, ContentSnapshot, AnalyticsEvent, InteractionRule) + migration | `5bdfc29` |
| 3 | Backend HTTP surface | Skeleton routers, real Auth0/JWT auth, real boto3 storage | `d0237ae` |
| 4a | Asset Manager | `packages/assets` — AssetRef, AssetDescriptor, resolvers, cache | `cc6f443` |
| 4b | WHEN→DO Engine | `packages/interaction` — RuntimeEvent/State, `dispatch()`, action executors | `8416364` |
| 4c | Sync Engine | `packages/sync` — SyncQueue, SyncClient, conflict detection | `c137100` |
| 5 | Production deploy | Dockerfiles, `docker-compose.prod.yml`, `deploy.yml`, `deploy/README.md` | `b216993` |
| 6 | Wire Asset Manager into frontend | `SceneObject.assetId` → resolver, viewport raycasting | `abde184` |
| 7 | Wire WHEN→DO into runtime | `ProjectData.rules`, gizmo/pointer → dispatcher → actions | `8416364` |
| 8 | Wire Sync into autosave | `serializer.ts` dual-write, reconnect retry | `8831960` |

Each doc in [`docs/code/`](.) that describes a piece of this baseline carries a one-line status note pointing back here.
