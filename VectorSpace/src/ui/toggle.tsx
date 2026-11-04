/**
 * @file        toggle.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       An on/off switch and a tick box, both always shown with a text label (manual rule:
 *              colour alone never says on or off).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { uiSound } from "../audio";
import { useMotionOnChange } from "../motion/useMotion";
import "./toggle.css";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  // what the switch controls, for screen readers; also shown as "On" / "Off" next to it
  label: string;
  disabled?: boolean;
  // replaces the "On" / "Off" text, e.g. "Always on" for something that cannot be turned off
  text?: string;
};

export function Toggle({ checked, onChange, label, disabled = false, text }: ToggleProps) {
  // pulses the track when the value changes, whether the click or the parent caused it
  const trackRef = useMotionOnChange<HTMLButtonElement>("control.toggle.change", String(checked));
  return (
    <span className="ui-toggle-wrap">
      <button
        ref={trackRef}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`ui-toggle ${checked ? "ui-toggle-on" : ""}`}
        onClick={() => {
          // only a press sounds; a value the parent changes stays silent (the pulse above still shows it)
          uiSound.press(checked ? "ui.toggle.off" : "ui.toggle.on");
          onChange(!checked);
        }}
      >
        <span className="ui-toggle-knob" />
      </button>
      <span className="ui-toggle-text">{text ?? (checked ? "On" : "Off")}</span>
    </span>
  );
}

type TickBoxProps = { checked: boolean; onChange: (next: boolean) => void; label: string };

// a real checkbox underneath (keyboard and screen readers work for free), drawn as the manual's 26px box
export function TickBox({ checked, onChange, label }: TickBoxProps) {
  const ref = useMotionOnChange<HTMLInputElement>("control.tick.change", String(checked));
  return (
    <input
      ref={ref}
      type="checkbox"
      className="ui-tick"
      checked={checked}
      aria-label={label}
      onChange={(event) => {
        uiSound.press(event.target.checked ? "ui.toggle.on" : "ui.toggle.off");
        onChange(event.target.checked);
      }}
    />
  );
}
