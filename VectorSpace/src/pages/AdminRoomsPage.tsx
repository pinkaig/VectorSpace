/**
 * @file        AdminRoomsPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Admin Rooms & assets: which room shells and asset packs one school can use.
 *              Whatever is on here is what its teachers can add to a project. Needs a
 *              school picked in the top bar. The pack switches are stored (pack_grants);
 *              the environment switches are not yet. Packs are built on the Library page. The two lists are in
 *              src/sections/admin/rooms/. Below them, YouTube and image links
 *              for info cards (MediaLinksSection), which need no school picked:
 *              they are kept in this browser for now.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { Link } from "react-router";
import { useLoad } from "../api/useLoad";
import { Motion } from "../motion/useMotion";
import { LoadingRows } from "../ui/loadingRows";
import { useAdmin } from "../sections/admin/adminContext";
import { RoomListSection } from "../sections/admin/rooms/RoomListSection";
import { MediaLinksSection } from "../sections/admin/rooms/MediaLinksSection";
import "./AdminRoomsPage.css";
import { AdminPageTitle } from "../sections/admin/AdminPageTitle";

export default function AdminRoomsPage() {
  const { schools } = useAdmin();
  return (
    <>
      {/*TITLE*/}
      <AdminPageTitle title="Rooms & assets" subtitle="The room shells and asset packs teachers can use in a project. Every school gets the same set." scope="All schools" />

      {/*NOT SAVED: which room shells a school may use has no table behind it (see api/adminFake.ts)*/}
      {schools.length > 0 && (
        <p className="admin-notstored" role="note">Asset pack switches are saved. Environment switches are not: there is no table behind them yet, so they reset on reload.</p>
      )}

      {schools.length > 0
        ? <RoomsForAllSchools schoolIds={schools.map((s) => s.id)} />
        : <p className="admin-muted">Add a school on the Overview page first.</p>}

      {/*LINKS: YouTube videos and image links for info cards, with approval*/}
      <MediaLinksSection />
    </>
  );
}

// every school gets the same rooms and packs: shown from the first school, each switch saved to all of them
function RoomsForAllSchools({ schoolIds }: { schoolIds: string[] }) {
  const { api } = useAdmin();
  const { data, setData, error, loading } = useLoad(() => api.getRooms(schoolIds[0]), schoolIds.join());
  const [problem, setProblem] = useState<string | null>(null);

  // switches take effect at once: update the screen, then tell the API
  const setEnabled = async (kind: "environment" | "pack", itemId: string, enabled: boolean) => {
    const list = kind === "environment" ? "environments" : "packs";
    const flip = (on: boolean) =>
      setData((rooms) => rooms && { ...rooms, [list]: rooms[list].map((item) => (item.id === itemId ? { ...item, enabled: on } : item)) });
    flip(enabled);
    try {
      await Promise.all(schoolIds.map((id) => api.setRoomEnabled(id, kind, itemId, enabled)));
      setProblem(null);
    } catch (failure) {
      flip(!enabled); // the switch goes back, so the screen never shows a setting that was not saved
      setProblem(`Could not save that switch: ${failure instanceof Error ? failure.message : String(failure)}`);
    }
  };

  return (
    <>
      {error && <Motion as="p" cue="feedback.error" role="alert">Could not load rooms: {error}</Motion>}
      {problem && <Motion as="p" cue="feedback.error" role="alert">{problem}</Motion>}
      <LoadingRows loading={loading} />
      {data && (
        <Motion cue="panel.content.enter" className="admin-rooms">
          {/*ENVIRONMENTS: room shells, each on or off for this school*/}
          <RoomListSection
            title="Environments"
            note="Room shells teachers can start a project in."
            items={data.environments}
            onToggle={(id, enabled) => setEnabled("environment", id, enabled)}
            extra="upload"
          />

          {/*ASSET PACKS: themed sets of objects, sounds and videos*/}
          <RoomListSection
            title="Asset packs"
            note={data.packs.length
              ? "Published packs from the library. Switch one on and teachers in every school see it in their catalogue."
              : "No pack is published yet."}
            items={data.packs}
            onToggle={(id, enabled) => setEnabled("pack", id, enabled)}
          >
            <Link to="/admin/library">Build or publish a pack on the Library page</Link>
          </RoomListSection>
        </Motion>
      )}
    </>
  );
}
