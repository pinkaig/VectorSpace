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

---

## 2026-10-26 · B5: remote media resolver

**Changed**
- `packages/assets/src/resolvers/RemoteMediaResolver.ts`: implemented. It asks the API for an entry and returns a ready descriptor (file), an embed descriptor (approved link) or an error descriptor.
- `packages/assets/src/AssetDescriptor.ts`: an optional `embed: { provider, providerId }` field, plus `embedAssetDescriptor()`.
- `packages/assets/src/mediaKinds.ts`: `EMBED_PROVIDERS`, the embed host allowlist with YouTube only, and `isAllowedEmbed()`.
- `packages/assets/src/ContentGuardResolver.ts`: an embed passes only if its provider and id are allowlisted and it carries no `url` or `blob`.
- `packages/assets/src/index.ts`: exports the new names.
- Tests: `RemoteMediaResolver.test.ts` rewritten with 6 cases, plus 3 new cases in `ContentGuardResolver.test.ts`.

**Decision**
- **Embeds get a field, not a content type.** An embed is a descriptor with an `embed` field and no `contentType`. Rejected alternative: a made-up content type such as `video/x-youtube`. That would add a content type to the security table, which needs the owner's sign-off. An embed downloads nothing, so it has nothing to type-check.
- **The embed allowlist has its own table.** `EMBED_PROVIDERS` sits next to `MEDIA_KIND_SPECS`. Its YouTube id rule matches the server's parser.
- **Signed URLs expire early in the cache.** A file's `expiresAt` is set 60 seconds before the signed URL expires. The existing cache already drops expired entries, so the next resolve fetches a fresh URL. No change to the cache was needed.
- **Pending links don't play for anyone.** A pending link resolves to an error, even for a teacher, so the card shows the fallback. This is the strictest reading of "a link needs approval before it plays".

**Method**
- Example: the card refers to `media-1`, and the resolver calls `GET {api}/projects/{id}/media/media-1` with the bearer token. The reply `{source: 'file', status: 'uploaded', download_url, download_expires_in: 900}` becomes `{status: 'ready', url, contentType, expiresAt: now + 840 s}`.
- For `{source: 'external', provider: 'youtube', provider_id: 'dQw4w9WgXcQ', approval: 'approved'}` it returns `{status: 'ready', embed: {provider: 'youtube', providerId: 'dQw4w9WgXcQ'}}`.

**Check**
- `npx vitest run packages/assets`: 43 tests pass, including "expired URL is refetched" and "an error becomes a descriptor, never a throw".
- `npx tsc --noEmit -p tsconfig.app.json`: clean. A strict standalone check of `packages/assets` and `packages/project`: clean.

**Needs you**
- The resolver is not yet wired into the app. The app's asset chain still sends images and videos to the local catalog. Wiring happens in B6, through `MediaView`.

---

## 2026-10-26 · B6: MediaView

**Changed**
- `src/runtime/MediaView.tsx`: the real player replaces the placeholder. It handles an image, an uploaded video, a YouTube embed, and the "unavailable" fallback. `MediaViewBody` draws one resolved state.
- `src/runtime/mediaLibrary.tsx` (new): `MediaLibraryContext`, which says how a media id is resolved, plus `MediaLibraryProvider` and `createMediaLibrary` for a server project.
- `src/runtime/youtube.ts` (new): `youtubeEmbedUrl` rebuilds the embed address from the video id. `loadYouTubeApi` loads YouTube's player script once, on first use.
- `src/styles.css`: styles for loading, fallback, image, video and embed.
- `src/runtime/mediaView.test.ts` (new): 8 tests. The card e2e test now expects the offline fallback.

**Decision**
- **No test packages added.** Rendering tests use `react-dom/server`, which is already installed, instead of adding a DOM test library. That would be a new npm dependency.
- **The sandbox allows only what the player needs.** That is `allow-scripts allow-same-origin allow-presentation`. There are no popups and no top navigation, so YouTube's "Watch on YouTube" link does nothing. That is deliberate.
- **The YouTube player script is used only to hear state.** It reports ready, playing, paused, ended and errors, so a dead or blocked video switches to "Video unavailable". If the script itself is blocked, the iframe still shows but its state is unknown.
- **Offline by default.** Until a page wraps itself in `MediaLibraryProvider`, every media slot shows "unavailable" with its caption. This includes the local editor, which has no server.

**Method**
- `MediaView` resolves `{kind, assetId}` through the context, then draws the result.
- Example: `{kind: 'video', assetId: 'm2'}` resolves to `embed: {provider: 'youtube', providerId: 'M7lc1UVf-VE'}`. That draws `<iframe src="https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&playsinline=1&enablejsapi=1&origin=…" sandbox="…">`, and `onState` reports `loading`, then `ready`.
- Closing the card unmounts the player, which stops the video.

