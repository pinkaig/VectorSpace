/**
 * @file        signInLinksCsv.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @brief       Accounts section: the CSV of one-time sign-in links an import hands back, built in the
 *              browser (no npm dependency, nothing sent anywhere), and the browser download that saves it.
 *              Kept apart from ImportCsvPopup.tsx so it can be tested without React.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import type { ImportRow } from "../../../api/admin";

/** One CSV field: quoted when it holds a comma, quote or line break; a leading = + - @ is defused
 *  so a spreadsheet opening the file does not run it as a formula. */
function field(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** email,name,role,classes,sign_in_link for each created row that has a link; header only when none. */
export function signInLinksCsv(rows: ImportRow[]): string {
  const lines = [["email", "name", "role", "classes", "sign_in_link"]];
  for (const row of rows) {
    if (row.outcome === "created" && row.inviteLink) {
      lines.push([row.email, row.name, row.role, row.classNames.join(";"), row.inviteLink]);
    }
  }
  return lines.map((line) => line.map(field).join(",")).join("\r\n") + "\r\n";
}

/** Saves text as a file through the browser's own download. */
export function downloadCsv(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
