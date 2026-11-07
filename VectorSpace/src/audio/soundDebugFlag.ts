/**
 * @file        soundDebugFlag.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Whether the sound debug panel is on in this browser.
 *
 * @responsibility
 * Kept apart from SoundDebugPanel.tsx so App.tsx can ask without downloading the panel.
 * Only in `npm run dev`, or in a build made with VITE_SOUND_DEBUG=true (off on the deployed site).
 * There, it is on only while the address carries ?sounddebug: /?sounddebug#/login and
 * /#/login?sounddebug both work. It is NOT remembered: an ordinary visit never shows the panel, so a
 * page opened once for sound work cannot leave it over every later page. (It used to be kept in
 * localStorage; that saved value is cleared on the next visit.) The hash routes keep the ?sounddebug
 * before the # as you move around, so the designer's /?sounddebug#/sound-design link still works.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

// the key the old, remembered switch used; only read now to delete it
const OLD_DEBUG_KEY = "vectorspace.soundDebug";

/** Whether this build may show the panel at all: dev, or a build that opted in. */
const ALLOWED = import.meta.env.DEV || import.meta.env.VITE_SOUND_DEBUG === "true";

export function isSoundDebugOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.removeItem(OLD_DEBUG_KEY);
  } catch {
    // storage blocked (private window): nothing was remembered there anyway
  }
  if (!ALLOWED) return false;
  const query = `${window.location.search}&${window.location.hash.split("?")[1] ?? ""}`;
  const match = /[?&]sounddebug(=([^&]*))?/.exec(query);
  return match !== null && match[2] !== "off" && match[2] !== "0";
}
