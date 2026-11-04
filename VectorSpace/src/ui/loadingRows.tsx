/**
 * @file        loadingRows.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       A skeleton for a panel whose data is on its way: a few grey bars, shown only if the wait is noticeable.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState } from "react";
import { Motion } from "../motion/useMotion";
import "./loadingRows.css";

// An answer faster than this should show nothing at all: a skeleton that flashes for 80 ms is
// worse than a blank that fills in. 200 ms is about where a pause starts to be noticed.
const NOTICEABLE_MS = 200;

/** True once `on` has stayed true for `ms`; false again the moment it turns false. */
export function useDelayedFlag(on: boolean, ms: number): boolean {
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    if (!on) {
      setFlag(false);
      return;
    }
    const timer = setTimeout(() => setFlag(true), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);
  return flag;
}

type LoadingRowsProps = { loading: boolean; rows?: number };

export function LoadingRows({ loading, rows = 4 }: LoadingRowsProps) {
  const visible = useDelayedFlag(loading, NOTICEABLE_MS);
  if (!visible) return null;
  return (
    <Motion cue="panel.content.enter" className="ui-loading" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="ui-loading-bar" />
      ))}
    </Motion>
  );
}
