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
