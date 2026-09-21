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
the registry and registers nothing). There is no text asset kind, and the backend `media_assets.kind` has no `text`
value (`apps/api/app/models.py:163`).

## Boundary

```text
Rule engine: showPanel / hidePanel / advancePanel         Editor: inspector, text editor, preview
        |                                                        |
        v                                                        v
+---------------------------------------------------------------------------+
| packages/text  (pure TypeScript; no React, no Three.js)                    |
|                                                                           |
|  registerTextActions --> TextSystem (facade)                               |
|                             |- TextLibrary   (meta + inline/file content)  |
|                             |- RichTextParser  markdown subset -> TextNode[]|
|                             |- UrlPolicy       allowed link schemes        |
|                             |- PanelManager    open panels, order, paging  |
|                             |- TextLayout      measure + wrap + page       |
|                             |- TextStateStore  -> subscribe / query        |
|                             '- TextEventBridge  -> rule triggers           |
|                                                                           |
|  TextMeasurer (interface):  CanvasTextMeasurer | FakeTextMeasurer (tests)   |
+---------------------------------------------------------------------------+
        ^ AssetRef -> AssetDescriptor (file text)    | TextNode[] + panel state
        | InlineTextResolver (inline text)           v
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
| Content lookup (inline or file) | `packages/text/src/TextLibrary.ts` |
| State store and queries | `packages/text/src/TextStateStore.ts` |
| Action executors and event bridge | `packages/text/src/actions/` |
| Types shared with the project file | `packages/project/src/index.ts` |
| Inline text resolver | `packages/assets/src/resolvers/InlineTextResolver.ts` |
| Overlay panels (React) and in-world canvas text | `src/` and `src/viewport/mediaSurfaces.ts` |

## Owns

- The text content model: inline text and file text, plain and markdown-subset
- Parsing author text into a safe `TextNode[]` tree, and the link policy
- Length, encoding and count limits
- Measuring, wrapping and paging text for a given box and font
- Which panels are open, their order, focus request and paging state; dialogue sequencing
- The state store and the events text raises
- Executors for the text actions

## Does not own

- Turning a text file `assetId` into a URL (Asset Manager); inline text does not go through the network
- Drawing: React draws overlay panels, `src/viewport/` draws in-world text
- Fonts: which font files ship and their licensing
- Translation memory or an external localisation service
- Timed captions for audio and video: see below, they share a parser but are owned by the audio and video systems
- Evaluating rules (`packages/interaction`)

## Concepts

| Term | Meaning |
|---|---|
| **Text asset** | A piece of author text identified by `assetId`. Either **inline** (stored in the project) or **file** (`text/plain` or `text/markdown` in media storage). |
| **Meta** (`TextAssetMeta`) | The text's settings and, for inline text, its content: format, language, style. |
| **Attachment** (`TextAttachment`) | A binding of a text asset to a host with a `presentation`. Defined in `attachment-integration.md`. |
| **Node tree** (`TextNode[]`) | The parsed, safe form of the text: paragraphs, emphasis, links, lists. Contains no HTML and no raw URLs outside the link policy. |
| **Presentation** | `panel` (DOM overlay), `label` (a small DOM or canvas tag near the host), `surface` (canvas texture on a quad), `dialogue` (a line in the dialogue box). |
| **Panel** | One open piece of text UI with an id, a node tree, a position in the panel stack and optional pages. |

## Functionality

### 1. Content model

Two sources, one interface:

| Source | Stored where | Resolved how | When to use |
|---|---|---|---|
| **Inline** | `TextAssetMeta.content` in the project file | `InlineTextResolver` (no network), or read directly from the meta | Short text: labels, captions, dialogue, panel bodies |
| **File** | `text/plain` or `text/markdown` in media storage | `AssetResolver` then `fetch`, then `Response.text()` | Long documents authors prefer to edit outside the tool |

`TextAssetMeta` holds the settings for both, so an attachment does not care which source it has. The `TextLibrary`
returns the content string either way and reports `loading` for a file that has not arrived.

**Limits.** 64 KB per text, and 512 KB total inline text per project so text cannot crowd out scenes inside the 2 MB
project cap (`serializer.ts:34`). Content must be valid UTF-8 (file text is decoded with a fatal decoder and rejected on
error). Control characters other than newline and tab are stripped.

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

### 5. Layout, measuring and paging

`TextLayout` takes a node tree, a font role, a box and a `TextMeasurer`, and returns lines and, when `paging: 'auto'`, a
list of pages that each fit the box. Measuring needs the browser (`measureText`), so it sits behind `TextMeasurer`; the
fake measurer uses a fixed glyph width so wrapping and paging are unit-testable.

- Wrapping uses `Intl.Segmenter` for word and grapheme boundaries where available, so CJK text wraps between characters instead of overflowing.
- A single unbreakable word longer than the box is force-broken at the grapheme.
- A page never splits a grapheme or leaves a heading alone at the bottom.
- Overlay panels can rely on the DOM's own wrapping and scroll instead; paging is mainly for `dialogue` and `surface`.

### 6. Panels, stack and dialogue

`PanelManager` holds the open panels.

- `open(attachmentId)` adds a panel; `close(id)` removes it; `closeAll()` clears them.
- **Stack policy:** a `modal` panel is on top and blocks scene interaction behind it; non-modal panels can coexist up to a cap (proposed 3), after which the oldest closes.
- **Dialogue queue:** `dialogue` panels form a queue. `advancePanel` shows the next line; the queue can be fed by a rule's `ActionSequencer` for timed sequences ("line, wait 2 s, line").
- **Auto-close:** `autoCloseMs` closes a panel after a delay, driven by an injected clock so it is testable.
- Opening a panel that is already open re-focuses it rather than duplicating it.

### 7. State store (`TextStateStore`)

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

### 8. Events back into the rule engine

`panelOpened` and `panelClosed` are forwarded to `emitRuntimeEvent` (`Viewport.tsx:287`) by `TextEventBridge`, with the
same loop guard as the audio bridge. Rules can say "when the intro panel closes, start the tour". A panel's own buttons
(a "Continue" action inside a panel) are T2 and would emit a named event the same way.

### 9. Loading, caching and failure

Inline text is available at once and needs no loading. File text resolves through the manager, is fetched, decoded and
parsed once, and the parsed tree is cached by `assetId` in a small `DecodedCache` (bytes are the string length times
two, a rough estimate; the budget is a few MB). Failure follows the shared policy: the panel opens showing
"Content unavailable", the store emits `panelError`, and nothing throws into the dispatcher. An empty text renders
nothing rather than an empty panel.

### 10. Localisation (T2)

`TextAssetMeta` carries `lang` and an optional `variants: Record<lang, content>` for inline text. The runtime picks the
visitor's language (from the user settings store) with a fallback to `lang`. File text uses one asset per language and
a `variantAssetIds` map. Right-to-left languages set the container `dir` and, in the canvas path, the text direction.
This is designed but not in T1.

### 11. Editor use

- **Inspector.** A text field for inline text with a live preview, a format toggle, language, presentation and style. Length counter against the 64 KB limit.
- **Preview.** Previewing a text attachment renders it in the inspector without opening a runtime panel or firing rules.
- **Import.** A `.txt` or `.md` file becomes file text (session-only until Stage 3) or is pasted into inline text.
- **Lint.** Empty text, missing language, unsupported markup that will show as literal text, and links that the policy will drop.

### 12. Accessibility

Text is the type where accessibility is easiest, because overlay panels are real DOM.

- Panels use `role="dialog"` with `aria-modal` when modal, a labelled heading and a visible close control reachable by keyboard; **Escape closes the top panel**; focus moves in on open and returns to the previously focused element on close.
- Dialogue lines are announced through an `aria-live="polite"` region.
- In-world canvas text is invisible to assistive technology, so each canvas surface has an off-screen DOM mirror with the same text (T2; in T1 the surface's `alt` is read).
- A user setting for text size and a high-contrast mode apply to overlay text (reuses the user settings store pattern from the audio doc).
- `lang` is set on the panel container so screen readers pronounce it correctly.
- Typewriter reveal respects `prefers-reduced-motion` (shows the full line at once).

### 13. Security and privacy

- **No HTML, ever.** No `dangerouslySetInnerHTML`, no `innerHTML`. The node tree is rendered as React elements or drawn on a canvas. [`when-do-dispatch-engine.md`](when-do-dispatch-engine.md) already flags author content as untrusted.
- **URL policy** as above; no `data:` or `javascript:` links; no raw URLs for images or media.
- **Fonts by role, colours by validation,** so styling cannot pull in remote resources (no `url()`).
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
| 1 | Inline and file text, plain format, limits, `UrlPolicy`, node tree | Core and security | T1 |
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
| 15 | Rich layouts (columns, tables, embedded media) | Editorial content | T3 |

## Data model (additions to `@vthere/project`)

Additive and optional. `TextAttachment` and the host fields are in `attachment-integration.md` section 3.

```ts
export type TextFormat = 'plain' | 'markdown-lite'

