/**
 * @file        admin.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       What the VThere Admin pages ask for and what they get back: the types, and
 *              AdminApi, the list of calls the pages make. Returns fake data for now (see
 *              adminFake.ts); will call the backend's /admin routes once they exist, with the
 *              same types, so the pages do not change.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { fakeAdminApi } from "./adminFake";

/** "all" is the top bar's All schools; any other value is a school id. */
export type SchoolFilter = string;
export const ALL_SCHOOLS: SchoolFilter = "all";

export type School = {
  id: string;
  name: string;
  status: "active" | "setting_up";
  students: number;
  educators: number;
};

export type Account = {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  role: "student" | "educator";
  className: string | null;
  /** ISO date-time of the last sign-in; null until the person has signed in once. */
  lastActive: string | null;
  /** Turned off wins; otherwise Invited until the first sign-in, then Active. */
  status: "active" | "invited" | "turned_off";
};

export type NewAccount = Pick<Account, "schoolId" | "name" | "email" | "role" | "className">;

export type Tile = { value: number; sub: string };

export type AttentionItem = {
  id: string;
  text: string;
  actionLabel: string;
  /** Which admin page fixes it, or null when that page is not built yet. */
  goTo: "rooms" | null;
};

export type PublishedItem = {
  id: string;
  title: string;
  where: string;
  visits: number;
  access: "public" | "unlisted" | "sign_in";
};

export type Overview = {
  tiles: { schools: Tile; educators: Tile; students: Tile; published: Tile };
  schools: School[];
  attention: AttentionItem[];
  recent: PublishedItem[];
};

export type PermissionRow = {
  key: string;
  group: "Building" | "Sharing" | "Projects and data";
  label: string;
  students: boolean;
  educators: boolean;
  /** When true, educators may change this setting for their own classes. */
  canAdjust: boolean;
};

export type RoomItem = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** Always on and cannot be switched off (Museum basics). */
  locked?: boolean;
  /** Packs only: how many objects, sounds and videos it holds. */
  itemCount?: number;
};

export type Rooms = { environments: RoomItem[]; packs: RoomItem[] };

/** Every call an admin page makes. Where a call takes a SchoolFilter, ALL_SCHOOLS means every school. */
export type AdminApi = {
  listSchools: () => Promise<School[]>;
  addSchool: (name: string) => Promise<School>;
  getOverview: (school: SchoolFilter) => Promise<Overview>;
  listAccounts: (school: SchoolFilter) => Promise<Account[]>;
  addAccount: (account: NewAccount) => Promise<Account>;
  setAccountOff: (accountId: string, off: boolean) => Promise<Account>;
  getPermissions: (schoolId: string) => Promise<PermissionRow[]>;
  savePermissions: (schoolId: string, rows: PermissionRow[]) => Promise<void>;
  getRooms: (schoolId: string) => Promise<Rooms>;
  setRoomEnabled: (schoolId: string, kind: "environment" | "pack", itemId: string, enabled: boolean) => Promise<void>;
};

/** The calls the pages use. Fake data until the backend is ready. */
export function createAdminApi(): AdminApi {
  return fakeAdminApi;
}
