# Text System

**Status:** Design specification (2026-09-21). Nothing in this doc is implemented yet. It becomes a description of built code as each build-sequence step lands.
**Baseline phase:** Post-baseline subsystem. Builds on the attachment model and the When-Do action registry. See [8-stage baseline overview](../baseline-phases.md).
**Companions:** [`attachment-integration.md`](attachment-integration.md) defines the attachment, the host relationship and the resolver chain this system relies on. [`attachment-types-and-asset-manager.md`](attachment-types-and-asset-manager.md) is the status map. Sibling designs: [`audio-system.md`](audio-system.md), [`image-system.md`](image-system.md), [`video-system.md`](video-system.md).
**Architecture decision:** [`repository.md`](../architecture/UNDATED--FOUNDATION--repository.md) L67-69 treats a new canonical subsystem as an architectural change. This doc is the proposal for `packages/text`; the package is created only after approval.

## Purpose

Show words: a label over an object, an information panel opened by a click, a line of dialogue, a longer article in an
overlay, a sign in the world. It owns the text content model, turning author text into a safe, renderable structure,
measuring and paging it, and reporting which panels are open so other systems can ask.

Text is the smallest attachment type and the one with the most security weight, because author-written content is
displayed to other people. The whole design leans on one rule: **the system never produces HTML.** Text becomes a node
tree, and React or a canvas draws the tree.

Today there is nothing. `showPanel` appears only in a doc comment (`packages/project/src/index.ts:119-121`) and in
tests (`packages/interaction/src/actions/registry.test.ts:15`); no executor is registered (`Viewport.tsx:278` creates
the registry and registers nothing). There is no text asset kind. Text does not need the backend `media_assets.kind`
to have a `text` value (section 1: text is project data, not media storage), so this is not a blocker the way it is
for a genuinely file-backed kind.

## Boundary

```text
Rule engine: showPanel / hidePanel / advancePanel         Editor: inspector, text editor, preview
        |                                                        |
        v                                                        v
+---------------------------------------------------------------------------+
| packages/text  (pure TypeScript; no React, no Three.js)                    |
|                                                                           |
|  registerTextActions --> TextSystem (facade)                               |
|                             |- TextLibrary   (meta + content, project data)|
|                             |- RichTextParser  markdown subset -> TextNode[]|
|                             |- UrlPolicy       allowed link schemes        |
|                             |- PanelManager    open panels, order, paging  |
|                             |- TextLayout      measure + wrap + page       |
|                             |- TextStateStore  -> subscribe / query        |
|                             '- TextEventBridge  -> rule triggers           |
|                                                                           |
|  TextMeasurer (interface):  CanvasTextMeasurer | FakeTextMeasurer (tests)   |
+---------------------------------------------------------------------------+
        ^ AssetRef -> AssetDescriptor (always ready; no network) | TextNode[] + panel state
        | InlineTextResolver                                     v
   Asset Manager                    src/ overlay layer (React): TextPanelHost, dialogue box
                                    src/viewport/mediaSurfaces.ts: canvas -> CanvasTexture on a quad
```

`TextMeasurer` wraps canvas `measureText`, which needs a browser, so tests run against a fake with fixed glyph widths.
The package imports `@vthere/project` and `@vthere/assets` only. Rendering is in `src/`: React draws overlay panels and
Three.js shows a canvas texture for in-world text.

## Where to find things (planned)

| Concern | Planned owner |
|---|---|
| Facade and public API | `packages/text/src/TextSystem.ts` |
| Markdown-subset parser and node types | `packages/text/src/parse/` |
| URL policy | `packages/text/src/UrlPolicy.ts` |
| Panels, paging, dialogue queue | `packages/text/src/PanelManager.ts` |
| Measure, wrap, page | `packages/text/src/layout/` and `TextMeasurer.ts`, `CanvasTextMeasurer.ts`, `FakeTextMeasurer.ts` |
| Content lookup (project data) | `packages/text/src/TextLibrary.ts` |
| State store and queries | `packages/text/src/TextStateStore.ts` |
| Action executors and event bridge | `packages/text/src/actions/` |
| Types shared with the project file | `packages/project/src/index.ts` |
| Inline text resolver | `packages/assets/src/resolvers/InlineTextResolver.ts` |
| Overlay panels (React) and in-world canvas text | `src/` and `src/viewport/mediaSurfaces.ts` |

## Owns

- The text content model: project-data text, plain and markdown-subset (section 1)
- Parsing author text into a safe `TextNode[]` tree, and the link policy
- Length, encoding and count limits
- Measuring, wrapping and paging text for a given box and font
- Which panels are open, their order, focus request and paging state; dialogue sequencing
- The state store and the events text raises
- Executors for the text actions

## Does not own

- File-backed text storage or a text byte cache; text never goes through the network (section 1)
- Drawing: React draws overlay panels, `src/viewport/` draws in-world text
- Fonts: which font files ship, their licensing, and the `FontRoleMap` (app-owned); the text system only ever receives a resolved `FontSpec` (section 5)
- Translation memory or an external localisation service
- Timed captions for audio and video: see below, they share a parser but are owned by the audio and video systems
- Evaluating rules (`packages/interaction`)
- A document-editing workspace for long-form writing outside a project's text limits (section 1, "What was deferred, not solved")

## The three uses

Every use of text in the experience is one of the three presentation modes already defined in section 4, aimed at a
different host:

| # | Use | Host | Presentation | Rendered by |
|---|---|---|---|---|
| 1 | A 3D panel object placed in the world (a sign, a poster, a wall of text) | The `panel` `SceneObject` primitive (`attachment-integration.md` section 4.3) | `surface` | Canvas 2D → `THREE.CanvasTexture` on a quad, via the shared `SurfaceRenderer` |
| 2 | A 2D overlay showing descriptive information (an info panel opened by a click) | Any `SceneObject` or `ZoneDefinition` | `panel` | React DOM (`TextPanelHost`) |
| 3 | A bottom dialogue/captioning line other actors (rules, `ActionSequencer` steps) call to display text on screen | No host required; addressed by `attachmentId`/`assetId` or `top: true` | `dialogue` | React dialogue box |

