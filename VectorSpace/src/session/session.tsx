/**
 * @file        session.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-12
 * @reviewed    2026-10-27
 * @brief       Who is signed in (teacher or student), the admin override and the route guard.
 *
 * @responsibility
 * Holds the signed-in role for this browser tab, remembers it across a refresh, and
 * redirects a visitor away from a page their role may not open. An admin session passes
 * every guard and may change the role it acts as without signing in again.
 *
 * @inputs
 * signIn(role, { admin }), actAs(role) and signOut() calls from the pages; the stored
 * role and admin flag on first load; in Auth0 mode, the verified token and GET /me.
 *
 * @outputs
 * The current role and the admin flag through useSession(), and a redirect from RequireRole.
 *
 * @members
 * Role, adminOverrideEnabled, guardRedirect, adminRedirect, homePath, SessionProvider,
 * useSession, RequireRole, RequireAdmin.
 *
 * @boundary
 * Two sign-in modes, chosen once at module load by auth0.ts (all three VITE_AUTH0_*
 * variables present or not). Only the inside of the provider differs: useSession(),
 * RequireRole, RequireAdmin, guardRedirect, adminRedirect and homePath are the same in
 * both, so no page or component knows which mode it is running in.
 *
 *   Auth0 mode. signIn() hands the browser to Auth0's hosted login and never returns;
 *   on the way back the token comes from getAccessTokenSilently and GET /me decides the
 *   role, the admin flag and the display name. VITE_API_URL must be set — there is no
 *   offline Auth0 mode. The stored role is a cache so a refresh does not bounce to the
 *   login page while silent authentication runs; the server's answer still overrules it.
 *
 *   Picker mode (the default, and what the browser tests use). Choosing a role is all it
 *   takes, and the admin override is one more button, offered on the dev server and in a
 *   build made with VITE_ADMIN_OVERRIDE=true. With VITE_API_URL unset no network call
 *   happens at all. With it set, the chosen role maps to a seeded dev person (see
 *   app/seed.py), the API is asked who that is through GET /me, and the ANSWER sets the
 *   role, not the click. That needs AUTH_DEV_BYPASS on the API.
 *
 * This is page routing, not access control. The role and the admin flag sit in the
 * browser, so anyone can set them; whatever must be protected has to be checked by the
 * server on every request.
 *
 * @dependencies
 * React, react-router (Navigate), @auth0/auth0-react, ../api/client, ./auth0.
 *
 * @status
 * Current. Auth0 mode is live but untested against a real tenant; see
 * Desktop/docs/handover/long auth0-integration.md.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import { Auth0Provider, useAuth0, type AppState } from '@auth0/auth0-react'
import { ApiError, apiFetch, apiUrl, type GetToken } from '../api/client'
import { auth0Config, auth0Enabled, auth0RedirectUri } from './auth0'

export type Role = 'teacher' | 'student'

// The admin override is a test aid for the prototype picker: always there on the dev
// server, and in a production build only when it was built with VITE_ADMIN_OVERRIDE=true.
// It is never offered in Auth0 mode, where actors.role is the only thing that grants admin.
export const adminOverrideEnabled =
  !auth0Enabled && (import.meta.env.DEV || import.meta.env.VITE_ADMIN_OVERRIDE === 'true')

// sessionStorage, not localStorage: a refresh keeps you signed in, but a new tab or a
// closed browser starts at the login page, which is what a shared classroom machine wants
const STORAGE_KEY = 'vectorspace-session-role'
const ADMIN_STORAGE_KEY = 'vectorspace-session-admin'
const TOKEN_STORAGE_KEY = 'vectorspace-session-token'
const NAME_STORAGE_KEY = 'vectorspace-session-name'

// the seeded people (app/seed.py) that the picker's buttons stand for while Auth0 is absent;
// the "dev|" bearer value is accepted by the API only when it runs with AUTH_DEV_BYPASS
export const devSubjectFor = (role: Role, admin: boolean): string =>
  admin ? 'dev|admin' : role === 'teacher' ? 'dev|teacher' : 'dev|student1'

type Me = { role: 'admin' | 'teacher' | 'student'; display_name: string }

// shown in the top bar's account group when there is no server to ask (offline picker mode)
const offlineName = (role: Role, admin: boolean): string => (admin ? 'VThere Admin' : role === 'teacher' ? 'Teacher' : 'Student')

const readStored = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

const readStoredRole = (): Role | null => {
  const stored = readStored(STORAGE_KEY)
  return stored === 'teacher' || stored === 'student' ? stored : null
}

// a stored admin flag is ignored when the override is off, so a flag left by an earlier
// dev session does nothing in a build that has it disabled. In Auth0 mode the flag is
// still read back, because there it was written from the server's answer, not from a click.
const readStoredAdmin = (): boolean => (adminOverrideEnabled || auth0Enabled) && readStored(ADMIN_STORAGE_KEY) === 'true'

const store = (key: string, value: string | null) => {
  try {
    if (value) sessionStorage.setItem(key, value)
    else sessionStorage.removeItem(key)
  } catch {
    // storage blocked (private window): the role still works for this page load
  }
}

// what GET /me's answer means for this browser tab, in both modes: an 'admin' actor gets
// the admin flag and acts as a teacher until it switches
const landingFor = (me: Me): { role: Role; admin: boolean } => ({
  role: me.role === 'student' ? 'student' : 'teacher',
  admin: me.role === 'admin',
})

// where a visitor with `role` must go to be allowed on a page that needs `required`,
// or null if they may stay. Signed out goes to login, the wrong role to its own home,
// and an admin may stay on every page.
export const guardRedirect = (role: Role | null, required: Role | Role[], admin = false): string | null =>
  !role ? '/login' : admin || [required].flat().includes(role) ? null : `/${role}`

// where a signed-in person starts: an admin has its own area, everyone else has the page named
// after their role. The admin flag wins, so an admin "acting as" a teacher still lands on /admin.
export const homePath = (role: Role, admin: boolean): string => (admin ? '/admin' : `/${role}`)

// the same idea as guardRedirect, for the /admin pages: only an admin stays
export const adminRedirect = (role: Role | null, admin: boolean): string | null =>
  !role ? '/login' : admin ? null : `/${role}`

// What to tell someone the login provider admitted but the roster does not know. A refusal
// (403, from get_current_actor) is the expected case and names the identity that was used;
// anything else is a fault, so it is shown as it came.
const rejectionMessage = (error: unknown, who: string): string =>
  error instanceof ApiError && error.status === 403
    ? `${who || 'That login'} is signed in, but it has no account on this platform. Use the account your school gave you.`
    : `Could not finish signing in: ${error instanceof Error ? error.message : String(error)}`

// The Auth0 error codes that mean "this browser can no longer get a token without the person
// signing in again": the refresh token is missing, expired or revoked, or Auth0 wants a login.
// Anything else (a network blip, a timeout) is not a lost session and must not sign anyone out.
const LOST_SESSION_CODES = new Set(['login_required', 'missing_refresh_token', 'invalid_grant', 'consent_required', 'interaction_required'])

/** True when an error from getAccessTokenSilently means the sign-in is gone, not just a failed request. */
export const isLostSession = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && LOST_SESSION_CODES.has(String((error as { error?: unknown }).error))

