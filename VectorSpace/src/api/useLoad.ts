/**
 * @file        useLoad.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       useLoad: the small helper a page uses to fetch what it shows when it opens.
 *              Written for the admin pages; any page (teacher, student) can use it.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState } from "react";

/**
 * Runs `load` when the page opens and again whenever `reloadKey` changes (for example the
 * picked school), and returns what came back. `data` is null while loading; setData lets a
 * page update what it shows after a change without asking the API again, and reload() asks
 * again on purpose (after adding something the page cannot patch in by itself).
 */
export function useLoad<T>(load: () => Promise<T>, reloadKey: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    let current = true; // false once the page moved on, so a slow answer is not shown late
    setData(null);
    setError(null);
    load().then(
      (value) => current && setData(value),
      (problem: Error) => current && setError(problem.message),
    );
    return () => {
      current = false;
    };
    // `load` is a new function on every render; reloadKey is what says "ask again"
  }, [reloadKey, again]);

  return { data, setData, error, reload: () => setAgain((count) => count + 1) };
}
