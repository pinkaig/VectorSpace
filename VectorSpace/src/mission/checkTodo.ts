/**
 * @file        checkTodo.ts
 * @project     VectorSpace
 * @author      <your name>
 * @brief       Counts how far a project is towards a mission goal, so a to-do can tick itself
 *              in the student editor and show "4/3" on the teacher's review page.
 *              An 'atLeast' goal is done at the target or above; an 'atMost' goal (a limit,
 *              e.g. "no sounds") is done at the target or below, so it starts out ticked.
 *              Only reads the project; never changes it.
 *
 *              WHAT IS COUNTED (whole project, every room):
 *                exhibits   objects that isExhibit() says are exhibits
 *                things     every object
 *                factCards  text attachments on objects and zones
 *                sounds     audio attachments on objects and zones, plus reactions that play
 *                           a sound (playAudio), so "Don't add any sounds" covers both
 *                reactions  WHEN -> DO rules
 *                rooms      scenes
 *                zones      zones
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { ProjectData, SceneObject } from '../project/model'
import type { GoalKind, MissionGoal } from './missionBrief'

// Decides whether a placed object is an exhibit. A placed object does not record which
// catalogue category it came from, so every object counts as an exhibit.
export type IsExhibit = (object: SceneObject) => boolean
export const everyObjectIsAnExhibit: IsExhibit = () => true

export interface GoalProgress {
  done: number
  target: number
  compare: 'atLeast' | 'atMost'
  complete: boolean
}

// how many of `kind` hang off one object (or zone)
function countOn(host: { attachments?: { kind: string }[] }, kind: 'text' | 'audio'): number {
  return (host.attachments ?? []).filter((attachment) => attachment.kind === kind).length
}

export function checkGoal(goal: MissionGoal, project: ProjectData, isExhibit: IsExhibit = everyObjectIsAnExhibit): GoalProgress {
  const objects = project.scenes.flatMap((scene) => scene.objects)
  const zones = project.scenes.flatMap((scene) => scene.zones ?? [])
  const rules = project.rules ?? []
  const exhibits = objects.filter(isExhibit)

  // "every exhibit has one": done = exhibits that have one, out of all exhibits.
  // With no exhibits yet it is 0 out of 1, so it can never tick itself on an empty room.
  if (goal.target === 'eachExhibit') {
    const has: Partial<Record<GoalKind, (object: SceneObject) => boolean>> = {
      factCards: (object) => countOn(object, 'text') > 0,
      sounds: (object) => countOn(object, 'audio') > 0,
      reactions: (object) => rules.some((rule) => rule.objectId === object.id),
    }
    const hasOne = has[goal.kind] ?? (() => false)
    const done = exhibits.filter(hasOne).length
    const target = Math.max(1, exhibits.length)
    return { done, target, compare: 'atLeast', complete: done >= target }
  }

  const sum = (counts: number[]) => counts.reduce((total, count) => total + count, 0)
  const counts: Record<GoalKind, () => number> = {
    exhibits: () => exhibits.length,
    things: () => objects.length,
    factCards: () => sum([...objects, ...zones].map((host) => countOn(host, 'text'))),
    sounds: () => sum([...objects, ...zones].map((host) => countOn(host, 'audio')))
      + sum(rules.map((rule) => rule.actions.filter((action) => action.kind === 'playAudio').length)),
    reactions: () => rules.length,
    rooms: () => project.scenes.length,
    zones: () => zones.length,
  }
  const done = counts[goal.kind]()
  const complete = goal.compare === 'atMost' ? done <= goal.target : done >= goal.target
  return { done, target: goal.target, compare: goal.compare, complete }
}

// the small count beside a to-do: "2/5", or "too many: 2" for a limit that is broken.
// Empty when the tick says it all (a target of 1, or a limit that is kept).
export function progressLabel(progress: GoalProgress): string {
  if (progress.compare === 'atMost') return progress.complete ? '' : `too many: ${progress.done}`
  return progress.target > 1 ? `${progress.done}/${progress.target}` : ''
}
