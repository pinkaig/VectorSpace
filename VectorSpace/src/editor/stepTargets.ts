/**
 * @file        stepTargets.ts
 * @author      Weian Ching
 * @brief       Which thing a click on the top bar's Add info or Make it react goes to.
 *
 * @responsibility
 * The things still missing what the step adds come first, one after another. Once
 * none are left, the step cycles through all of them, so a student can look each
 * one over. Pure, no React.
 */

/**
 * The thing to go to. `stay` is for arriving from another step: a current thing
 * that fits is kept, so a student isn't moved off it. Clicking the step again
 * moves on. Null when there are no things.
 */
export const nextStepThing = <T extends { id: string }>(
  things: readonly T[],
  isDone: (thing: T) => boolean,
  currentId: string | null,
  stay: boolean,
): T | null => {
  const todo = things.filter((thing) => !isDone(thing))
  const list = todo.length > 0 ? todo : things
  if (list.length === 0) return null
  const at = list.findIndex((thing) => thing.id === currentId)
  return stay && at >= 0 ? list[at] : list[(at + 1) % list.length]
}