**Check**
- `npx vitest run`: 56 files, 425 tests pass. `npx tsc --noEmit -p tsconfig.app.json`: clean.
- `textPanels.spec.ts` e2e: both tests pass.
- A one-off browser check used a temporary page with a fake library. That page and its test files were deleted before commit.
  - A PNG loaded (loading, then ready).
  - A WebM played, paused and could seek (loading, ready, playing, paused).
  - A real YouTube video loaded through the player script (loading, then ready).
  - A dead YouTube id became "Video unavailable" with its caption.
  - A missing file and a pending link both showed the fallback.
  - No page errors.
- Not checked: pressing play inside the YouTube player, and any real MinIO file.

**Needs you**
- **Wiring is outside my scope.** For media to load in the app, the page that opens a server project must wrap its tree in `MediaLibraryProvider`. It needs the project id, `apiUrl` and the session's `getToken`. That page is `src/pages/ProjectEditorPage.tsx`, or wherever the runtime view mounts for a server project. Both are outside my scope, so I have not touched them. The change is one wrapper element.
- **Security policy:** the site sends no Content-Security-Policy header today. If one is added, it must allow `frame-src https://www.youtube-nocookie.com` and `script-src https://www.youtube.com`.
- **School networks:** check that YouTube embeds load on a school machine (handover question B7.5).

---

## 2026-10-26 · A4 + A5: hotspot data and the card editor (in-scope parts)

**Changed**
- `src/editor/cardEditorOperations.ts` (new):
  - `saveObjectCard` adds or edits an object's card.
  - `removeObjectCard` removes the card and its text.
  - `createHotspotCard` adds a hotspot zone that holds a card.
  - `checkCardInput` checks the form against the save-file limits.
  - `findCard` returns the card on a host.
- `src/sections/objectPanel/InfoCardSection.tsx` (new): the Info tab form, with title, text, media picker, caption, image description, timer, save and remove, plus a live preview.
- `src/sections/objectPanel/objectPanel.tsx` / `.css`: optional props `infoCard`, `mediaChoices`, `onSaveCard` and `onRemoveCard`. With `onSaveCard`, the Info tab shows the card form. Without it, the tab shows the old placeholders.
- `packages/project/src/index.ts`: `ZoneDefinition.marker?: 'hotspot'`.
- `src/project/serializer.ts`: rejects an unknown marker. Zones without one load as before.
- `src/runtime/TextPanelHost.tsx`: exports `TextNodes`, so the editor preview draws text exactly like the run-time card.
- Tests: `cardEditorOperations.test.ts`, 7 cases.

**Decision**
- **One card per object.** Pressing "Add info card" on an object that already has one edits it. Rejected alternative: stacking several cards. Only one card can open per click, so a second card would be unreachable.
- **Card text assets use a `card-` prefix.** The rule clean-up in `ruleEditorOperations.ts` only deletes `message-` assets, so it can never sweep up a card's text.
- **Images need a description.** The form requires one before saving, which follows the handover's suggestion for question 5. Video descriptions are optional.
- **A hotspot is a sphere zone with `marker: 'hotspot'` and one card attachment.** This follows the handover's suggestion for question 3. Only the data exists so far (see Needs you).

**Method**
- Example: `saveObjectCard(project, sceneId, 'obj-1', { title: 'The Rosetta Stone', body: 'Found in **1799**.', media: { kind: 'image', assetId: 'm1', alt: 'A dark stone slab' } })` returns one new project value. It holds both the attachment `att-card-…` (mode `card`) and the text asset `card-…`. EditorPage commits it once, so one undo removes both.

**Check**
- `npx vitest run`: 57 files, 432 tests pass. `npx tsc --noEmit -p tsconfig.app.json`: clean.
- e2e `textPanels.spec.ts` and `smoke.spec.ts`: 3 passed.
- A one-off browser check used a temporary page wired to the real operations, deleted before commit.
  - An empty title is refused.
  - An image without a description is refused.
  - Saving writes the attachment and text asset shown above, and the button becomes "Save card".
  - The preview shows bold text and the https link, and drops the `javascript:` link.
  - Remove clears both the attachment and the text. No page errors.

**Needs you** (all outside my scope; I made none of these edits)
1. `src/pages/EditorPage.tsx`, to show the card editor in the real editor. EditorPage currently renders the old Inspector and does not mount `ObjectPanel` at all. Whoever owns it needs to render `ObjectPanel` for step 2 and pass the four props:
   ```tsx
   infoCard={selectedCard}                      // from findCard(project, selected)
   mediaChoices={[]}                            // library entries once a server project is open
   onSaveCard={(input) => { const r = saveObjectCard(project, scene.id, selected.id, input); if (!r.ok) return r.error; commit('Save info card', r.project); return null }}
   onRemoveCard={() => commit('Remove info card', removeObjectCard(project, scene.id, selected.id))}
   ```
