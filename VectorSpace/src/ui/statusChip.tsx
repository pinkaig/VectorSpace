/**
 * @file        statusChip.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       A small rounded label such as Active, Invited or Student. The colour says the kind
 *              of status: green = on/done, amber = waiting, purple = a role, grey = off, red = problem.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { ReactNode } from "react";
import "./statusChip.css";

export type ChipTone = "green" | "amber" | "purple" | "grey" | "red";

export function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={`ui-chip ui-chip-${tone}`}>{children}</span>;
}
