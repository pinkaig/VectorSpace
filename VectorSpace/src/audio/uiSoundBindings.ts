/**
 * @file        uiSoundBindings.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Which cue a pressed control makes: the rules in ui-sound-map.json, plus any tags
 *              made on the page in the sound debug panel.
 *
 * @responsibility
 * Pure lookups, no sound. Given an element the person pressed, it finds the control it belongs
 * to and answers with one cue and why (a tag, a data-sfx attribute, a numbered rule, or nothing).
 * The director (uiSoundDirector.ts) asks it on every press; the debug panel asks it to draw the
 * outline over every control and to say where a sound came from.
 *
 * Order of authority, strongest first:
 *  1. a tag made on the page (sound debug on only; kept in this browser until exported)
 *  2. data-sfx="cue.id" (or "none") written on the element in code
 *  3. the first rule in ui-sound-map.json that the control matches
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import soundMap from "./ui-sound-map.json";

/** One line of ui-sound-map.json. */
export type SoundRule = {
  /** the cue to play; null is silent on purpose */
  cue: string | null;
  /** click (the default) or change (a dropdown's pick) */
  on?: "click" | "change";
  /** CSS the control must match */
  selector?: string;
  /** a regular expression the control's label must match */
  label?: string;
  /** a regular expression the route (the address after #, ids as :id) must match */
  route?: string;
  /** why, for the next person */
  note?: string;
};

export type SoundMapFile = { note?: string; rules: SoundRule[] };

/** A cue chosen for one control on one screen in the debug panel. */
export type SoundTag = { route: string; label: string; cue: string | null };

export type SoundSource = "tag" | "attribute" | "rule" | "none";

export type Resolution = {
  cue: string | null;
  source: SoundSource;
  /** the rule's position in ui-sound-map.json, when source is "rule" */
  ruleIndex?: number;
  rule?: SoundRule;
};

/** Everything a person can press that UI sound knows about. */
export const CONTROL_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  "select",
  "input[type=checkbox]",
  "input[type=radio]",
  "[role=button]",
  "[role=tab]",
  "[role=switch]",
  "[role=radio]",
  "[role=checkbox]",
  "[role=menuitem]",
  "[role=option]",
  "[data-sfx]",
].join(", ");

/** The data attribute a component writes to choose its own cue: a cue id, or "none". */
export const SFX_ATTRIBUTE = "data-sfx";

export const shippedRules: readonly SoundRule[] = (soundMap as SoundMapFile).rules;

/** The control a press landed on, or null when it was not on one. */
export function controlOf(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  return target.closest(CONTROL_SELECTOR);
}

const squash = (text: string | null | undefined): string => (text ?? "").replace(/\s+/g, " ").trim();

/** What a person would call the control: its aria-label, else its visible text, else its title. */
export function labelOf(element: Element): string {
  const aria = squash(element.getAttribute("aria-label"));
  if (aria) return aria.slice(0, 80);
  // innerText keeps the gaps between block children ("Educator Ms Tan"); jsdom has no layout, so textContent
  const html = element as HTMLElement;
  const text = squash(typeof html.innerText === "string" ? html.innerText : element.textContent);
  if (text) return text.slice(0, 80);
  return squash(element.getAttribute("title")).slice(0, 80);
}

// An id in the address (a project, a class) would make a tag fit one project only.
const looksLikeId = (segment: string): boolean => (/\d/.test(segment) && segment.length >= 3) || segment.length >= 20;

/** The screen, as the address after # with its ids replaced by :id, e.g. /editor/:id. */
export function routeOf(hash: string): string {
  const path = (hash.replace(/^#/, "").split("?")[0] || "/").replace(/\/+$/, "") || "/";
  return path
    .split("/")
    .map((segment) => (looksLikeId(segment) ? ":id" : segment))
    .join("/");
}

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A tag as a rule that fits that one control on that one screen, for the top of the exported map. */
export function tagToRule(tag: SoundTag): SoundRule {
  return {
    cue: tag.cue,
    route: `^${tag.route.split(":id").map(escapeRegExp).join("[^/]+")}$`,
    label: `^${escapeRegExp(tag.label)}$`,
    note: "Tagged on the page.",
  };
}

type Compiled = { label?: RegExp; route?: RegExp; broken?: boolean };
const compiled = new WeakMap<SoundRule, Compiled>();

const compile = (rule: SoundRule): Compiled => {
  let entry = compiled.get(rule);
  if (!entry) {
    try {
      entry = {
        label: rule.label ? new RegExp(rule.label) : undefined,
        route: rule.route ? new RegExp(rule.route) : undefined,
      };
    } catch {
      // a bad pattern in the map must not break every click
      entry = { broken: true };
    }
    compiled.set(rule, entry);
  }
  return entry;
};

const safeMatches = (element: Element, selector: string): boolean => {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
};

/** Does this rule fit this control on this screen? */
export function ruleFits(rule: SoundRule, element: Element, on: "click" | "change", route: string, label: string): boolean {
  if ((rule.on ?? "click") !== on) return false;
  const patterns = compile(rule);
  if (patterns.broken) return false;
  if (rule.selector && !safeMatches(element, rule.selector)) return false;
  if (patterns.label && !patterns.label.test(label)) return false;
  if (patterns.route && !patterns.route.test(route)) return false;
  return true;
}

/** The one cue this control makes, and where that answer came from. */
export function resolveCue(
  element: Element,
  on: "click" | "change",
  route: string,
  rules: readonly SoundRule[] = shippedRules,
  tags: readonly SoundTag[] = [],
): Resolution {
  const label = labelOf(element);
  if (on === "click") {
    const tag = tags.find((candidate) => candidate.route === route && candidate.label === label);
    if (tag) return { cue: tag.cue, source: "tag" };
    const attribute = element.closest(`[${SFX_ATTRIBUTE}]`)?.getAttribute(SFX_ATTRIBUTE);
    if (attribute) return { cue: attribute === "none" ? null : attribute, source: "attribute" };
  }
  const ruleIndex = rules.findIndex((rule) => ruleFits(rule, element, on, route, label));
  if (ruleIndex >= 0) return { cue: rules[ruleIndex].cue, source: "rule", ruleIndex, rule: rules[ruleIndex] };
  return { cue: null, source: "none" };
}

/** The map to save over ui-sound-map.json: the tags as rules on top, then the shipped rules they do not repeat. */
export function exportSoundMap(tags: readonly SoundTag[], rules: readonly SoundRule[] = shippedRules): SoundMapFile {
  const tagged = tags.map(tagToRule);
  const same = (a: SoundRule, b: SoundRule) => a.route === b.route && a.label === b.label && !a.selector && !b.selector;
  return {
    note: (soundMap as SoundMapFile).note,
    rules: [...tagged, ...rules.filter((rule) => !tagged.some((tag) => same(tag, rule)))],
  };
}
