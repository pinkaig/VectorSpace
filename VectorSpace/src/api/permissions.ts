/**
 * @file        permissions.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-11-06
 * @brief       What the signed-in person may do in their own school: GET /permissions/mine.
 *
 * @responsibility
 * Hides the buttons the API would refuse. It is not the rule: the API checks every enforced
 * setting itself and answers 403 (apps/api/app/permissions.py). The keys are the ones on the
 * admin Permissions page, for example "from-templates".
 *
 * @boundary
 * Read only, and only for the caller. Admins edit the settings through admin.ts.
 *
 * @status
 * Current. One key is enforced so far: "from-templates".
 */

import { apiFetch, type GetToken } from './client'

/** Every setting key, true when the caller's role may do it. */
export type MyPermissions = Record<string, boolean>

export function getMyPermissions(getToken: GetToken, base?: string): Promise<MyPermissions> {
  return apiFetch<MyPermissions>(getToken, '/permissions/mine', {}, base)
}

/** False only when the API said no. A key it did not send is left to the API to refuse. */
export const may = (mine: MyPermissions, key: string): boolean => mine[key] !== false
