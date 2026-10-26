# Info card and media: progress log

One entry per step group, newest last. The plan these follow is in the three handover files:
`info-card-and-media-overview.md`, `info-card-work-package.md` and `image-video-work-package.md`.

---

## 2026-10-26 · Step 0: shared types

**Changed**
- `packages/project/src/index.ts`: adds `ImageAttachment` and `VideoAttachment` to the `Attachment` union, plus `CardMedia`, `MediaViewState` and `MediaViewProps`. It also re-exports the capability lookups.
- `packages/project/src/capabilities.ts` (new): one read-only descriptor per attachment kind and variant, with `getAttachmentCapabilities` and `listAttachmentCapabilities`.
- `src/project/serializer.ts`: save files may now contain `image` and `video` attachments.
- `src/project/model.ts`: re-exports the new types and lookups for app code.
- Tests: new `capabilities.test.ts`, plus new cases in `attachments.test.ts` and `serializer.test.ts`.

**Decision**
- Image and video attachments hold only `assetId`, the id of a media library entry. Caption and alt text live on `CardMedia`, the card's media slot, not on the attachment. Rejected alternative: caption on the attachment. That would put the same text in two places once the card exists.
- Each descriptor entry marks each action and event as `available` or `planned`. Text actions and events are `available` because code handles them today. Every media action and event is `planned`. Rejected alternative: listing names with no status. The rules owner could then offer authors actions that do nothing yet.
- The table includes `audio` too, so every attachment kind has an entry. It only describes the existing audio actions and changes no audio code.
- Hover appears nowhere. A test checks this.

**Method**
- A capability descriptor is a plain data entry. It says what an attachment can do, what events it sends, and what settings each action takes. The rules side reads it and never imports media code.
- Example: `getAttachmentCapabilities('video-screen')` returns an entry with `attachmentKind: 'video'` and `form: 'object'`. Its actions are `playMedia`, `pauseMedia` and `stopMedia`, all `planned`. An unknown key such as `'hologram'` returns `undefined`.
- The table is frozen, so no caller can change what another caller reads.
- Example save: `{ "id": "att-2", "kind": "video", "assetId": "media-clip" }` now loads. Before Step 0 it failed with "unknown kind".

**Check**
- `npx vitest run`: 54 files, 396 tests, all pass.
- `npx tsc --noEmit -p tsconfig.app.json`: no errors from this work. Seven errors remain in `src/pages/EditorPage.tsx`. They were already on the branch before Step 0 (see Needs you).
- Old saves: a test loads a save with only audio and text attachments and checks they come back unchanged.

**Needs you**
- `src/pages/EditorPage.tsx` does not compile on `weian_branch`. The merge of `Working` (commit `df90054`) brought back the old Inspector, which uses functions and imports that were removed earlier. This is outside my scope, so I did not touch it.
- The overview says the serializer allowlist is in `packages/project`. It is actually in `src/project/serializer.ts`, and it is a validator that rejects unknown kinds, not a table. I edited it there because the allowlist is in scope.
- `src/pages/TeacherReviewPage.tsx`, named in the handover for B8, does not exist in the repo.

---

## 2026-10-26 · A1: card shape

**Changed**
- `packages/project/src/index.ts`: `TextPresentation.mode` gains `'card'`, plus `media?: CardMedia` and `fields?: CardField[]`. Adds the new `CardField` type.
- `src/project/serializer.ts`: accepts `card` mode and checks `media` and `fields` when a save loads.
- `src/project/model.ts`: re-exports `CardField`.
- `src/project/serializer.test.ts`: four new cases.

**Decision**
- These answer the work package's open questions. The owner did not answer them, so I used the handover's suggestions:
  1. `label`, `surface` and `dialogue` stay in the type as reserved names. Nothing renders them. Deleting them would break saves that already use them; one existing test uses `dialogue`.
  2. There is one close behaviour everywhere, with no "any press closes". This lands in A2.
  3. A hotspot is a zone with a marker. This lands in A4.
  4. A long card scrolls. `paging` stays unused.
- No separate `caption` on the presentation. The work package lists one, but `CardMedia` already has `caption`, and two caption fields would drift apart. Rejected alternative: both fields.
- The caption and alt text cap is 500 characters, separate from the 64 KB text cap, which stays unchanged.

**Method**
- A card is still a text attachment. It is just one whose `presentation.mode` is `'card'`.
- Example save entry: `{ kind: 'text', assetId: 'text-1', presentation: { mode: 'card', title: 'Rosetta Stone', media: { kind: 'image', assetId: 'media-stone', alt: '…' } } }`. It loads and saves back identically.
- `media: { kind: 'audio', … }` fails to load with "invalid media".

**Check**
- `npx vitest run src/project`: 49 tests pass, including the card round-trip and the old-save test from Step 0.
- `npx tsc --noEmit -p tsconfig.app.json`: clean.

**Needs you**
- Please confirm or overturn the four answers above.

---

## 2026-10-26 · A2 + A3: close behaviour and the card view

**Changed**
- `src/runtime/TextPanelHost.tsx`: draws `panel` and `card` modes. The "any press closes every panel" listener is gone. Escape now goes through `panelKeys.ts`. A card shows `MediaView` under its title.
- `src/runtime/panelKeys.ts` (new): the Escape rule as a plain function. Escape closes the top panel only, and every other key does nothing.
- `src/runtime/MediaView.tsx` (new): a placeholder that draws a labelled box plus the caption. Track B replaces its body.
- `packages/text/src/TextStateStore.ts`, `PanelManager.ts`, `TextSystem.ts`: a panel's status now carries `media`, for cards only.
- `src/styles.css`: card and media-box styles.
- Tests: `panelKeys.test.ts`, five new cases in `TextSystem.test.ts`, and a new e2e test in `tests/e2e/textPanels.spec.ts`.

