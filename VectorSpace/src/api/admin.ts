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
 * Schools, accounts, the overview, asset packs and permission settings come from the API's
 * /admin routes, built from the real tables. Only the room-shell (environment) switches have no
 * table behind them, so they still come from adminFake.ts and the Rooms page says on screen
 * that they are not saved.
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
 * An admin is VThere staff and works on every school (D-A, 6 Nov): All schools is every school, and
 * addSchool creates a real, empty one. See apps/api/app/routers/admin.py.
 *
 * @status
 * Current. Everything is live except the environment switches on the Rooms page.
 */

import { apiFetch, type GetToken } from "./client";
import { fakeAdminApi } from "./adminFake";

/** "all" is the top bar's All schools; any other value is a school id. */
export type SchoolFilter = string;
export const ALL_SCHOOLS: SchoolFilter = "all";

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

/** What POST /admin/accounts/import says about one CSV line. */
export type ImportOutcome = "would_create" | "created" | "skipped_exists" | "error";
export type ImportRow = {
  line: number;
  email: string;
  name: string;
  role: string;
  classNames: string[];
  outcome: ImportOutcome;
  accountId: string | null;
  /** created rows only, where there is an Auth0 tenant: a credential, shown and downloaded once */
  inviteLink: string | null;
  error: string | null;
};
type ImportApiRow = {
  line: number; email: string; name: string; role: string; class_names: string[]; outcome: ImportOutcome;
  account_id: string | null; invite_link: string | null; error: string | null;
};

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
  /** When true, educators may change this setting for their own classes. Saved; nothing per class reads it yet. */
  canAdjust: boolean;
  /** False = saved and shown, but the product does not check it yet. Set by the API, never sent back. */
  enforced: boolean;
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
  /** A fresh one-time sign-in link (also a password reset); null where the build has no Auth0 tenant. */
  newSignInLink: (accountId: string) => Promise<string | null>;
  /** One row per CSV line. dryRun writes nothing; otherwise created rows carry their one-time link. */
  importAccounts: (schoolId: string, csv: string, dryRun: boolean) => Promise<ImportRow[]>;
  getPermissions: (schoolId: string) => Promise<PermissionRow[]>;
  /** Answers every setting as saved, so the page shows what the API kept rather than what it sent. */
  savePermissions: (schoolId: string, rows: PermissionRow[]) => Promise<PermissionRow[]>;
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
// GET and PUT /admin/schools/{school}/permissions
type PermissionApiRow = {
  key: string;
  group: PermissionRow["group"];
  label: string;
  students: boolean;
  educators: boolean;
  can_adjust: boolean;
  enforced: boolean;
};

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

const toPermission = (row: PermissionApiRow): PermissionRow => ({
  key: row.key,
  group: row.group,
  label: row.label,
  students: row.students,
  educators: row.educators,
  canAdjust: row.can_adjust,
  enforced: row.enforced,
});

const query = (school: SchoolFilter) => `?school=${encodeURIComponent(school)}`;
const permissionsPath = (schoolId: string) => `/admin/schools/${encodeURIComponent(schoolId)}/permissions`;

/**
 * The calls the pages use. Everything goes to the API except the room shells, which fall
 * through to the in-memory fake because no table holds them yet.
 */
export function createAdminApi(getToken: GetToken, base?: string): AdminApi {
  return {
    ...fakeAdminApi,

    listSchools: () => apiFetch<SchoolRow[]>(getToken, "/admin/schools", {}, base),

    addSchool: (name) => apiFetch<SchoolRow>(getToken, "/admin/schools", { method: "POST", body: { name } }, base),

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

    getPermissions: async (schoolId) =>
      (await apiFetch<PermissionApiRow[]>(getToken, permissionsPath(schoolId), {}, base)).map(toPermission),

    // only the switches go back; the label, group and enforced are the API's to say
    savePermissions: async (schoolId, rows) =>
      (await apiFetch<PermissionApiRow[]>(getToken, permissionsPath(schoolId), {
        method: "PUT",
        body: rows.map((row) => ({ key: row.key, students: row.students, educators: row.educators, can_adjust: row.canAdjust })),
      }, base)).map(toPermission),

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

    newSignInLink: async (accountId) =>
      (await apiFetch<{ account_id: string; invite_link: string | null }>(
        getToken, `/admin/accounts/${encodeURIComponent(accountId)}/invite`, { method: "POST" }, base,
      )).invite_link,

    importAccounts: async (schoolId, csv, dryRun) =>
      (await apiFetch<{ rows: ImportApiRow[] }>(getToken, "/admin/accounts/import", {
        method: "POST",
        body: { school_id: schoolId, csv, dry_run: dryRun },
      }, base)).rows.map((r) => ({
        line: r.line, email: r.email, name: r.name, role: r.role, classNames: r.class_names, outcome: r.outcome,
        accountId: r.account_id, inviteLink: r.invite_link, error: r.error,
      })),

    setAccountOff: async (accountId, off) =>
      toAccount(
        await apiFetch<AccountRow>(getToken, `/admin/accounts/${accountId}`, {
          method: "PATCH",
          body: { active: !off },
        }, base),
      ),
  };
}
