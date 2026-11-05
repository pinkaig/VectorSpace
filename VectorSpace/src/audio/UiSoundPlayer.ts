/**
 * @file        UiSoundPlayer.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Decides which ONE sound a gesture makes, and whether sound is on at all.
 *
 * @responsibility
 * The masterlist rule "one sound per action", as code. A press is not played the moment it
 * happens: it waits for the end of the current task. If anything the press caused asks for a
 * sound in that time (a dialog opening, a dialog closing), that sound plays instead and the
 * click is dropped. So a Cancel button sounds like a close, not like a click and a close.
 *
 *  - press(cue): a control was pressed. The weakest claim; anything else in the same task wins.
 *  - play(cue):  something happened. Replaces a waiting press, and an earlier play in the same
 *                task (so React's StrictMode rehearsal, open-close-open, still makes one sound).
 *
 * Knows nothing about audio files or AudioSystem: it hands the winning cue id to a sink. That
 * keeps it testable with a fake clock and keeps the real wiring in uiSound.ts.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

/** A cue id from cue-map.json; null or undefined means "make no sound". */
export type UiCue = string | null | undefined;

export type UiSoundPlayerOptions = {
  muted?: boolean;
  // when a waiting sound is played; the default is the end of the current task
  schedule?: (flush: () => void) => void;
  // told what happened to each request, for the sound debug panel
  trace?: (cueId: string, step: string, ok: boolean) => void;
};

type Pending = { cueId: string; outcome: boolean };

export class UiSoundPlayer {
  private pending: Pending | null = null;
  private isMuted: boolean;
  private readonly schedule: (flush: () => void) => void;
  private readonly listeners = new Set<() => void>();
  private readonly trace: (cueId: string, step: string, ok: boolean) => void;

  constructor(private readonly sink: (cueId: string) => void, options: UiSoundPlayerOptions = {}) {
    this.isMuted = options.muted ?? false;
    this.schedule = options.schedule ?? ((flush) => setTimeout(flush, 0));
    this.trace = options.trace ?? (() => {});
  }

  /** A control was pressed. Plays at the end of the task unless something it caused plays instead. */
  press(cueId: UiCue, why?: string): void {
    this.request(cueId, false, why);
  }

  /** Something happened. Takes the place of any press, or earlier play, waiting in the same task. */
  play(cueId: UiCue): void {
    this.request(cueId, true);
  }

  get muted(): boolean {
    return this.isMuted;
  }

  setMuted(muted: boolean): void {
    if (muted === this.isMuted) return;
    this.isMuted = muted;
    // a sound already waiting when the person mutes must not still come out
    if (muted) this.pending = null;
    for (const listener of [...this.listeners]) listener();
  }

  /** Fires when muted changes. Returns the unsubscribe, so it fits useSyncExternalStore. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private request(cueId: UiCue, outcome: boolean, why?: string): void {
    if (!cueId) return;
    const kind = why ? `${outcome ? "play" : "press"} (${why})` : outcome ? "play" : "press";
    if (this.isMuted) {
      this.trace(cueId, `${kind}: dropped, UI sound is muted`, false);
      return;
    }
    const waiting = this.pending;
    if (waiting) {
      // a press never displaces an outcome; everything else replaces what was waiting
      if (waiting.outcome && !outcome) {
        this.trace(cueId, `${kind}: dropped, ${waiting.cueId} plays instead`, true);
        return;
      }
      this.trace(waiting.cueId, `replaced by ${kind} ${cueId}`, true);
      this.pending = { cueId, outcome };
      return;
    }
    this.trace(cueId, kind, true);
    this.pending = { cueId, outcome };
    this.schedule(() => this.flush());
  }

  private flush(): void {
    const waiting = this.pending;
    this.pending = null;
    if (waiting && !this.isMuted) this.sink(waiting.cueId);
  }
}
