/**
 * @file        admin.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-19
 * @brief       What the VThere Admin pages ask for and what they get back: the types, and
 *              AdminApi, the list of calls the pages make.
 *
 * @responsibility
 * Names every field an admin page shows, and routes each call to whichever half can answer it.
 * Schools, accounts and the overview come from the API's /admin routes, built from the real
 * tables. Permission settings and the room/asset-pack switches have no tables behind them at
 * all, so they still come from adminFake.ts and their pages say on screen that nothing is
 * saved. NOT_STORED_YET is that sentence; use it rather than writing your own.
 *
 * @boundary
 * These types follow the database, not the mock-up. Three places where they differ, so nobody
 * is surprised:
 *   - a role is 'student' | 'teacher' | 'admin' (the database's words). The pages still *say*
 *     "Educator" for a teacher; that is a label, not a value.
 *   - classNames is a list, because class_members lets a person be in more than one class.
 *   - a published museum has no visit count and no access level, because nothing records either
 *     yet. When analytics and sharing arrive, add them to PublishedItem.
 *   - addAccount answers a CreatedAccount, not an Account: the create reply alone carries the
 *     new person's one-time password link, because Auth0 mints the ticket once and nothing
 *     stores it. listAccounts therefore cannot show it again, by design and not omission.
 * addSchool answers 501: an admin belongs to one school, and the operator role the mock-up's
 * "All schools" implies does not exist yet. See apps/api/app/routers/admin.py.
 *
 * @status
 * Current. Schools, accounts and overview are live; permissions and rooms are not.
 */

import { apiFetch, type GetToken } from "./client";
import { fakeAdminApi } from "./adminFake";

/** "all" is the top bar's All schools; any other value is a school id. */
export type SchoolFilter = string;
export const ALL_SCHOOLS: SchoolFilter = "all";

/** Shown on the pages whose settings have nowhere to be saved. */
export const NOT_STORED_YET =
  "Nothing on this page is saved yet: there is no table behind these settings, so changes are lost on reload.";

export type School = {
  id: string;
  name: string;
  students: number;
  educators: number;
  /** Worked out, not stored: a school with at least one teacher and one student is Active. */
  status: "active" | "setting_up";
};

export type Role = "student" | "teacher" | "admin";

export type Account = {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  role: Role;
  /** Every class this person is in; empty for an admin. */
  classNames: string[];
  /** ISO date-time of the last /me call; null until the person has signed in once. */
  lastActive: string | null;
  /** Turned off wins; otherwise Invited until the first sign-in, then Active. */
  status: "active" | "invited" | "turned_off";
};

export type NewAccount = Pick<Account, "schoolId" | "name" | "email" | "role" | "classNames">;

/**
 * What addAccount answers: the new account, plus the one-time password-set link Auth0 just
 * minted for it. Nothing emails that link, so this reply is the only chance to hand it over;
 * it is single-use and is never stored, so listAccounts cannot show it again. Null when there
 * is no link at all, which is every local run: the dev login stand-in has no tenant to mint one.
 */
export type CreatedAccount = Account & { inviteLink: string | null };

export type Tile = { value: number; sub: string };

export type AttentionItem = {
  id: string;
  text: string;
  actionLabel: string;
  /** Which admin page fixes it, or null when no page does. */
  goTo: "rooms" | "accounts" | null;
};

export type PublishedItem = {
  id: string;
  title: string;
  /** School, and the class when the project belongs to one. */
  where: string;
  publishedAt: string | null;
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
  addAccount: (account: NewAccount) => Promise<CreatedAccount>;
  setAccountOff: (accountId: string, off: boolean) => Promise<Account>;
  getPermissions: (schoolId: string) => Promise<PermissionRow[]>;
  savePermissions: (schoolId: string, rows: PermissionRow[]) => Promise<void>;
  getRooms: (schoolId: string) => Promise<Rooms>;
  setRoomEnabled: (schoolId: string, kind: "environment" | "pack", itemId: string, enabled: boolean) => Promise<void>;
};

