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
 * /editor is opened. For an admin session it lists every page and offers the role switch.
 * Owns no editor or project state.
 *
 * @inputs
 * The URL hash (#/login, #/teacher, #/editor, ...), the signed-in role and the admin flag.
 *
 * @outputs
 * The page for the current route, and a redirect when the role may not open it.
 *
 * @members
 * App, Landing, SignIn, WithNav, pageLinks, the route table.
 *
 * @boundary
 * The editor itself is src/pages/EditorPage.tsx, reached through the apps/editor
 * boundary. Who is signed in lives in src/session/session.tsx.
 *
 * @dependencies
 * React, react-router (hash router), the pages in src/pages.
 *
 * @status
 * Current. Page links live in WithNav until each page has its own navigation. The admin
 * override (every page, switchable role) is temporary and goes with the temporary sign-in.
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
import { RequireRole, SessionProvider, adminOverrideEnabled, useSession, type Role } from './session/session'

// The editor (three.js, the authoring engine, the audio catalog) is by far the largest part
// of the app, so it is downloaded when someone opens /editor, not on the login page.
const EditorApplication = lazy(() => import('../apps/editor/src/EditorApplication'))

// where a signed-in visitor lands when the URL is empty or unknown, signed-out goes to login
function Landing() {
  const { role } = useSession()
  return <Navigate to={role ? `/${role}` : '/login'} replace />
}

// the temporary sign-in: pick a role (or the admin override), then go to that role's home
function SignIn() {
  const { signIn } = useSession()
  const navigate = useNavigate()
  return <LoginPage showAdmin={adminOverrideEnabled} onSignIn={(role, admin) => { signIn(role, { admin }); navigate(`/${role}`) }} />
}

const pageLinks: Record<Role, { to: string; label: string }[]> = {
  teacher: [{ to: '/teacher', label: 'Home' }, { to: '/teacher/template', label: 'Template setup' }, { to: '/editor', label: 'Editor' }],
  student: [{ to: '/student', label: 'Home' }],
}
const roles = Object.keys(pageLinks) as Role[]

// every page, for an admin: the same links, each prefixed with the role that owns it
const allPageLinks = roles.flatMap((owner) => pageLinks[owner].map((link) => ({ to: link.to, label: `${owner}: ${link.label}` })))

// links between the placeholder pages and a sign-out, in one strip here rather than
// inside each page, so the pages stay free for their owners to fill in. An admin session
// gets every page plus "Act as", which switches the role without signing in again.
function WithNav({ children }: { children: ReactNode }) {
  const { role, admin, actAs, signOut } = useSession()
  const navigate = useNavigate()
  const links = admin ? allPageLinks : role ? pageLinks[role] : []
  return (
    <>
      <nav className="page-nav">
        {links.map((link) => <Link key={link.to} to={link.to}>{link.label}</Link>)}
        {admin && role && (
          <label>
            <span>Act as</span>
            <select value={role} onChange={(event) => { const next = event.target.value as Role; actAs(next); navigate(`/${next}`) }}>
              {roles.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        )}
        <button className="button ghost" onClick={signOut}>Sign out</button>
      </nav>
      {children}
    </>
  )
}

/*
 * Working with React Router here: a short recipe
 *
 * Add a page
 *   1. Create src/pages/MyPage.tsx that exports a default component.
 *   2. Import it at the top of this file.
 *   3. Add <Route path="/my-page" element={<MyPage />} /> inside <Routes> below. Wrap the
 *      element in <RequireRole role="teacher"> (or "student") if only that role may open
 *      it, as the routes below do; leave the wrapper off for a page anyone may open.
 *   4. Add { to: '/my-page', label: 'My page' } to that role's list in pageLinks so WithNav
 *      shows it (an admin session lists every page from the same table).
 *
 * Go from one page to another
 *   <Link to="/teacher">Home</Link>      a link; the page does not reload
 *   const navigate = useNavigate()       then navigate('/teacher') from code, e.g. after a save
 *   Do not use <a href> or window.location: they reload the whole app and drop its state.
 *   Paths are written absolute ('/teacher'). The address bar shows them after a '#'
 *   (this is HashRouter), which is why the web host needs no rewrite rules.
 *
 * Read the URL
 *   <Route path="/student/:projectId" ...> and useParams() returns { projectId }.
 *   useSearchParams() reads and sets ?key=value; useLocation() gives the current path.
 *
 * Who may open a page
 *   RequireRole picks which page a visitor is shown. It is not security: see session.tsx.
 *
 * A shared header or sidebar for several pages (WithNav stands in until then)
 *   Use a layout route: <Route element={<Layout />}> around the child <Route>s, and put
 *   <Outlet /> in Layout where the child page should appear.
 */

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
