# Text system — decisions to recall

**Written for:** whoever picks the text system up next, including me after a gap.

This is not a design spec — [`text-system.md`](text-system.md) is, at 673 lines, and it holds the full
decision log. This is the shorter thing: the decisions that are **load-bearing**, meaning you will
break something or redo work if you do not know them, plus where the implementation and the spec
have actually diverged.

Verified against the tree at `aa4b76e` (2026-09-29). 41 tests pass across 6 files in `packages/text`.

---

## 1. The one that explains everything else: text is project data

**Decision (2026-09-27): text is project data only. No file-backed text kind, ever, in this system.**

Everything odd about this package follows from this. Text content lives inline in
`ProjectData.textAssets`, deserialised with the project, resident in memory. So:

- `TextLibrary.getMeta()` is a **synchronous** `Map.get`. No promise, no loading state, no cache tier.
- `TextSystem.open()` returns a `PanelHandle` whose `ready: Promise<void>` exists **only for API
  symmetry** with async kinds. It is already resolved. Do not read it as evidence that text loads.
- There is no `AssetDescriptor` for text in the live path, and no network code to find.
- Bounded by the serializer instead of a storage tier: **64 KB per asset, 512 KB per project**
  (`MAX_TEXT_ASSET_BYTES` at [`src/serializer.ts:47`](../../../src/serializer.ts)).

**Why it matters when you return:** if you go looking for the text loading path, there isn't one, and
that is deliberate rather than unfinished. The temptation to "make text consistent with audio" is a
temptation to undo a decision.

**The seam, if that changes.** `src/viewport/assetResolution.ts` still has a wired text leg that
nothing reads. It is kept on purpose, documented as `RESERVED, not live`: a document drive or signed
URL has loading and error states a synchronous `Map` cannot express but `AssetDescriptor` already
can. Feeding that map and swapping `InlineTextResolver` for a remote resolver is the migration path.
This also means **`TextAssetMeta` has no source discriminant** — it is `{ content: string }` with no
`url`/`source` field, and the serializer hard-requires `typeof meta.content === 'string'`. Adding
`{source:'inline'} | {source:'remote'}` plus matching serializer validation is the first real step of
any cloud-document work, not an afterthought.

## 2. Security rests on the node tree, not on sanitising

**Decision: no HTML in, no HTML out.** `RichTextParser` produces a bounded typed `TextNode` tree
([`parse/nodes.ts`](../../../packages/text/src/parse/nodes.ts)). React or a canvas draws the tree.

The consequence worth remembering: **there is nothing to sanitise, and a parser bug can produce wrong
formatting but not script.** Raw HTML in author source stays literal text. If someone later proposes
rendering text via `dangerouslySetInnerHTML` or adding a markdown library that emits HTML strings,
that is not a refactor — it moves the security boundary and removes the property the whole design
rests on.

Two guards sit beside it:

- **`UrlPolicy`** — the single gate every href passes, inside the parser. Allowlist is exactly
  `https:` and `mailto:`. Everything else becomes plain text. It constructs `new URL(href)` **with no
  base URL on purpose**, so a relative or scheme-relative href fails rather than silently resolving
  against wherever the app happens to be hosted.
- **`TextLimits`** — `maxNodes: 10_000`, `maxDepth: 8`, `maxListItems: 1_000`. Past a cap the parser
  **truncates** rather than erroring, consistent with "malformed input is never an error."

**Decision (2026-09-22): small markdown subset, hand-written, no library.** No `marked`/`markdown-it`
+ DOMPurify. Revisit only if the subset proves limiting in real authoring, against the
unreviewed-dependency policy in `tech-stack.md`.

## 3. Nothing throws toward the dispatcher

A rule executor that throws would break the WHEN→DO chain for every other action in the same rule.
So the whole package fails soft, in three distinct ways that are easy to mistake for bugs:

