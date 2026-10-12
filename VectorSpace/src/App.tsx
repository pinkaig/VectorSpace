/**
 * @file        App.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-10-12
 * @brief       Application shell: the route table that decides which page a URL shows.
 *
 * @responsibility
 * Wraps the app in the router and the session, maps each URL to its page, keeps the
 * pages a visitor may not open behind RequireRole, and fetches the editor only when
 * /editor is opened. Owns no editor or project state.
 *
 * @inputs
 * The URL hash (#/login, #/teacher, #/editor, ...) and the signed-in role.
 *
 * @outputs
 * The page for the current route, and a redirect when the role may not open it.
 *
 * @members
 * App, Landing, SignIn, WithNav, the route table.
 *
 * @boundary
 * The editor itself is src/pages/EditorPage.tsx, reached through the apps/editor
 * boundary. Who is signed in lives in src/session/session.tsx.
 *
 * @dependencies
 * React, react-router (hash router), the pages in src/pages.
 *
 * @status
 * Current. Page links live in WithNav until each page has its own navigation.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router'
import LoginPage from './pages/LoginPage'
import StudentHomePage from './pages/StudentHomePage'
import TeacherHomePage from './pages/TeacherHomePage'
import TeacherTemplateSetupPage from './pages/TeacherTemplateSetupPage'
import { RequireRole, SessionProvider, useSession, type Role } from './session/session'

// The editor (three.js, the authoring engine, the audio catalog) is by far the largest part
// of the app, so it is downloaded when someone opens /editor, not on the login page.
const EditorApplication = lazy(() => import('../apps/editor/src/EditorApplication'))

// where a signed-in visitor lands when the URL is empty or unknown, signed-out goes to login
function Landing() {
  const { role } = useSession()
  return <Navigate to={role ? `/${role}` : '/login'} replace />
}

// the temporary sign-in: pick a role, then go to that role's home
function SignIn() {
  const { signIn } = useSession()
  const navigate = useNavigate()
  return <LoginPage onSignIn={(role) => { signIn(role); navigate(`/${role}`) }} />
}

const pageLinks: Record<Role, { to: string; label: string }[]> = {
  teacher: [{ to: '/teacher', label: 'Home' }, { to: '/teacher/template', label: 'Template setup' }, { to: '/editor', label: 'Editor' }],
  student: [{ to: '/student', label: 'Home' }],
}

// links between the placeholder pages and a sign-out, in one strip here rather than
// inside each page, so the pages stay free for their owners to fill in
function WithNav({ children }: { children: ReactNode }) {
  const { role, signOut } = useSession()
  return (
    <>
      <nav className="page-nav">
        {role && pageLinks[role].map((link) => <Link key={link.to} to={link.to}>{link.label}</Link>)}
        <button className="button ghost" onClick={signOut}>Sign out</button>
      </nav>
      {children}
    </>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<SignIn />} />
          <Route path="/teacher" element={<RequireRole role="teacher"><WithNav><TeacherHomePage /></WithNav></RequireRole>} />
          <Route path="/teacher/template" element={<RequireRole role="teacher"><WithNav><TeacherTemplateSetupPage /></WithNav></RequireRole>} />
          <Route path="/student" element={<RequireRole role="student"><WithNav><StudentHomePage /></WithNav></RequireRole>} />
          <Route path="/editor" element={<RequireRole role="teacher"><Suspense fallback={<p>Loading editor…</p>}><EditorApplication /></Suspense></RequireRole>} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </HashRouter>
    </SessionProvider>
  )
}
