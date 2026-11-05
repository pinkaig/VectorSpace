/**
 * @file        SoundDesignPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       A page for the sound designer: which file each of the five sounds is, how loud,
 *              and which sound every cue plays. Exports cue-map.json.
 *
 * @responsibility
 * Opened at /?sounddebug#/sound-design, in production too, signed in or not. Every change plays
 * in the app at once (the live CueBank) and is kept in this browser by uiSoundTags.ts, which
 * survives signing in and out of Auth0 accounts. Nothing reaches the repo until the designer
 * downloads cue-map.json and someone commits it over src/audio/cue-map.json; until then the page
 * shows a banner, and leaving or reloading the site asks first.
 *
 * The five sounds are the masterlist's (V3.05): Tip, Brief, Success, Error, Next. Each is one
 * entry in cue-map.json's "sounds", and the cues name them, so changing Tip's file changes every
 * moment that plays Tip.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useReducer, useState } from "react";
import libraryFiles from "virtual:audio-files";
import sfxFiles from "virtual:ui-sfx-files";
import type { CueDef, CueMap, CueSound } from "../../packages/audio/src/index";
import cueMapJson from "./cue-map.json";
import { KINDS } from "./SoundTagTools";
import { exportFile, formatCueMap, formatSoundMap } from "./soundMapExport";
import { uiSound, uiSoundDebug } from "./uiSound";
import { exportSoundMap } from "./uiSoundBindings";
import { uiSoundTags } from "./uiSoundTags";
import "./soundDesignPage.css";

const shipped = cueMapJson as unknown as CueMap;

/** The masterlist's five sounds, in its order, with when each plays. */
const FIVE: { id: string; name: string; when: string }[] = [
  { id: "tip", name: "Tip", when: "A tip appears (tutorial, Reactions, Zones), a card or video rule is auto-added, or sound is switched back on." },
  { id: "brief", name: "Brief", when: "The tutorial ends and the student lands in the editor with the Mission brief." },
  { id: "success", name: "Success", when: "A project is submitted, or a teacher approves one." },
  { id: "error", name: "Error", when: "The “Oops, that won't fit inside a wall” popup opens." },
  { id: "next", name: "Next", when: "In Play, the visitor walks somewhere, jumps to a tour spot or changes room." },
];

const RULES = [
  "One sound per action: when a press causes an outcome (a popup, a send), the outcome's sound replaces the click.",
  "The sound on/off button remembers the choice in this browser.",
  "No sound until the person has clicked or pressed a key (the browser's rule).",
];

/** Every audio file the site serves, as the URL a sound would name. */
const FILES: { url: string; group: string }[] = [
  ...sfxFiles.map((name) => ({ url: `/audio/SFX/${name}`, group: "UI sounds (public/audio/SFX)" })),
  ...libraryFiles.map((name) => ({ url: `/audio/${name}`, group: "Student library (public/audio)" })),
];
const fileName = (url: string | undefined) => url?.split("/").pop() ?? "a file from this computer";

/** Re-render when a change is made or the engine loads; the engine has no React state of its own. */
function useLive(): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const offTags = uiSoundTags.subscribe(tick);
    const offDebug = uiSoundDebug.subscribe(tick);
    // the bank appears once the idle download finishes
    const timer = window.setInterval(tick, 1000);
    return () => {
      offTags();
      offDebug();
      window.clearInterval(timer);
    };
  }, []);
}

/** The live map once the engine is loaded, cue-map.json with this browser's changes before that. */
function currentMap(): CueMap {
  const bank = uiSoundDebug.bank();
  if (bank) return bank.toJSON();
  const sounds: Record<string, CueSound> = {};
  for (const [id, def] of Object.entries(shipped.sounds)) {
    const edit = uiSoundTags.sounds()[id];
    sounds[id] = { ...def, url: edit?.url ?? def.url, volume: edit?.volume ?? def.volume };
  }
  const cues = shipped.cues.map((cue) => ({ ...cue, sounds: uiSoundTags.cueSounds()[cue.id] ?? cue.sounds }));
  return { sounds, cues };
}

