# Handover: project templates (teacher) + projects (student)

For whoever starts the template authoring work.
Sherman · 2026-10-19

---

## 1. The one thing to understand first

A template and a project are **the same row in the same table**, told apart by one column:

- `projects.kind = 'template'` — a teacher authors it
- `projects.kind = 'project'` — a student works in it

Starting a project from a template **copies** the template's content into a new row and records
where it came from. After that they're independent: editing the template does not change copies
already made.

Saves are append-only — never edited in place:

```
Project → ProjectVersion (revision 1, 2, 3…) → ContentSnapshot (data JSON + checksum)
```

## 2. Files to open, in this order

1. `src/pages/TeacherTemplateSetupPage.tsx` — **your work goes here.** Currently 3 lines and an `<h1>`. Routed at `/teacher/template`.
2. `src/pages/ProjectEditorPage.tsx` — 56 lines. How a project opens by id.
3. `src/project/remoteProject.ts` — ~120 lines. Load from the server, save back as revisions.
4. `apps/api/app/routers/projects.py` — the endpoints.
5. `src/project/serializer.ts` — read before adding any field to a project.

## 3. What you'll use — API

Everything here works and is tested:

- `GET /projects?kind=template` — list templates (filters: `status`, `class_id`, `q`)
- `POST /projects` `{name, kind: "template"}` — **create a template** (students get 403)
- `POST /projects` `{name, template_id}` — create a project, content copied from the template
- `GET /projects/{id}` — one row, with `current_version_id`
- `PATCH /projects/{id}` `{name?, status?}` — rename, or draft/published/archived
- `POST /projects/{id}/assign` `{student_id}` — give a student their own copy
- `GET /projects/{id}/versions` — the save history
- `POST /projects/{id}/versions` — save a new revision
- `GET /projects/{id}/versions/{vid}` — one save's content

Returns 501 (not built): `DELETE /projects/{id}`, `POST /versions/{vid}/activate`, and all of
`media.py`, `analytics.py`, `rules.py`.

## 4. What you'll use — browser

- `listTemplates` / `createProject` — `src/api/projects.ts`, `src/api/templates.ts`
- `loadRemoteProject(getToken, projectId)` — fetches the row + its scene, and registers the id so later saves know where to go
- `ServerSyncTransport` — turns a queued save into `POST /versions`
- `isRemoteProject(id)` — how `useAutosave` decides server vs. localStorage

**There is no `createTemplate` in the browser yet.** The endpoint takes `kind`, but no browser
function sends it. Adding one is ~4 lines in `src/api/projects.ts`.

## 5. What already works end to end

Signed in as `dev|teacher` against the seeded database:

1. Open a template from the teacher home → loads its real scene from Postgres
2. Edit it → autosave queues → `POST /versions` lands → revision 5 becomes 6
3. The landing page History shows the new save with your name
4. Send it to Aisyah → she gets her own copy, labelled "Sent by Ms Tan Hui Min"
5. Sign in as `dev|student1`, open it, edit it → revision 2, her name

Same route, same editor component, both roles. **The loop closes today.**

## 6. What's missing

- No way to create a template from the UI
- `TeacherTemplateSetupPage` is empty
- `ProjectData` has no idea what a template is — no locked objects, no instructions, no author notes
- No "the student may change this but not that"
- No review step before publishing a template
- A copy never updates when its template changes (deliberate, but maybe not forever)

## 7. Two decisions to make before writing code

**A. Where does "New template" live?** A button on the teacher home, or a mode in the editor?
The answer decides what the setup page is for. Settle it first.

**B. Does a teacher need to lock parts of a scene?** If yes, that's a new field in the scene
JSON and a rule the editor enforces. Cheap now (`ContentSnapshot.data` is JSON), expensive once
the editor work goes deep.

B is a schema decision, not a UI one. Don't let it drift.

## 8. What to do

1. Read `ProjectEditorPage.tsx` and `remoteProject.ts`. They work — don't rewrite them.
2. Add `createTemplate(getToken, name)` to `src/api/projects.ts`, mirroring `createProject`. Add a test next to the ones in `src/api/projects.test.ts`.
3. Build `TeacherTemplateSetupPage` for the parts **about** the template, not its scene: name, status, class, what it's for. All but the last are existing `PATCH` fields.
4. Leave the scene itself to `/editor/:projectId`. Two ways to edit a scene is two bugs.
5. Before adding any field to `ProjectData`, add a validator in `serializer.ts` — it has hard caps (2 MB per project, 5 000 objects, 64 KB per text asset) and will silently drop an unknown field on load.
6. Run `python -m pytest apps/api/tests` and `npm run test` as you go. 63 API + 386 unit tests pass today.

## 9. Known flake, not yours

`tests/e2e/navigation.spec.ts` fails about two runs in three — a 5-second timeout waiting for
the lazily-loaded editor. It predates this work and reproduces on a clean tree. Worth fixing,
but you didn't break it.
