/**
 * @file        soundMapExport.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Writes ui-sound-map.json and cue-map.json the way they are kept in the repo: one
 *              rule, sound or cue per line, so a pasted export makes a readable diff.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { CueMap } from "../../packages/audio/src/index";
import type { SoundMapFile } from "./uiSoundBindings";
import { uiSoundTags, type ExportFile } from "./uiSoundTags";

/** { "a": 1, "b": [2] } on one line, with the spaces the hand-written files use. */
const oneLine = (value: object): string =>
  `{ ${Object.entries(value)
    .filter(([, field]) => field !== undefined)
    .map(([key, field]) => `${JSON.stringify(key)}: ${JSON.stringify(field)}`)
    .join(", ")} }`;

export function formatSoundMap(map: SoundMapFile): string {
  const rules = map.rules.map((rule) => `    ${oneLine(rule)}`).join(",\n");
  return `{\n  "note": ${JSON.stringify(map.note ?? "")},\n  "rules": [\n${rules}\n  ]\n}\n`;
}

export function formatCueMap(map: CueMap): string {
  const sounds = Object.entries(map.sounds)
    .map(([id, sound]) => `    ${JSON.stringify(id)}: ${oneLine(sound)}`)
    .join(",\n\n");
  const cues = map.cues.map((cue) => `    ${oneLine(cue)}`).join(",\n");
  return `{\n  "sounds": {\n${sounds}\n  },\n\n  "cues": [\n${cues}\n  ]\n}\n`;
}

/** Saves text as a file through the browser's own download. */
export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copies text; false when the browser refuses (no permission, not a secure page). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies or downloads one export file and, when that worked, marks its changes as exported so
 * leaving the site no longer warns about them. Returns a line to show the person.
 */
export async function exportFile(file: ExportFile, text: string, how: "copy" | "download"): Promise<string> {
  if (how === "download") {
    downloadText(file, text);
    uiSoundTags.markExported(file);
    return `Downloaded ${file}: put it over src/audio/${file} and commit it.`;
  }
  if (!(await copyText(text))) return "The browser refused to copy; use Download.";
  uiSoundTags.markExported(file);
  return `Copied ${file}: paste it over src/audio/${file} and commit it.`;
}