let preview: HTMLAudioElement | null = null;
/** Plays a file straight from the server, apart from the engine, so it works before any unlock. */
function playFile(url: string | undefined, volume: number): void {
  if (!url) return;
  preview?.pause();
  preview = new Audio(url);
  preview.volume = Math.min(1, Math.max(0, volume));
  void preview.play().catch(() => undefined);
}

function setSoundFile(id: string, url: string): void {
  const before = uiSoundTags.sounds()[id] ?? {};
  uiSoundDebug.bank()?.replaceSound(id, { url });
  uiSoundTags.setSound(id, { ...before, url: url === shipped.sounds[id]?.url ? undefined : url });
}

function setSoundVolume(id: string, volume: number): void {
  const before = uiSoundTags.sounds()[id] ?? {};
  uiSoundDebug.bank()?.updateSound(id, { volume });
  uiSoundTags.setSound(id, { ...before, volume: volume === shipped.sounds[id]?.volume ? undefined : volume });
}

function setCueSounds(cue: CueDef, soundIds: string[]): void {
  uiSoundDebug.bank()?.assign(cue.id, soundIds);
  const asShipped = shipped.cues.find((one) => one.id === cue.id)?.sounds ?? [];
  uiSoundTags.setCueSounds(cue.id, soundIds.join("+") === asShipped.join("+") ? undefined : soundIds);
}