There is no fourth mode and no separate "3D text system": the world-placed panel is not a new subsystem, it is the
`panel` primitive (owned by the attachment/scene-object model, T2 in `image-system.md`) carrying a text attachment.
This keeps one content model, one parser and one measurer behind all three uses — an author writes the same
`markdown-lite` text whether it ends up on a sign, in an info panel, or as a caption line; only the presentation and
the host differ. `label` (a fourth presentation already in section 4) is the short form of use 2: a tag anchored to an
object rather than a full panel, for things like a name floating over an NPC.

## Concepts

| Term | Meaning |
|---|---|
| **Text asset** | A piece of author text identified by `assetId`, stored inline in the project (`ProjectData.textAssets[]`). No file-backed text kind exists (section 1). |
| **Meta** (`TextAssetMeta`) | The text's settings and content: format, language, style. |
| **Attachment** (`TextAttachment`) | A binding of a text asset to a host with a `presentation`. Defined in `attachment-integration.md`. |
| **Node tree** (`TextNode[]`) | The parsed, safe form of the text: paragraphs, emphasis, links, lists. Contains no HTML and no raw URLs outside the link policy. |
| **Presentation** | `panel` (DOM overlay), `label` (a small DOM or canvas tag near the host), `surface` (canvas texture on a quad), `dialogue` (a line in the dialogue box). |
| **Panel** | One open piece of text UI with an id, a node tree, a position in the panel stack and optional pages. |

## Functionality

### 1. Content model

**Decision (2026-09-27): text lives in project data, not media storage.** Every text asset is inline —
`TextAssetMeta.content` sits in the project file (`ProjectData.textAssets[]`) and is present the moment the project
deserialises, the same way a `SceneObject`'s transform is. There is no file-backed text kind, no network fetch for
text content, and therefore no cache tier for it at all: no IndexedDB, no `AssetResolver` round-trip, nothing to go
stale or need eviction. A text asset resolves as fast as reading a field off an already-parsed object, because that
is exactly what it is.

This replaces the earlier two-source design (inline vs. file) considered in draft. That design mirrored
audio/image/video, where a byte cache buys real latency and offline wins for large media — but text assets are
capped small enough (below) that the cache machinery would add IndexedDB plumbing, eviction logic and a second
"where did this text come from" mental model for no measurable benefit. `InlineTextResolver`
(`attachment-integration.md` L290) still exists structurally as the resolver every other kind has, so text
participates in the same `AssetRef` shape as audio/image/video for the systems that don't care which kind they're
looking at — it simply always resolves from the meta already in memory, never from the network.

| Concept | Stored where | Resolved how |
|---|---|---|
| **Text asset** | `TextAssetMeta.content` in `ProjectData.textAssets[]` | `InlineTextResolver` reads the meta directly; no network, no `loading` state |

`TextAssetMeta` holds format, language and style alongside the content, so an attachment only ever needs an
`assetId`. The `TextLibrary` returns the content string synchronously, since it was already deserialised with the
rest of the project.

**Limits — this is where "how much a student can write" is actually enforced.** 64 KB per text asset, and 512 KB
total text per project, so text cannot crowd out scenes inside the 2 MB project cap (`serializer.ts:34`). These caps
are the deliberate substitute for a bigger storage system: rather than building somewhere for a student to put
unbounded writing, the format itself stays small enough that "in the project" is always enough room. Content must be
valid UTF-8; control characters other than newline and tab are stripped.

**What was deferred, not solved.** A student wanting to write and manage long-form documents — more than a project's
512 KB gives, edited in a dedicated space rather than an inspector field — is a real future want (a "docs" area
alongside the project, closer to a small drive than an attachment field). That is explicitly **not** this system: it
would need its own storage model, its own editing surface, and probably backend media storage once Stage 3 exists.
Deliberately shelved rather than half-built now; see "Open questions" item 6.

### 2. Formats and parsing

| Format | Meaning | Output |
|---|---|---|
| `plain` | Text with newlines. Blank line = new paragraph. | Paragraph nodes with text |
| `markdown-lite` | A small markdown subset (below) | Node tree |

`markdown-lite` supports: paragraphs, `**bold**`, `*italic*`, `` `code` ``, links `[text](url)`, unordered and ordered
lists, headings (levels 1 to 3), and hard line breaks. It does **not** support raw HTML, images, tables, footnotes or
nested blockquotes. An image in text is an image attachment, not markup.

```ts
export type TextNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong' | 'emphasis'; children: InlineNode[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: InlineNode[] }   // href already passed UrlPolicy
  | { type: 'break' }
```

The parser is a small hand-written function with no dependency. Because it produces a typed tree and never a string of
HTML, there is nothing to sanitise, and a bug in it can produce wrong formatting but not script. Depth and node count
are capped so a hostile file cannot exhaust memory. A malformed construct is left as literal text, not an error.

### 3. Link and URL policy

Links are the only way author text can reach outside the experience, so they are checked in the parser (`UrlPolicy`):

- Allowed schemes: `https:` and `mailto:`. Everything else (`javascript:`, `data:`, `http:`, `blob:`, `file:`) becomes plain text.
- The renderer opens links with `target="_blank"` and `rel="noopener noreferrer"`, after a visible "leaving this experience" confirmation in the published runtime (T2 setting, on by default).
- Link text is escaped like any other text (React does this; the canvas path draws it as glyphs).
- A link inside in-world (canvas) text is not clickable; only overlay panels support links.

### 4. Presentation

| Mode | Rendered by | Notes |
|---|---|---|
| `panel` | React overlay (`TextPanelHost`) | Title, body, close button, optional paging. Focus is moved into the panel and returned on close. |
| `label` | React (a positioned DOM tag) or canvas | A short line anchored to the host's screen position (DOM) or a billboard quad (canvas). Plain text only. |
| `surface` | Canvas 2D drawn to a `THREE.CanvasTexture` on a quad | A sign or a wall text. Re-drawn only when the text, size or language changes, not every frame. |
| `dialogue` | React dialogue box | One line at a time from the panel queue, with a speaker name, typewriter reveal (T2) and "next". |

