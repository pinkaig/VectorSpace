/**
 * @file        AdminOverviewPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Admin Overview: four numbers, the schools table, what needs attention and
 *              what was published recently, for all schools or the one picked in the top bar.
 *              The parts live in src/sections/admin/overview/.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useLoad } from "../api/useLoad";
import { Motion } from "../motion/useMotion";
import { LoadingRows } from "../ui/loadingRows";
import { useAdmin } from "../sections/admin/adminContext";
import { StatTilesSection } from "../sections/admin/overview/StatTilesSection";
import { SchoolsSection } from "../sections/admin/overview/SchoolsSection";
import { NeedsAttentionSection } from "../sections/admin/overview/NeedsAttentionSection";
import { RecentlyPublishedSection } from "../sections/admin/overview/RecentlyPublishedSection";
import "./AdminOverviewPage.css";

export default function AdminOverviewPage() {
  const { api, school, schoolId, refreshSchools } = useAdmin();
  // asks the API again whenever the School picker changes
  const { data, error, loading, reload } = useLoad(() => api.getOverview(schoolId), schoolId);

  // a new school changes both the picker's list and this page's numbers
  const onSchoolAdded = async () => {
    await refreshSchools();
    reload();
  };

  return (
    <>
      {/*TITLE*/}
      <div className="admin-page-title">
        <h1>Overview</h1>
        <p>{school ? school.name : "All schools"}</p>
      </div>

      {error && <p role="alert">Could not load the overview: {error}</p>}
      <LoadingRows loading={loading} />
      {data && (
        <Motion cue="panel.content.enter" className="admin-overview">
          {/*TILES: Schools, Educators, Students, Published*/}
          <StatTilesSection tiles={data.tiles} />

          {/*SCHOOLS: name, students, educators, status, + Add a school*/}
          <SchoolsSection schools={data.schools} onAdded={onSchoolAdded} />

          {/*NEEDS YOUR ATTENTION: one action button each*/}
          <NeedsAttentionSection items={data.attention} />

          {/*RECENTLY PUBLISHED: title, where, visits, access level*/}
          <RecentlyPublishedSection items={data.recent} />
        </Motion>
      )}
    </>
  );
}