function FiveSoundCard({ id, name, when, map }: { id: string; name: string; when: string; map: CueMap }) {
  const sound = map.sounds[id];
  const edited = uiSoundTags.sounds()[id];
  const users = map.cues.filter((cue) => cue.sounds.includes(id));
  if (!sound) return null;
  const known = FILES.some((file) => file.url === sound.url);
  return (
    <article className="sd-card">
      <header>
        <h3>{name}</h3>
        {edited && (
          <button type="button" className="sd-link" onClick={() => uiSoundDebug.restoreSound(id)}>
            Put back
          </button>
        )}
      </header>
      <p className="sd-dim">{when}</p>
      <label className="sd-field">
        <span>File</span>
        <select
          value={sound.url ?? ""}
          onChange={(event) => {
            setSoundFile(id, event.target.value);
            playFile(event.target.value, sound.volume);
          }}
        >
          {!known && <option value={sound.url ?? ""}>{fileName(sound.url)}</option>}
          {["UI sounds (public/audio/SFX)", "Student library (public/audio)"].map((group) => (
            <optgroup key={group} label={group}>
              {FILES.filter((file) => file.group === group).map((file) => (
                <option key={file.url} value={file.url}>
                  {fileName(file.url)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="sd-field">
        <span>Volume {Math.round(sound.volume * 100)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(sound.volume * 100)}
          onChange={(event) => setSoundVolume(id, Number(event.target.value) / 100)}
          onPointerUp={() => playFile(sound.url, sound.volume)}
        />
      </label>
      <div className="sd-row">
        <button type="button" onClick={() => playFile(sound.url, sound.volume)}>
          ▶ Play
        </button>
        <span className="sd-dim">
          {users.length ? `Plays for ${users.length} cue${users.length === 1 ? "" : "s"}` : "No cue plays it"}
        </span>
      </div>
      {users.length > 0 && (
        <ul className="sd-chips">
          {users.map((cue) => (
            <li key={cue.id} title={cue.id}>
              {cue.label}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function CueRow({ cue, map }: { cue: CueDef; map: CueMap }) {
  const joined = cue.sounds.join("+");
  const asShipped = shipped.cues.find((one) => one.id === cue.id)?.sounds ?? [];
  const changed = joined !== asShipped.join("+");
  const first = map.sounds[cue.sounds[0] ?? ""];
  return (
    <tr className={changed ? "sd-changed" : undefined}>
      <td>
        {cue.label}
        <div className="sd-dim">
          <code>{cue.id}</code>
        </div>
      </td>
      <td>
        <select
          aria-label={`Sound for ${cue.label}`}
          value={joined}
          onChange={(event) => {
            const next = event.target.value ? event.target.value.split("+") : [];
            setCueSounds(cue, next);
            const sound = map.sounds[next[0] ?? ""];
            if (sound) playFile(sound.url, sound.volume * (cue.gain ?? 1));
          }}
        >
          {cue.sounds.length > 1 && <option value={joined}>{cue.sounds.join(" + ")}</option>}
          {asShipped.length > 1 && changed && <option value={asShipped.join("+")}>{asShipped.join(" + ")} (as shipped)</option>}
          <option value="">No sound</option>
          {Object.entries(map.sounds).map(([id, sound]) => (
            <option key={id} value={id}>
              {FIVE.find((five) => five.id === id)?.name ?? id} · {fileName(sound.url)}
            </option>
          ))}
        </select>
        <div className="sd-dim">
          {cue.sounds.length
            ? cue.sounds.map((id) => fileName(map.sounds[id]?.url)).join(", ") + (cue.sounds.length > 1 ? ` (${cue.pick ?? "first"})` : "")
            : "silent: no sound chosen yet"}
        </div>
      </td>
      <td className="sd-actions">
        <button
          type="button"
          disabled={!first}
          onClick={() => playFile(first?.url, (first?.volume ?? 1) * (cue.gain ?? 1))}
          aria-label={`Play ${cue.label}`}
        >
          ▶
        </button>
        {changed && (
          <button type="button" className="sd-link" onClick={() => uiSoundDebug.restoreCue(cue.id)}>
            Put back
          </button>
        )}
      </td>
    </tr>
  );
}

export default function SoundDesignPage() {
  useLive();
  const [message, setMessage] = useState("");
  const map = currentMap();
  const unexported = uiSoundTags.unexported();
  const loaded = uiSoundDebug.bank() !== null;

  const exportCueMap = async (how: "copy" | "download") => setMessage(await exportFile("cue-map.json", formatCueMap(currentMap()), how));
  const exportSoundMapFile = async () =>
    setMessage(await exportFile("ui-sound-map.json", formatSoundMap(exportSoundMap(uiSoundTags.tags())), "download"));

  return (
    <main className="sound-design">
      <header className="sd-head">
        <div>
          <h1>Sound design</h1>
          <p className="sd-dim">
            Choose the file and volume of the five sounds, and the sound every cue plays. Changes play in the app straight away and
            are kept in this browser, through signing in and out, until you download them.
          </p>
        </div>
        <div className="sd-row">
          <button type="button" className="sd-primary" onClick={() => void exportCueMap("download")}>
            Download cue-map.json
          </button>
          <button type="button" onClick={() => void exportCueMap("copy")}>
            Copy
          </button>
        </div>
      </header>

      {unexported.length > 0 && (
        <div className="sd-banner" role="status">
          <strong>Not downloaded yet:</strong> {unexported.join(" and ")}. These changes live only in this browser. Download, then send
          the file to whoever commits it.
          {unexported.includes("ui-sound-map.json") && (
            <button type="button" onClick={() => void exportSoundMapFile()}>
              Download ui-sound-map.json
            </button>
          )}
        </div>
      )}
      {message && <p className="sd-message">{message}</p>}
      {!loaded && <p className="sd-dim">The sound engine is still loading; the lists below show the files as saved.</p>}
      {uiSound.muted && <p className="sd-dim">Sound is switched off in the app, so presses elsewhere are silent; ▶ here still plays.</p>}

      <section>
        <h2>The five sounds</h2>
        <div className="sd-cards">
          {FIVE.map((five) => (
            <FiveSoundCard key={five.id} {...five} map={map} />
          ))}
        </div>
      </section>

      <section>
        <h2>Every cue and the sound it plays</h2>
        <p className="sd-dim">
          A cue is one moment in the product that can make a sound. Pick one of the five sounds, a click from the UI pack, or no sound.
        </p>
        {KINDS.map((kind) => {
          const cues = map.cues.filter((cue) => cue.group === kind.name);
          if (!cues.length) return null;
          return (
            <div key={kind.name} className="sd-kind">
              <h3 style={{ borderColor: kind.colour }}>{kind.name}</h3>
              <table>
                <tbody>
                  {cues.map((cue) => (
                    <CueRow key={cue.id} cue={cue} map={map} />
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </section>

      <section>
        <h2>Rules the build keeps</h2>
        <ul className="sd-rules">
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <footer className="sd-row">
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Undo every sound change in this browser, including tags made on other pages?")) uiSoundDebug.restoreAll();
          }}
        >
          Undo all changes
        </button>
      </footer>
    </main>
  );
}
