/**
 * @file        AccountsTableSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Accounts section: the table of people and each row's actions. New sign-in link
 *              covers both a lost invite and a forgotten password (one Auth0 ticket does both).
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { Account } from "../../../api/admin";
import { Motion } from "../../../motion/useMotion";
import { Button } from "../../../ui/button";
import { StatusChip, type ChipTone } from "../../../ui/statusChip";
import { initials } from "../../../ui/initials";

const STATUS: Record<Account["status"], { label: string; tone: ChipTone }> = {
  active: { label: "Active", tone: "green" },
  invited: { label: "Invited", tone: "amber" },
  turned_off: { label: "Turned off", tone: "grey" },
};

// "Today", "3 days ago" or "Never" instead of a raw timestamp
function lastActiveLabel(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000));
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

type AccountsTableSectionProps = {
  rows: Account[];
  onTurnOff: (account: Account, off: boolean) => void;
  // opens SignInLinkPopup; a turned-off account has none, the API would answer 409
  onSignInLink: (account: Account) => void;
};

export function AccountsTableSection({ rows, onTurnOff, onSignInLink }: AccountsTableSectionProps) {
  return (
    <div className="admin-scroll">
      <table className="admin-table">
        <thead>
          <tr><th>Name</th><th>Role</th><th>Class</th><th>Last active</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((account, index) => (
            <Motion as="tr" cue="table.rows.enter" staggerIndex={index} key={account.id}>
              <td>
                <div className="admin-person">
                  <span className="admin-avatar" aria-hidden="true">{initials(account.name)}</span>
                  <span>
                    <strong>{account.name}</strong>
                    <span className="admin-muted">{account.email}</span>
                  </span>
                </div>
              </td>
              <td><StatusChip tone={account.role === "student" ? "purple" : "amber"}>{account.role === "student" ? "Student" : "Educator"}</StatusChip></td>
              <td>{account.classNames.length ? account.classNames.join(", ") : "-"}</td>
              <td>{lastActiveLabel(account.lastActive)}</td>
              <td><StatusChip tone={STATUS[account.status].tone}>{STATUS[account.status].label}</StatusChip></td>
              <td className="admin-actions">
                {account.status !== "turned_off" && (
                  <Button size="small" onClick={() => onSignInLink(account)}>New sign-in link</Button>
                )}
                {/* one of: Turn off (Active or Invited), Turn on (Turned off) */}
                {account.status !== "turned_off" && <Button size="small" variant="danger" onClick={() => onTurnOff(account, true)}>Turn off</Button>}
                {account.status === "turned_off" && <Button size="small" onClick={() => onTurnOff(account, false)}>Turn on</Button>}
              </td>
            </Motion>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="admin-muted">No accounts match.</p>}
    </div>
  );
}
