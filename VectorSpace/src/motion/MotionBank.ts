/**
 * @file        MotionBank.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Named UI moments ("cues") mapped to swappable recipes, played through a MotionDriver.
 *
 * @responsibility
 * The seam between "something happened in the UI" and "what it looks like". Callers say
 * `motion.play('popup.enter', element)`; the bank finds the cue, finds its recipe, and hands
 * the driver the arguments after doing the sums (gain, stagger). Pointing a cue at a different
 * recipe is one string in a data file, never a code change. Same job as CueBank in
 * packages/audio, with "which file plays" replaced by "which recipe runs".
 *
 * Adds no animating ability of its own: the driver is the only code that touches the DOM.
 * It does not know what triggers a cue; that is whoever calls play() (see useMotion.ts).
 * Never throws for an unknown or placeholder cue: rules like this outlive the code that
 * names them, so an unknown id is a skip, not a crash (the same rule as the action registry).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { DriverOpts, MotionDef, MotionDriver, MotionHandle, MotionMap, MotionRecipe, PlayOpts } from "./types";

/** A table of 200 rows with a 20 ms stagger would take four seconds, so rows past this share the last delay. */
export const STAGGER_CAP = 12;

/** What a skipped or silent play() returns, so callers can always wait on `finished`. */
export const settledHandle = (): MotionHandle => ({ finished: Promise.resolve(true), cancel: () => {} });

export interface MotionBankOptions {
  /** Where "unknown cue" warnings go. Defaults to console.warn. */
  warn?: (message: string) => void;
}

export interface MotionPlayEvent {
  cueId: string;
  recipeId: string;
}

/** Problems a hand-edited map can have, in words a designer can act on. Empty means usable. */
export function validateMotionMap(map: MotionMap): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const cue of map.cues) {
    if (seen.has(cue.id)) problems.push(`Cue "${cue.id}" is listed twice`);
    seen.add(cue.id);
    if (!cue.placeholder && !Object.hasOwn(map.recipes, cue.recipe)) {
      problems.push(`Cue "${cue.id}" uses recipe "${cue.recipe}", which is not in the recipes list`);
    }
  }
  return problems;
}

export class MotionBank {
  private readonly cues = new Map<string, MotionDef>();
  private readonly recipes = new Map<string, MotionRecipe>();
  /** One live animation per element: a second play() on the same element replaces the first. */
  private readonly live = new WeakMap<Element, MotionHandle>();
  private readonly warned = new Set<string>();
  private readonly playListeners = new Set<(event: MotionPlayEvent) => void>();
  private readonly changeListeners = new Set<() => void>();
  private readonly warn: (message: string) => void;

  constructor(map: MotionMap, private readonly driver: MotionDriver, options: MotionBankOptions = {}) {
    this.warn = options.warn ?? ((message) => console.warn(message));
    // Copy so later edits through the bank never write back into the object the caller loaded.
    for (const [id, recipe] of Object.entries(map.recipes)) this.recipes.set(id, { ...recipe, keyframes: recipe.keyframes.map((frame) => ({ ...frame })) });
    for (const cue of map.cues) this.cues.set(cue.id, { ...cue });
  }

  play(cueId: string, el: Element, opts: PlayOpts = {}): MotionHandle {
    const cue = this.cues.get(cueId);
    if (!cue) return this.skip(`unknown:${cueId}`, `Motion cue "${cueId}" does not exist; nothing played.`);
    if (cue.placeholder) return settledHandle();
    const recipe = this.recipes.get(cue.recipe);
    if (!recipe) return this.skip(`recipe:${cueId}`, `Motion cue "${cueId}" uses recipe "${cue.recipe}", which does not exist; nothing played.`);

    this.live.get(el)?.cancel();

    const driverOpts: DriverOpts = {
      gain: (cue.gain ?? 1) * (opts.gain ?? 1),
      stagger: cue.stagger ?? 0,
      staggerIndex: Math.min(opts.staggerIndex ?? 0, STAGGER_CAP),
    };
    const handle = this.driver.play(el, recipe, driverOpts);
    this.live.set(el, handle);
    handle.finished.then(() => {
      if (this.live.get(el) === handle) this.live.delete(el);
    });
    for (const listener of [...this.playListeners]) listener({ cueId, recipeId: cue.recipe });
    return handle;
  }

  /** Points a cue at a different recipe at runtime. No rebuild, no reload: this is what the board calls. */
  retarget(cueId: string, recipeId: string): void {
    const cue = this.cues.get(cueId);
    if (!cue) return;
    cue.recipe = recipeId;
    cue.placeholder = false;
    this.warned.delete(`recipe:${cueId}`);
    this.changed();
  }

  updateCue(cueId: string, patch: Partial<Omit<MotionDef, "id">>): void {
    const cue = this.cues.get(cueId);
    if (!cue) return;
    Object.assign(cue, patch);
    this.changed();
  }

  /** Edits a recipe's fields, so every cue that uses it changes at once. */
  updateRecipe(recipeId: string, patch: Partial<MotionRecipe>): void {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return;
    Object.assign(recipe, patch);
    this.changed();
  }

  cueList(): MotionDef[] {
    return [...this.cues.values()];
  }

  getCue(cueId: string): MotionDef | undefined {
    return this.cues.get(cueId);
  }

  recipeList(): Array<{ id: string; recipe: MotionRecipe }> {
    return [...this.recipes.entries()].map(([id, recipe]) => ({ id, recipe }));
  }

  getRecipe(recipeId: string): MotionRecipe | undefined {
    return this.recipes.get(recipeId);
  }

  /** The current map, ready to paste back over recipes.ts and cues.ts. */
  toJSON(): MotionMap {
    const recipes: Record<string, MotionRecipe> = {};
    for (const [id, recipe] of this.recipes) recipes[id] = { ...recipe, keyframes: recipe.keyframes.map((frame) => ({ ...frame })) };
    return { recipes, cues: this.cueList().map((cue) => ({ ...cue })) };
  }

  problems(): string[] {
    return validateMotionMap(this.toJSON());
  }

  /** Fires for every cue that actually ran, so a coverage view can tell "never triggered" from "triggered". */
  onPlay(listener: (event: MotionPlayEvent) => void): () => void {
    this.playListeners.add(listener);
    return () => this.playListeners.delete(listener);
  }

  /** Fires when the map is edited (retarget, updateCue, updateRecipe), so the board can redraw. */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  // warns once per key, then keeps quiet: a cue inside a render loop must not flood the console
  private skip(key: string, message: string): MotionHandle {
    if (!this.warned.has(key)) {
      this.warned.add(key);
      this.warn(message);
    }
    return settledHandle();
  }

  private changed(): void {
    for (const listener of [...this.changeListeners]) listener();
  }
}