```ts
export interface TextPresentation {
  mode: 'panel' | 'label' | 'surface' | 'dialogue'
  title?: string
  anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right'       // panel and dialogue placement
  size?: [number, number]                                        // surface: world units; label: ignored
  offset?: [number, number, number]                              // surface and label: host-local
  style?: TextStyle
  modal?: boolean                                                // true: pause interaction with the scene behind it
  autoCloseMs?: number
  paging?: 'none' | 'auto'                                       // auto: split long text into pages that fit the box
}
export interface TextStyle {
  fontFamily?: 'body' | 'heading' | 'mono'   // named roles, mapped to fonts by the app; never a raw font-face string
  sizePx?: number; color?: string; background?: string; align?: 'left' | 'center' | 'right'
}
```

`fontFamily` names a **role**, not a font file, so authors cannot inject an arbitrary font URL and the app decides what
each role maps to. `color` and `background` are validated as hex colours.

### 5. Fonts: roles, loading, and why runtime and editor render differently

**Roles, not files.** Section 4 already settles the security question: `TextStyle.fontFamily` is one of `'body' |
'heading' | 'mono'`, never a URL or a font-face string. The text system does not know what `body` looks like; the
**app** (not `packages/text`) owns a `FontRoleMap` that resolves each role to an actual font for the current
experience, e.g. `{ body: 'Manrope', heading: 'Manrope', mono: 'DM Mono' }` today (`src/styles.css:1`, the two
Google Fonts already used by the editor chrome, per `CREDITS.md`). `packages/text` receives the resolved font (a
`FontSpec`, see the `TextLayout`/`TextMeasurer` signature in section 6) and never fetches or names a font file
itself. This is the same boundary as `fontFamily` today: the text package is pure and knows nothing about `woff2`,
`FontFace`, or a CDN.

**Runtime loading (two-tier, mirrors `audio-system.md` section 7).** Once bundled fonts beyond the system stack are
needed (T2+, e.g. an author-selectable heading font, or a font shipped for brand consistency), the same two-tier
shape audio just implemented applies directly, because the problem is identical (a byte payload behind an
`assetId`, wanted both as a network URL and as cached bytes):

```ts
export type ResolvedFont =
  | { kind: 'url'; url: string; contentType?: string }        // FontFace(family, url) — browser fetches and caches per its own HTTP cache
  | { kind: 'buffer'; data: ArrayBuffer; contentType?: string } // FontFace(family, data) from IndexedDB-cached bytes, no re-fetch
```

- **Tier A — URL.** Most fonts: `new FontFace(family, \`url(${url})\`).load()`, added to `document.fonts` (overlay
  text) — the browser's own cache handles repeat loads. This is the default and covers every T1 need, because T1 has
  no bundled custom fonts at all (system stack only, per "Considerations" below).
  - Reference wiring: `AudioBackend.decode(url)` (`audio-system.md` L668-669) is the model; a `FontBackend.load(url)`
    plays the same role.
- **Tier B — cached bytes.** Only relevant if a font must render in a **canvas surface** (use 1: the `panel`
  primitive) reliably offline or on a flaky connection, since `FontFace` from an `ArrayBuffer` avoids a second
  network round-trip once the font is used on a sign the visitor revisits. Follows `audioByteCache.ts`'s exact
  shape: a small IndexedDB store (`vthere-font-cache`) keyed by `assetId` (or by font URL/hash), LRU-evicted by
  last-accessed against a byte budget, populated best-effort on first use.
- **Bundled catalog.** A static `src/fontAssets.ts` (mirrors `src/audioAssets.ts`) lists the roles-to-files mapping
  for T1/T2 (files under `public/fonts/`), replaced later by a cloud manifest once Stage 3 backend storage exists —
  same deferral audio already documents for its own catalog.
- **Asset manager linkage.** A font is a `MediaKind` like `audio`/`image`/`video`/`text` (`MEDIA_KIND_SPECS` in
  `attachment-types-and-asset-manager.md` section 5), with its own content-type allowlist (`font/woff2`,
  `font/woff`, and `font/ttf` as a fallback) and size cap. It resolves through the same `AssetResolver` chain as
  every other kind (`Placeholder(Caching(ContentGuard(KindRouter(...))))`), **not** through a bespoke path. This
  keeps a hostile or oversized font file caught by the same guard as a hostile image or text file, and gets fonts a
  visible-placeholder + retry story for free if a font fails to load (falls back to the system font for that role,
  never a blank glyph).
- **Who owns decoded memory.** Per the cross-cutting rule every other kind follows, the type subsystem that consumes
  the asset owns its decoded budget. A `FontRoleMap`/font-loading concern would most naturally live beside
  `packages/text` (the only consumer of custom fonts today) rather than as a new `packages/fonts`, unless image or
  video ever need custom type too (e.g. burned-in captions) — track under "Open questions" below rather than
  deciding now.

**Runtime vs. editor rendering — why they differ, concretely:**

| | Editor (inspector/preview) | Runtime |
|---|---|---|
| Rendered as | Real DOM (`<div>`/`<p>`, section 12) | `panel`/`label`/`dialogue`: DOM. `surface`: canvas 2D → GPU texture |
| Font applied via | Ordinary CSS `font-family`, already loaded because the editor UI itself uses `styles.css` | DOM presentations: CSS, same as editor. `surface` presentation: `ctx.font` on a 2D context, which needs the font **already loaded via `FontFace`/`document.fonts.ready`** before the first draw, or the canvas silently falls back to a default font for that frame |
| Text shaping | Browser's own DOM layout engine (handles complex scripts, kerning, ligatures) | DOM presentations: same browser engine. `surface`: browser's canvas `fillText` shaping — same engine, different code path, which is why "Considerations and limits" below ("Complex scripts") flags it as the thing to verify, not a hypothetical |
| Wrapping | Native DOM wrapping/reflow, free | `TextLayout`'s own wrap/page maths against `TextMeasurer` (`CanvasTextMeasurer` calls the same `measureText` used for the draw, so wrap and draw agree) |
| Interactivity (links, selection) | Full DOM: selectable, clickable, inspectable | DOM presentations: same. `surface`: none — canvas pixels are not selectable or clickable, per section 3's "no link inside in-world text" rule |
| Accessibility | Free (real DOM) | DOM presentations: free. `surface`: invisible to assistive tech, needs the off-screen DOM mirror (section 14, T2) |

