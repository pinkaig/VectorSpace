/**
 * @file        StatTilesSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Overview section: the four numbers across the top.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { Overview } from "../../../api/admin";
import { StatTile } from "../../../ui/statTile";

export function StatTilesSection({ tiles }: { tiles: Overview["tiles"] }) {
  return (
    <section className="admin-panel admin-overview-tiles" aria-label="Totals">
      <StatTile label="Schools" value={tiles.schools.value} sub={tiles.schools.sub} />
      <StatTile label="Educators" value={tiles.educators.value} sub={tiles.educators.sub} />
      <StatTile label="Students" value={tiles.students.value} sub={tiles.students.sub} />
      <StatTile label="Published" value={tiles.published.value} sub={tiles.published.sub} />
    </section>
  );
}
