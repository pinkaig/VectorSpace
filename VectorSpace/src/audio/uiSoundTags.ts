/**
 * @file        uiSoundTags.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The changes made in the sound debug panel before they are exported: a cue chosen
 *              for one control, and different sound files chosen for a cue.
 *
 * @responsibility
 * Kept in this browser (localStorage), so tagging can stop and resume across reloads, and used
 * only while sound debug is on: a browser that once tagged and then turned debug off hears the
 * shipped map again. The durable way to keep a change is the panel's Export, pasted over
 * ui-sound-map.json and cue-map.json.
 *
 * Survives signing in and out: Auth0's logout clears only its own keys, so a designer who signs
 * in as someone else in the same browser keeps their changes. Another browser or device starts
 * empty. While a change has not been exported, leaving or reloading the site asks first.
 *
 * Also holds whether the panel is picking a control, so the director stays quiet while a press
 * is only choosing what to tag.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { isSoundDebugOn } from "./soundDebugFlag";
import type { SoundTag } from "./uiSoundBindings";

const TAGS_KEY = "vectorspace.uiSoundTags";

type Saved = {
  tags: SoundTag[];
  /** cue id -> the sound ids it plays instead of cue-map.json's */
  cueSounds: Record<string, string[]>;
  /** sound id -> another file or loudness than cue-map.json's */
  sounds: Record<string, SoundEdit>;
  /** what each file looked like when it was last exported, so leaving can warn about the rest */
  exported: { soundMap?: string; cueMap?: string };
};

export type SoundEdit = { url?: string; volume?: number };
export type ExportFile = "ui-sound-map.json" | "cue-map.json";

const empty = (): Saved => ({ tags: [], cueSounds: {}, sounds: {}, exported: {} });

const read = (): Saved => {
  try {
    const raw = localStorage.getItem(TAGS_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      tags: parsed.tags ?? [],
      cueSounds: parsed.cueSounds ?? {},
      sounds: parsed.sounds ?? {},
      exported: parsed.exported ?? {},
    };
  } catch {
    return empty();
  }
};

const active = typeof window !== "undefined" && isSoundDebugOn();
let saved: Saved = active ? read() : empty();
let picking = false;

// the part of the changes each export file carries; "" when there is nothing to export
const fingerprint = (file: ExportFile): string => {
  if (file === "ui-sound-map.json") return saved.tags.length ? JSON.stringify(saved.tags) : "";
  const { cueSounds, sounds } = saved;
  return Object.keys(cueSounds).length || Object.keys(sounds).length ? JSON.stringify({ cueSounds, sounds }) : "";
};
const exportedKey = (file: ExportFile) => (file === "ui-sound-map.json" ? "soundMap" : "cueMap");
const listeners = new Set<() => void>();

const changed = (): void => {
  try {
    localStorage.setItem(TAGS_KEY, JSON.stringify(saved));
  } catch {
    // storage is off: the tags last for this visit
  }
  for (const listener of [...listeners]) listener();
};

export const uiSoundTags = {
  /** True when tags apply at all (sound debug is on in this browser). */
  active,
  tags: (): readonly SoundTag[] => saved.tags,
  cueSounds: (): Readonly<Record<string, string[]>> => saved.cueSounds,

  /** Choose a cue for one control on one screen; undefined removes the tag. */
  setTag(route: string, label: string, cue: string | null | undefined): void {
    const rest = saved.tags.filter((tag) => !(tag.route === route && tag.label === label));
    saved = { ...saved, tags: cue === undefined ? rest : [...rest, { route, label, cue }] };
    changed();
  },

  /** Choose the sound files a cue plays; undefined goes back to cue-map.json's. */
  setCueSounds(cueId: string, soundIds: string[] | undefined): void {
    const cueSounds = { ...saved.cueSounds };
    if (soundIds) cueSounds[cueId] = soundIds;
    else delete cueSounds[cueId];
    saved = { ...saved, cueSounds };
    changed();
  },

  sounds: (): Readonly<Record<string, SoundEdit>> => saved.sounds,

  /** Give a sound another file or loudness; undefined goes back to cue-map.json's. */
  setSound(soundId: string, edit: SoundEdit | undefined): void {
    const sounds = { ...saved.sounds };
    if (edit && (edit.url !== undefined || edit.volume !== undefined)) sounds[soundId] = edit;
    else delete sounds[soundId];
    saved = { ...saved, sounds };
    changed();
  },

  /** The export files holding changes that were never exported (or changed since). */
  unexported(): ExportFile[] {
    return (["ui-sound-map.json", "cue-map.json"] as const).filter(
      (file) => fingerprint(file) !== "" && fingerprint(file) !== saved.exported[exportedKey(file)],
    );
  },

  /** Call after a Copy or Download of the file succeeded. */
  markExported(file: ExportFile): void {
    saved = { ...saved, exported: { ...saved.exported, [exportedKey(file)]: fingerprint(file) } };
    changed();
  },

  clear(): void {
    saved = empty();
    changed();
  },

  get picking(): boolean {
    return picking;
  },
  setPicking(on: boolean): void {
    picking = on;
    for (const listener of [...listeners]) listener();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// Leaving, reloading or signing out (Auth0 sends the page away) with changes not yet exported:
// the browser asks first. Its own wording; browsers no longer show a custom message.
if (active) {
  window.addEventListener("beforeunload", (event) => {
    if (uiSoundTags.unexported().length === 0) return;
    event.preventDefault();
    event.returnValue = "";
  });
}
