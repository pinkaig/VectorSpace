/**
 * @file        soundDebugFlag.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Whether the sound debug panel is on in this browser.
 *
 * @responsibility
 * Kept apart from SoundDebugPanel.tsx so App.tsx can ask without downloading the panel.
 * Only in `npm run dev`, or in a build made with VITE_SOUND_DEBUG=true (off on the deployed site).
 * There, add ?sounddebug to the address to turn it on (remembered in this browser), ?sounddebug=off to
 * turn it off. Either the address or the hash route may carry it: /?sounddebug#/login and
 * /#/login?sounddebug both work.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

const DEBUG_KEY = "vectorspace.soundDebug";

/** Whether this build may show the panel at all: dev, or a build that opted in. */
const ALLOWED = import.meta.env.DEV || import.meta.env.VITE_SOUND_DEBUG === "true";

export function isSoundDebugOn(): boolean {
  if (!ALLOWED || typeof window === "undefined") return false;
  try {
    const query = `${window.location.search}&${window.location.hash.split("?")[1] ?? ""}`;
    const match = /[?&]sounddebug(=([^&]*))?/.exec(query);
    if (match) localStorage.setItem(DEBUG_KEY, match[2] === "off" || match[2] === "0" ? "off" : "on");
    return localStorage.getItem(DEBUG_KEY) === "on";
  } catch {
    return false;
  }
}
