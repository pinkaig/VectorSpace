/**
 * @file        AccountFilters.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Accounts section: the Everyone / Students / Educators / Invited tabs (each
 *              with its count) and the search box. Also holds the rule for which accounts
 *              a tab and a search let through, so the page and the tabs agree.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { Search } from "lucide-react";
import type { Account } from "../../../api/admin";
import "../../../ui/field.css"; // the .ui-input look for the search box

export type AccountTab = "everyone" | "students" | "educators" | "invited";

const TABS: { id: AccountTab; label: string }[] = [
  { id: "everyone", label: "Everyone" },
  { id: "students", label: "Students" },
  { id: "educators", label: "Educators" },
  { id: "invited", label: "Invited" },
];

const inTab = (account: Account, tab: AccountTab) =>
  tab === "everyone" ||
  (tab === "students" && account.role === "student") ||
  (tab === "educators" && account.role === "teacher") ||
  (tab === "invited" && account.status === "invited");

/** True when `account` belongs under `tab` and its name, email or class contains the search text. */
export function matchesFilter(account: Account, tab: AccountTab, search: string): boolean {
  const text = search.trim().toLowerCase();
  return inTab(account, tab) && (!text || [account.name, account.email, ...account.classNames].some((field) => field.toLowerCase().includes(text)));
}

type AccountFiltersProps = {
  accounts: Account[];
  tab: AccountTab;
  onTab: (tab: AccountTab) => void;
  search: string;
  onSearch: (text: string) => void;
};

export function AccountFilters({ accounts, tab, onTab, search, onSearch }: AccountFiltersProps) {
  return (
    <div className="admin-accounts-filters">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`admin-accounts-tab ${tab === id ? "admin-accounts-tab-active" : ""}`}
          onClick={() => onTab(id)}
        >
          {label} ({accounts.filter((account) => inTab(account, id)).length})
        </button>
      ))}
      <label className="admin-accounts-search">
        <Search size={16} />
        <input
          className="ui-input"
          placeholder="Search name or class"
          aria-label="Search name or class"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
    </div>
  );
}
