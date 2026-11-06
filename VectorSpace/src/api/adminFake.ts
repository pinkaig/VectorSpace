/**
 * @file        adminFake.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-19
 * @brief       What the admin pages show that has no database behind it yet: which room
 *              shells a school may use. Held in memory, so a switch moves until the page is
 *              reloaded. Asset packs (pack_grants) and permission settings (school_permissions)
 *              are real now, through admin.ts, so this only answers for environments.
 *
 * @responsibility
 * Gives AdminRoomsPage's environment switches something to render and something to change.
 * The schools, accounts and overview that used to live here are gone: they are real calls now,
 * in admin.ts. What is left is only what no table can answer.
 *
 * @boundary
 * Nothing here is stored anywhere. The Rooms page says so above the switches, so no one
 * mistakes a switch that moved for a setting that was saved. Making it real means room shells
 * as an "environments" pack, switched on per school like the other packs. Delete this file on
 * that day.
 *
 * @status
 * Placeholder. The only part of the admin area that is not wired to the database.
 */

import type { AdminApi, Rooms } from "./admin";

// [id, name, description]
const ENVIRONMENTS: [string, string, string][] = [
  ["museum-hall", "Museum hall", "A tall gallery with spotlights"],
  ["classroom", "Classroom", "Desks, a board and a window"],
  ["riverside-dock", "Riverside dock", "A wooden pier over water"],
  ["ancient-temple", "Ancient temple", "Stone columns and torchlight"],
];

const DEFAULT_ON = ["museum-hall", "classroom"];

// what has been changed this page load, per school id; a school not in here gets the defaults
const switchedOn = new Map<string, Set<string>>();

const onFor = (schoolId: string): Set<string> => {
  if (!switchedOn.has(schoolId)) switchedOn.set(schoolId, new Set(DEFAULT_ON));
  return switchedOn.get(schoolId)!;
};

/** The calls with no database behind them. admin.ts puts the real ones on top of these. */
export const fakeAdminApi: Pick<AdminApi, "getRooms" | "setRoomEnabled"> = {
  async getRooms(schoolId): Promise<Rooms> {
    const on = onFor(schoolId);
    return {
      environments: ENVIRONMENTS.map(([id, name, description]) => ({ id, name, description, enabled: on.has(id) })),
      packs: [], // real now: admin.ts asks /admin/schools/{school}/packs
    };
  },

  async setRoomEnabled(schoolId, _kind, itemId, enabled) {
    const on = onFor(schoolId);
    if (enabled) on.add(itemId);
    else on.delete(itemId);
  },
};