The reason `surface` cannot just reuse the DOM/CSS path: it is not DOM at all, it is a `THREE.CanvasTexture` — a
bitmap uploaded to the GPU once and reused every frame without re-layout (`image-system.md`'s `TextureCache`
pattern). That bitmap has to be *drawn*, by `TextSurfaceRenderer` calling 2D-canvas `fillText`, which means the font
must be resident (loaded via `FontFace`, or already present as a system/CSS font) before that draw call, not lazily
substituted the way a `<div>` would reflow if a webfont finished loading a moment later. This is the one place a
font's loading state actually gates a render, and it is the same gate `image-system.md` documents for a decoded
bitmap: no draw before the resource is ready.

### 6. Layout, measuring and paging

`TextLayout` takes a node tree, a font role, a box and a `TextMeasurer`, and returns lines and, when `paging: 'auto'`, a
list of pages that each fit the box. Measuring needs the browser (`measureText`), so it sits behind `TextMeasurer`; the
fake measurer uses a fixed glyph width so wrapping and paging are unit-testable.

- Wrapping uses `Intl.Segmenter` for word and grapheme boundaries where available, so CJK text wraps between characters instead of overflowing.
- A single unbreakable word longer than the box is force-broken at the grapheme.
- A page never splits a grapheme or leaves a heading alone at the bottom.
- Overlay panels can rely on the DOM's own wrapping and scroll instead; paging is mainly for `dialogue` and `surface`.

### 7. Panels, stack and dialogue

`PanelManager` holds the open panels.

- `open(attachmentId)` adds a panel; `close(id)` removes it; `closeAll()` clears them.
- **Stack policy:** a `modal` panel is on top and blocks scene interaction behind it; non-modal panels can coexist up to a cap (proposed 3), after which the oldest closes.
- **Dialogue queue:** `dialogue` panels form a queue. `advancePanel` shows the next line; the queue can be fed by a rule's `ActionSequencer` for timed sequences ("line, wait 2 s, line").
- **Auto-close:** `autoCloseMs` closes a panel after a delay, driven by an injected clock so it is testable.
- Opening a panel that is already open re-focuses it rather than duplicating it.

**Navigation: prev/curr/next (2026-09-27 decision).** A dialogue queue or a paged panel is a **sequence** the visitor
moves through, and a sequence needs to move both ways, not just forward. `PanelManager` tracks this as a plain index
into an already-resolved array — every line/page in a sequence is content already sitting in the project (section 1),
so "going back" is `index - 1` into memory that is already there, never a re-fetch, a re-derivation or a pre-loaded
buffer. This is deliberately the smaller design: no look-ahead buffering, no speculative loading of "the next few
panels" — the thing being navigated (a dialogue queue's lines, or a paged panel's pages) is already fully materialised
by `TextLayout`/the queue builder before navigation starts, so `prev`/`next` is index arithmetic, nothing more.

```ts
interface PanelSequenceState {
  index: number            // current position
  length: number            // total entries; fixed once the sequence starts
  canGoPrev: boolean         // index > 0
  canGoNext: boolean         // index < length - 1
}
```

- `advance(sel)` becomes directional: `advance(sel, 'next')` (the existing default, forward) and `advance(sel,
  'prev')` (new). Both are no-ops at the ends (`canGoPrev`/`canGoNext` false), not errors — the last line stays shown
  rather than closing the panel, so a visitor who over-clicks "back" doesn't lose their place.
- This applies to both consumers of a sequence: the **dialogue queue** (lines) and a **paged `surface`/`panel`**
  (pages, section 6). Both already have an ordered, fully-resolved array in memory; this section just gives the
  visitor (and rules, via `advancePanel`) a way to move an index in either direction over it instead of only forward.
- `PanelStatus` (section 8) already carries `page`/`pageCount`; extend the same shape to dialogue (`index`/`length`)
  rather than inventing a parallel field set, so the state store's shape doesn't fork per presentation mode.