/** What the login page says after a session ran out under an open page. */
const sessionExpiredNotice = 'Your sign-in expired. Sign in again to carry on.'

type Session = {
  role: Role | null
  admin: boolean
  // Set when the sign-in provider let someone in but this platform has no active account
  // for that identity -- signing in with a personal Google account instead of the school
  // one lands here. The message is for the login page, which must then offer a way out:
  // the provider still holds that session, so "Sign in" alone would only fail again.
  rejected: string | null
  // Set when a sign-in that was working stopped being able to get a token (Auth0 mode only).
  // The cached role is dropped at the same moment, so no page keeps looking signed in while
  // every API call is refused; the login page shows this text.
  notice: string | null
  // the name shown in the top bar: the server's display_name, or a fixed one while offline
  displayName: string
  // resolves with where the person landed (role and admin flag as the server decided them);
  // rejects (an ApiError) if the server refuses them. In Auth0 mode a signed-out caller is
  // handed to the hosted login instead, and this promise never settles because the browser
  // leaves the page.
  signIn: (role: Role, options?: { admin?: boolean }) => Promise<{ role: Role; admin: boolean }>
  // the bearer token for API calls, or null when signed out or running without a server
  getToken: GetToken
  actAs: (role: Role) => void
  signOut: () => void
}

const SessionContext = createContext<Session | null>(null)

