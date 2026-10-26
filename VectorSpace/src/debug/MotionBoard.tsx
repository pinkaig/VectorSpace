/**
 * @file        MotionBoard.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Development-only board for tuning the app's motion live and exporting the result.
 *              Open it at /#/motion-board on the dev server. It is not in the production build.
 *
 * @responsibility
 * Shows every cue (and which are still undecided), lets you retune the shared tokens with
 * sliders, edit a recipe, point a cue at another recipe, replay it on a stage at any speed,
 * and copy the edited tables back into the repo. The app ships the data, never the editor.
 *
 * Everything here goes through the same `motion` bank the admin pages use, so what you tune
 * is what they play. The edits live in memory: reload the page and they are gone until pasted.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useReducer, useRef, useState } from "react";
import { motion, setPreviewReducedMotion } from "../motion/motion";
import type { DurationToken, MotionDef, MotionRecipe } from "../motion/types";
import { Button } from "../ui/button";
import { Toggle, TickBox } from "../ui/toggle";
import "./motionBoard.css";

// the sliders: one per token the board may retune (see src/styles/motion.css)
const TOKEN_SLIDERS = [
  { name: "--mo-dur-instant", label: "Instant (press, chip pulse)", min: 0, max: 600, step: 10, unit: "ms" },
  { name: "--mo-dur-fast", label: "Fast (hover, toggle, popup)", min: 0, max: 600, step: 10, unit: "ms" },
  { name: "--mo-dur-base", label: "Base (panel and page enter)", min: 0, max: 1000, step: 10, unit: "ms" },
  { name: "--mo-dur-slow", label: "Slow (whole region)", min: 0, max: 1500, step: 10, unit: "ms" },
  { name: "--mo-scale", label: "Amplitude (0 = fades only)", min: 0, max: 1.5, step: 0.05, unit: "" },
] as const;

const DURATION_TOKENS: DurationToken[] = ["instant", "fast", "base", "slow"];
// easing choices, including a spring baked into linear() (a list of sampled progress values)
const EASING_PRESETS = [
  "standard",
  "exit",
  "emphasis",
  "linear",
  "ease-in-out",
  "linear(0, 0.25, 0.7, 1.04, 1.01, 1)",
];
const SAMPLE_COUNT = 5;

const readToken = (name: string): number => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

export default function MotionBoard() {
  // the bank is not React state, so redraw whenever it says it was edited
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  useEffect(() => motion.onChange(redraw), []);

  const [cueId, setCueId] = useState("popup.enter");
  const [rate, setRate] = useState(1);
  const [reduced, setReduced] = useState(false);
  const [tokens, setTokens] = useState<Record<string, number>>(() => Object.fromEntries(TOKEN_SLIDERS.map((slider) => [slider.name, readToken(slider.name)])));
  const samples = useRef<Array<HTMLDivElement | null>>([]);
  const generation = useRef(0);

  const cues = motion.cueList();
  const recipes = motion.recipeList();
  const groups = [...new Set(cues.map((cue) => cue.group))];

  const play = (id: string) => {
    setCueId(id);
    const elements = samples.current.filter((el): el is HTMLDivElement => el !== null);
    const handles = elements.map((el, index) => motion.play(id, el, { staggerIndex: index }));
    // the handle has no speed control, so slow every running animation down directly
    for (const el of elements) for (const animation of el.getAnimations()) animation.updatePlaybackRate(rate);
    // an exit leaves its element invisible (fill "both"), so put the samples back a moment after the last one ends,
    // unless another play started in between
    const mine = ++generation.current;
    Promise.all(handles.map((handle) => handle.finished)).then(() => {
      setTimeout(() => {
        if (generation.current !== mine) return;
        for (const el of elements) for (const animation of el.getAnimations()) animation.cancel();
      }, 500);
    });
  };

  const setToken = (name: string, value: number, unit: string) => {
    document.documentElement.style.setProperty(name, `${value}${unit}`);
    setTokens((current) => ({ ...current, [name]: value }));
  };
  const resetTokens = () => {
    for (const slider of TOKEN_SLIDERS) document.documentElement.style.removeProperty(slider.name);
    setTokens(Object.fromEntries(TOKEN_SLIDERS.map((slider) => [slider.name, readToken(slider.name)])));
  };

  const problems = motion.problems();
  const placeholders = cues.filter((cue) => cue.placeholder);

  return (
    <main className="motion-board">
      <header>
        <h1>Motion board</h1>
        <p>
          Development only. Edits live in memory: copy the export at the bottom into <code>src/motion/recipes.ts</code> and{" "}
          <code>cues.ts</code> to keep them. {cues.length} cues, {placeholders.length} still undecided.
        </p>
      </header>

      <section className="motion-board-panel">
        <h2>Tokens</h2>
        <p className="motion-board-note">These write to the same CSS variables every hover, press and popup reads, so the whole app retunes as you drag.</p>
        {TOKEN_SLIDERS.map((slider) => (
          <label key={slider.name} className="motion-board-slider">
            <span>{slider.label}</span>
            <input type="range" min={slider.min} max={slider.max} step={slider.step} value={tokens[slider.name]} onChange={(event) => setToken(slider.name, Number(event.target.value), slider.unit)} />
            <output>{tokens[slider.name]}{slider.unit}</output>
          </label>
        ))}
        <button type="button" onClick={resetTokens}>Reset tokens</button>
      </section>

      <section className="motion-board-panel">
        <h2>Controls (hover, press and click them)</h2>
        <ControlsDemo />
      </section>

      <section className="motion-board-panel">
        <h2>Preview</h2>
        <div className="motion-board-controls">
          <strong>{cueId}</strong>
          <button type="button" onClick={() => play(cueId)}>Replay</button>
          <label>
            Speed {rate}x
            <input type="range" min={0.1} max={2} step={0.1} value={rate} onChange={(event) => setRate(Number(event.target.value))} />
          </label>
          <label>
            <input
              type="checkbox"
              checked={reduced}
              onChange={(event) => {
                setReduced(event.target.checked);
                setPreviewReducedMotion(event.target.checked);
              }}
            />
            Preview reduced motion
          </label>
        </div>
        <div className="motion-board-stage">
          {Array.from({ length: SAMPLE_COUNT }, (_, index) => (
            <div key={index} ref={(el) => { samples.current[index] = el; }} className="motion-board-sample">Sample {index + 1}</div>
          ))}
        </div>
      </section>

      <section className="motion-board-panel">
        <h2>Cues</h2>
        {problems.length > 0 && <ul className="motion-board-problems">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
        {groups.map((group) => (
          <div key={group}>
            <h3>{group}</h3>
            <table className="motion-board-table">
              <tbody>
                {cues.filter((cue) => cue.group === group).map((cue) => (
                  <CueRow key={cue.id} cue={cue} recipeIds={recipes.map(({ id }) => id)} selected={cue.id === cueId} onPlay={() => play(cue.id)} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <RecipeEditor recipeIds={recipes.map(({ id }) => id)} onChanged={() => play(cueId)} />

      <ExportPanel />
    </main>
  );
}

// the real shared controls, so the response layer (motion/response.css) and the control.* cues can be felt here
function ControlsDemo() {
  const [on, setOn] = useState(false);
  const [ticked, setTicked] = useState(false);
  return (
    <div className="motion-board-controls">
      <Button variant="primary">Primary</Button>
      <Button>Secondary</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="add">+ Add</Button>
      <Button disabled>Disabled</Button>
      <Toggle checked={on} onChange={setOn} label="Demo switch" />
      <Toggle checked label="Disabled switch" disabled onChange={() => undefined} />
      <TickBox checked={ticked} onChange={setTicked} label="Demo tick" />
    </div>
  );
}

function CueRow({ cue, recipeIds, selected, onPlay }: { cue: MotionDef; recipeIds: string[]; selected: boolean; onPlay: () => void }) {
  return (
    <tr className={selected ? "motion-board-selected" : undefined}>
      <td><code>{cue.id}</code><div className="motion-board-note">{cue.label}</div></td>
      <td>Tier {cue.tier}</td>
      <td>
        <select value={cue.placeholder ? "" : cue.recipe} onChange={(event) => motion.retarget(cue.id, event.target.value)} aria-label={`Recipe for ${cue.id}`}>
          {cue.placeholder && <option value="">(undecided)</option>}
          {recipeIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        {cue.placeholder && <span className="motion-board-badge">undecided</span>}
      </td>
      <td><button type="button" onClick={onPlay} disabled={cue.placeholder}>Play</button></td>
    </tr>
  );
}

function RecipeEditor({ recipeIds, onChanged }: { recipeIds: string[]; onChanged: () => void }) {
  const [recipeId, setRecipeId] = useState(recipeIds[0]);
  const [durationText, setDurationText] = useState("");
  const [easing, setEasing] = useState("");
  const [reducedMotion, setReducedMotion] = useState<NonNullable<MotionRecipe["reducedMotion"]>>("fade");
  const [keyframesText, setKeyframesText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  // load the chosen recipe into the form
  useEffect(() => {
    const recipe = motion.getRecipe(recipeId);
    if (!recipe) return;
    setDurationText(String(recipe.duration));
    setEasing(recipe.easing);
    setReducedMotion(recipe.reducedMotion ?? "fade");
    setKeyframesText(JSON.stringify(recipe.keyframes, null, 2));
    setProblem(null);
  }, [recipeId]);

  const apply = () => {
    let keyframes: Keyframe[];
    try {
      const parsed: unknown = JSON.parse(keyframesText);
      if (!Array.isArray(parsed) || parsed.some((frame) => typeof frame !== "object" || frame === null)) throw new Error("Keyframes must be a list of objects.");
      keyframes = parsed as Keyframe[];
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Keyframes are not valid JSON.");
      return;
    }
    // a token name stays a token, so the sliders keep working on it; a number is milliseconds
    const duration = DURATION_TOKENS.includes(durationText as DurationToken) ? (durationText as DurationToken) : Number(durationText);
    if (typeof duration === "number" && !Number.isFinite(duration)) {
      setProblem("Duration must be instant, fast, base, slow or a number of milliseconds.");
      return;
    }
    setProblem(null);
    motion.updateRecipe(recipeId, { keyframes, duration, easing, reducedMotion });
    onChanged();
  };

  return (
    <section className="motion-board-panel">
      <h2>Recipe</h2>
      <label className="motion-board-field">
        Recipe
        <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
          {recipeIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <label className="motion-board-field">
        Duration (instant, fast, base, slow, or milliseconds)
        <input value={durationText} onChange={(event) => setDurationText(event.target.value)} list="motion-board-durations" />
        <datalist id="motion-board-durations">{DURATION_TOKENS.map((token) => <option key={token} value={token} />)}</datalist>
      </label>
      <label className="motion-board-field">
        Easing (a token, any CSS easing, or a linear() spring)
        <input value={easing} onChange={(event) => setEasing(event.target.value)} list="motion-board-easings" />
        <datalist id="motion-board-easings">{EASING_PRESETS.map((preset) => <option key={preset} value={preset} />)}</datalist>
      </label>
      <label className="motion-board-field">
        For visitors who asked for less motion
        <select value={reducedMotion} onChange={(event) => setReducedMotion(event.target.value as typeof reducedMotion)}>
          <option value="fade">fade (keep opacity only)</option>
          <option value="skip">skip (play nothing)</option>
          <option value="full">full (ignore the setting)</option>
        </select>
      </label>
      <label className="motion-board-field">
        Keyframes (JSON; animate transform and opacity only)
        <textarea rows={9} value={keyframesText} onChange={(event) => setKeyframesText(event.target.value)} spellCheck={false} />
      </label>
      {problem && <p className="motion-board-problems" role="alert">{problem}</p>}
      <button type="button" onClick={apply}>Apply and replay</button>
    </section>
  );
}

function ExportPanel() {
  const map = motion.toJSON();
  const text = [
    "// src/motion/recipes.ts",
    `export const RECIPES: Record<string, MotionRecipe> = ${JSON.stringify(map.recipes, null, 2)};`,
    "",
    "// src/motion/cues.ts",
    `export const CUES: MotionDef[] = ${JSON.stringify(map.cues, null, 2)};`,
  ].join("\n");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard blocked: the text below can still be selected by hand
    }
  };
  return (
    <section className="motion-board-panel">
      <h2>Export</h2>
      <p className="motion-board-note">
        Paste over the two tables. recipes.ts builds its distances from small helper functions; the export holds the resulting calc() strings, which behave the same.
      </p>
      <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      <textarea className="motion-board-export" readOnly rows={14} value={text} aria-label="Exported motion tables" />
    </section>
  );
}
