/**
 * @file        adminFake.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Sample schools, people and settings for the admin pages, kept in memory so
 *              turning an account off or saving a setting works until the page is reloaded.
 *              Replaced by the real backend calls in admin.ts; delete this file then.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type {
  Account, AdminApi, AttentionItem, NewAccount, Overview, PermissionRow, PublishedItem, Rooms, School, SchoolFilter,
} from "./admin";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

type SchoolRecord = { id: string; name: string; status: School["status"] };
const schools: SchoolRecord[] = [
  { id: "riverside", name: "Riverside Secondary", status: "active" },
  { id: "northview", name: "Northview Academy", status: "active" },
  { id: "bayside", name: "Bayside Secondary", status: "setting_up" },
];

// ---- people -----------------------------------------------------------------------------
// [school, name, role, class]; the status and last-active day are worked out from the position
const PEOPLE: [string, string, Account["role"], string | null][] = [
  ["riverside", "Tan Wei Ming", "educator", "Sec 2B"],
  ["riverside", "Priya Nair", "educator", "Sec 3A"],
  ["riverside", "Aisyah Rahman", "student", "Sec 2B"],
  ["riverside", "Ravi Kumar", "student", "Sec 2B"],
  ["riverside", "Mei Ling Tan", "student", "Sec 2B"],
  ["riverside", "Jun Hao Lee", "student", "Sec 3A"],
  ["riverside", "Nur Aina", "student", "Sec 3A"],
  ["riverside", "Ethan Wong", "student", "Sec 3A"],
  ["northview", "Sarah Lim", "educator", "Class 2C"],
  ["northview", "Daniel Ong", "educator", "Class 3B"],
  ["northview", "Hui Min Chen", "student", "Class 2C"],
  ["northview", "Arjun Menon", "student", "Class 2C"],
  ["northview", "Sofia Lopez", "student", "Class 3B"],
  ["northview", "Zhi Yang Goh", "student", "Class 3B"],
  ["bayside", "Kevin Chua", "educator", null],
  ["bayside", "Farah Ismail", "student", null],
];

const accounts: Account[] = PEOPLE.map(([schoolId, name, role, className], i) => {
  const status: Account["status"] = i % 7 === 6 ? "invited" : i % 9 === 8 ? "turned_off" : "active";
  return {
    id: `acc-${i + 1}`,
    schoolId,
    name,
    email: `${name.toLowerCase().replace(/ /g, ".")}@${schoolId}.example`,
    role,
    className,
    lastActive: status === "invited" ? null : daysAgo(i % 6),
    status,
  };
});

// ---- settings and rooms, one copy per school ---------------------------------------------
const DEFAULT_PERMISSIONS: PermissionRow[] = [
  { key: "more-rooms", group: "Building", label: "Add more rooms (up to 5 per project)", students: true, educators: true, canAdjust: false },
  { key: "publish-no-approval", group: "Sharing", label: "Publish without approval", students: false, educators: true, canAdjust: false },
  { key: "public-links", group: "Sharing", label: "Public links", students: false, educators: true, canAdjust: true },
  { key: "unlisted-links", group: "Sharing", label: "Unlisted links", students: true, educators: true, canAdjust: true },
  { key: "signin-links", group: "Sharing", label: "Sign-in only links", students: true, educators: true, canAdjust: false },
  { key: "from-templates", group: "Projects and data", label: "Set up projects from templates", students: false, educators: true, canAdjust: false },
  { key: "edit-after-assign", group: "Projects and data", label: "Edit a project after assigning", students: false, educators: true, canAdjust: true },
  { key: "see-results", group: "Projects and data", label: "See visitor results", students: false, educators: true, canAdjust: false },
  { key: "delete-published", group: "Projects and data", label: "Delete published museums", students: false, educators: false, canAdjust: false },
];
const permissions = new Map<string, PermissionRow[]>();

const ENVIRONMENTS = [
  ["museum-hall", "Museum hall", "A tall gallery with spotlights"],
  ["classroom", "Classroom", "Desks, a board and a window"],
  ["riverside-dock", "Riverside dock", "A wooden pier over water"],
  ["ancient-temple", "Ancient temple", "Stone columns and torchlight"],
];
// [id, name, description, item count]; the first pack is on for every school
const PACKS: [string, string, string, number][] = [
  ["museum-basics", "Museum basics", "Plinths, frames, signs and lights", 24],
  ["dinosaurs", "Dinosaurs", "Skeletons, models and roars", 18],
  ["ancient-egypt", "Ancient Egypt", "Statues, hieroglyph walls, a sarcophagus", 22],
  ["outer-space", "Outer space", "Planets, rockets and a starfield", 20],
  ["ancient-rome", "Ancient Rome", "Columns, busts and a mosaic floor", 16],
];
// which ids are switched on, per school; Bayside is brand new, so it has no rooms yet
const switchedOn = new Map<string, Set<string>>([
  ["riverside", new Set(["museum-hall", "classroom", "riverside-dock", "museum-basics", "dinosaurs", "ancient-egypt", "outer-space", "ancient-rome"])],
  ["northview", new Set(["museum-hall", "classroom", "museum-basics", "dinosaurs", "ancient-rome"])],
  ["bayside", new Set(["museum-basics"])],
]);

const RECENT: (PublishedItem & { schoolId: string })[] = [
  { id: "pub-1", schoolId: "riverside", title: "Dino Discovery Hall", where: "Riverside Secondary · Sec 2B", visits: 214, access: "public" },
  { id: "pub-2", schoolId: "northview", title: "Life in a Kampong", where: "Northview Academy · Class 2C", visits: 96, access: "unlisted" },
  { id: "pub-3", schoolId: "riverside", title: "The Water Cycle", where: "Riverside Secondary · Sec 3A", visits: 41, access: "sign_in" },
];

// ---- helpers ------------------------------------------------------------------------------
const inScope = (schoolId: string, filter: SchoolFilter) => filter === "all" || filter === schoolId;

const describe = (record: SchoolRecord): School => ({
  ...record,
  students: accounts.filter((a) => a.schoolId === record.id && a.role === "student").length,
  educators: accounts.filter((a) => a.schoolId === record.id && a.role === "educator").length,
});

// ---- the calls ----------------------------------------------------------------------------
export const fakeAdminApi: AdminApi = {
  async listSchools() {
    return schools.map(describe);
  },

  async addSchool(name) {
    // a new school is Setting up, with only the always-on Museum basics pack
    const record: SchoolRecord = { id: `school-${schools.length + 1}`, name, status: "setting_up" };
    schools.push(record);
    switchedOn.set(record.id, new Set(["museum-basics"]));
    return describe(record);
  },

  async getOverview(filter) {
    const list = schools.filter((s) => inScope(s.id, filter)).map(describe);
    const people = accounts.filter((a) => inScope(a.schoolId, filter));
    const recent = RECENT.filter((p) => inScope(p.schoolId, filter));
    const activeThisWeek = people.filter((a) => a.lastActive && Date.now() - Date.parse(a.lastActive) < 7 * DAY).length;

    const attention: AttentionItem[] = [];
    if (inScope("riverside", filter)) {
      attention.push({ id: "reported", text: "A visitor reported “Dino Discovery Hall”", actionLabel: "Review", goTo: null });
    }
    for (const school of list) {
      const on = switchedOn.get(school.id) ?? new Set<string>();
      if (!ENVIRONMENTS.some(([id]) => on.has(id))) {
        attention.push({ id: `no-rooms-${school.id}`, text: `${school.name} has no rooms yet`, actionLabel: "Assign rooms", goTo: "rooms" });
      } else if (!on.has("outer-space")) {
        attention.push({ id: `new-pack-${school.id}`, text: `New asset pack “Outer space” for ${school.name}`, actionLabel: "Turn on", goTo: "rooms" });
      }
    }

    return {
      tiles: {
        schools: { value: list.length, sub: `${list.filter((s) => s.status === "active").length} active` },
        educators: { value: people.filter((a) => a.role === "educator").length, sub: `${people.filter((a) => a.role === "educator" && a.status === "invited").length} invited` },
        students: { value: people.filter((a) => a.role === "student").length, sub: `${activeThisWeek} active this week` },
        published: { value: recent.length, sub: `${recent.reduce((sum, p) => sum + p.visits, 0)} visits in total` },
      },
      schools: list,
      attention,
      recent,
    } satisfies Overview;
  },

  async listAccounts(filter) {
    return accounts.filter((a) => inScope(a.schoolId, filter)).map((a) => ({ ...a }));
  },

  async addAccount(input: NewAccount) {
    // new accounts always start as Invited: they have not signed in yet
    const account: Account = { ...input, id: `acc-${accounts.length + 1}`, lastActive: null, status: "invited" };
    accounts.push(account);
    return { ...account };
  },

  async setAccountOff(accountId, off) {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new Error("No such account");
    // turning back on restores Invited if they never signed in, otherwise Active
    account.status = off ? "turned_off" : account.lastActive ? "active" : "invited";
    return { ...account };
  },

  async getPermissions(schoolId) {
    if (!permissions.has(schoolId)) permissions.set(schoolId, DEFAULT_PERMISSIONS.map((row) => ({ ...row })));
    return permissions.get(schoolId)!.map((row) => ({ ...row }));
  },

  async savePermissions(schoolId, rows) {
    permissions.set(schoolId, rows.map((row) => ({ ...row })));
  },

  async getRooms(schoolId): Promise<Rooms> {
    const on = switchedOn.get(schoolId) ?? new Set<string>();
    return {
      environments: ENVIRONMENTS.map(([id, name, description]) => ({ id, name, description, enabled: on.has(id) })),
      packs: PACKS.map(([id, name, description, itemCount]) => ({
        id, name, description, itemCount, enabled: id === "museum-basics" || on.has(id), locked: id === "museum-basics",
      })),
    };
  },

  async setRoomEnabled(schoolId, _kind, itemId, enabled) {
    const on = switchedOn.get(schoolId) ?? new Set<string>();
    if (enabled) on.add(itemId);
    else on.delete(itemId);
    switchedOn.set(schoolId, on);
  },
};
