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
 * from "not allowed" (403) from "not signed in" (401), plus the server's error code, request id
 * and per-field problems. No answer at all becomes a NetworkError; describeError turns either
 * into a sentence for the screen.
 *
 * @inputs
 * A function that returns the current token (so the token source can change, e.g. Auth0
 * refreshing it), a path such as '/projects' (the /api/v1 prefix is added here), and optional
 * fetch options with a JSON body.
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

/** The API version every request goes to, added here so no call site names it (apps/api/app/main.py, API_PREFIX). */
export const apiPrefix = '/api/v1'

export type GetToken = () => Promise<string | null>

/** What the API adds to every error (apps/api/app/errors.py): a stable code, the request id, and for bad input the fields. */
export type ApiErrorExtras = {
  code?: string
  requestId?: string
  fields?: { field: string; message: string }[]
}

export class ApiError extends Error {
  readonly status: number
  /** The server's detail field: text for most errors, an object for a save conflict. */
  readonly detail: unknown
  /** A short stable name for the kind of failure, e.g. "not_found" or "invalid_request". */
  readonly code?: string
  /** The id the server logged this request under: quote it when reporting a problem. */
  readonly requestId?: string
  /** For bad input, one entry per thing to fix. */
  readonly fields?: { field: string; message: string }[]
  constructor(status: number, detail: unknown, extras: ApiErrorExtras = {}) {
    super(typeof detail === 'string' ? detail : `API error ${status}`)
    this.status = status
    this.detail = detail
    this.code = extras.code
    this.requestId = extras.requestId
    this.fields = extras.fields
  }
}

/**
 * The request never got an answer: offline, the server is down, or the address is wrong. Not an
 * ApiError on purpose: callers that retry on "anything but an ApiError" (a save, a model load) keep working.
 */
export class NetworkError extends Error {
  constructor() {
    super('Cannot reach the server. Check your internet connection and try again.')
  }
}

const STATUS_SENTENCES: Record<number, string> = {
  400: 'That request was not understood. Check what you entered and try again.',
  401: 'Please sign in again.',
  403: 'You are not allowed to do that.',
  404: 'That was not found. It may have been removed.',
  408: 'The server took too long to answer. Try again.',
  413: 'That is too large to send. Make it smaller and try again.',
  429: 'Too many requests. Wait a moment and try again.',
  502: 'The server is not responding right now. Try again in a moment.',
  503: 'The server is not responding right now. Try again in a moment.',
  504: 'The server is not responding right now. Try again in a moment.',
}

/**
 * One sentence for a person, from anything a call can throw: the server's own words where it has
 * them, ours where it sent none (a proxy's error page), the request id on a fault that is ours.
 */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const { detail } = error
    const fallback = STATUS_SENTENCES[error.status] ?? (error.status >= 500 ? 'Something went wrong on our side. Please try again.' : `The request failed (${error.status}).`)
    const message = (detail as { message?: unknown } | null | undefined)?.message
    const sentence = typeof detail === 'string' && detail ? detail : typeof message === 'string' ? message : fallback
    return error.status >= 500 && error.requestId ? `${sentence} (request ${error.requestId})` : sentence
  }
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Something went wrong. Please try again.'
}

export type ApiRequest = Omit<RequestInit, 'body'> & { body?: unknown }

export async function apiFetch<T>(getToken: GetToken, path: string, init: ApiRequest = {}, base = apiUrl): Promise<T> {
  if (!base) throw new Error('No API address: set VITE_API_URL')
  const token = await getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(`${base}${apiPrefix}${path}`, {
      ...init,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error // the caller cancelled; not a fault
    throw new NetworkError()
  }
  const text = await response.text()
  let parsed: unknown
  try {
    parsed = text ? JSON.parse(text) : undefined
  } catch {
    parsed = undefined // not JSON, e.g. an error page from a proxy; the status still says what happened
  }
  if (!response.ok) {
    const body = (parsed ?? {}) as ApiErrorExtras & { detail?: unknown }
    throw new ApiError(response.status, body.detail, { code: body.code, requestId: body.requestId, fields: body.fields })
  }
  return parsed as T
}
