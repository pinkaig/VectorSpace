/**
 * @file        AssetInventoryBoard.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Development-only board showing the Asset Manager's inventory.
 *              Open it at /#/asset-inventory on the dev server. It is not in the production build.
 *
 * @responsibility
 * Reads assetInventory() and nothing else, so what it shows is exactly what the
 * manager can account for — including the gaps. An asset the 3D engine loaded
 * but the manager never resolved shows a blank status; one the manager resolved
 * but the engine never loaded shows "no". Both are real and worth seeing.
 *
 * No project is loaded on this route, so the placements column is blank here;
 * assetInventory(project) fills it when a caller has one.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState } from "react";
import { assetInventory, type AssetInventoryRow } from "../content/assetInventory";
import "./assetInventoryBoard.css";

// The registry is written by loaders, not by React, so there is nothing to
// subscribe to — poll slowly enough to be free and fast enough to watch a load.
const REFRESH_MS = 1000;

const columns = [
  { key: "id", label: "Asset" },
  { key: "kind", label: "Kind" },
  { key: "source", label: "Source" },
  { key: "status", label: "Manager" },
  { key: "engine", label: "Engine" },
  { key: "loads", label: "Loads" },
  { key: "placements", label: "Placed" },
  { key: "used", label: "Last used" },
] as const;

const engineCell = (row: AssetInventoryRow): string => {
  if (!row.inEngine) return "no";
  if (row.engineState === "error") return `error — ${row.engineErrorMessage ?? "unknown"}`;
  return row.engineState ?? "yes";
};

const ago = (at: number | undefined): string => {
  if (at === undefined) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;
};

export default function AssetInventoryBoard() {
  const [rows, setRows] = useState<AssetInventoryRow[]>(() => assetInventory());

  useEffect(() => {
    const timer = window.setInterval(() => setRows(assetInventory()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const inEngine = rows.filter((row) => row.inEngine).length;
  const failed = rows.filter((row) => row.engineState === "error").length;

  return (
    <div className="asset-inventory-board">
      <h1>Asset inventory</h1>
      <p className="asset-inventory-note">
        {rows.length} assets accounted for · {inEngine} in the engine · {failed} failed to load.
        Refreshes every second. Placements need a loaded project, so they are blank on this route.
      </p>
      {rows.length === 0 && (
        <p className="asset-inventory-note">
          Nothing yet. Open the editor in another tab first — the catalog registers when it mounts.
        </p>
      )}
      <table className="asset-inventory-table">
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.engineState === "error" ? "asset-inventory-failed" : undefined}>
              <td title={row.url}>{row.id}</td>
              <td>{row.kind}</td>
              <td>{row.source}</td>
              <td>{row.status ?? "—"}</td>
              <td>{engineCell(row)}</td>
              <td>{row.engineLoadCount ?? "—"}</td>
              <td>{row.placements ?? "—"}</td>
              <td>{ago(row.lastAccessedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