**Decision**
- No new timer for `autoCloseMs`. The 3D view's frame loop already calls `text.tick()` while playing, and closing a panel removes its deadline. A second timer would race the first. A test checks that a card closes on time and that a card closed by hand stays closed.
- Escape is caught in the capture phase on `window`, the phase that runs before any other listener, and stopped there. So one press closes one panel and does not also leave Play. Rejected alternative: Escape only on the focused panel, which was the old behaviour. It did nothing once focus moved into the scene.
- Card layout is title, then media and caption, then text. The work package says both "media slot under the title" (section 4) and "title, text, then MediaView" (A3). I chose "under the title" so the picture stays in view when the text scrolls.
- The caption is drawn by `MediaView`, not the card, because the caption must stay visible when the media is unavailable (overview decision 6).
- The X button's accessible name is now "Close", as the work package asks. It was "Close panel", and no test used the old name.

**Method**
- Example: two cards are open and the visitor presses Escape. `handlePanelKey` sees a top panel, closes it and returns `true`, so the host stops the key. The second Escape closes the other card. The third finds no panel, returns `false`, and RuntimeView leaves Play.
- Clicking the scene no longer closes anything.

**Check**
- `npx vitest run`: 55 files, 409 tests pass.
- `npx tsc --noEmit -p tsconfig.app.json`: clean.
- `npx playwright test --project=chromium`: 10 passed, 1 skipped, 1 failed. Both text panel tests pass, including the existing "Escape closes in order" one. The failure is `navigation.spec.ts` "a teacher can walk login, home, editor…". It clicks a "Home" button the new editor top bar no longer has. It fails the same way with my changes stashed, so this work did not cause it.

**Needs you**
- The navigation e2e failure belongs to whoever owns the editor top bar. It is outside my scope.
- Plain pop-ups also lost "any press closes". I took the suggested answer of one behaviour everywhere. Say if plain pop-ups should keep it.

---

## 2026-10-26 · B2 + B3: media library entry and backend routes

**Changed**
- `apps/api/app/models.py`: new `MediaLink` model, the `media_links` table, for external links with an approval state.
- `apps/api/alembic/versions/0004_media_links.py` (new): creates that table.
- `apps/api/app/media_policy.py` (new): the backend's upload allowlist and `parse_media_link`, the server-side YouTube link parser.
- `apps/api/app/storage.py`: adds `head_object` (size and type of an uploaded file) and `delete_object`.
- `apps/api/app/routers/media.py`: the four routes are implemented, plus `POST /{id}/confirm`, `POST /links` and `PATCH /links/{id}`.
- `apps/api/tests/test_media.py`, `test_media_policy.py` (new): 39 tests.

**Decision**
- **Separate links table:** links live in a sibling `media_links` table, as the handover suggests. `media_assets` and its upload path are unchanged.
- **Who does what:** these are the handover's suggestions, plus what the code shows.
  - Teachers and admins who can change a project upload files and add links. Students cannot, as B3 says.
  - Any teacher or admin who can see the project may approve or send back a link.
  - Approval is per project.
  - The backend already has an `admin` role, which answers open question 4.
- **New links start pending, even a teacher's own.** The same teacher may approve it straight away. Rejected alternative: auto-approving a teacher's own link. That would skip the approval state that decision 5 asks for.
- **Students see only playable entries:** uploaded files and approved links. Pending, failed and sent-back entries return 404 for them.
- **Upload confirmation:** a presigned PUT, a time-limited upload link straight to storage, cannot limit the file size. So `confirm` reads the stored object's real size and type. On any mismatch it marks the row `failed` and deletes the object.
- **Link storage:** the stored `url` is rebuilt from the YouTube id. The pasted text is never stored.
- **Kinds:** only `image` and `video` are uploaded through this API. Audio has its own library (out of scope) and text is inline.

**Method**
1. The browser asks `POST /projects/{id}/media` with kind, content type, size and file name.
2. The server checks them against `MEDIA_KIND_SPECS`, creates a `pending` row, and returns a presigned PUT URL.
3. The browser PUTs the file.
4. `POST …/confirm` checks storage and flips the row to `uploaded`.
5. `GET …/{id}` then returns a download URL that lasts 900 seconds.

Example: `POST …/links {"url": "https://youtu.be/dQw4w9WgXcQ?si=x"}` stores `provider: youtube`, `provider_id: dQw4w9WgXcQ`, `url: https://www.youtube.com/watch?v=dQw4w9WgXcQ`, `approval: pending`.

**Check**
- `python -m pytest apps/api/tests`: 102 passed (63 before, plus 39 new). These include the allowlist parity test, which reads `packages/assets/src/mediaKinds.ts` and fails if the two lists drift, and the hostile-link list.
- `alembic upgrade 0003:0004 --sql` renders the expected `CREATE TABLE`. The migration was not run against a real Postgres database. There is none here.
- The Python test packages are not in the repo's setup. I installed `requirements.txt` into a separate environment outside the repo to run them.

**Needs you**
- Please confirm the table shape and the permissions above with the backend owner.
- Storage is faked in the tests. Nothing has been checked against real MinIO, including B10's range requests.
