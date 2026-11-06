/**
 * @file        SoundDebugPanel.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       An on-page panel that shows what UI sound is doing, for finding why a sound did not play.
 *
 * @responsibility
 * Three tabs:
 *  - Log: the audio engine's state, the browser's audio context, the unlock and the mute, then
 *    every step each sound took (which control, which rule, replaced, waiting, playing, or
 *    dropped and why). A press on a control that fits no rule shows in red.
 *  - Tag: outline every control with its cue, pick one, give it another cue (SoundTagTools.tsx).
 *  - Cues: every cue by kind of sound and the file(s) it plays; choose others; export both maps.
 *
 * Turned on per browser, in dev or a build made with VITE_SOUND_DEBUG=true, by adding ?sounddebug to the address:
 *   https://<site>/?sounddebug#/login     on, remembered in this browser
 *   https://<site>/?sounddebug=off        off again
 * App.tsx imports this file only when soundDebugFlag.ts says it is on, so nobody else downloads it.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useReducer, useState } from "react";
import { useLocation } from "react-router";
import {
  CuesTab,
  KindLegend,
  SoundOverlay,
  TagTab,
  type Picked,
} from "./SoundTagTools";
import { uiSound, uiSoundDebug } from "./uiSound";
import "./soundDebugPanel.css";

type Tab = "log" | "tag" | "cues";
const TAB_KEY = "vectorspace.soundDebugTab";
const readTab = (): Tab => {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return saved === "tag" || saved === "cues" ? saved : "log";
  } catch {
    return "log";
  }
};

export default function SoundDebugPanel() {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [open, setOpen] = useState(true);
  const [testCue, setTestCue] = useState("ui.click");
  const [tab, setTabState] = useState<Tab>(readTab);
  const [outline, setOutline] = useState(true);
  const [picked, setPicked] = useState<Picked | null>(null);
  const setTab = (next: Tab) => {
    setTabState(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // remembered for this visit only
    }
  };

  useEffect(() => uiSoundDebug.subscribe(refresh), []);
  // the audio context changes state on its own (tab hidden, device change), so look again often
  useEffect(() => {
    const timer = window.setInterval(refresh, 500);
    return () => window.clearInterval(timer);
  }, []);

  const status = uiSoundDebug.status();
  const steps = [...uiSoundDebug.steps()].reverse();
  const contextOk = status.context === "running";
  // the sound design page is a full-page version of the Cues tab; the panel would only cover it
  const onDesignPage = useLocation().pathname === "/sound-design";

  if (!open || onDesignPage) {
    return (
      <button
        type="button"
        className="sound-debug sound-debug-closed"
        onClick={() => setOpen(true)}
      >
        Sound debug
      </button>
    );
  }

  return (
    <>
      {tab !== "log" && outline && (
        <SoundOverlay highlight={picked?.element ?? null} />
      )}
      <aside
        className={`sound-debug${tab !== "log" ? " sound-debug-wide" : ""}`}
        aria-label="Sound debug"
      >
        <header>
          <strong>Sound debug</strong>
          <a href="#/sound-design" className="sound-debug-dim">
            Sound design page
          </a>
          <nav className="sound-debug-tabs">
            {(["log", "tag", "cues"] as const).map((name) => (
              <button
                key={name}
                type="button"
                className={tab === name ? "sound-debug-active" : ""}
                onClick={() => setTab(name)}
              >
                {name === "log"
                  ? "Log"
                  : name === "tag"
                    ? "Tag controls"
                    : "Cues"}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Hide sound debug"
          >
            ×
          </button>
        </header>
        {tab !== "log" && (
          <div className="sound-debug-row">
            <label>
              <input
                type="checkbox"
                checked={outline}
                onChange={(event) => setOutline(event.target.checked)}
              />{" "}
              Outline every control
            </label>
          </div>
        )}
        {tab !== "log" && outline && <KindLegend />}
        {tab === "tag" && <TagTab picked={picked} setPicked={setPicked} />}
        {tab === "cues" && <CuesTab />}
        {tab === "log" && (
          <>
            <dl>
              <dt>Engine</dt>
              <dd
                className={
                  status.engine === "ready"
                    ? "ok"
                    : status.engine === "failed"
                      ? "bad"
                      : ""
                }
              >
                {status.engine}
                {status.engineError && `: ${status.engineError}`}
              </dd>
              <dt>Browser audio</dt>
              <dd className={contextOk ? "ok" : "bad"}>{status.context}</dd>
              <dt>Unlocked</dt>
              <dd className={status.unlocked ? "ok" : "bad"}>
                {status.unlocked ? "yes" : "no, press anywhere"}
              </dd>
              <dt>Muted</dt>
              <dd className={status.muted ? "bad" : "ok"}>
                {status.muted ? "yes" : "no"}{" "}
                <button
                  type="button"
                  onClick={() => uiSound.setMuted(!status.muted)}
                >
                  {status.muted ? "Unmute" : "Mute"}
                </button>
              </dd>
            </dl>
            <div className="sound-debug-test">
              <select
                value={testCue}
                onChange={(event) => setTestCue(event.target.value)}
                aria-label="Cue to test"
              >
                {(status.cues.length ? status.cues : [testCue]).map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
              <button type="button" onClick={() => uiSound.play(testCue)}>
                Play
              </button>
              <button type="button" onClick={uiSoundDebug.clear}>
                Clear
              </button>
            </div>
            <ol>
              {steps.length === 0 && <li>No sound asked for yet.</li>}
              {steps.map((step, index) => (
                <li
                  key={`${step.at}-${index}`}
                  className={step.ok ? "" : "bad"}
                >
                  <time>{(step.at / 1000).toFixed(2)}s</time>{" "}
                  <code>{step.cueId}</code> {step.step}
                </li>
              ))}
            </ol>
          </>
        )}
      </aside>
    </>
  );
}
