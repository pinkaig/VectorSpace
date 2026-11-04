/**
 * @file        AdminAccountsPage.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Admin Accounts: everyone in the picked school (or all schools), filtered by
 *              tab and search, with Add an account and Turn off / Turn on. Accounts are
 *              turned off, never deleted. The parts live in src/sections/admin/accounts/.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import type { Account } from "../api/admin";
import { Motion } from "../motion/useMotion";
import { Button } from "../ui/button";
import { LoadingRows } from "../ui/loadingRows";
import { useNoLogic } from "../ui/noLogic";
import { useLoad } from "../api/useLoad";
import { useAdmin } from "../sections/admin/adminContext";
import { AccountFilters, matchesFilter, type AccountTab } from "../sections/admin/accounts/AccountFilters";
import { AccountsTableSection } from "../sections/admin/accounts/AccountsTableSection";
import { AddAccountPopup } from "../sections/admin/accounts/AddAccountPopup";
import "./AdminAccountsPage.css";

export default function AdminAccountsPage() {
  const { api, school, schoolId } = useAdmin();
  const { data: accounts, setData, error, loading } = useLoad(() => api.listAccounts(schoolId), schoolId);

  const [tab, setTab] = useState<AccountTab>("everyone");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  // buttons that are not connected yet (Auth0 sends the emails) open a "no logic" popup
  const [noLogic, noLogicPopup] = useNoLogic();

  const replace = (changed: Account) => setData((rows) => rows && rows.map((row) => (row.id === changed.id ? changed : row)));
  const turnOff = async (account: Account, off: boolean) => replace(await api.setAccountOff(account.id, off));

  const shown = accounts?.filter((account) => matchesFilter(account, tab, search)) ?? [];

  return (
    <>
      {/*TITLE*/}
      <div className="admin-page-title">
        <h1>Accounts</h1>
        <p>{school ? school.name : "All schools"}</p>
      </div>

      <section className="admin-panel admin-accounts">
        {/*TOOLBAR: filter tabs with counts, search, and the two ways to add people*/}
        <div className="admin-accounts-toolbar">
          <AccountFilters accounts={accounts ?? []} tab={tab} onTab={setTab} search={search} onSearch={setSearch} />
          <div className="admin-accounts-add">
            <Button onClick={() => noLogic("Import class list (CSV)")}>Import class list (CSV)</Button>
            <Button variant="primary" onClick={() => setAdding(true)}>+ Add an account</Button>
          </div>
        </div>

        {/*TABLE: name and email, role, class, last active, status, row actions*/}
        {error && <Motion as="p" cue="feedback.error" role="alert">Could not load accounts: {error}</Motion>}
        <LoadingRows loading={loading} />
        {accounts && (
          <AccountsTableSection rows={shown} onTurnOff={turnOff} onNotice={noLogic} />
        )}
      </section>

      {noLogicPopup}
      {adding && (
        <AddAccountPopup
          onClose={() => setAdding(false)}
          // the popup stays open after this: it shows the new person's one-time password link,
          // which is minted once and is in no later reply (see AddAccountPopup.tsx)
          onAdded={(account) => setData((rows) => rows && [...rows, account])}
        />
      )}
    </>
  );
}
