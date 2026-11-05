/**
 * @file       App.tsx
 * @project    Spatial Experience Builder
 * @author     Sherman Goh Wee Hao
 * @author     Goh Pin Kai
 * @brief      Defines the application shell and manages page routing,
 *             user sessions, role-based navigation, route protection,
 *             and lazy loading of the 3D editor.
 *
 * @copyright  Copyright (C) 2026 DigiPen Institute of Technology.
 *             Reproduction or disclosure of this file or its contents without the
 *             prior written consent of DigiPen Institute of Technology is prohibited.
 */
/****************************************************************************************************/
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router'
import AdminAccountsPage from './pages/AdminAccountsPage'
import AdminLayout from './pages/AdminLayout'
import AdminOverviewPage from './pages/AdminOverviewPage'
import AdminPermissionsPage from './pages/AdminPermissionsPage'
import AdminRoomsPage from './pages/AdminRoomsPage'
import LoginPage from './pages/LoginPage'
import StudentHomePage from './pages/StudentHomePage'
import TeacherHomePage from './pages/TeacherHomePage'
import TeacherLayout from './pages/TeacherLayout'
import { LoadingRoom } from './ui/LoadingRoom'
import TeacherReviewPage from './pages/TeacherReviewPage'
import TeacherResultsPage from './pages/TeacherResultsPage'
import TeacherPreviewPage from './pages/TeacherPreviewPage'
import { ApiError } from './api/client'
import { auth0Enabled } from './session/auth0'
import { RequireAdmin, RequireRole, SessionProvider, adminOverrideEnabled, homePath, useSession, type Role } from './session/session'
import { isSoundDebugOn } from './audio/soundDebugFlag'

// The editor (three.js, the authoring engine, the audio catalog) is by far the largest part
// of the app, so it is downloaded when someone opens /editor, not on the login page.
const EditorApplication = lazy(() => import('../apps/editor/src/EditorApplication'))
// the same editor opened by project id (/editor/:projectId), fetched from the API first
const ProjectEditorPage = lazy(() => import('./pages/ProjectEditorPage'))
// the template setup page embeds the 3D viewport, which pulls in the audio package, so it is lazy too
const TeacherTemplateSetupPage = lazy(() => import('./pages/TeacherTemplateSetupPage'))
// a shared project's page (/visit/:slug) shows the 3D project, so it is lazy too
const VisitPage = lazy(() => import('./pages/VisitPage'))
// the Review tab's "Walk through it as a visitor": full page, like a share link
const TeacherWalkPage = lazy(() => import('./pages/TeacherWalkPage'))
// Chloe's editor-layout skeleton (slot placeholders), previewed at #/layout-test in dev only.
const LayoutTest = lazy(() => import('./editorLayoutTest').then((module) => ({ default: module.LayoutTest })))
// The motion board (/motion-board, dev only). The ternary, not a bare lazy(), so a production build folds
// this to null and never emits the board's chunk.
const MotionBoard = import.meta.env.DEV ? lazy(() => import('./debug/MotionBoard')) : null
const AssetInventoryBoard = import.meta.env.DEV ? lazy(() => import('./debug/AssetInventoryBoard')) : null
// The sound debug panel: in production too, but only for a browser that opened the site with ?sounddebug.
const SoundDebugPanel = isSoundDebugOn() ? lazy(() => import('./audio/SoundDebugPanel')) : null
// The sound designer's page (#/sound-design), behind the same ?sounddebug switch, signed in or not.
const SoundDesignPage = isSoundDebugOn() ? lazy(() => import('./audio/SoundDesignPage')) : null

// where a signed-in visitor lands when the URL is empty or unknown, signed-out goes to login
function Landing() {
  const { role, admin } = useSession()
  return <Navigate to={role ? homePath(role, admin) : '/login'} replace />
}

