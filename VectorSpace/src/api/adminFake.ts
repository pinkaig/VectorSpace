/**
 * @file        adminFake.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-19
 * @brief       The two admin pages that have no database behind them: the per-role permission
 *              settings, and which room shells and asset packs a school may use. Held in
 *              memory, so a switch moves and a Save works until the page is reloaded.
 *
 * @responsibility
 * Gives AdminPermissionsPage and AdminRoomsPage something to render and something to change.
 * The schools, accounts and overview that used to live here are gone: they are real calls now,
 * in admin.ts. What is left is only what no table can answer.
 *
 * @boundary
 * Nothing here is stored anywhere. Both pages show admin.ts's NOT_STORED_YET above the
 * settings so no one mistakes a switch that moved for a setting that was saved. Making these
 * real needs tables first -- roughly school_settings(school_id, key, students, educators,
 * can_adjust) and school_assets(school_id, asset_id, enabled) -- and then /admin routes like
 * the ones beside them. Delete this file on that day.
 *
 * @status
 * Placeholder. The only part of the admin area that is not wired to the database.
 */

import type { AdminApi, PermissionRow, Rooms } from "./admin";

const DEFAULT_PERMISSIONS: PermissionRow[] = [
  { key: "more-rooms", group: "Building", label: "Add more rooms (up to 5 per project)", students: true, educators: true, canAdjust: false },
  { key: "publish-no-approval", group: "Sharing", label: "Publish without approval", students: false, educators: true, canAdjust: false },
  { key: "public-links", group: "Sharing", label: "Public links", students: false, educators: true, canAdjust: true },
  { key: "unlisted-links", group: "Sharing", label: "Unlisted links", students: true, educators: true, canAdjust: true },
  { key: "signin-links", group: "Sharing", label: "Sign-in only links", students: true, educators: true, canAdjust: false },
  { key: "from-templates", group: "Projects and data", label: "Set up projects from templates", students: false, educators: true, canAdjust: false },
  { key: "edit-after-assign", group: "Projects and data", label: "Edit a project after assigning", students: false, educators: true, canAdjust: true },
  { key: "see-results", group: "Projects and data", label: "See visitor results", students: false, educators: false, canAdjust: false },
  { key: "delete-published", group: "Projects and data", label: "Delete published projects", students: false, educators: false, canAdjust: false },
];

// [id, name, description]
const ENVIRONMENTS: [string, string, string][] = [
  ["museum-hall", "Museum hall", "A tall gallery with spotlights"],
  ["classroom", "Classroom", "Desks, a board and a window"],
  ["riverside-dock", "Riverside dock", "A wooden pier over water"],
  ["ancient-temple", "Ancient temple", "Stone columns and torchlight"],
];

// [id, name, description, item count]; museum-basics is on for every school and cannot be switched off
const PACKS: [string, string, string, number][] = [
  ["museum-basics", "Museum basics", "Plinths, frames, signs and lights", 24],
  ["dinosaurs", "Dinosaurs", "Skeletons, models and roars", 18],
  ["ancient-egypt", "Ancient Egypt", "Statues, hieroglyph walls, a sarcophagus", 22],
  ["outer-space", "Outer space", "Planets, rockets and a starfield", 20],
  ["ancient-rome", "Ancient Rome", "Columns, busts and a mosaic floor", 16],
];

const DEFAULT_ON = ["museum-hall", "classroom", "museum-basics", "dinosaurs", "ancient-rome"];

// what has been changed this page load, per school id; a school not in here gets the defaults
const permissions = new Map<string, PermissionRow[]>();
const switchedOn = new Map<string, Set<string>>();

const onFor = (schoolId: string): Set<string> => {
  if (!switchedOn.has(schoolId)) switchedOn.set(schoolId, new Set(DEFAULT_ON));
  return switchedOn.get(schoolId)!;
};

/** The calls with no database behind them. admin.ts puts the real ones on top of these. */
export const fakeAdminApi: Pick<AdminApi, "getPermissions" | "savePermissions" | "getRooms" | "setRoomEnabled"> = {
  async getPermissions(schoolId) {
    if (!permissions.has(schoolId)) permissions.set(schoolId, DEFAULT_PERMISSIONS.map((row) => ({ ...row })));
    return permissions.get(schoolId)!.map((row) => ({ ...row }));
  },

  async savePermissions(schoolId, rows) {
    permissions.set(schoolId, rows.map((row) => ({ ...row })));
  },

  async getRooms(schoolId): Promise<Rooms> {
    const on = onFor(schoolId);
    return {
      environments: ENVIRONMENTS.map(([id, name, description]) => ({ id, name, description, enabled: on.has(id) })),
      packs: PACKS.map(([id, name, description, itemCount]) => ({
        id, name, description, itemCount,
        enabled: id === "museum-basics" || on.has(id),
        locked: id === "museum-basics",
      })),
    };
  },

  async setRoomEnabled(schoolId, _kind, itemId, enabled) {
    const on = onFor(schoolId);
    if (enabled) on.add(itemId);
    else on.delete(itemId);
  },
};
