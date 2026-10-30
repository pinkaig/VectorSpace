/**
 * @file        parseTodo.ts
 * @project     VectorSpace
 * @author      <your name>
 * @brief       Reads a teacher's to-do ("Place 5 exhibits") and works out what to count.
 *
 *              HOW IT READS A SENTENCE (no AI, just word lists, so it is predictable):
 *                1. Lower-case it, drop punctuation, split into words, make each word singular
 *                   ("Exhibits!" -> "exhibit").
 *                2. Find the THING words using THING_WORDS ("exhibit", "fact card", "room"...).
 *                3. Find the NUMBER nearest before that thing ("5", "five", "a", "second", "2nd").
 *                   No number means 1.
 *                4. "each" / "every" before "exhibit" means "one on every exhibit".
 *                5. "this" / "that" / "the" just before a singular thing points at ONE
 *                   particular object ("Do not put this item"), which cannot be counted, so
 *                   it is left to the teacher instead of becoming "no items at all".
 *                6. A LIMIT turns "at least" into "at most":
 *                     "Don't add any sounds"       -> at most 0 sounds
 *                     "No more than 5 exhibits"    -> at most 5 exhibits
 *                     "Add up to 5 exhibits"       -> at most 5 exhibits
 *                     "Less than 5 exhibits"       -> at most 4 exhibits
 *                     "No fewer than 5 exhibits"   -> at least 5 exhibits
 *              The VERB IS IGNORED on purpose: "place", "add", "put", "make", "build" all mean
 *              the same here, so "Place 5 exhibits" and "Add 5 exhibits" give the same goal and
 *              the teacher's own wording can stay as it is.
 *
 *              To teach it a new word, add it to THING_WORDS or NUMBER_WORDS. Nothing else.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { PER_EXHIBIT_KINDS, type GoalKind, type MissionGoal } from './missionBrief'

// Words (singular, lower case) that name each kind of thing. Two-word names go first in a
// list so "fact card" wins over "card". A word must only appear under one kind.
export const THING_WORDS: { kind: GoalKind; words: string[] }[] = [
  {
    kind: 'factCards',
    words: ['fact card', 'info card', 'text card', 'fact panel', 'info panel', 'text panel', 'fact sheet',
      'card', 'fact', 'label', 'caption', 'description', 'plaque', 'blurb'],
  },
  {
    kind: 'sounds',
    words: ['sound effect', 'voice over', 'background music', 'sound', 'audio', 'music', 'narration',
      'voiceover', 'recording', 'soundtrack', 'song', 'sfx'],
  },
  { kind: 'reactions', words: ['reaction', 'interaction', 'trigger', 'response'] },
  { kind: 'rooms', words: ['room', 'scene', 'gallery', 'hall', 'chamber'] },
  { kind: 'zones', words: ['zone', 'area', 'marker', 'region', 'spot'] },
  { kind: 'exhibits', words: ['exhibit', 'artefact', 'artifact', 'display', 'specimen', 'showpiece'] },
  { kind: 'things', words: ['object', 'thing', 'item', 'prop', 'piece'] },
]

// How many a word means. Digits ("5") and digit ordinals ("2nd") are read separately.
const NUMBER_WORDS: Record<string, number> = {
  // counting words
  a: 1, an: 1, single: 1,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  // order words: "add a second room" means two rooms in total
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  // loose amounts: the smallest sensible count
  pair: 2, couple: 3, few: 3, several: 4, dozen: 12,
}

// a sentence with one of these sets a limit: "don't add sounds", "no more than 5 exhibits"
const NEGATIVE_WORDS = new Set(['not', 'dont', 'no', 'never', 'without', 'avoid', 'zero', 'none',
  'shouldnt', 'cant', 'cannot', 'mustnt', 'doesnt', 'wont', 'nothing'])
const EACH_WORDS = new Set(['each', 'every', 'all'])
// words that point at one particular object: "this item", "that red exhibit", "my sound"
const PARTICULAR_WORDS = new Set(['this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'their', 'its',
  'particular', 'specific'])
// how far before the thing such a word may sit: "this item" (1), "this red item" (2)
const PARTICULAR_REACH = 2
// words ending in s that are not plurals, so singular() leaves them alone ("this" is not "thi")
const NOT_PLURAL = new Set(['this', 'his', 'its', 'is', 'was', 'has', 'does', 'us', 'yes', 'plus', 'always',
  'perhaps', 'across', 'thus', 'bus', 'gas', 'canvas', 'atlas', 'focus', 'bonus', 'status', 'campus', 'cactus'])
// the most a to-do can ask for; anything bigger is almost certainly a typo
const MAX_TARGET = 99

// "Exhibits," -> "exhibit", "artefacts" -> "artefact", "galleries" -> "gallery"
function singular(word: string): string {
  if (NOT_PLURAL.has(word)) return word
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y'
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1)
  return word
}

// the words as written, lower case, punctuation gone (not yet singular)
function rawWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')        // "don't" -> "dont"
    .replace(/[^a-z0-9\s-]/g, ' ')    // other punctuation becomes a space
    .split(/[\s-]+/)
    .filter(Boolean)
}

// "5" -> 5, "five" -> 5, "2nd" -> 2, anything else -> null
function numberOf(word: string): number | null {
  const digits = /^(\d+)(st|nd|rd|th)?$/.exec(word)
  if (digits) return Number(digits[1])
  return word in NUMBER_WORDS ? NUMBER_WORDS[word] : null
}

// where in the sentence each thing word was found, in sentence order
type Found = { kind: GoalKind; at: number; length: number }

function findThings(words: string[]): Found[] {
  const found: Found[] = []
  for (let at = 0; at < words.length; at++) {
    match: for (const { kind, words: names } of THING_WORDS) {
      for (const name of names) {
        const parts = name.split(' ')
        if (parts.every((part, i) => words[at + i] === part)) {
          found.push({ kind, at, length: parts.length })
          at += parts.length - 1
          break match
        }
      }
    }
  }
  return found
}

// the number closest before position `before`, but not past `stopAt`
function numberBefore(words: string[], before: number, stopAt: number): number | null {
  for (let i = before - 1; i >= stopAt; i--) {
    const value = numberOf(words[i])
    if (value !== null) return value
  }
  return null
}

// "this item", "that red exhibit", "the item": one particular object, not a count of them.
// "the" only counts when the thing is written singular, so "Don't add the sounds" still
// means no sounds. A number in between ("this 3 exhibits"? "the 2 rooms") makes it a count.
function pointsAtParticular(words: string[], raw: string[], thing: Found): boolean {
  for (let i = thing.at - 1; i >= Math.max(0, thing.at - PARTICULAR_REACH); i--) {
    if (numberOf(words[i]) !== null || EACH_WORDS.has(words[i]) || NEGATIVE_WORDS.has(words[i])) return false
    if (PARTICULAR_WORDS.has(words[i])) return true
    if (words[i] === 'the' && raw[thing.at] === words[thing.at]) return true
  }
  return false
}

// "less than 5", "fewer than 5": below a number, so one fewer is the most allowed
function hasBelowWords(words: string[]): boolean {
  return words.some((word, i) => (word === 'less' || word === 'fewer') && words[i + 1] === 'than')
}

// "at most 5", "up to 5", "max 5", "maximum of 5": a limit with no negative word
function hasLimitWords(words: string[]): boolean {
  return words.some((word, i) =>
    (word === 'most' && words[i - 1] === 'at') ||
    (word === 'up' && words[i + 1] === 'to') ||
    word === 'max' || word === 'maximum')
}

/**
 * The goal a to-do asks for, or null when it cannot be counted automatically
 * (then the teacher ticks it when reviewing).
 *   parseTodo('Place 5 exhibits')              -> 5 or more exhibits
 *   parseTodo('Add five exhibits to the room') -> 5 or more exhibits
 *   parseTodo('Give each exhibit a fact card') -> a fact card on every exhibit
 *   parseTodo('Add a second room')             -> 2 or more rooms
 *   parseTodo("Don't add any sounds")          -> 0 sounds at most
 *   parseTodo('No more than 5 exhibits')       -> 5 exhibits at most
 *   parseTodo('Less than 5 exhibits')          -> 4 exhibits at most
 *   parseTodo('Do not put this item')          -> null (one particular item: the teacher ticks it)
 *   parseTodo('Make it look nice')             -> null
 */
