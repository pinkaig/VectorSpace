/**
 * @file        session.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-12
 * @reviewed    2026-10-12
 * @brief       Who is signed in (teacher or student), the admin override and the route guard.
 *
 * @responsibility
 * Holds the signed-in role for this browser tab, remembers it across a refresh, and
 * redirects a visitor away from a page their role may not open. An admin session passes
 * every guard and may change the role it acts as without signing in again.
 *
 * @inputs
 * signIn(role, { admin }), actAs(role) and signOut() calls from the pages; the stored
 * role and admin flag on first load.
 *
 * @outputs
 * The current role and the admin flag through useSession(), and a redirect from RequireRole.
 *
 * @members
 * Role, adminOverrideEnabled, guardRedirect, SessionProvider, useSession, RequireRole.
 *
 * @boundary
 * Sign-in here is temporary: choosing a role is all it takes, and the admin override is
 * one more button, offered on the dev server and in a build made with
 * VITE_ADMIN_OVERRIDE=true. Auth0 replaces the inside of SessionProvider (role and admin
 * then come from the verified login, and adminOverrideEnabled goes away); useSession()
 * and RequireRole, and so every page that uses them, stay as they are.
 * This is page routing, not access control. The role and the admin flag sit in the
 * browser, so anyone can set them; whatever must be protected has to be checked by the
 * server on every request.
 *
 * @dependencies
 * React, react-router (Navigate).
 *
 * @status
 * Current, temporary sign-in.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router'

export type Role = 'teacher' | 'student'

// The admin override is a test aid for the temporary sign-in: always there on the dev
// server, and in a production build only when it was built with VITE_ADMIN_OVERRIDE=true.
export const adminOverrideEnabled = import.meta.env.DEV || import.meta.env.VITE_ADMIN_OVERRIDE === 'true'

// sessionStorage, not localStorage: a refresh keeps you signed in, but a new tab or a
// closed browser starts at the login page, which is what a shared classroom machine wants
const STORAGE_KEY = 'vectorspace-session-role'
const ADMIN_STORAGE_KEY = 'vectorspace-session-admin'

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
// dev session does nothing in a build that has it disabled
const readStoredAdmin = (): boolean => adminOverrideEnabled && readStored(ADMIN_STORAGE_KEY) === 'true'

const store = (key: string, value: string | null) => {
  try {
    if (value) sessionStorage.setItem(key, value)
    else sessionStorage.removeItem(key)
  } catch {
    // storage blocked (private window): the role still works for this page load
  }
}

// where a visitor with `role` must go to be allowed on a page that needs `required`,
// or null if they may stay. Signed out goes to login, the wrong role to its own home,
// and an admin may stay on every page.
export const guardRedirect = (role: Role | null, required: Role, admin = false): string | null =>
  !role ? '/login' : admin || role === required ? null : `/${role}`

type Session = {
  role: Role | null
  admin: boolean
  signIn: (role: Role, options?: { admin?: boolean }) => void
  actAs: (role: Role) => void
  signOut: () => void
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(readStoredRole)
  const [admin, setAdmin] = useState<boolean>(readStoredAdmin)
  const session = useMemo<Session>(
    () => ({
      role,
      admin,
      signIn: (next, options) => {
        const asAdmin = adminOverrideEnabled && options?.admin === true
        store(STORAGE_KEY, next)
        store(ADMIN_STORAGE_KEY, asAdmin ? 'true' : null)
        setRole(next)
        setAdmin(asAdmin)
      },
      // an admin changes the role the app treats them as; anyone else is ignored
      actAs: (next) => {
        if (!admin) return
        store(STORAGE_KEY, next)
        setRole(next)
      },
      signOut: () => {
        store(STORAGE_KEY, null)
        store(ADMIN_STORAGE_KEY, null)
        setRole(null)
        setAdmin(false)
      },
    }),
    [role, admin],
  )
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside <SessionProvider>')
  return session
}

// wraps a route's page: renders it for the required role (or an admin), redirects anyone else
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const session = useSession()
  const redirect = guardRedirect(session.role, role, session.admin)
  return redirect ? <Navigate to={redirect} replace /> : children
}
