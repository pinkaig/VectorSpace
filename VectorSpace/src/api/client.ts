/**
 * @file        client.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-18
 * @brief       The one place the browser talks to the API: base address, bearer token, errors.
 *
 * @responsibility
 * Sends a request to the API with the signed-in person's token attached and turns a failed
 * reply into an ApiError carrying the status code, so a page can tell "not found" (404)
 * from "not allowed" (403) from "not signed in" (401).
 *
 * @inputs
 * A function that returns the current token (so the token source can change, e.g. Auth0
 * refreshing it), a path such as '/projects', and optional fetch options with a JSON body.
 *
 * @outputs
 * The parsed JSON reply (undefined for an empty one), or a thrown ApiError.
 *
 * @boundary
 * The token is never stored here; session.tsx owns it. Which API address to use comes from
 * VITE_API_URL; when it is unset the app is in its offline mode and apiUrl is undefined.
 *
 * @status
 * Current. Not yet used by the editor.
 */

/** Address of the API, from VITE_API_URL; undefined means the app runs without a server. */
export const apiUrl: string | undefined = import.meta.env.VITE_API_URL || undefined

export type GetToken = () => Promise<string | null>

export class ApiError extends Error {
  readonly status: number
  /** The server's detail field: text for most errors, an object for a save conflict. */
  readonly detail: unknown
  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `API error ${status}`)
    this.status = status
    this.detail = detail
  }
}

export type ApiRequest = Omit<RequestInit, 'body'> & { body?: unknown }

export async function apiFetch<T>(getToken: GetToken, path: string, init: ApiRequest = {}, base = apiUrl): Promise<T> {
  if (!base) throw new Error('No API address: set VITE_API_URL')
  const token = await getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await response.text()
  let parsed: unknown
  try {
    parsed = text ? JSON.parse(text) : undefined
  } catch {
    parsed = undefined // not JSON, e.g. an error page from a proxy; the status still says what happened
  }
  if (!response.ok) throw new ApiError(response.status, (parsed as { detail?: unknown } | undefined)?.detail)
  return parsed as T
}
