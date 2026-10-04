/**
 * @file        ruleEditorOperations.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Editor adapters that build When-Do rules from the author's choices and add them through the authoring engine
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import type { ActionSpec, InteractionRule } from '@vthere/project'
import { addObjectRule, removeRule, type RuleOperationResult } from '@vthere/authoring-engine'
import { playAudioAction } from '../../packages/audio/src/index'
import { cloneProject, type ProjectData } from '../model'
import { audioAssetCatalog } from '../audioAssets'
import { changeColorAction } from '../viewport/actions/changeColorActionBuilder'

// what the author picked in the "then" dropdown, together with the setting that action needs
export type ClickRuleChoice =
  | { action: 'changeColor'; color: number }
  | { action: 'playAudio'; assetId: string }
  | { action: 'showText'; message: string }

// every text asset the editor creates starts with this, so clean-up can tell them from hand-authored ones
const MESSAGE_ASSET_PREFIX = 'message-'

// the most characters a message can hold, far below the 64 KB the project file allows per text asset
export const MAX_MESSAGE_LENGTH = 1000

// turns the author's choice into a real action with the typed builders, so params always match their executors
const buildAction = (objectId: string, choice: ClickRuleChoice, textAssetId: string): ActionSpec => {
  if (choice.action === 'changeColor') return changeColorAction(objectId, choice.color)
  // showPanel opens a panel straight from a text asset's id, so the rule needs no attachment
  if (choice.action === 'showText') return { kind: 'showPanel', params: { assetId: textAssetId } }
  // play the sound on the channel its catalog entry suggests, the same way the audio demo's rules do
  const asset = audioAssetCatalog.find((item) => item.assetId === choice.assetId)
  return playAudioAction(choice.assetId, asset ? { channel: asset.defaultChannel } : {})
}

// builds a "when clicked, do the chosen action" rule for one object and adds it to a copy of the project
// a "show text" choice also saves its message as a new text asset in the same copy, so one undo removes both
export const addEditorClickRule = (project: ProjectData, sceneId: string, objectId: string, choice: ClickRuleChoice): RuleOperationResult => {
  // a random id so no two messages share one, because loading rejects duplicate text asset ids
  const textAssetId = `${MESSAGE_ASSET_PREFIX}${crypto.randomUUID()}`
  let base = project
  if (choice.action === 'showText') {
    base = cloneProject(project)
    base.textAssets = [...(base.textAssets ?? []), { assetId: textAssetId, name: 'Message', format: 'plain', lang: 'en', content: choice.message }]
  }
  return addObjectRule(base, {
    sceneId,
    objectId,
    rule: {
      // a random id so no two rules share one, because loading rejects duplicate ids
      id: crypto.randomUUID(),
      objectId,
      // 'click' is typed by hand for now, a shared vocabulary list will replace it later
      triggers: ['click'],
      actions: [buildAction(objectId, choice, textAssetId)],
    },
  })
}

// the text asset ids a rule's showPanel actions open
const shownTextAssetIds = (rule: InteractionRule): string[] =>
  rule.actions.flatMap((action) => (action.kind === 'showPanel' && typeof action.params?.assetId === 'string' ? [action.params.assetId] : []))

/**
 * Removes a rule and the message it showed, as one project copy so one undo restores both.
 *
 * CURRENT-DESIGN CLEAN-UP, re-check when text changes: this only holds while a message is
 * owned by the one rule that shows it (the editor makes a fresh asset per rule). It deletes
 * only editor-made assets ('message-' ids) that no other rule opens. If messages become
 * reusable, are picked from a library, gain attachments, variants or other display modes,
 * or anything else starts to reference them, this must be reviewed or it may delete content
 * still in use (or leave orphans behind).
 */
export const removeEditorRule = (project: ProjectData, ruleId: string): RuleOperationResult => {
  const removed = (project.rules ?? []).find((rule) => rule.id === ruleId)
  const result = removeRule(project, { ruleId })
  if (!removed) return result
  const stillShown = new Set((result.project.rules ?? []).flatMap(shownTextAssetIds))
  const orphans = new Set(shownTextAssetIds(removed).filter((id) => id.startsWith(MESSAGE_ASSET_PREFIX) && !stillShown.has(id)))
  if (orphans.size > 0) result.project.textAssets = (result.project.textAssets ?? []).filter((asset) => !orphans.has(asset.assetId))
  return result
}