| Situation | Behaviour |
|---|---|
| Missing or corrupt `assetId` | Opens an **error panel** ("Content unavailable"), emits `panelError` |
| Bad or missing action params | `console.warn`, returns `ctx.state` unchanged |
| Unregistered action kind | Silent no-op — an empty registry is harmless |
| Malformed markdown | Left as literal text |
| Over a parse cap | Truncates to what it has |

**`TextSystem.layout()` returns `undefined` rather than throwing** — changed 2026-09-29. It used to
throw when no measurer was supplied, but `Viewport.tsx` constructs `new TextSystem({ library })` with
no measurer, so the throw was a guaranteed production crash on any `layout()` call. Check
`canLayout` before relying on a result.

## 4. Modal input is a one-way boolean

**Decision (2026-09-27): the modal-input boundary is not a text-system responsibility.**

`packages/text` exposes exactly `TextStateStore.getSnapshot().modalOpen`, a plain boolean. Every
decision about what that *means* — which keys and pointer events get swallowed, whether the clock
pauses, how it interacts with walk-mode pointer lock — belongs to
`src/viewport/interactionController.ts`.

**Why to recall it:** when modal behaviour feels wrong, the bug is almost certainly in the
controller, not here. Resist adding input handling to `packages/text` to fix it; that reintroduces
the coupling the decision removed.

## 5. Sequences navigate both ways, with no buffering

**Decision (2026-09-27): prev/curr/next, explicitly scoped down from a "buffer upcoming panels" idea
that was rejected as over-engineering.**

Because content is already fully in memory (§1), navigation is **index arithmetic over a resolved
array**. No look-ahead, no buffering, both directions no-op at the ends. `advancePanel`/`advance()`
take an explicit `dir: 'next' | 'prev'`.

If you find yourself adding prefetch here, re-read §1 first — it is probably unnecessary.

## 6. Panel stack policy

`PanelManager` owns order and admission:

- A modal panel sits on top and sets `modalOpen`.
- Non-modal panels coexist up to a cap of **3**, after which the **oldest closes**.
- **Re-opening an already-open `attachmentId` re-focuses instead of duplicating.** This one surprises
  people; a double-fired trigger does not stack panels.
- Auto-close runs off an **injected clock read on `tick()`**, not `setTimeout` — which is why it is
  testable without fake timers, and why `Viewport.tsx` must call `text.tick()` each frame or
  `autoCloseMs` silently never fires.

The cap of 3 is explicitly a **placeholder to tune once real authoring content exists**, not a
considered limit.

## 7. `showPanel` argument shape — settled, with an alias

**Decision (2026-09-22): `showPanel` takes `attachmentId`; `componentId` is accepted as an alias** so
existing example rules keep working. Also accepts a bare `assetId` for a hostless panel.

Recorded in [`contracts.md`](../architecture/FOUNDATION--contracts.md). Note that during the
2026-09-29 merge, `Working` had reverted a related naming correction (`playAudio` →
`playAudioOrVideo`); `playAudio` is what is actually registered, and `playAudioOrVideo` appears
nowhere in code. If that drift reappears, the code is right and the doc is wrong.

## 8. `wait: true` is an honest gap, not an oversight

`showPanel` accepts `wait: true`, **warns, and opens anyway.** Pausing a DO chain until a panel
closes needs a wait-for-event primitive `ActionSequencer` does not have.

It warns rather than silently ignoring, so an author gets a signal. If you author a sequence
expecting it to block, it will not.

## 9. Panel events are triggers; paging events are not

`TextEventBridge` forwards **`panelOpened` and `panelClosed`** into `emitRuntimeEvent`, so rules can
chain on text ("when the intro panel closes, start the tour"). It carries a **re-entrancy guard**,
because a rule reacting to `panelClosed` can synchronously open or close more panels and recurse
back through the same emit.

**`panelPaged` and `panelError` stay internal** — deliberately classed as UI state, not rule
vocabulary. Promoting them to triggers is a vocabulary decision, not a wiring change.

