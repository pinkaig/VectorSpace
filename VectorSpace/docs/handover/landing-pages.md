# Handover: teacher home + student home

For whoever takes over `/teacher` and `/student`.
Sherman · 2026-10-19

---

## 1. Files to open, in this order

1. `src/sections/home/ProjectListsSection.tsx` — **start here.** ~140 lines. This is the whole landing page.
2. `src/pages/TeacherHomePage.tsx` — 3 lines. An `<h1>` and the section above.
3. `src/pages/StudentHomePage.tsx` — 3 lines. The same section.
4. `src/App.tsx:146` and `:148` — the two routes.
5. `src/api/useLoad.ts` — the fetch-on-open hook. 40 lines.

That's it. Five files, and the fourth and fifth are tiny.

## 2. What you'll use

Functions that already work against the real database:

- `listMyProjects(getToken)` → my projects, newest first — `src/api/projects.ts`
- `listTemplates(getToken, filter)` → templates I'm allowed to see — `src/api/templates.ts`
- `createProject(getToken, name, templateId?)` → new project, blank or from a template
- `listRevisions(getToken, projectId)` → the save history of one project
- `sendToStudent(getToken, projectId, studentId)` → gives a student their own copy
- `listMyStudents(getToken)` → students in my classes — `src/api/classes.ts`
- `useLoad(load, reloadKey)` → `{ data, error, reload }`, `data` is `null` while loading
- `useSession()` → `{ role, getToken }`, already `'teacher'` or `'student'` on these routes

## 3. What already works

- Lists templates, with status and save summary
- Lists my own projects, with status, source template and class
- "Start from this" on a template → real project, content copied
- "New blank project"
- Click a project → opens the editor at `/editor/:projectId`
- "History" on a project → every save, when, by whom
- Teachers: send a project or template to a student

## 4. What's missing

- No styling — plain `<ul>`, `<details>`, `<fieldset>`
- Teacher and student pages are identical (they share one component)
- No class filter, no status tabs, no search
- No pagination
- Empty states and errors are bare text
- "Dev tools: send to a student" is a testing box, not the real assign flow

## 5. What to do

1. Read `ProjectListsSection.tsx` all the way through.
2. Split it in two. A teacher wants their classes' work; a student wants their own. Keep the API calls, replace everything around them.
3. Add filters by passing them to `listTemplates` — the arguments already exist (`status`, `classId`, `q`).
4. Style it to V3. There is no CSS of mine in the way.
5. Replace the Dev tools box when the assign flow is designed. `sendToStudent` itself stays.

## 6. Three things not to do

- **Don't filter templates by role in the browser.** The API already decides: students see published only.
- **Don't add a `/templates` route.** A template is a row in the same table with `kind: 'template'`.
- **Don't reimplement the duplicate-name rule.** `distinct_name` on the API owns "Volcano lab (2)".

## 7. Two details in the data worth keeping

- `saveSummary()` has three cases: "never saved", "not edited yet (copied …)", "3 saves, last … by …". The middle one is how "sent but not opened" shows up. You only get it from `current_revision === 1 && template_id`.
- `saved_by_name` is not always the owner. On a copy a teacher sent, the first save is the teacher's. Show the name; don't assume it.

## 8. Offline

With `VITE_API_URL` unset these pages show an error. That's deliberate — there's no server to ask. Offline mode is the standalone editor at `/editor`, nothing else.
