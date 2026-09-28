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
import type { ActionSpec } from '@vthere/project'
import { addObjectRule, type RuleOperationResult } from '@vthere/authoring-engine'
import { playAudioAction } from '../../packages/audio/src/index'
import type { ProjectData } from '../model'
import { audioAssetCatalog } from '../audioAssets'
import { changeColorAction } from '../viewport/actions/changeColorActionBuilder'

// what the author picked in the "then" dropdown, together with the setting that action needs
export type ClickRuleChoice =
  | { action: 'changeColor'; color: number }
  | { action: 'playAudio'; assetId: string }

// turns the author's choice into a real action with the typed builders, so params always match their executors
const buildAction = (objectId: string, choice: ClickRuleChoice): ActionSpec => {
  if (choice.action === 'changeColor') return changeColorAction(objectId, choice.color)
  // play the sound on the channel its catalog entry suggests, the same way the audio demo's rules do
  const asset = audioAssetCatalog.find((item) => item.assetId === choice.assetId)
  return playAudioAction(choice.assetId, asset ? { channel: asset.defaultChannel } : {})
}

// builds a "when clicked, do the chosen action" rule for one object and adds it to a copy of the project
export const addEditorClickRule = (project: ProjectData, sceneId: string, objectId: string, choice: ClickRuleChoice): RuleOperationResult =>
  addObjectRule(project, {
    sceneId,
    objectId,
    rule: {
      // a random id so no two rules share one, because loading rejects duplicate ids
      id: crypto.randomUUID(),
      objectId,
      // 'click' is typed by hand for now, a shared vocabulary list will replace it later
      triggers: ['click'],
      actions: [buildAction(objectId, choice)],
    },
  })