export function parseTodo(text: string): MissionGoal | null {
  const raw = rawWords(text)
  const words = raw.map(singular)
  const things = findThings(words)
  if (things.length === 0) return null
  // "Do not put this item", "Move that exhibit": about one object, so nothing to count
  if (pointsAtParticular(words, raw, things[0])) return null

  // ── a limit: "don't add any sounds", "no more than 5 exhibits" ──
  const negativeAt = words.findIndex((word) => NEGATIVE_WORDS.has(word))
  if (negativeAt !== -1) {
    // "Place 3 exhibits without sounds" is two instructions in one; leave it to the teacher
    if (things.some((thing) => thing.at < negativeAt)) return null
    // "Don't give each exhibit a sound" is too tangled to count
    if (things.some((thing) => EACH_WORDS.has(words[thing.at - 1]))) return null
    const goal = things[0]
    // "no less than 5" / "no fewer than 5" is a floor: at least 5
    if (hasBelowWords(words.slice(negativeAt, goal.at))) {
      const floor = numberBefore(words, goal.at, negativeAt)
      if (floor === null || floor < 1 || floor > MAX_TARGET) return null
      return { kind: goal.kind, target: floor, compare: 'atLeast' }
    }
    // "no MORE THAN 5" keeps its number; otherwise "don't add a/any sound" means none at all
    const moreThan = words.slice(negativeAt, goal.at).some((word) => word === 'more' || word === 'than')
    const target = moreThan ? numberBefore(words, goal.at, negativeAt) : 0
    if (target === null || target > MAX_TARGET) return null
    return { kind: goal.kind, target, compare: 'atMost' }
  }

  // ── "each exhibit" / "every object": counted ON every exhibit ──
  // Only "each exhibit" can be counted; "each room has 2 exhibits" is left to the teacher.
  const perExhibit = things.find((thing) => EACH_WORDS.has(words[thing.at - 1]))
  if (perExhibit) {
    if (perExhibit.kind !== 'exhibits' && perExhibit.kind !== 'things') return null
    const goal = things.find((thing) => thing !== perExhibit)
    if (!goal || !PER_EXHIBIT_KINDS.includes(goal.kind)) return null
    return { kind: goal.kind, target: 'eachExhibit', compare: 'atLeast' }
  }

  // ── otherwise: the first thing named, and the number just before it ──
  const goal = things[0]
  const target = numberBefore(words, goal.at, 0) ?? 1
  // "less than 5 exhibits": at most 4
  if (hasBelowWords(words.slice(0, goal.at))) {
    if (target < 1 || target > MAX_TARGET) return null
    return { kind: goal.kind, target: target - 1, compare: 'atMost' }
  }
  if (target < 1 || target > MAX_TARGET) return null
  return { kind: goal.kind, target, compare: hasLimitWords(words) ? 'atMost' : 'atLeast' }
}

