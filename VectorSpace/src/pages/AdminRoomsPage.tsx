/**
 * @file        AdminRoomsPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Admin Rooms & assets: which room shells and asset packs one school can use.
 *              Whatever is on here is what its teachers can add to a project. Needs a
 *              school picked in the top bar. The two lists are in
 *              src/sections/admin/rooms/.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useLoad } from "../api/useLoad";
import { Motion } from "../motion/useMotion";
import { NOT_STORED_YET } from "../api/admin";
import { LoadingRows } from "../ui/loadingRows";
import { useAdmin } from "../sections/admin/adminContext";
import { RoomListSection } from "../sections/admin/rooms/RoomListSection";
import { PickSchoolNotice } from "../sections/admin/PickSchoolNotice";
import "./AdminRoomsPage.css";

export default function AdminRoomsPage() {
  const { school } = useAdmin();
  return (
    <>
      {/*TITLE*/}
      <div className="admin-page-title">
        <h1>Rooms &amp; assets</h1>
        <p>{school ? school.name : "All schools"}</p>
      </div>

      {/*NOT SAVED: which rooms a school may use has no table behind it (see api/adminFake.ts)*/}
      <p className="admin-notstored" role="note">{NOT_STORED_YET}</p>

      {school ? <RoomsForSchool key={school.id} schoolId={school.id} /> : <PickSchoolNotice what="Rooms and asset packs" />}
    </>
  );
}

// split out so the data is only fetched once a school is picked
function RoomsForSchool({ schoolId }: { schoolId: string }) {
  const { api } = useAdmin();
  const { data, setData, error, loading } = useLoad(() => api.getRooms(schoolId), schoolId);

  // switches take effect at once: update the screen, then tell the API
  const setEnabled = async (kind: "environment" | "pack", itemId: string, enabled: boolean) => {
    const list = kind === "environment" ? "environments" : "packs";
    setData((rooms) => rooms && { ...rooms, [list]: rooms[list].map((item) => (item.id === itemId ? { ...item, enabled } : item)) });
    await api.setRoomEnabled(schoolId, kind, itemId, enabled);
  };

  return (
    <>
      {error && <p role="alert">Could not load rooms: {error}</p>}
      <LoadingRows loading={loading} />
      {data && (
        <Motion cue="panel.content.enter" className="admin-rooms">
          {/*ENVIRONMENTS: room shells, each on or off for this school*/}
          <RoomListSection
            title="Environments"
            note="Room shells teachers can start a museum in."
            items={data.environments}
            onToggle={(id, enabled) => setEnabled("environment", id, enabled)}
            extra="upload"
          />

          {/*ASSET PACKS: themed sets of objects, sounds and videos*/}
          <RoomListSection
            title="Asset packs"
            note="Themed sets of objects, sounds and videos. Museum basics is on for every school."
            items={data.packs}
            onToggle={(id, enabled) => setEnabled("pack", id, enabled)}
          />
        </Motion>
      )}
    </>
  );
}