/**
 * The sign-in for this build. One branch, decided by auth0.ts at module load, so the two
 * providers never swap places during a render and each may use its own hooks freely.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  if (!auth0Config) return <PickerSessionProvider>{children}</PickerSessionProvider>
  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        audience: auth0Config.audience,
        redirect_uri: auth0RedirectUri(),
        // with a connection configured the hosted page offers only that one, so nobody can
        // sign in through a provider the roster cannot name (see auth0.ts)
        ...(auth0Config.connection ? { connection: auth0Config.connection } : {}),
      }}
      // refresh tokens rather than a hidden iframe: browsers that block third-party
      // cookies break silent authentication, and a classroom browser is likely to be one
      useRefreshTokens
      cacheLocation="localstorage"
      onRedirectCallback={onRedirectCallback}
    >
      <Auth0SessionProvider>{children}</Auth0SessionProvider>
    </Auth0Provider>
  )
}

// Auth0 comes back to the site root with ?code=&state= in the query. Drop those two from
// the address bar and restore the hash route the person was sent away from, because the
// router reads the hash and would otherwise land them on the default page.
const onRedirectCallback = (appState?: AppState) => {
  const returnTo = typeof appState?.returnTo === 'string' ? appState.returnTo : window.location.hash
  window.history.replaceState({}, document.title, `${window.location.pathname}${returnTo}`)
}

/**
 * Auth0 mode. The token comes from the SDK and the role comes from GET /me; this provider
 * holds neither credential nor permission of its own.
 */
function Auth0SessionProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0()
  const [role, setRole] = useState<Role | null>(readStoredRole)
  const [admin, setAdmin] = useState<boolean>(readStoredAdmin)
  const [displayName, setDisplayName] = useState<string>(() => readStored(NAME_STORAGE_KEY) ?? '')
  const [rejected, setRejected] = useState<string | null>(null)
  // the session ran out under an open page: getAccessTokenSilently can no longer renew it
  const [expired, setExpired] = useState(false)

  // how to name the Auth0 identity back to the person, so a refusal says which account
  // they used rather than only that something failed
  const signedInAs = user?.email ?? user?.name ?? ''

  const getToken = useCallback<GetToken>(async () => {
    if (!isAuthenticated) return null
    try {
      return await getAccessTokenSilently()
    } catch (error) {
      // The refresh token expired or was revoked. Returning null alone left the page showing
      // the cached name and role while every request came back 401, so also mark the session
      // as lost: the effect below drops the cache and the guards send the person to /login.
      if (isLostSession(error)) setExpired(true)
      return null
    }
  }, [isAuthenticated, getAccessTokenSilently])

  const remember = useCallback((landed: { role: Role; admin: boolean }, name: string) => {
    store(STORAGE_KEY, landed.role)
    store(ADMIN_STORAGE_KEY, landed.admin ? 'true' : null)
    store(NAME_STORAGE_KEY, name)
    setRole(landed.role)
    setAdmin(landed.admin)
    setDisplayName(name)
  }, [])

  const forget = useCallback(() => {
    store(STORAGE_KEY, null)
    store(ADMIN_STORAGE_KEY, null)
    store(TOKEN_STORAGE_KEY, null)
    store(NAME_STORAGE_KEY, null)
    setRole(null)
    setAdmin(false)
    setDisplayName('')
  }, [])

  // ask the server who this token belongs to. The answer, not anything in the browser,
  // is what sets the role and the admin flag.
  const askWhoIAm = useCallback(async () => {
    if (!apiUrl) throw new Error('Auth0 sign-in needs VITE_API_URL: there is no offline Auth0 mode')
    try {
      const me = await apiFetch<Me>(getToken, '/me')
      const landed = landingFor(me)
      setRejected(null)
      remember(landed, me.display_name)
      return landed
    } catch (error) {
      // Auth0 proved who they are and the token verified; the roster simply has no active
      // account for that subject. Record it so the login page stops offering a sign-in that
      // cannot succeed and offers to sign this identity out instead.
      setRejected(rejectionMessage(error, signedInAs))
      throw error
    }
  }, [getToken, remember, signedInAs])

  // After the redirect back from Auth0 there is a token but no role yet, so fetch it. The
  // same effect clears a cached role once silent authentication has finished and found
  // nobody signed in — that cache is only there to survive a refresh.
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      if (role !== null || displayName !== '') forget()
      if (rejected !== null) setRejected(null)
      return
    }
    // asked once per Auth0 session: a refusal is remembered, so this effect does not keep
    // re-asking /me on every render for an identity the server has already turned away
    // A lost session keeps Auth0's cached user (isAuthenticated stays true) but cannot get a
    // token, so asking /me again would only fail: drop the cached role and wait for a sign-in.
    if (expired) {
      if (role !== null || displayName !== '') forget()
      return
    }
    if (role === null && rejected === null) askWhoIAm().catch(() => forget())
  }, [isLoading, isAuthenticated, role, displayName, rejected, expired, askWhoIAm, forget])

  const session = useMemo<Session>(
    () => ({
      role,
      admin,
      displayName,
      rejected,
      notice: expired ? sessionExpiredNotice : null,
      // the role and admin arguments are ignored here: nobody chooses what they are in
      // Auth0 mode. They stay in the signature so the login page and every caller are
      // the same in both modes.
      signIn: async () => {
        // a refused identity is still signed in at Auth0, so asking it again would only be
        // refused again: hand the browser back to the hosted page, where another account can
        // be given. prompt=login stops Auth0 from silently reusing the same session.
        // A lost session goes back to the hosted page too: there is no token to ask /me with.
        if (isAuthenticated && rejected === null && !expired) return askWhoIAm()
        await loginWithRedirect({
          appState: { returnTo: window.location.hash },
          authorizationParams: rejected === null ? undefined : { prompt: 'login' },
        })
        // the browser is on its way to Auth0; nothing after this runs in this page
        return new Promise<{ role: Role; admin: boolean }>(() => {})
      },
      getToken,
      // an admin changes the role the app treats them as; anyone else is ignored
      actAs: (next) => {
        if (!admin) return
        store(STORAGE_KEY, next)
        setRole(next)
      },
      signOut: () => {
        forget()
        setRejected(null)
        setExpired(false)
        logout({ logoutParams: { returnTo: auth0RedirectUri() } })
      },
    }),
    [role, admin, displayName, rejected, expired, isAuthenticated, loginWithRedirect, logout, getToken, askWhoIAm, forget],
  )
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