// how each kind reads in a sentence: [one, many, what was done to it]
const KIND_TEXT: Record<GoalKind, [string, string, string]> = {
  exhibits: ['exhibit', 'exhibits', 'placed'],
  things: ['thing', 'things', 'placed'],
  factCards: ['fact card', 'fact cards', 'written'],
  sounds: ['sound', 'sounds', 'added'],
  reactions: ['reaction', 'reactions', ''],
  rooms: ['room', 'rooms', ''],
  zones: ['zone', 'zones', ''],
}

/**
 * Short words for what the app will count, shown in the chip beside the to-do so the teacher
 * can see it understood them: "5 exhibits placed", "a fact card on every exhibit", "no sounds", "at most 5 exhibits".
 */
export function describeGoal(goal: MissionGoal): string {
  const [one, many, done] = KIND_TEXT[goal.kind]
  if (goal.target === 'eachExhibit') return `${/^[aeiou]/.test(one) ? 'an' : 'a'} ${one} on every exhibit`
  if (goal.compare === 'atMost') return goal.target === 0 ? `no ${many}` : `at most ${goal.target} ${goal.target === 1 ? one : many}`
  return [goal.target, goal.target === 1 ? one : many, done].filter(Boolean).join(' ')
}


// ── CLASHES: to-dos in one brief that cannot both be ticked ─────────────────
// e.g. "Place 3 exhibits" with "Don't put any items" (a limit of 0 objects, and every
// exhibit is an object). Only a LIMIT ('atMost') can clash: it clashes with any goal that
// needs more of what it limits. Two "at least" goals never clash ("Place 3 exhibits" and
// "Place 5 exhibits" are both met by 5), and neither do two limits (0 meets both).
// A clash is only a WARNING for the teacher: template setup shows a red "Clashes with ..."
// chip on both to-dos. Nothing changes for students; both still tick themselves, since not
// every to-do has to be done.

// a limit on the key also limits these: every exhibit is a placed thing (object)
const LIMIT_ALSO_COVERS: Partial<Record<GoalKind, GoalKind[]>> = { things: ['exhibits'] }

const limitCovers = (limited: GoalKind, kind: GoalKind): boolean =>
  limited === kind || (LIMIT_ALSO_COVERS[limited] ?? []).includes(kind)

// the fewest of each kind a goal needs before it can tick
function needs(goal: MissionGoal): [GoalKind, number][] {
  if (goal.compare === 'atMost') return []
  // "a fact card on every exhibit" never ticks on an empty room (see checkGoal), so it
  // needs at least one exhibit, and one of its own kind on it
  if (goal.target === 'eachExhibit') return [[goal.kind, 1], ['exhibits', 1]]
  return [[goal.kind, goal.target]]
}

/**
 * For each to-do (by position) that clashes, the positions of the to-dos it clashes with.
 * A null goal (one the teacher ticks) never clashes. To-dos that clash with nothing are absent.
 */
export function findConflicts(goals: (MissionGoal | null)[]): Map<number, number[]> {
  const clashes = new Map<number, number[]>()
  const note = (a: number, b: number) => {
    const list = clashes.get(a) ?? []
    if (!list.includes(b)) clashes.set(a, [...list, b])
  }
  goals.forEach((limit, i) => {
    if (!limit || limit.compare !== 'atMost' || typeof limit.target !== 'number') return
    const most = limit.target
    goals.forEach((goal, j) => {
      if (!goal || i === j) return
      if (needs(goal).some(([kind, fewest]) => limitCovers(limit.kind, kind) && fewest > most)) {
        note(i, j)
        note(j, i)
      }
    })
  })
  return clashes
}
