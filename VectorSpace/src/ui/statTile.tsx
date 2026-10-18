/**
 * @file        statTile.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       One number with a label and a short sub-line, e.g. Schools / 3 / 2 active this week.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import "./statTile.css";

type StatTileProps = { label: string; value: number | string; sub: string };

export function StatTile({ label, value, sub }: StatTileProps) {
  return (
    <div className="ui-stat">
      <div className="ui-stat-label">{label}</div>
      <div className="ui-stat-value">{value}</div>
      <div className="ui-stat-sub">{sub}</div>
    </div>
  );
}
