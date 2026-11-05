/**
 * @file        SoundTagTools.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       The sound debug panel's tagging half: outline every control with the cue it plays,
 *              pick one and give it another cue, give a cue other files, then export both maps.
 *
 * @responsibility
 * Works on the real pages, so what is tagged is what ships. Three parts:
 *  - SoundOverlay: a box over every control on screen, coloured by its kind of sound, labelled
 *    with its cue (or "no rule" in red). Read-only; clicks pass through it.
 *  - TagTab: "Pick a control" catches the next press instead of letting it through, then shows
 *    why that control sounds as it does and lets you choose another cue for it on this screen.
 *  - CuesTab: every cue by kind of sound, the file(s) in public/audio it plays, and a choice of
 *    other files.
 * Changes live in uiSoundTags.ts (this browser) until exported: ui-sound-map.json (controls to
 * cues) and cue-map.json (cues to files), pasted over the files in src/audio.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useReducer, useState } from "react";
import type { CueDef, CueMap } from "../../packages/audio/src/index";
import cueMapJson from "./cue-map.json";
import { exportFile, formatCueMap, formatSoundMap } from "./soundMapExport";
import { uiSound, uiSoundDebug } from "./uiSound";
import {
  CONTROL_SELECTOR,
  controlOf,
  exportSoundMap,
  labelOf,
  resolveCue,
  routeOf,
  type Resolution,
} from "./uiSoundBindings";
import { sourceText } from "./uiSoundDirector";
import { uiSoundTags } from "./uiSoundTags";

const shippedCueMap = cueMapJson as unknown as CueMap;

/** The six kinds of sound (prototypes/ui-audio/SOUND-CATEGORIES.md), in the order a person meets them. */
export const KINDS: { name: string; colour: string }[] = [
  { name: "Touch feedback", colour: "#4fa3ff" },
  { name: "Switches and doors", colour: "#b58cff" },
  { name: "Movement and transition", colour: "#3fd0c0" },
  { name: "Building", colour: "#ffb84d" },
  { name: "Outcome and notice", colour: "#7ddc8a" },
  { name: "The museum itself", colour: "#ff8fc7" },
];
const NO_RULE = "#ff6b5b";
const SILENT = "#888888";

const cueList = (): CueDef[] =>
  uiSoundDebug.bank()?.cueList() ?? shippedCueMap.cues;
const cueById = (id: string): CueDef | undefined =>
  cueList().find((cue) => cue.id === id);
const colourOf = (resolution: Resolution): string => {
  if (resolution.source === "none") return NO_RULE;
  if (!resolution.cue) return SILENT;
  const group = cueById(resolution.cue)?.group;
  return KINDS.find((kind) => kind.name === group)?.colour ?? NO_RULE;
};

const currentRoute = (): string => routeOf(window.location.hash);
const resolveHere = (element: Element): Resolution =>
  resolveCue(
    element,
    element.tagName === "SELECT" ? "change" : "click",
    currentRoute(),
    undefined,
    uiSoundTags.tags(),
  );

/** Re-render on a timer: the page under the panel changes without telling it. */
function useTick(ms: number, on = true): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!on) return;
    const timer = window.setInterval(tick, ms);
    const off = uiSoundTags.subscribe(tick);
    return () => {
      window.clearInterval(timer);
      off();
    };
  }, [ms, on]);
}

type Seen = { element: Element; rect: DOMRect; resolution: Resolution };

/** The controls a person can see and reach right now, outside the panel. */
function visibleControls(): Seen[] {
  const seen: Seen[] = [];
  for (const element of document.querySelectorAll(CONTROL_SELECTOR)) {
    if (element.closest(".sound-debug")) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.right < 0)
      continue;
    if (rect.top > window.innerHeight || rect.left > window.innerWidth)
      continue;
    // under a popup's backdrop, or scrolled out of its panel: not reachable, not outlined
    const hit = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    if (hit && !element.contains(hit) && !hit.closest(".sound-debug-overlay"))
      continue;
    seen.push({ element, rect, resolution: resolveHere(element) });
  }
  return seen;
}

