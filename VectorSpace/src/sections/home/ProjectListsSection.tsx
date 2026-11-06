/**
 * @file        ProjectListsSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-10-19
 * @brief       The basic landing content for teachers and students: templates to start from,
 *              my projects with their save history, and (teachers) a dev "send to student" tool.
 *              Plain and unstyled on purpose.
 *
 * @responsibility
 * Loads the templates the signed-in person may see (students: published only, decided by the
 * API) and their own projects, starts a new project from a template, and shows for each project
 * how many times it was saved, when and by whom, with the full list of saves on request, so a
 * tester can see that an edit really reached the database. Both home pages render this; the V3
 * look, cards, class filters and per-role differences are for whoever takes each page over.
 *
 * @boundary
 * Data and a few actions only. The "Dev tools" box (send a project or template to a student) is
 * a testing shortcut for completing a user journey; the real assign flow (class, due date)
 * replaces it. Students and teachers both open projects through /editor/:projectId.
 *
 * @status
 * Current. Placeholder look; the data calls are the part to keep.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { listMyStudents } from '../../api/classes'
import { getMyPermissions, may } from '../../api/permissions'
import { createProject, listMyProjects, listRevisions, sendToStudent } from '../../api/projects'
import { listTemplates } from '../../api/templates'
import { useLoad } from '../../api/useLoad'
import { useSession } from '../../session/session'
import { Button } from '../../ui/button'

const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleString() : 'never')

/** "3 saves, last 19/10/2026, 14:02 by Ms Tan", or a plain note while a copy has not been touched. */
const saveSummary = (revision: number, savedAt: string | null, by: string, fromTemplate: boolean): string =>
  revision === 0 ? 'never saved'
  : revision === 1 && fromTemplate ? `not edited yet (copied ${when(savedAt)})`
  : `${revision} save${revision === 1 ? '' : 's'}, last ${when(savedAt)} by ${by}`

// the saves of one project, loaded only once it is opened
function History({ projectId }: { projectId: string }) {
  const { getToken } = useSession()
  const [open, setOpen] = useState(false)
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>History</summary>
      {open && <Revisions projectId={projectId} getToken={getToken} />}
    </details>
  )
}

function Revisions({ projectId, getToken }: { projectId: string; getToken: ReturnType<typeof useSession>['getToken'] }) {
  const { data, error } = useLoad(() => listRevisions(getToken, projectId), projectId)
  if (error) return <p role="alert">Could not load: {error}</p>
  if (!data) return <p>Loading…</p>
  return (
    <ol reversed>
      {data.map((r) => (
        <li key={r.id} value={r.revision}>
          save {r.revision}: {when(r.created_at)} by {r.created_by_name}
          {r.label ? ` (${r.label})` : ''}
        </li>
      ))}
    </ol>
  )
}

// Dev tools: send a project or template to a student in one of my classes
function SendToStudent({ items, onSent }: { items: { id: string; name: string }[]; onSent: () => void }) {
  const { getToken } = useSession()
  const { data: students, error } = useLoad(() => listMyStudents(getToken), 'students')
  const [itemId, setItemId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [message, setMessage] = useState('')
  if (error) return <p role="alert">Could not load students: {error}</p>
  if (!students) return null

  const send = async () => {
    try {
      const copy = await sendToStudent(getToken, itemId, studentId)
      setMessage(`Sent "${copy.name}" to ${copy.created_by_name}.`)
      onSent()
    } catch (e) {
      setMessage(`Could not send: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
  }

  return (
    <fieldset>
      <legend>Dev tools: send to a student (for testing the journey)</legend>
      <select aria-label="What to send" value={itemId} onChange={(e) => setItemId(e.target.value)}>
        <option value="">Choose a project or template</option>
        {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>{' '}
      <select aria-label="Which student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
        <option value="">Choose a student</option>
        {students.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
      </select>{' '}
      <Button size="small" disabled={!itemId || !studentId} onClick={send}>Send</Button>
      {message && <p role="status">{message}</p>}
    </fieldset>
  )
}

export function ProjectListsSection() {
  const { role, getToken } = useSession()
  const { data, error, reload } = useLoad(
    () => Promise.all([listTemplates(getToken), listMyProjects(getToken), getMyPermissions(getToken)]),
    role ?? '',
  )
  if (error) return <p role="alert">Could not load: {error}</p>
  if (!data) return <p>Loading…</p>
  const [templates, projects, mine] = data
  // the school's "Set up projects from templates"; the API refuses a copy (403) when it is off
  const canStartFromTemplates = may(mine, 'from-templates')

  const start = async (templateId?: string, name = 'My project') => {
    await createProject(getToken, name, templateId)
    reload()
  }
  // a teacher can open any template to edit it; a student only starts copies
  const canOpenTemplates = role === 'teacher'

  return (
    <>
      <Button size="small" onClick={reload}>Refresh</Button>

      <h2>Templates</h2>
      {templates.length === 0 && <p>No templates yet.</p>}
      {/* a hidden button says why it is hidden, so nobody hunts for it */}
      {templates.length > 0 && !canStartFromTemplates && <p>Your school does not let you start projects from templates. Your teacher sends you yours.</p>}
      <ul>
        {templates.map((t) => (
          <li key={t.id}>
            {canOpenTemplates ? <Link to={`/editor/${t.id}`}>{t.name}</Link> : t.name} ({t.status}), {saveSummary(t.current_revision, t.saved_at, t.saved_by_name, false)}{' '}
            {canStartFromTemplates && <Button size="small" onClick={() => start(t.id, t.name)}>Start from this</Button>}
          </li>
        ))}
      </ul>

      <h2>My projects</h2>
      <Button size="small" onClick={() => start()}>New blank project</Button>
      {projects.length === 0 && <p>No projects yet.</p>}
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/editor/${p.id}`}>{p.name}</Link> ({p.status}
            {p.template_name ? `, from ${p.template_name}` : ''}
            {p.class_name ? `, ${p.class_name}` : ''}): {saveSummary(p.current_revision, p.saved_at, p.saved_by_name, !!p.template_id)}
            <History projectId={p.id} />
          </li>
        ))}
      </ul>

      {role === 'teacher' && <SendToStudent items={[...projects, ...templates]} onSent={reload} />}
    </>
  )
}
