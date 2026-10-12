/**
 * @file        session.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-12
 * @reviewed    2026-10-12
 * @brief       Who is signed in (teacher or student) and the route guard that uses it.
 *
 * @responsibility
 * Holds the signed-in role for this browser tab, remembers it across a refresh, and
 * redirects a visitor away from a page their role may not open.
 *
 * @inputs
 * signIn(role) and signOut() calls from the pages; the stored role on first load.
 *
 * @outputs
 * The current role through useSession(), and a redirect from RequireRole.
 *
 * @members
 * Role, guardRedirect, SessionProvider, useSession, RequireRole.
 *
 * @boundary
 * Sign-in here is temporary: choosing a role is all it takes. Auth0 replaces the inside
 * of SessionProvider (the role then comes from the verified login); useSession() and
 * RequireRole, and so every page that uses them, stay as they are.
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

// sessionStorage, not localStorage: a refresh keeps you signed in, but a new tab or a
// closed browser starts at the login page, which is what a shared classroom machine wants
const STORAGE_KEY = 'vectorspace-session-role'

const readStoredRole = (): Role | null => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    return stored === 'teacher' || stored === 'student' ? stored : null
  } catch {
    return null
  }
}

const storeRole = (role: Role | null) => {
  try {
    if (role) sessionStorage.setItem(STORAGE_KEY, role)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage blocked (private window): the role still works for this page load
  }
}

// where a visitor with `role` must go to be allowed on a page that needs `required`,
// or null if they may stay. Signed out goes to login, the wrong role to its own home.
export const guardRedirect = (role: Role | null, required: Role): string | null =>
  role === required ? null : role ? `/${role}` : '/login'

type Session = { role: Role | null; signIn: (role: Role) => void; signOut: () => void }

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(readStoredRole)
  const session = useMemo<Session>(
    () => ({
      role,
      signIn: (next) => {
        storeRole(next)
        setRole(next)
      },
      signOut: () => {
        storeRole(null)
        setRole(null)
      },
    }),
    [role],
  )
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside <SessionProvider>')
  return session
}

// wraps a route's page: renders it for the required role, redirects anyone else
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const redirect = guardRedirect(useSession().role, role)
  return redirect ? <Navigate to={redirect} replace /> : children
}