export function SoundOverlay({ highlight }: { highlight: Element | null }) {
  useTick(300);
  const controls = visibleControls();
  return (
    <div className="sound-debug-overlay" aria-hidden="true">
      {controls.map(({ element, rect, resolution }, index) => {
        const colour = colourOf(resolution);
        const text =
          resolution.source === "none"
            ? "no rule"
            : (resolution.cue ?? "silent");
        return (
          <div
            key={index}
            className={`sound-debug-box${element === highlight ? " sound-debug-box-on" : ""}`}
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              borderColor: colour,
            }}
          >
            <span style={{ background: colour }}>
              {resolution.source === "tag" ? "★ " : ""}
              {text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Counts each cue's controls on this screen, for the Cues tab and the legend. */
function countsOnScreen(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { resolution } of visibleControls()) {
    const key =
      resolution.source === "none"
        ? "(no rule)"
        : (resolution.cue ?? "(silent)");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function CueOptions() {
  return (
    <>
      {KINDS.map((kind) => (
        <optgroup key={kind.name} label={kind.name}>
          {cueList()
            .filter((cue) => cue.group === kind.name)
            .map((cue) => (
              <option key={cue.id} value={cue.id}>
                {cue.id} ·{" "}
                {cue.sounds.length ? cue.sounds.join(", ") : "no file yet"}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

type Picked = { element: Element; route: string; label: string };

export function TagTab({
  picked,
  setPicked,
}: {
  picked: Picked | null;
  setPicked: (picked: Picked | null) => void;
}) {
  useTick(500);
  const [message, setMessage] = useState("");

  // while picking, the next press anywhere outside the panel chooses a control and does nothing else
  useEffect(() => {
    if (!uiSoundTags.picking) return;
    const outside = (event: Event) =>
      !(event.target as Element | null)?.closest?.(".sound-debug");
    const swallow = (event: Event) => {
      if (!outside(event)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const choose = (event: MouseEvent) => {
      if (!outside(event)) return;
      swallow(event);
      const control = controlOf(event.target);
      uiSoundTags.setPicking(false);
      if (!control) {
        setMessage(
          "That is not a control UI sound knows (no button, link, tab, switch or data-sfx).",
        );
        return;
      }
      setMessage("");
      setPicked({
        element: control,
        route: currentRoute(),
        label: labelOf(control),
      });
    };
    const kinds = ["pointerdown", "mousedown", "pointerup", "mouseup"] as const;
    for (const kind of kinds) window.addEventListener(kind, swallow, true);
    window.addEventListener("click", choose, true);
    return () => {
      for (const kind of kinds) window.removeEventListener(kind, swallow, true);
      window.removeEventListener("click", choose, true);
    };
  }, [uiSoundTags.picking, setPicked]);

  const resolution = picked
    ? resolveCue(
        picked.element,
        picked.element.tagName === "SELECT" ? "change" : "click",
        picked.route,
        undefined,
        uiSoundTags.tags(),
      )
    : null;
  const tagged = resolution?.source === "tag";
  const choice = !resolution
    ? ""
    : tagged
      ? (resolution.cue ?? "__none")
      : "__rule";

  const exportMap = async (how: "copy" | "download") =>
    setMessage(await exportFile("ui-sound-map.json", formatSoundMap(exportSoundMap(uiSoundTags.tags())), how));

  return (
    <div className="sound-debug-tab">
      <div className="sound-debug-row">
        <button
          type="button"
          className={uiSoundTags.picking ? "sound-debug-active" : ""}
          onClick={() => uiSoundTags.setPicking(!uiSoundTags.picking)}
        >
          {uiSoundTags.picking
            ? "Picking… press any control"
            : "Pick a control"}
        </button>
      </div>
      {message && <p className="sound-debug-note">{message}</p>}
      {picked && resolution && (
        <div className="sound-debug-picked">
          <div>
            <code>{picked.label || "(no label)"}</code> on{" "}
            <code>{picked.route}</code>
          </div>
          <div>
            Plays <b>{resolution.cue ?? "nothing"}</b> because:{" "}
            {sourceText(resolution)}
          </div>
          <div className="sound-debug-row">
            <select
              aria-label="Cue for this control"
              value={choice}
              onChange={(event) => {
                const value = event.target.value;
                uiSoundTags.setTag(
                  picked.route,
                  picked.label,
                  value === "__rule"
                    ? undefined
                    : value === "__none"
                      ? null
                      : value,
                );
                if (value !== "__rule" && value !== "__none")
                  uiSound.play(value);
              }}
            >
              <option value="__rule">Let the rules decide</option>
              <option value="__none">Silent</option>
              <CueOptions />
            </select>
            <button
              type="button"
              disabled={!resolution.cue}
              onClick={() => resolution.cue && uiSound.play(resolution.cue)}
            >
              Play
            </button>
          </div>
          {!picked.label && (
            <p className="sound-debug-note bad">
              This control has no label, so a tag cannot find it again. Give it
              an aria-label, or data-sfx in code.
            </p>
          )}
        </div>
      )}
      <h4>Tagged in this browser ({uiSoundTags.tags().length})</h4>
      <ul className="sound-debug-tags">
        {uiSoundTags.tags().length === 0 && (
          <li>None yet. Pick a control and choose a cue.</li>
        )}
        {uiSoundTags.tags().map((tag) => (
          <li key={`${tag.route}|${tag.label}`}>
            <button
              type="button"
              aria-label={`Remove the tag on ${tag.label}`}
              onClick={() =>
                uiSoundTags.setTag(tag.route, tag.label, undefined)
              }
            >
              ×
            </button>{" "}
            <code>{tag.route}</code> “{tag.label}” →{" "}
            <b>{tag.cue ?? "silent"}</b>
          </li>
        ))}
      </ul>
      <div className="sound-debug-row">
        <span>ui-sound-map.json</span>
        <button type="button" onClick={() => void exportMap("copy")}>
          Copy
        </button>
        <button type="button" onClick={() => void exportMap("download")}>
          Download
        </button>
      </div>
    </div>
  );
}

export function CuesTab() {
  useTick(1000);
  const [message, setMessage] = useState("");
  const bank = uiSoundDebug.bank();
  const counts = countsOnScreen();
  const sounds =
    bank?.soundList() ??
    Object.entries(shippedCueMap.sounds).map(([id, def]) => ({ id, def }));
  const shipped = (id: string) =>
    shippedCueMap.cues.find((cue) => cue.id === id)?.sounds ?? [];

  const exportMap = async (how: "copy" | "download") => {
    if (bank) setMessage(await exportFile("cue-map.json", formatCueMap(bank.toJSON()), how));
  };

  return (
    <div className="sound-debug-tab">
      {!bank && (
        <p className="sound-debug-note">
          The engine is not loaded yet; press anywhere on the page.
        </p>
      )}
      <p className="sound-debug-note">
        Each cue, by kind of sound, with the file(s) in public/audio it plays.
        “On screen” counts the controls on this page that make it.
        {counts.get("(no rule)")
          ? ` ${counts.get("(no rule)")} control(s) here fit no rule.`
          : ""}
      </p>
      {KINDS.map((kind) => (
        <section key={kind.name}>
          <h4 style={{ color: kind.colour }}>{kind.name}</h4>
          {cueList()
            .filter((cue) => cue.group === kind.name)
            .map((cue) => {
              const joined = cue.sounds.join("+");
              const changed = joined !== shipped(cue.id).join("+");
              return (
                <div key={cue.id} className="sound-debug-cue">
                  <div>
                    <code>{cue.id}</code>{" "}
                    <span className="sound-debug-dim">{cue.label}</span>
                    {counts.get(cue.id) ? (
                      <span className="ok">
                        {" "}
                        · on screen {counts.get(cue.id)}
                      </span>
                    ) : null}
                  </div>
                  <div className="sound-debug-row">
                    <select
                      aria-label={`Sound for ${cue.id}`}
                      value={joined}
                      disabled={!bank}
                      onChange={(event) => {
                        const next = event.target.value
                          ? event.target.value.split("+")
                          : [];
                        bank?.assign(cue.id, next);
                        uiSoundTags.setCueSounds(
                          cue.id,
                          next.join("+") === shipped(cue.id).join("+")
                            ? undefined
                            : next,
                        );
                        if (next.length) uiSound.play(cue.id);
                      }}
                    >
                      {cue.sounds.length > 1 && (
                        <option value={joined}>{cue.sounds.join(" + ")}</option>
                      )}
                      {shipped(cue.id).length > 1 &&
                        joined !== shipped(cue.id).join("+") && (
                          <option value={shipped(cue.id).join("+")}>
                            {shipped(cue.id).join(" + ")} (as shipped)
                          </option>
                        )}
                      <option value="">no sound</option>
                      {sounds.map(({ id, def }) => (
                        <option key={id} value={id}>
                          {id} ·{" "}
                          {def.url?.replace(/^\/audio\//, "") ?? "in memory"}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!cue.sounds.length}
                      onClick={() => uiSound.play(cue.id)}
                    >
                      Play
                    </button>
                    {changed && (
                      <span className="sound-debug-dim">changed</span>
                    )}
                  </div>
                </div>
              );
            })}
        </section>
      ))}
      {message && <p className="sound-debug-note">{message}</p>}
      <div className="sound-debug-row">
        <span>cue-map.json</span>
        <button
          type="button"
          disabled={!bank}
          onClick={() => void exportMap("copy")}
        >
          Copy
        </button>
        <button
          type="button"
          disabled={!bank}
          onClick={() => void exportMap("download")}
        >
          Download
        </button>
        <button
          type="button"
          onClick={() => {
            uiSoundDebug.restoreAll();
          }}
        >
          Clear all changes
        </button>
      </div>
    </div>
  );
}

export function KindLegend() {
  return (
    <div className="sound-debug-legend">
      {KINDS.map((kind) => (
        <span key={kind.name}>
          <i style={{ background: kind.colour }} />
          {kind.name}
        </span>
      ))}
      <span>
        <i style={{ background: NO_RULE }} />
        no rule
      </span>
      <span>
        <i style={{ background: SILENT }} />
        silent
      </span>
    </div>
  );
}

export type { Picked };