export interface TextAssetMeta {
  assetId: string
  name: string
  format: TextFormat
  lang: string                          // BCP 47, e.g. 'en'
  source: { kind: 'inline'; content: string } | { kind: 'file' }
  variants?: Record<string, string>     // T2: inline content by language
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
  advance(sel: PanelSelector): void                       // next dialogue line or page
  layout(att: TextAttachment, box: { width: number; height: number }, font: FontSpec): TextLayoutResult
  dispose(): void
  readonly store: TextStateStore
  getStats(): TextStats
}
interface PanelHandle { readonly id: string; readonly state: 'loading' | 'open' | 'error'
  readonly nodes?: TextNode[]; readonly ready: Promise<void>; close(): void; advance(): void }
type PanelSelector = { panelId: string } | { attachmentId: string } | { assetId: string } | { top: true }
```

| Class | Responsibility |
|---|---|
| `TextLibrary` | `getContent(assetId)` from inline meta or a resolved file; `getMeta(assetId)`. Reads `ProjectData.textAssets`. |
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
| `advancePanel` | `attachmentId` or `top: true` | Next dialogue line or page |

## Integration points

| Where | Change |
|---|---|
| `packages/project`, `src/serializer.ts` | `TextAssetMeta`, `TextAttachment`, validation, the 64 KB and 512 KB limits. |
| `packages/assets` | `text` entries in `MEDIA_KIND_SPECS`, `InlineTextResolver`, content guard. |
| `src/viewport/assetResolution.ts` | Route `kind: 'text'` for file text; `resolveAttachment`. |
| `src/Viewport.tsx` near L278 | Create `TextSystem`, `registerTextActions`. Pass project-level `textAssets` in as a new prop, like `rules` (`Viewport.tsx:318`). |
| `src/RuntimeView.tsx` and the editor viewport wrapper | Mount `TextPanelHost` in the overlay layer, subscribed to `text.store`. |
| `src/viewport/interactionController.ts` | While a modal panel is open, pointer events on the scene are ignored. Note: `src` currently does not use pointer lock, so a DOM panel receives the pointer normally; re-check if walk mode adds it. |
| `apps/api` (Stage 3) | Add a `text` value to `media_assets.kind` (or store file text as `other`), with a migration. |
| `src/styles.css` | Panel and dialogue styles; the app maps the `body`, `heading` and `mono` font roles. |

## Considerations and limits

- **Author content is untrusted.** The node-tree design removes the HTML injection class of bug, but URLs, length, depth and colour values still need the checks above.
- **Fonts and licensing.** Web fonts must be licensed for embedding and are a real download cost; the default is the system font stack. Adding a bundled font is a product decision.
- **Complex scripts.** Canvas `fillText` uses the browser's shaping, so Arabic, Indic and CJK draw correctly. A custom SDF library may not (verify before adopting one). This is the main reason canvas, not SDF, is the default.
- **Canvas text is soft at distance and invisible to assistive technology.** It suits short signs. Long content belongs in an overlay panel.
- **Measuring is browser-dependent.** Line breaks in the canvas path may differ slightly from the DOM. Tests verify the wrapping algorithm with a fake measurer, not pixel-exact layout.
- **Modal panels and play mode.** A modal panel must stop scene clicks and movement input without pausing the runtime clock unless the author asks. Which keys the viewport ignores while a panel is open is an interaction-controller detail to settle when wiring.
- **Whole-project rebuilds.** `syncArtefacts` rebuilds meshes on each sync (`syncArtefacts.ts:49-52`). A `surface` re-creates its quad each time, but the canvas texture is cached by content hash so the text is not re-drawn.
- **Two renderers.** `ReferenceViewport.tsx` builds meshes separately; it does not show text surfaces unless decided otherwise.
- **Project size.** Inline text counts against the 2 MB project cap, hence the 512 KB inline ceiling. A very long document should be a file asset once Stage 3 storage exists.
- **No text search across the project** in this design. A future outline or search view would read `textAssets` directly.
- **Tests.** No canvas or fonts in vitest. Parser, policy, layout maths and panel logic are pure and covered against `FakeTextMeasurer`; React and canvas output is verified in the browser.

## Open questions

1. **`showPanel` argument.** Confirm `attachmentId` with `componentId` as an alias, or migrate existing examples.
2. **Inline vs file default.** Recommendation: inline first (T1), file text once Stage 3 storage exists. Confirm.
3. **Markdown subset.** Is the list in section 2 enough, or is a full markdown library wanted despite the sanitiser it would need?
4. **Panel stack cap and modal behaviour.** Three non-modal panels is a placeholder number.
5. **Link confirmation.** On by default in published runtime, or author-configurable?
6. **Where dialogue lives.** As a text presentation (this doc), or as its own dialogue system later.

## Build sequence

1. **Approve this doc** and the shared attachment model. Decide the inline-vs-file and `showPanel` questions.
2. **Shared work first** ([`attachment-integration.md`](attachment-integration.md) build steps 2 to 5): types, serializer with the text limits, `InlineTextResolver`, kind router, guard.
3. **Core without a browser.** Create `packages/text` (`package.json` with `"exports": "./src/index.ts"`, depends on `@vthere/project` and `@vthere/assets`). `RichTextParser`, `UrlPolicy`, `TextLibrary`, `TextLayout` with `FakeTextMeasurer`, `PanelManager`, `TextStateStore`, with co-located `*.test.ts`.
4. **Overlay.** `TextPanelHost` in `src/`, accessible DOM from the node tree, focus handling, Escape.
5. **Runtime wiring.** `registerTextActions`, event bridge, project-level `textAssets` prop.
6. **Dev surface.** A demo scene with a click-to-open panel, a label, a long text that pages (once T2), and a deliberately hostile text file (script tag, `javascript:` link, huge nesting) that must render as inert text.
7. **T2 features** in this order: `surface`, dialogue queue and typewriter, paging, localisation, DOM mirror, link confirmation.
8. **Docs sync.** `architecture.md`, `repository.md`, `development-guide.md`, `contracts.md` (`showPanel` argument), `when-do-dispatch-engine.md` (executor now exists); mark this doc's status as implemented.

### Verification

- `npm test`. Unit tests cover: the parser on well-formed, malformed and hostile input (unclosed markers, deep nesting, oversized list, raw HTML left as text), `UrlPolicy` scheme cases, length and UTF-8 limits, layout wrapping and paging with the fake measurer (including CJK breaking and an overlong word), `PanelManager` stack, modal, cap and auto-close with an injected clock, dialogue queue order, store events, disposal through `resetRuntime`, and serializer round-trip and limit rejection.
- `npm run typecheck` and `npm run build`. `tsconfig.app.json` includes only `src`, so `packages/text` is type-checked once `src/` imports it (step 5). Run `npm install` to link the workspace and commit the lockfile.
- Manual browser check: a click opens a panel that traps focus and closes on Escape and returns focus; a hostile text shows as plain text with no script and no navigation; a long panel scrolls; restart scene closes everything; a screen reader announces a dialogue line; the missing-asset case shows "Content unavailable".
