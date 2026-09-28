/**
 * @file        ruleEditorOperations.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Editor adapters that build When-Do rules and add them through the authoring engine
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { addObjectRule, type RuleOperationResult } from '@vthere/authoring-engine'
import type { ProjectData } from '../model'
import { changeColorAction } from '../viewport/actions/changeColorActionBuilder'

// builds a "when clicked, change colour" rule for one object and adds it to a copy of the project
export const addEditorClickColorRule = (project: ProjectData, sceneId: string, objectId: string, color: number): RuleOperationResult =>
  addObjectRule(project, {
    sceneId,
    objectId,
    rule: {
      // a random id so no two rules share one, because loading rejects duplicate ids
      id: crypto.randomUUID(),
      objectId,
      // 'click' is typed by hand for now, a shared vocabulary list will replace it later
      triggers: ['click'],
      // the builder makes sure params.objectId is the same object and the params match the executor
      actions: [changeColorAction(objectId, color)],
    },
  })