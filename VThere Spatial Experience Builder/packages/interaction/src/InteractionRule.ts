/**
 * @file        InteractionRule.ts
 * @brief       The authored WHEN→DO rule, re-exported from the project model.
 *
 * @responsibility
 * A rule is persisted data, so its canonical definition lives in
 * @vthere/project alongside ProjectData. This module re-exports it under the
 * interaction package's own entry point so runtime consumers import rules from
 * the subsystem that runs them, without a second, drift-prone declaration.
 *
 * @ownership
 * Owns nothing; @vthere/project owns the shape. Field names there mirror the
 * backend's interaction_rules columns (object_id, zone_id, triggers, actions,
 * priority) so a rule round-trips through ProjectData, the sync queue, and
 * /projects/{id}/rules without translation.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/When-Do-Dispatch-Engine
 * Links point at the project wiki; migration is still in progress.
 */
export type { InteractionRule } from '@vthere/project'