2. **Opening a card on click (A4/A5 at run time).** Clicking an object or hotspot must call `text.open(cardAttachment)`. Today only a WHEN→DO rule opens text, and wiring that is the rules owner's job. The capability table already lists `hotspot-card` with `click` → `showPanel`.
3. **Drawing hotspots.** `src/viewport/zoneVisuals.ts` and `src/viewport/Viewport.tsx` need to draw a visible marker for `marker: 'hotspot'` zones and let a click on it pick the zone. A catalogue entry, in the catalogue's file, should call `createHotspotCard`.
4. **Card text cleanup on delete.** Deleting an object leaves its card's text asset behind. It is small, harmless and still loads. Object removal belongs to the authoring engine, so I left it.

---

## 2026-10-26 · B7: link parsing, browser and server in step

**Changed**
- `packages/assets/src/parseMediaLink.ts` (new): the browser's link parser. It returns `{ provider, providerId }` or `{ error }`.
- `packages/assets/src/mediaLinkCases.json` (new): 7 links that must be accepted and 20 that must be refused, shared by both test suites.
- `apps/api/app/media_policy.py`: also refuses a backslash, whitespace, or any `@` or `:` in the host part, including `:443`.
- `packages/assets/src/parseMediaLink.test.ts` (new). `apps/api/tests/test_media_policy.py` now reads the shared file instead of its own list.

**Decision**
- **One test list for two parsers.** Rejected alternative: two hand-kept lists. They would drift, and a link the browser accepts but the server refuses, or the reverse, is a confusing bug at best.
- **Both parsers refuse a few tricky inputs.** A browser reads `https://youtu.be\x` as `https://youtu.be/x`, but Python does not. A browser also silently drops `:443`. Refusing both in both parsers keeps them identical. A real YouTube link never contains either.

**Method**
- `parseMediaLink('https://youtu.be/dQw4w9WgXcQ?si=abc')` returns `{ provider: 'youtube', providerId: 'dQw4w9WgXcQ' }`.
- `parseMediaLink('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')` returns `{ error: 'Only YouTube links can be added for now' }`.

**Check**
- `npx vitest run packages/assets`: 70 tests pass. `python -m pytest apps/api/tests`: 105 pass. `tsc`: clean.

**Needs you**
- Nothing new.

---

## 2026-10-26 · B4 + B8: upload and link approval

**Changed**
- `src/api/media.ts` (new): the browser client for the media routes.
  - `listMedia`, `addMediaLink`, `reviewMediaLink`, `deleteMedia`.
  - `uploadMediaFile`: ask for a URL, PUT the file with progress, then confirm.
  - `checkUploadFile`: refuses a wrong-type or over-size file before sending.
  - `playableChoices`: picker choices for the card editor.
- `src/sections/mediaLibrary/MediaLibraryPanel.tsx` + `.css` (new): upload with a progress bar, add a YouTube link with live feedback, a "Waiting for approval" list with Approve / Send back and an optional comment, a list of all entries with status chips, and delete.
- `apps/api/app/routers/media.py`: entries now carry a `label`, the file name or "YouTube video ‹id›", so pickers can show names.
- Tests: `src/api/media.test.ts`, 6 cases. Two assertions were added in `apps/api/tests/test_media.py`.

**Decision**
- **Approval lives in the media library panel for now.** `src/pages/TeacherReviewPage.tsx`, which the handover names, does not exist in the repo, so the panel copies the Approve / Send back pattern. Rejected alternative: building a review page. Pages and routes are not in my scope.
- **Upload progress uses `XMLHttpRequest`.** `fetch` cannot report upload progress. No library was added.
- **Students see a read-only list.** `canEdit` and `canReview` hide the controls. The server enforces the same rules either way, so a hidden button is never the only protection.

**Method**
- Choosing `new.png` runs `POST /projects/p1/media {kind:'image', content_type:'image/png', size_bytes:3, filename:'new.png'}`. Then it runs `PUT <presigned URL>` with `Content-Type: image/png` and progress, then `POST …/f2/confirm`, then refreshes the list. The file shows as "Ready".
- Choosing `bad.svg` shows "Only PNG, JPEG or WebP images and MP4 or WebM videos can be uploaded" and sends nothing.

**Check**
- `npx vitest run`: 59 files, 465 tests pass. `tsc`: clean. `pytest apps/api/tests`: 105 pass.
- A one-off browser check used a temporary page and a fake API, both deleted before commit. Every request had the bearer token and the expected body.
  - A bad link showed the parser's message.
  - Adding a good link worked.
  - Approve with a comment worked, and so did Send back with a comment. Both comments show on the entry.
  - Uploading a PNG produced POST, then PUT to storage with the right type, then confirm.
  - An SVG was refused with no request.
  - Delete removed the entry. No page errors.
- Not checked: a real MinIO upload (needs the deployment) and real upload progress on a large file.

**Needs you**
- **Mounting the panel:** it must be mounted by a teacher-facing page with the project id, the session's `getToken`, and `canEdit`/`canReview` from the user's role. The Teacher Review page or the project editor page could host it. Both are outside my scope. Its `onChange` gives the entries, and `playableChoices(entries)` is exactly what the card editor's `mediaChoices` prop needs.
- **Student proposals:** whether students may propose links (handover question 1) is still open. Today only teachers and admins can add links, as B3 says.
