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

// builds a "when clicked, change colour" rule for one object and adds it to a copy of the project
export const addEditorClickColorRule = (project: ProjectData, sceneId: string, objectId: string, color: number): RuleOperationResult =>
  addObjectRule(project, {
    sceneId,
    objectId,
    rule: {
      // a random id so no two rules share one, because loading rejects duplicate ids
      id: crypto.randomUUID(),
      objectId,
      // 'click' and 'changeColor' are typed by hand for now, a shared vocabulary list will replace them later
      triggers: ['click'],
      // params.objectId must be the same object, because the colour action recolours whichever object it names
      actions: [{ kind: 'changeColor', params: { objectId, color } }],
    },
  })