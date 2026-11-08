/**
 * @file        uiSoundTags.test.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Changes not yet exported are counted per file, so leaving the site can warn.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { beforeEach, describe, expect, it } from "vitest";
import { uiSoundTags } from "./uiSoundTags";

describe("uiSoundTags.unexported", () => {
  beforeEach(() => uiSoundTags.clear());

  it("is empty with no changes", () => {
    expect(uiSoundTags.unexported()).toEqual([]);
  });

  it("names the file each change belongs in", () => {
    uiSoundTags.setSound("tip", { url: "/audio/SFX/Next.wav" });
    expect(uiSoundTags.unexported()).toEqual(["cue-map.json"]);
    uiSoundTags.setTag("/login", "Educator", "ui.click.primary");
    expect(uiSoundTags.unexported()).toEqual(["ui-sound-map.json", "cue-map.json"]);
  });

  it("forgets a file once exported, until it changes again", () => {
    uiSoundTags.setCueSounds("ui.tip", ["next"]);
    uiSoundTags.markExported("cue-map.json");
    expect(uiSoundTags.unexported()).toEqual([]);
    uiSoundTags.setSound("next", { volume: 0.5 });
    expect(uiSoundTags.unexported()).toEqual(["cue-map.json"]);
  });

  it("drops an edit that puts a sound back as shipped", () => {
    uiSoundTags.setSound("tip", { url: "/audio/SFX/Next.wav" });
    uiSoundTags.setSound("tip", { url: undefined, volume: undefined });
    expect(uiSoundTags.sounds()).toEqual({});
    expect(uiSoundTags.unexported()).toEqual([]);
  });
});