---

## Where the implementation diverges from the spec

The spec describes the intended system. These are the places the tree does not match it yet, verified
by reading code rather than the doc. None is a bug; all are unbuilt scope that the spec's prose can
make sound present.

**Three of four presentation modes render nothing.** `TextPresentation.mode` declares
`'panel' | 'label' | 'surface' | 'dialogue'`, and `PanelManager` faithfully records whichever is
passed. But [`src/TextPanelHost.tsx:113`](../../../src/TextPanelHost.tsx) filters
`if (panel.mode !== 'panel') return false`. A `label`, `surface` or `dialogue` attachment therefore
**opens a panel record, emits `panelOpened`, and draws nothing.** This is the most likely source of a
confusing "the rule fired but I see no text" report.

**Not implemented despite appearing in the spec's T2 list:** typewriter effect (0 references), link
confirmation (0), `FontRoleMap` and bundled custom fonts (0). `lang` is carried on panels and set for
screen readers, but `TextAssetMeta.variants` (content by language) has no reader — localisation is
plumbed, not done.

**Only `FakeTextMeasurer` exists.** The layout engine is pure and tested, but there is no
canvas-backed measurer, so `layout()` is unreachable in the app (§3). The DOM overlay lets the
browser wrap instead. A canvas measurer is the missing piece for any fixed-size surface — a caption
box or dialogue plate.

**`layout/` carries a captioning caveat.** Some of this was built with a real-time captioning helper
in mind, and two limits are recorded in `TextLayout.ts`: `page()`'s paging and heading-widow rules
are for *reading documents*, whereas captions want a rolling 1–3 line window via `wrapLine`; and
`layout()` re-wraps the whole node tree per call, so per-frame use against a growing transcript is
**quadratic**. Incremental append is not implemented. Captioning would also need a non-attachment
entry point and an append-to-open-panel verb `PanelManager` lacks.

**`ReferenceViewport.tsx` renders no text surfaces** — a known, flagged gap, not a silent one.

---

## The live question: editor surfacing

This is the one open item with a direction already chosen, and the reason to read this doc before
touching the package.

Text's WHEN→DO surfacing is **entirely runtime**. Rules are hand-authored JSON; there is no editor UI
for building a `showPanel` rule. The audio system was deliberately built the other way — its
interaction work is left to be surfaced *at the editor* — so the two systems currently disagree about
where authoring lives.

**The decided direction: unwind text's own editor interpretation and adopt `Working`'s pattern.**
Since the 2026-09-29 merge these are all present in the tree:

- [`src/inspector/WhenDoRuleSection.tsx`](../../../src/inspector/WhenDoRuleSection.tsx)
- [`src/interactions/RuleRow.tsx`](../../../src/interactions/RuleRow.tsx)
- [`src/editor/ruleEditorOperations.ts`](../../../src/editor/ruleEditorOperations.ts)
- [`packages/authoring-engine/src/ruleOperations.ts`](../../../packages/authoring-engine/src/ruleOperations.ts)

The work is to route text (and audio) attachments through that rule-row editor rather than through
the text system's own surfacing.

Not started. It is a new implementation task, not a continuation of the merge.

---

## Reading order if you are cold

1. This file.
2. [`text-system.md`](text-system.md) §1 (content model), §2 (parsing), §7 (panels) — the three that
   carry the decisions above. Its "Open questions" section holds the full decision log and the
   lower-impact defaults.
3. [`packages/text/src/index.ts`](../../../packages/text/src/index.ts), then `TextSystem.ts` — every
   file has a `@responsibility` header block that states its one job.
4. [`registerTextActions.ts`](../../../packages/text/src/actions/registerTextActions.ts) for the DO
   half and `TextEventBridge.ts` for the loop back into WHEN.
5. `tests/e2e/fixtures/text-demo-project.json` for two real working rules, including a deliberately
   hostile text asset that must render inert.