// the temporary sign-in: pick a role (or the admin override), then go to that role's home
function SignIn() {
  const { signIn, rejected, signOut, role, admin } = useSession()
  const navigate = useNavigate()
  const [problem, setProblem] = useState<string | null>(null)
  // a shared project's "Sign in" sends ?next=/visit/<slug> so the visitor goes back to it;
  // nothing else is honoured, so the link cannot send someone elsewhere
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/visit/') ? params.get('next') : null
  // where it navigates to is what signIn lands on, which the server decides when there is one:
  // an admin goes to /admin, everyone else to the page named after their role
  const onSignIn = (role: Role, admin?: boolean) => {
    setProblem(null)
    signIn(role, { admin }).then((landed) => navigate(next ?? homePath(landed.role, landed.admin)), (error: Error) => setProblem(
      error instanceof ApiError && error.status === 403 ? 'This account is not set up yet.' : `Could not sign in: ${error.message}`,
    ))
  }
  // Auth0 returns to the hash route the sign-in started from, which is this page, and the
  // role arrives from /me a moment later; once it has, move on instead of waiting for a click
  if (auth0Enabled && role) return <Navigate to={next ?? homePath(role, admin)} replace />
  // a refusal from the sign-in provider's own session outlives a click, so it is shown
  // whether or not anything was clicked, and it offers the way out that a retry cannot
  return (
    <>
      <LoginPage
        showAdmin={adminOverrideEnabled}
        hostedLogin={auth0Enabled}
        onSignIn={onSignIn}
        stranded={rejected !== null}
        onUseAnotherAccount={signOut}
      />
      {(rejected ?? problem) && <p role="alert" className="sign-in-problem">{rejected ?? problem}</p>}
    </>
  )
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
        {admin && <Link to="/admin">Admin</Link>}
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
      <p role="note"><strong>Placeholder page:</strong> unstyled. Only the project and template lists work; everything else is not built yet.</p>
      {children}
    </>
  )
}

// the strip only for admin sessions, so they keep "Act as" and the page links;
// teachers and students see the page on its own
function AdminNav({ children }: { children: ReactNode }) {
  const { admin } = useSession()
  return admin ? <WithNav>{children}</WithNav> : <>{children}</>
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
 *   <Outlet /> in Layout where the child page should appear. The /admin routes below are a
 *   working example: pages/AdminLayout.tsx is the frame, each admin page fills its middle.
 */

export default function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<SignIn />} />
          {/* a project's share link: open to anyone, the server decides who sees it */}
          <Route path="/visit/:slug" element={<Suspense fallback={<p>Opening the project…</p>}><VisitPage /></Suspense>} />
          {/* the VThere Admin area: one frame (top bar, sidebar) around four pages */}
          <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="permissions" element={<AdminPermissionsPage />} />
            <Route path="accounts" element={<AdminAccountsPage />} />
            <Route path="rooms" element={<AdminRoomsPage />} />
          </Route>
          <Route path="/teacher" element={<RequireRole role="teacher"><AdminNav><TeacherLayout /></AdminNav></RequireRole>}>
            <Route index element={<TeacherHomePage />} />
            <Route path="review" element={<TeacherReviewPage />} />
            <Route path="results" element={<TeacherResultsPage />} />
          </Route>
          <Route path="/teacher/template" element={<RequireRole role="teacher"><AdminNav><Suspense fallback={<p>Loading template setup…</p>}><TeacherTemplateSetupPage /></Suspense></AdminNav></RequireRole>} />
          {/* "Preview as a student" from template setup: the dark preview bar over a student page */}
          <Route path="/teacher/review/:projectId/walk" element={<RequireRole role="teacher"><Suspense fallback={<p>Opening the project…</p>}><TeacherWalkPage /></Suspense></RequireRole>} />
          <Route path="/teacher/preview" element={<RequireRole role="teacher"><TeacherPreviewPage /></RequireRole>} />
          <Route path="/student" element={<RequireRole role="student"><AdminNav><StudentHomePage /></AdminNav></RequireRole>} />
          <Route path="/editor" element={<RequireRole role="teacher"><Suspense fallback={<LoadingRoom />}><EditorApplication /></Suspense></RequireRole>} />
          <Route path="/editor/:projectId" element={<RequireRole role={['teacher', 'student']}><Suspense fallback={<LoadingRoom />}><ProjectEditorPage /></Suspense></RequireRole>} />
          {import.meta.env.DEV && MotionBoard && <Route path="/motion-board" element={<Suspense fallback={<p>Loading board…</p>}><MotionBoard /></Suspense>} />}
          {import.meta.env.DEV && <Route path="/layout-test" element={<Suspense fallback={<p>Loading layout…</p>}><LayoutTest /></Suspense>} />}
          {import.meta.env.DEV && AssetInventoryBoard && <Route path="/asset-inventory" element={<Suspense fallback={<p>Loading inventory…</p>}><AssetInventoryBoard /></Suspense>} />}
          {SoundDesignPage && <Route path="/sound-design" element={<Suspense fallback={<p>Loading sounds…</p>}><SoundDesignPage /></Suspense>} />}
          <Route path="*" element={<Landing />} />
        </Routes>
        {SoundDebugPanel && <Suspense fallback={null}><SoundDebugPanel /></Suspense>}
      </HashRouter>
    </SessionProvider>
  )
}