- The **open-panel stack** (which panels are simultaneously visible) and **sequence navigation** (position within one
  panel's content) are different axes and stay separate concerns: closing a panel discards its sequence position;
  re-opening the same `attachmentId` starts the sequence over at `index: 0` unless a future "resume where you left
  off" need justifies persisting position (not designed here, no forcing function yet).

### 8. State store (`TextStateStore`)

```ts
interface TextSnapshot { panels: PanelStatus[]; topPanelId?: string; modalOpen: boolean }
interface PanelStatus { id: string; attachmentId: string; assetId: string; mode: TextPresentation['mode'];
                        state: 'loading' | 'open' | 'error'; page: number; pageCount: number }
getSnapshot(): TextSnapshot
subscribe(listener): () => void
isOpen(attachmentId): boolean
getPanel(id): PanelStatus | undefined
```

Events: `panelOpened`, `panelClosed`, `panelPaged`, `panelError`.

### 9. Events back into the rule engine

`panelOpened` and `panelClosed` are forwarded to `emitRuntimeEvent` (`Viewport.tsx:287`) by `TextEventBridge`, with the
same loop guard as the audio bridge. Rules can say "when the intro panel closes, start the tour". A panel's own buttons
(a "Continue" action inside a panel) are T2 and would emit a named event the same way.

### 10. Loading, caching and failure

Text content is available at once and needs no loading (section 1: it deserialised with the project). The only work
left to do at open time is parsing the content string into a `TextNode[]` tree, which is cheap enough at these sizes
(64 KB max) to redo per open rather than cache; `PanelStatus.state: 'loading'` exists in the store's shape for
consistency with other panel-driving kinds, but a text panel moves through it synchronously. Failure follows the
shared policy anyway, for the case of a missing or corrupt `assetId` (a broken reference, not a slow fetch):
the panel opens showing "Content unavailable", the store emits `panelError`, and nothing throws into the dispatcher.
An empty text renders nothing rather than an empty panel.

### 11. Localisation (T2)

`TextAssetMeta` carries `lang` and an optional `variants: Record<lang, content>`. The runtime picks the visitor's
language (from the user settings store) with a fallback to `lang`. Right-to-left languages set the container `dir`
and, in the canvas path, the text direction. This is designed but not in T1.

### 12. Editor use

- **Inspector.** A text field for inline text with a live preview, a format toggle, language, presentation and style. Length counter against the 64 KB limit.
- **Preview.** Previewing a text attachment renders it in the inspector without opening a runtime panel or firing rules.
- **Import.** A `.txt` or `.md` file's contents are read in the editor and become inline text content (section 1: there is no file-backed text kind to import *into*), subject to the same 64 KB/512 KB caps as any other text.
- **Lint.** Empty text, missing language, unsupported markup that will show as literal text, and links that the policy will drop.

### 13. Editor quality-of-life: copy/paste and embedding external content

Two requested QoL features, both editor-only (they affect what ends up in `TextAssetMeta.content`, never a runtime
network call):

**Copy and paste.** The inspector's text field is a plain `<textarea>`/rich text widget, so browser copy/paste
already works for plain text at no extra cost. The feature worth designing is **paste-and-clean**: pasting from a
web page or a word processor brings HTML and inline styles on the clipboard (`text/html` clipboard data alongside
`text/plain`). The editor reads `text/plain` only and discards `text/html` — this is not a missing feature, it is
the security boundary already established in section 15 (no HTML, ever) applied one step earlier, at authoring time
rather than at render time. A "paste as markdown" convenience (best-effort HTML→`markdown-lite` conversion, e.g.
`<b>` → `**`, `<a href>` → `[text](url)` already passed through `UrlPolicy`) is a plausible T2/T3 addition, but it is
strictly a paste-time transform that still emits only the same bounded `TextNode[]`-producing formats — it does not
widen what the parser accepts.

**Embedding text from a website or a handle (e.g. "pull this article" or "pull this profile's bio").** This is
**not** a runtime feature — it must not become a live network fetch of third-party content into the experience,
because that would mean the text system fetches and displays content the author never reviewed, from a host with no
uptime, licensing or content guarantee, at an arbitrary time chosen by whoever wrote the rule. Instead this is an
**editor-time import**:

1. The author pastes a URL (or a handle, resolved by whatever service the app already trusts for that, if any) into
   an "Import from URL" inspector action.
2. The **editor** (not the runtime, not `packages/text`) fetches it, once, at author-time, through the same kind of
   guarded path already used for other imports (size cap, content-type check, timeout, visible loading/error state).
3. The fetched HTML is converted to `markdown-lite`/plain text by the same paste-and-clean conversion above, and the
   result becomes ordinary inline text content that the author can then edit, exactly as if they had typed or pasted
   it — capped by the same 64 KB/512 KB limits as any other text, so an oversized page is truncated or rejected at
   import time, not silently accepted into a new storage tier.
4. Nothing about the import is preserved at runtime: no stored URL, no re-fetch, no live embed, no iframe. If the
   source page changes or disappears later, the experience is unaffected, because the text was captured once and
   now lives in the project like any other authored text.

This keeps the feature inside every existing guarantee (bounded size, no HTML, no runtime network dependency on a
third party, no new attack surface for visitors) while still giving authors the convenience of not re-typing
existing copy. It is an **editor/import-tooling feature**, not a `packages/text` capability — `packages/text` only
ever sees the resulting plain/markdown-lite string, the same as it does for hand-typed text. Flagged as open in
"Open questions" below because it needs a product decision on scope (arbitrary URLs vs. an allowlisted set of
sources) before it is sized for a tier.

### 14. Accessibility

Text is the type where accessibility is easiest, because overlay panels are real DOM.

- Panels use `role="dialog"` with `aria-modal` when modal, a labelled heading and a visible close control reachable by keyboard; **Escape closes the top panel**; focus moves in on open and returns to the previously focused element on close.
- Dialogue lines are announced through an `aria-live="polite"` region.
- In-world canvas text is invisible to assistive technology, so each canvas surface has an off-screen DOM mirror with the same text (T2; in T1 the surface's `alt` is read).
- A user setting for text size and a high-contrast mode apply to overlay text (reuses the user settings store pattern from the audio doc).
- `lang` is set on the panel container so screen readers pronounce it correctly.
- Typewriter reveal respects `prefers-reduced-motion` (shows the full line at once).

### 15. Security and privacy

- **No HTML, ever.** No `dangerouslySetInnerHTML`, no `innerHTML`. The node tree is rendered as React elements or drawn on a canvas. [`when-do-dispatch-engine.md`](when-do-dispatch-engine.md) already flags author content as untrusted.
- **URL policy** as above; no `data:` or `javascript:` links; no raw URLs for images or media.
- **Fonts by role, colours by validation,** so styling cannot pull in remote resources (no `url()`). When a font is
  asset-backed (section 5), it goes through the same `ContentGuardResolver` allowlist and size cap as any other
  media kind — an author picks a role, never a font URL, so there is no path for a font choice to become an
  arbitrary cross-origin request at runtime.
- **Editor-time import is not runtime fetch.** The "embed from a website" QoL feature (section 13) is deliberately
  scoped to author-time only; nothing about it introduces a visitor-facing network dependency on third-party
  content, and the imported result is validated as plain/markdown-lite text like any other input before it is
  stored.
- **Bounded input:** length, node depth, node count and list size caps prevent a hostile or accidental huge document from freezing the tab.
- **Untrusted text in logs.** The logger (`packages/debugging`) should truncate and not log full author text.
- **No personal data in templates.** Variable substitution (`{visitorName}`) is not in this design; if added it must escape the value like any other text.

## Relationship to captions

Timed captions (cue lists synchronised to audio or video) are a related but separate thing. They are parsed and tracked by
`CaptionTrack` and `parseWebVTT`, first built inside `packages/audio` ([`audio-system.md`](audio-system.md) section 7).
The text system **does not** own them, but the two share rendering: a caption cue is displayed through the same
`TextPanelHost` styling and the same `UrlPolicy` (captions never contain links). When video becomes the second consumer,
captions are extracted to `packages/captions` (see [`attachment-integration.md`](attachment-integration.md) section 1),
and the text system may import them for a "subtitle" presentation. Until then there is no dependency.

## Feature tiers

| # | Feature | Why | Tier |
|---|---|---|---|
| 1 | Text as project data, plain format, limits, `UrlPolicy`, node tree | Core and security | T1 |
| 2 | `panel` and `label` overlay presentation, focus handling, Escape to close | Core | T1 |
| 3 | `markdown-lite` parser | Readable formatting without HTML | T1 |
| 4 | `PanelManager` (stack, modal, auto-close), state store, events, `showPanel`/`hidePanel`, disposal | Integration | T1 |
| 5 | Error state and "Content unavailable" | Stability | T1 |
| 6 | `surface` presentation (canvas texture) | Signs in the world | T2 |
| 7 | `dialogue` mode with queue, `advancePanel`, typewriter, speaker names | Storytelling | T2 |
| 8 | Paging for long text | Long content in fixed boxes | T2 |
| 9 | Localisation variants and text direction | Audience reach | T2 |
| 10 | Off-screen DOM mirror for canvas text | Accessibility | T2 |
| 11 | "Leaving this experience" confirmation for links | Safety | T2 |
| 12 | Panel-embedded buttons that emit events | Interactive panels | T2 |
| 13 | Variable substitution and templating | Personalised text | T3 |
| 14 | SDF text for crisp in-world type at distance (optional library, in `src/`) | Quality | T3 |
| 15 | Rich layouts (columns, tables, embedded media) | Editorial content | T3, no forcing function yet — revisit only if a concrete authoring need outgrows `markdown-lite`, not preemptively |
| 16 | Paste-and-clean (`text/html` clipboard → `markdown-lite`) | Author convenience | T2 |
| 17 | Bundled custom fonts via `FontRoleMap` + asset-backed `ResolvedFont` (two-tier loading) | Type beyond the system stack | T2 |
| 18 | Font byte cache (IndexedDB, mirrors `audioByteCache.ts`) | Offline/flaky-network signs | T3 |
| 19 | "Import from URL" editor tool (author-time fetch, convert, store as text) | Author convenience | T3 |
| 20 | Document-editing workspace ("docs dock") for long-form writing beyond a project's text caps | Author convenience at scale | Shelved — a separate future subsystem, not a tier of this one (Open questions item 6) |

T1 ships with the system font stack only (no row above needed); a font is always a named role resolved by the app,
whether that role maps to a system font (T1) or an asset-backed custom font (T2, row 17).

## Data model (additions to `@vthere/project`)

Additive and optional. `TextAttachment` and the host fields are in `attachment-integration.md` section 3.

```ts
export type TextFormat = 'plain' | 'markdown-lite'

export interface TextAssetMeta {
  assetId: string
  name: string
  format: TextFormat
  lang: string                          // BCP 47, e.g. 'en'
  content: string                       // project data; no file-backed alternative (section 1)
  variants?: Record<string, string>     // T2: content by language
  maxLength?: number                    // author-set cap, never above the system limit
  title?: string
}
// ProjectData.textAssets?: TextAssetMeta[]      SceneObject.attachments and ZoneDefinition.attachments may hold TextAttachment
```

The `showPanel` action's `componentId` (named in the `ActionSpec` doc comment, `packages/project/src/index.ts:119-121`)
is accepted as an alias of `attachmentId` so any existing example rule keeps working.

## Class design (`packages/text/src`)

```ts
class TextSystem {                                           // the only object other code holds
  constructor(opts: { library: TextLibrary; resolver: AssetResolver; measurer: TextMeasurer;
                      cache?: DecodedCache<TextNode[]>; clock?: () => number; limits?: Partial<TextLimits> })
  open(att: TextAttachment, opts?: { modal?: boolean; autoCloseMs?: number }): PanelHandle
  close(sel: PanelSelector): void
  closeAll(): void
  advance(sel: PanelSelector, dir?: 'next' | 'prev'): void  // dialogue line or page; dir defaults to 'next'
  layout(att: TextAttachment, box: { width: number; height: number }, font: FontSpec): TextLayoutResult
  dispose(): void
  readonly store: TextStateStore
  getStats(): TextStats
}
interface PanelHandle { readonly id: string; readonly state: 'loading' | 'open' | 'error'
  readonly nodes?: TextNode[]; readonly ready: Promise<void>; close(): void
  advance(dir?: 'next' | 'prev'): void }
type PanelSelector = { panelId: string } | { attachmentId: string } | { assetId: string } | { top: true }
```

| Class | Responsibility |
|---|---|
| `TextLibrary` | `getContent(assetId)` from meta, synchronously; `getMeta(assetId)`. Reads `ProjectData.textAssets`. |
| `RichTextParser` | `parse(format, source) -> TextNode[]`. Pure, bounded, no dependency. |
| `UrlPolicy` | `check(href) -> string | null`. Pure. |
| `TextLayout` | `wrap`, `page`. Pure given a `TextMeasurer`. |
| `TextMeasurer` (interface) | `measure(text, font) -> { width, height }`. |
| `CanvasTextMeasurer` | `canvas.measureText`. Thin. |
| `FakeTextMeasurer` | Fixed glyph width. All unit tests use it. |
| `PanelManager` | Open panels, stack and modal policy, auto-close, dialogue queue, paging state. |
| `TextStateStore` | Snapshot, queries, subscribe, events. |
| `TextEventBridge` | Forwards `panelOpened` and `panelClosed` to `emitRuntimeEvent` with the loop guard. |
| `registerTextActions(registry, text, opts)` | Registers the executors below and the disposers. |
| **In `src/` (React):** `TextPanelHost` | Renders the store's panels as accessible DOM from the node tree. The only place `TextNode` becomes elements. |
| **In `src/viewport/`:** `TextSurfaceRenderer` | Draws a node tree to a canvas and a `CanvasTexture`, redrawing only on change. Shares `SurfaceRenderer` with the image system. |

## Action vocabulary

Every executor that opens a panel registers a disposer with `context.effects.add` so a scene reset closes it. Unknown or
invalid params are ignored with a logged warning, not thrown.

| Kind | `params` | Effect |
|---|---|---|
| `showPanel` | `attachmentId` (or `componentId`, or `assetId`); optional `modal`, `autoCloseMs`, `title`, `wait` | Open a panel. With `wait: true` an `ActionSequencer` step resumes when it closes. |
| `hidePanel` | `attachmentId` or `assetId`, or `top: true`, or `all: true` | Close panels |
| `advancePanel` | `attachmentId` or `top: true`; optional `dir: 'next' \| 'prev'` (default `'next'`) | Move the dialogue/page index one step; no-op at either end |

## Integration points

| Where | Change |
|---|---|
| `packages/project`, `src/serializer.ts` | `TextAssetMeta`, `TextAttachment`, validation, the 64 KB and 512 KB limits. |
| `packages/assets` | `text` entries in `MEDIA_KIND_SPECS`, `InlineTextResolver`, content guard (guards length/encoding, not a network fetch). |
| `src/viewport/assetResolution.ts` | Route `kind: 'text'` to `InlineTextResolver`; `resolveAttachment`. |
| `src/Viewport.tsx` near L278 | Create `TextSystem`, `registerTextActions`. Pass project-level `textAssets` in as a new prop, like `rules` (`Viewport.tsx:318`). |
| `src/RuntimeView.tsx` and the editor viewport wrapper | Mount `TextPanelHost` in the overlay layer, subscribed to `text.store`. |
| `src/viewport/interactionController.ts` | Reads `text.store.getSnapshot().modalOpen` (a plain boolean, section 8) and decides what to do with it — see "Modal input boundary" below. The text system does not reach into input handling itself. |
| `apps/api` | None required for this system: text is project data, not `media_assets` (section 1). A future document-dock (Open questions item 6) would need its own backend storage; not this system's dependency. |
| `src/styles.css` | Panel and dialogue styles; the app maps the `body`, `heading` and `mono` font roles. |
| `packages/assets` (T2, once fonts are asset-backed) | `font` entries in `MEDIA_KIND_SPECS` (content-type allowlist, size cap), routed through the same `KindRouterResolver`/`ContentGuardResolver` chain as audio/image/video/text. |
| `src/fontAssets.ts` (T2) | Bundled font catalog mirroring `src/audioAssets.ts`; files under `public/fonts/`. |
| `src/viewport/fontByteCache.ts` (T3) | IndexedDB byte cache mirroring `src/viewport/audioByteCache.ts`, only if offline/flaky-network signs need it. |

## Considerations and limits

- **Author content is untrusted.** The node-tree design removes the HTML injection class of bug, but URLs, length, depth and colour values still need the checks above.
- **Fonts and licensing.** Web fonts must be licensed for embedding and are a real download cost; the default is the system font stack. Adding a bundled font is a product decision (section 5 has the loading design for when that decision is made; `CREDITS.md` is the existing attribution convention to extend).
- **Font package ownership is not yet decided.** Section 5 notes a `FontRoleMap`/loader most naturally sits beside `packages/text` since it is the only current consumer of custom type, but this is deferred to "Open questions" rather than settled here.
- **Complex scripts.** Canvas `fillText` uses the browser's shaping, so Arabic, Indic and CJK draw correctly. A custom SDF library may not (verify before adopting one). This is the main reason canvas, not SDF, is the default.
- **Canvas text is soft at distance and invisible to assistive technology.** It suits short signs. Long content belongs in an overlay panel.
- **Measuring is browser-dependent.** Line breaks in the canvas path may differ slightly from the DOM. Tests verify the wrapping algorithm with a fake measurer, not pixel-exact layout.
- **Modal input boundary (2026-09-27 decision).** The text system's job stops at *reporting* modal state; deciding
  what that state means for input is `interactionController`'s job, not `packages/text`'s. The contract is one
  boolean: `TextStateStore.getSnapshot().modalOpen` (section 8), true whenever any modal panel is open, false
  otherwise. `packages/text` never reads pointer/keyboard state and never calls into `interactionController` — the
  dependency points one way, store to controller, the same shape as the event bridge (section 9) but read instead of
  pushed. Everything downstream of that boolean — which keys are swallowed, whether movement or only clicks stop,
  whether the runtime clock pauses, how walk-mode pointer lock interacts with a DOM panel receiving focus — is
  `interactionController`'s decision to make and revise without touching this doc or `packages/text`, because it is
  a game-feel and input-stack concern, not a text-content concern. `src` currently has no pointer lock, so a DOM
  panel already receives the pointer normally with no special-casing needed yet; that changes only if walk mode adds
  pointer lock, and is `interactionController`'s call when it does.
- **Whole-project rebuilds.** `syncArtefacts` rebuilds meshes on each sync (`syncArtefacts.ts:49-52`). A `surface` re-creates its quad each time, but the canvas texture is cached by content hash so the text is not re-drawn.
- **Two renderers.** `ReferenceViewport.tsx` builds meshes separately; it does not show text surfaces unless decided otherwise.
- **Project size.** All text counts against the 2 MB project cap, hence the 512 KB text ceiling (section 1). There is
  no file-asset escape valve for a very long document in this system — a student who needs more room is the
  document-dock idea (Open questions item 6), a deliberately separate, shelved system, not a T3 upgrade to this one.
- **No text search across the project** in this design. A future outline or search view would read `textAssets` directly.
- **Tests.** No canvas or fonts in vitest. Parser, policy, layout maths and panel logic are pure and covered against `FakeTextMeasurer`; React and canvas output is verified in the browser.

## Open questions

**Decision (2026-09-22): `showPanel` takes `attachmentId`, with `componentId` accepted as an alias.** See
`attachment-integration.md`'s "Open questions" decision log and its section 9. No existing example rules need
migrating; the alias keeps them working.

**Decision (2026-09-22): Small markdown subset, no library.** Section 2's subset list is confirmed as the T1 scope. No
`marked`/`markdown-it` + DOMPurify dependency is added; a full markdown library stays a possible future upgrade if the
subset proves too limiting in practice, re-evaluated against `tech-stack.md`'s unreviewed-dependency policy at that
time.

**Decision (2026-09-27): text is project data only; no file-backed text kind, ever, in this system.** Section 1
supersedes the earlier "inline vs. file" question: there is one source (project data), no network path, and no cache
tier. This closes what used to be open question 1, and removes the Stage-3 `media_assets.kind` dependency for text
specifically (a text file the author wants to reuse across projects is future document-dock scope, item 6 below, not
this system waiting on backend storage).

**Decision (2026-09-27): sequences navigate both ways — prev/curr/next, not just forward.** Section 7's "Navigation"
subsection is the design: a dialogue queue or a paged panel keeps an `index` into an already-fully-resolved array
(no buffering, no look-ahead loading — text is small and already in memory per section 1, so going back is just
`index - 1`), and `advancePanel`/`advance()` take an explicit `dir: 'next' | 'prev'`. This was raised and explicitly
scoped down from an earlier "buffer upcoming panels" idea, rejected as over-engineering for content this size.

**Decision (2026-09-27): the modal-input boundary is a one-way boolean, not a text-system responsibility.**
"Considerations and limits" → "Modal input boundary" is the design: `packages/text` only ever exposes
`TextStateStore.getSnapshot().modalOpen`; every decision about what to do with that signal (which keys/pointer
events get swallowed, whether the clock pauses, walk-mode pointer-lock interaction) belongs to
`src/viewport/interactionController.ts`, not to this doc or this package. This closes the "settle when wiring" note
that used to sit under "Considerations" — the boundary is now settled; only the controller-side key-mapping choices
remain open, and those are `interactionController`'s to make, not tracked here.

The following are lower-impact and take the stated default; flag if any should change:

1. **Panel stack cap** (how many *simultaneously open* panels are allowed, not sequence navigation within one — see
   section 7's "Navigation" for prev/curr/next) — default: three non-modal panels, as a placeholder, tuned once real
   authoring content exists.
2. **Link confirmation** — default: on by default in the published runtime (a visitor confirms before leaving the
   experience); author-configurable is a later refinement if it turns out too intrusive.
3. **Where dialogue lives** — default: as a text presentation in this doc; a standalone dialogue system is deferred
   until a concrete case needs branching or a queue this doc's `PanelManager` doesn't cover.
4. **Font package ownership** — default: a `FontRoleMap`/loader lives beside `packages/text` when bundled fonts are
   built (T2), since text is the only current consumer; revisit only if image or video need custom type too (e.g.
   burned-in captions) before then.
5. **`ReferenceViewport.tsx` text-surface parity** — default: the reference viewport does not render text surfaces
   for now; flag as a known gap (not a silent one) if a sign fails to appear there while working correctly in the
   main viewport.
6. **A document-editing workspace ("docs dock") for long-form writing** — explicitly shelved, not designed here.
   Raised and deliberately deferred as over-engineered for the current need: a "Google Drive of docs" belonging to
   the app, letting a student manage documents larger or more numerous than a project's 512 KB text budget allows,
   edited outside a project entirely. If ever pursued it is a new subsystem (its own storage model, its own editing
   surface, likely Stage-3 backend storage), not an extension of `packages/text` — this system stays scoped to text
   that is small enough to live in a project. Revisit only if the 64 KB/512 KB caps prove genuinely limiting for real
   authoring content, not preemptively.

## Build sequence

1. **Approve this doc** and the shared attachment model. `showPanel`'s argument shape is already decided (above); text's storage model (project data only, section 1) is already decided.
2. **Shared work first** ([`attachment-integration.md`](attachment-integration.md) build steps 2 to 5): types, serializer with the text limits, `InlineTextResolver`, kind router, guard.
3. **Core without a browser.** Create `packages/text` (`package.json` with `"exports": "./src/index.ts"`, depends on `@vthere/project` and `@vthere/assets`). `RichTextParser`, `UrlPolicy`, `TextLibrary`, `TextLayout` with `FakeTextMeasurer`, `PanelManager`, `TextStateStore`, with co-located `*.test.ts`.
4. **Overlay.** `TextPanelHost` in `src/`, accessible DOM from the node tree, focus handling, Escape.
5. **Runtime wiring.** `registerTextActions`, event bridge, project-level `textAssets` prop.
6. **Dev surface.** A demo scene with a click-to-open panel, a label, a long text that pages (once T2), and a deliberately hostile text file (script tag, `javascript:` link, huge nesting) that must render as inert text.
7. **T2 features** in this order: `surface`, dialogue queue and typewriter, paging, localisation, DOM mirror, link confirmation, bundled custom fonts (`FontRoleMap`, two-tier loading, `src/fontAssets.ts`), paste-and-clean.
8. **Docs sync.** `architecture.md`, `repository.md`, `development-guide.md`, `contracts.md` (`showPanel` argument), `when-do-dispatch-engine.md` (executor now exists); mark this doc's status as implemented.

### Verification

- `npm test`. Unit tests cover: the parser on well-formed, malformed and hostile input (unclosed markers, deep nesting, oversized list, raw HTML left as text), `UrlPolicy` scheme cases, length and UTF-8 limits, layout wrapping and paging with the fake measurer (including CJK breaking and an overlong word), `PanelManager` stack, modal, cap and auto-close with an injected clock, dialogue queue order, store events, disposal through `resetRuntime`, and serializer round-trip and limit rejection.
- `npm run typecheck` and `npm run build`. `tsconfig.app.json` includes only `src`, so `packages/text` is type-checked once `src/` imports it (step 5). Run `npm install` to link the workspace and commit the lockfile.
- Manual browser check: a click opens a panel that traps focus and closes on Escape and returns focus; a hostile text shows as plain text with no script and no navigation; a long panel scrolls; restart scene closes everything; a screen reader announces a dialogue line; the missing-asset case shows "Content unavailable".
