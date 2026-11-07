/**
 * @file        AdminLibraryPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-11-06
 * @brief       Admin Library: the shared files every school's packs draw on, and the packs
 *              themselves. An admin uploads a model here, puts it in a pack, publishes the pack,
 *              then switches it on for a school on Rooms & assets. No terminal, no redeploy.
 *
 * @responsibility
 * Loads the library and the packs once and hands both to the two sections, so a file uploaded
 * in one shows up as addable in the other without a reload.
 *
 * @boundary
 * Platform-wide, like the API behind it: no school is picked for this page. The sections are in
 * src/sections/admin/library/. Calls are in src/api/library.ts.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useMemo } from "react";
import { createLibraryApi } from "../api/library";
import { useLoad } from "../api/useLoad";
import { Motion } from "../motion/useMotion";
import { useSession } from "../session/session";
import { LoadingRows } from "../ui/loadingRows";
import { LibraryFilesSection } from "../sections/admin/library/LibraryFilesSection";
import { PacksSection } from "../sections/admin/library/PacksSection";
import "./AdminLibraryPage.css";
import { AdminPageTitle } from "../sections/admin/AdminPageTitle";

export default function AdminLibraryPage() {
  const { getToken } = useSession();
  const api = useMemo(() => createLibraryApi(getToken), [getToken]);
  const files = useLoad(() => api.listLibrary(), "library");
  const packs = useLoad(() => api.listPacks(), "packs");

  return (
    <>
      {/*TITLE*/}
      <AdminPageTitle title="Library" subtitle="Upload models and media once; packs built from them can be switched on for any school." scope={"Shared by every school"} />

      {(files.error || packs.error) && (
        <Motion as="p" cue="feedback.error" role="alert">Could not load the library: {files.error ?? packs.error}</Motion>
      )}
      <LoadingRows loading={files.loading || packs.loading} />

      {files.data && packs.data && (
        <Motion cue="panel.content.enter" className="admin-library">
          {/*FILES: upload, rename, credit, delete*/}
          <LibraryFilesSection api={api} files={files.data} setFiles={files.setData} packs={packs.data} />
          {/*PACKS: group files, publish a manifest*/}
          <PacksSection api={api} files={files.data} packs={packs.data} setPacks={packs.setData} />
        </Motion>
      )}
    </>
  );
}