/**
 * Picker mode: the prototype sign-in. Kept for local development and the browser tests,
 * and it is what a build with no tenant configured runs.
 */
function PickerSessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(readStoredRole)
  const [admin, setAdmin] = useState<boolean>(readStoredAdmin)
  const [displayName, setDisplayName] = useState<string>(() => readStored(NAME_STORAGE_KEY) ?? '')
  const session = useMemo<Session>(
    () => ({
      role,
      admin,
      displayName,
      // nothing to be stranded by: the picker's buttons stand for seeded people, and a
      // server that refuses one is reported by signIn's rejection like any other failure
      rejected: null,
      // a picker token is a fixed "dev|" name that never expires
      notice: null,
      signIn: async (next, options) => {
        let landedAs = next
        let asAdmin = adminOverrideEnabled && options?.admin === true
        let name = ''
        if (apiUrl) {
          const token = devSubjectFor(next, asAdmin)
          const me = await apiFetch<Me>(async () => token, '/me')
          // the server's answer decides; an admin acts as a teacher until they switch
          const landed = landingFor(me)
          asAdmin = landed.admin
          landedAs = landed.role
          name = me.display_name
          store(TOKEN_STORAGE_KEY, token)
        }
        name = name || offlineName(landedAs, asAdmin)
        store(STORAGE_KEY, landedAs)
        store(ADMIN_STORAGE_KEY, asAdmin ? 'true' : null)
        store(NAME_STORAGE_KEY, name)
        setRole(landedAs)
        setAdmin(asAdmin)
        setDisplayName(name)
        return { role: landedAs, admin: asAdmin }
      },
      getToken: async () => readStored(TOKEN_STORAGE_KEY),
      // an admin changes the role the app treats them as; anyone else is ignored
      actAs: (next) => {
        if (!admin) return
        store(STORAGE_KEY, next)
        setRole(next)
      },
      signOut: () => {
        store(STORAGE_KEY, null)
        store(ADMIN_STORAGE_KEY, null)
        store(TOKEN_STORAGE_KEY, null)
        store(NAME_STORAGE_KEY, null)
        setRole(null)
        setAdmin(false)
        setDisplayName('')
      },
    }),
    [role, admin, displayName],
  )
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside <SessionProvider>')
  return session
}

// wraps a route's page: renders it for the required role (or an admin), redirects anyone else
export function RequireRole({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const session = useSession()
  const redirect = guardRedirect(session.role, role, session.admin)
  return redirect ? <Navigate to={redirect} replace /> : children
}

// wraps the /admin pages: only an admin session sees them, anyone else is sent to their own home.
// Like RequireRole this chooses a page; it is not security, the server checks every /admin request.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const session = useSession()
  const redirect = adminRedirect(session.role, session.admin)
  return redirect ? <Navigate to={redirect} replace /> : children
}
