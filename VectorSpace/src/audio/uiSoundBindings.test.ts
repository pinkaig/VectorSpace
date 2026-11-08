/**
 * @file        uiSoundBindings.test.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The control-to-cue rules: the shipped map is sound, tags win, exports round-trip.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { describe, expect, it } from "vitest";
import cueMap from "./cue-map.json";
import { formatCueMap, formatSoundMap } from "./soundMapExport";
import { exportSoundMap, resolveCue, routeOf, shippedRules, tagToRule, type SoundRule } from "./uiSoundBindings";

// Enough of an Element for rules with no selector (no DOM in these tests).
const fakeControl = (label: string, attributes: Record<string, string> = {}): Element => {
  const element = {
    tagName: "BUTTON",
    textContent: label,
    getAttribute: (name: string) => attributes[name] ?? null,
    matches: () => true,
    closest: (selector: string) => (selector === "[data-sfx]" && "data-sfx" in attributes ? element : null),
  };
  return element as unknown as Element;
};

describe("ui-sound-map.json", () => {
  it("names only cues that cue-map.json has", () => {
    const known = new Set(cueMap.cues.map((cue) => cue.id));
    const unknown = shippedRules.flatMap((rule) => (rule.cue && !known.has(rule.cue) ? [rule.cue] : []));
    expect(unknown).toEqual([]);
  });

  it("has patterns that compile", () => {
    for (const rule of shippedRules) {
      if (rule.label) expect(() => new RegExp(rule.label as string)).not.toThrow();
      if (rule.route) expect(() => new RegExp(rule.route as string)).not.toThrow();
    }
  });

  it("ends with the default click, so no button is silent by accident", () => {
    expect(shippedRules.at(-1)).toMatchObject({ cue: "ui.click", selector: expect.stringContaining("button") });
  });
});

describe("routeOf", () => {
  it("keeps the screen and hides the ids", () => {
    expect(routeOf("#/login")).toBe("/login");
    expect(routeOf("#/editor/3f2a9c")).toBe("/editor/:id");
    expect(routeOf("#/teacher/review?x=1")).toBe("/teacher/review");
    expect(routeOf("")).toBe("/");
  });
});

describe("resolveCue", () => {
  const rules: SoundRule[] = [
    { cue: "ui.close", label: "^Cancel$" },
    { cue: "ui.click" },
  ];

  it("takes the first rule that fits", () => {
    expect(resolveCue(fakeControl("Cancel"), "click", "/x", rules)).toMatchObject({ cue: "ui.close", source: "rule", ruleIndex: 0 });
    expect(resolveCue(fakeControl("Save"), "click", "/x", rules)).toMatchObject({ cue: "ui.click", ruleIndex: 1 });
  });

  it("lets data-sfx in code beat the rules, and none mean silent", () => {
    expect(resolveCue(fakeControl("Cancel", { "data-sfx": "ui.error" }), "click", "/x", rules)).toMatchObject({ cue: "ui.error", source: "attribute" });
    expect(resolveCue(fakeControl("Cancel", { "data-sfx": "none" }), "click", "/x", rules)).toMatchObject({ cue: null, source: "attribute" });
  });

  it("lets a tag beat everything, on its own screen only", () => {
    const tags = [{ route: "/login", label: "Cancel", cue: "ui.tip" }];
    expect(resolveCue(fakeControl("Cancel", { "data-sfx": "ui.error" }), "click", "/login", rules, tags)).toMatchObject({ cue: "ui.tip", source: "tag" });
    expect(resolveCue(fakeControl("Cancel"), "click", "/teacher", rules, tags)).toMatchObject({ cue: "ui.close", source: "rule" });
  });

  it("says when nothing fits", () => {
    expect(resolveCue(fakeControl("Save"), "change", "/x", rules)).toEqual({ cue: null, source: "none" });
  });
});

describe("export", () => {
  it("turns a tag into a rule that fits the same control on the same screen", () => {
    const rule = tagToRule({ route: "/editor/:id", label: "Play (beta)", cue: "play.start" });
    expect(resolveCue(fakeControl("Play (beta)"), "click", "/editor/:id", [rule])).toMatchObject({ cue: "play.start" });
    expect(new RegExp(rule.route as string).test("/editor/abc123")).toBe(true);
    expect(resolveCue(fakeControl("Play"), "click", "/editor/:id", [rule])).toMatchObject({ source: "none" });
  });

  it("puts tags on top and does not repeat an earlier export of the same control", () => {
    const tag = { route: "/login", label: "Educator", cue: "ui.click.primary" };
    const once = exportSoundMap([tag], shippedRules);
    const twice = exportSoundMap([{ ...tag, cue: "ui.tip" }], once.rules);
    expect(twice.rules[0]).toMatchObject({ cue: "ui.tip" });
    expect(twice.rules.length).toBe(shippedRules.length + 1);
  });
});

describe("export files", () => {
  it("write JSON that reads back the same", () => {
    const map = exportSoundMap([{ route: "/login", label: "Sign in", cue: "ui.click.primary" }]);
    expect(JSON.parse(formatSoundMap(map))).toEqual(JSON.parse(JSON.stringify(map)));
    expect(JSON.parse(formatCueMap(cueMap as never))).toEqual(cueMap);
  });
});
