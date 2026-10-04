/**
 * @file        ruleOperations.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       Pure project operations for adding and removing When-Do rules
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
import { InteractionRule, ProjectData, cloneProject } from '@vthere/project'
import { ObjectOperationError, ObjectTargetInput, requireObject } from './objectAccess'

// what addObjectRule needs: which scene and object to target, plus the rule to add
export interface AddObjectRuleInput extends ObjectTargetInput {
    rule: InteractionRule
}

// what addObjectRule gives back: the updated project and the id of the rule it added
export interface RuleOperationResult {
    project: ProjectData
    ruleId: string
}

export const addObjectRule = (project: ProjectData, input: AddObjectRuleInput): RuleOperationResult => {
    // work on a copy so the original project stays untouched for undo
    const next = cloneProject(project)
    const { object } = requireObject(next, input)

    // stop if the rule belongs to a different object, because loading would reject it later
    if (input.rule.objectId !== object.id) {
        throw new ObjectOperationError(`Rule "${input.rule.id}" targets "${input.rule.objectId}", not "${object.id}"`)
    }

    // if project has no rules list yet, create one
    const rules = (next.rules ??= [])
    
    if (rules.some((item) => item.id === input.rule.id)) {
        throw new ObjectOperationError(`Rule "${input.rule.id}" already exists in project`)
    }

    // add the new rule to the project
    rules.push(input.rule)
    return { project: next, ruleId: input.rule.id }
}

// what removeRule needs: only the rule's id, because rules live at the project level, not inside a scene
export interface RemoveRuleInput {
  ruleId: string
}

export const removeRule = (project: ProjectData, input: RemoveRuleInput): RuleOperationResult => {
  // work on a copy so the original project stays untouched for undo
  const next = cloneProject(project)
  const rules = next.rules ?? []
  const index = rules.findIndex((rule) => rule.id === input.ruleId)
  // stop if the rule doesn't exist, so a stale button can't silently do nothing
  if (index === -1) {
    throw new ObjectOperationError(`Rule "${input.ruleId}" was not found`)
  }
  // remove just that one rule from the copy
  rules.splice(index, 1)
  return { project: next, ruleId: input.ruleId }
}