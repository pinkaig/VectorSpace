/**
 * @file        AccountsTableSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Accounts section: the table of people and each row's actions. Reset password
 *              and Resend invite need the real sign-in (Auth0), so they only post a notice.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { Account } from "../../../api/admin";
import { Button } from "../../../ui/button";
import { StatusChip, type ChipTone } from "../../../ui/statusChip";

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
  // opens the "no logic" popup, for actions that are not connected yet
  onNotice: (message: string) => void;
};

export function AccountsTableSection({ rows, onTurnOff, onNotice }: AccountsTableSectionProps) {
  return (
    <div className="admin-scroll">
      <table className="admin-table">
        <thead>
          <tr><th>Name</th><th>Role</th><th>Class</th><th>Last active</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((account) => (
            <tr key={account.id}>
              <td>
                <div className="admin-accounts-person">
                  <strong>{account.name}</strong>
                  <span className="admin-muted">{account.email}</span>
                </div>
              </td>
              <td><StatusChip tone={account.role === "student" ? "purple" : "amber"}>{account.role === "student" ? "Student" : "Educator"}</StatusChip></td>
              <td>{account.className ?? "-"}</td>
              <td>{lastActiveLabel(account.lastActive)}</td>
              <td><StatusChip tone={STATUS[account.status].tone}>{STATUS[account.status].label}</StatusChip></td>
              <td className="admin-actions">
                <Button size="small" onClick={() => onNotice(`Reset password for ${account.name}`)}>
                  Reset password
                </Button>
                {/* one of: Turn off (Active), Turn on (Turned off), Resend invite (Invited) */}
                {account.status === "active" && <Button size="small" variant="danger" onClick={() => onTurnOff(account, true)}>Turn off</Button>}
                {account.status === "turned_off" && <Button size="small" onClick={() => onTurnOff(account, false)}>Turn on</Button>}
                {account.status === "invited" && (
                  <Button size="small" onClick={() => onNotice(`Resend invite to ${account.email}`)}>
                    Resend invite
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="admin-muted">No accounts match.</p>}
    </div>
  );
}
