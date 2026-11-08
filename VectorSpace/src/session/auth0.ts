/**
 * @file        auth0.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-27
 * @brief       The Auth0 tenant values read from the environment, and the switch they decide.
 *
 * @responsibility
 * Reads the three VITE_AUTH0_* variables once, at module load, and reports whether this
 * build has a tenant to sign in against. Nothing else in the app reads those variables.
 *
 * @inputs
 * VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, VITE_AUTH0_AUDIENCE from the build environment,
 * and the optional VITE_AUTH0_CONNECTION.
 *
 * @outputs
 * auth0Config: the three values together, or null when any of them is missing.
 *
 * @boundary
 * This is the one switch between the app's two sign-in modes. With a config,
 * SessionProvider signs in through Auth0 and the role comes from GET /me. Without one it
 * falls back to the prototype role picker, which is what local development and the
 * Playwright suite use. A partly filled tenant counts as missing: all three or none, so a
 * half-configured deployment fails loudly at the picker rather than quietly at login.
 *
 * @dependencies
 * None. Deliberately free of React so tests can read it without a renderer.
 *
 * @status
 * Current.
 */

export type Auth0Config = {
  domain: string
  clientId: string
  audience: string
  /**
   * The one Auth0 connection the hosted login may use, or '' to show every connection the
   * tenant enables. Set it to the database connection the roster provisions into (the API's
   * AUTH0_CONNECTION): a social login such as Google authenticates a subject that no roster
   * row names, so it verifies and is then refused by GET /me. Pinning it here keeps that
   * account off the hosted page in the first place. It is a convenience, not a control --
   * the tenant's own connection settings are what actually decide who may sign in.
   */
  connection: string
}

const read = (value: string | undefined): string => (value ?? '').trim()

/** The tenant for this build, or null when it has none (the picker mode). */
export const auth0Config: Auth0Config | null = (() => {
  const domain = read(import.meta.env.VITE_AUTH0_DOMAIN)
  const clientId = read(import.meta.env.VITE_AUTH0_CLIENT_ID)
  const audience = read(import.meta.env.VITE_AUTH0_AUDIENCE)
  const connection = read(import.meta.env.VITE_AUTH0_CONNECTION)
  return domain && clientId && audience ? { domain, clientId, audience, connection } : null
})()

/** True when this build signs in through Auth0 rather than the prototype picker. */
export const auth0Enabled = auth0Config !== null

/**
 * Where Auth0 sends the browser back to. The app is a HashRouter, so the callback URL is
 * the site root with no path and no hash — that exact origin has to be listed in the
 * tenant's Allowed Callback URLs and Allowed Logout URLs.
 */
export const auth0RedirectUri = (): string => `${window.location.origin}${window.location.pathname}`