// ---- what the API sends (snake_case) ------------------------------------------------------
type SchoolRow = { id: string; name: string; students: number; educators: number; status: School["status"] };
type AccountRow = {
  id: string;
  school_id: string;
  name: string;
  email: string;
  role: Role;
  class_names: string[];
  last_active: string | null;
  status: Account["status"];
};
type CreatedAccountRow = AccountRow & { invite_link: string | null };
type AttentionRow = { id: string; text: string; action_label: string; go_to: AttentionItem["goTo"] };
type PublishedRow = { id: string; title: string; where: string; published_at: string | null };
// GET /admin/schools/{school}/packs: every published pack and whether this school has it on
type SchoolPackRow = { id: string; slug: string; title: string; description: string | null; item_count: number; enabled: boolean };

type OverviewRow = {
  tiles: Overview["tiles"];
  schools: SchoolRow[];
  attention: AttentionRow[];
  recent: PublishedRow[];
};

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  schoolId: row.school_id,
  name: row.name,
  email: row.email,
  role: row.role,
  classNames: row.class_names,
  lastActive: row.last_active,
  status: row.status,
});

const toCreatedAccount = (row: CreatedAccountRow): CreatedAccount => ({
  ...toAccount(row),
  inviteLink: row.invite_link,
});

const toOverview = (row: OverviewRow): Overview => ({
  tiles: row.tiles,
  schools: row.schools,
  attention: row.attention.map((a) => ({ id: a.id, text: a.text, actionLabel: a.action_label, goTo: a.go_to })),
  recent: row.recent.map((p) => ({ id: p.id, title: p.title, where: p.where, publishedAt: p.published_at })),
});

const query = (school: SchoolFilter) => `?school=${encodeURIComponent(school)}`;

/**
 * The calls the pages use. Schools, accounts, the overview and asset packs go to the API;
 * permissions and room shells fall through to the in-memory fake, because no table holds them yet.
 */
export function createAdminApi(getToken: GetToken, base?: string): AdminApi {
  return {
    ...fakeAdminApi,

    listSchools: () => apiFetch<SchoolRow[]>(getToken, "/admin/schools", {}, base),

    addSchool: () => apiFetch<School>(getToken, "/admin/schools", { method: "POST", body: {} }, base),

    getOverview: async (school) =>
      toOverview(await apiFetch<OverviewRow>(getToken, `/admin/overview${query(school)}`, {}, base)),

    listAccounts: async (school) =>
      (await apiFetch<AccountRow[]>(getToken, `/admin/accounts${query(school)}`, {}, base)).map(toAccount),

    addAccount: async (account) =>
      toCreatedAccount(
        await apiFetch<CreatedAccountRow>(getToken, "/admin/accounts", {
          method: "POST",
          body: {
            school_id: account.schoolId,
            name: account.name,
            email: account.email,
            role: account.role,
            class_names: account.classNames,
          },
        }, base),
      ),

    // environments (room shells) are still the fake's; packs are pack_grants rows
    getRooms: async (schoolId) => {
      const [fake, packs] = await Promise.all([
        fakeAdminApi.getRooms(schoolId),
        apiFetch<SchoolPackRow[]>(getToken, `/admin/schools/${encodeURIComponent(schoolId)}/packs`, {}, base),
      ]);
      return {
        environments: fake.environments,
        packs: packs.map((p) => ({ id: p.id, name: p.title, description: p.description ?? "", enabled: p.enabled, itemCount: p.item_count })),
      };
    },

    setRoomEnabled: async (schoolId, kind, itemId, enabled) => {
      if (kind === "environment") return fakeAdminApi.setRoomEnabled(schoolId, kind, itemId, enabled);
      await apiFetch(getToken, `/admin/schools/${encodeURIComponent(schoolId)}/packs/${itemId}`, { method: "PATCH", body: { enabled } }, base);
    },

    setAccountOff: async (accountId, off) =>
      toAccount(
        await apiFetch<AccountRow>(getToken, `/admin/accounts/${accountId}`, {
          method: "PATCH",
          body: { active: !off },
        }, base),
      ),
  };
}
