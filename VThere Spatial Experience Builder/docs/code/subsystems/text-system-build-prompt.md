# Build prompt: `packages/text`

**Handoff type:** implementation handoff with a built-in learning step, not a spec drop.
**For:** the teammate picking up `packages/text` from design to code.
**Source of truth:** [`text-system.md`](text-system.md) — this prompt does not repeat its content, it tells you how to approach it.

---

## Before you write any code: use the codebase-comprehension skill

Don't start by reading `text-system.md` top to bottom and translating section-by-section into files. That gets you a
package that type-checks but a mental model that's shallow — you'll know *what* each class does without knowing *why*
it's shaped that way, which is exactly the kind of gap that produces "technically matches the doc, but fights the
rest of the codebase" code.

Instead, run the **codebase-comprehension** skill first, pointed at this subsystem, before opening an editor:

> Use the codebase-comprehension skill to help me understand `packages/text` as designed in
> `VThere Spatial Experience Builder/docs/code/subsystems/text-system.md`, before I implement it. Read the actual
> sibling code it depends on and mirrors (`packages/audio`, `packages/assets`, `attachment-integration.md`) as well
> as the doc. Give me the dependency/data-flow diagram and the tour-style walkthrough.

That should produce two things for you to review before touching `packages/text`:

1. **A dependency/data-flow diagram** — `TextSystem` and its five internals (`TextLibrary`, `RichTextParser`,
   `UrlPolicy`, `PanelManager`, `TextLayout`, `TextStateStore`, `TextEventBridge`), what calls what, and where the
   package boundary actually is (what's `packages/text` vs. what's `src/`). Use this to sanity-check your own reading
   of the Boundary diagram in `text-system.md` section "Boundary" — if the generated diagram disagrees with your
   mental model of that ASCII diagram, that's a signal to re-read, not a bug in the skill's output.
2. **A tour-style walkthrough** — starting from what a rule author or a visitor actually triggers (`showPanel` /
   clicking a signed object), following it inward to parsing, layout, and the panel stack. Pay particular attention
   to whichever two or three decisions the walkthrough calls out as "not obvious from reading the code top to
   bottom" — those are very likely to be the same decisions logged with a date in `text-system.md`'s "Open
   questions" section, and are the parts most likely to trip you up if skipped.

This is a comprehension step, not a design step — the skill will not invent anything `text-system.md` doesn't
already say, and it must not commit anything. If it produces a diagram or walkthrough that contradicts the doc,
trust the doc and flag the mismatch back rather than building against the diagram.

## Why this matters here specifically

Three things make `packages/text` a bad candidate for reading-as-you-go instead of building a model first:

- **It's a security-load-bearing package** (Purpose section: "the one with the most security weight"). The
  no-HTML-ever rule, `UrlPolicy`, and the bounded-node-tree design only hold if you understand *why* the parser
  produces a typed tree instead of a string, not just that it does. That's exactly the kind of "why" the tour output
  is meant to surface rather than let you infer.
- **It mirrors `packages/audio` on purpose** (font loading, two-tier `url`/`buffer` resolution, event bridge shape),
  but is *not* audio — text has no cache tier at all (section 1), which is the one place the mirroring stops. A
  diagram that puts both packages side by side makes that divergence obvious in a way that reading one doc in
  isolation doesn't.
- **Five recent dated decisions** (2026-09-21 through 2026-09-27) each closed off a simpler-looking alternative:
  file-backed text, panel buffering/pre-loading, and text-system-owned input handling were all considered and
  explicitly rejected. Implementing from the doc without seeing *why* those were rejected risks quietly
  reintroducing one of them the first time a "wouldn't it be simpler to just—" moment comes up during a hookup.

## What to do with the two outputs

- Keep the diagram and walkthrough as your own working reference (a scratch file, not committed as project
  documentation — `text-system.md` remains the single source of truth for the design; don't fork a second doc).
- If anything in the walkthrough surfaces a genuine ambiguity `text-system.md` doesn't resolve, treat that as a real
  open question and raise it before writing code for that part — don't guess and don't silently pick the
  audio-mirrored behavior by default, since section 1's whole point is that text deliberately diverges from audio.
- Once you can explain, in your own words and without re-reading the doc, (a) why text has no cache tier, (b) why
  `advance()` is index arithmetic and not a buffer, and (c) why `packages/text` only ever exposes a boolean to
  `interactionController` rather than deciding input behavior itself — you're ready to start the build sequence.

## Check explicitly: does When-Do integration actually happen, or just get built?

`packages/text` is only useful to a rule author once `showPanel`/`hidePanel`/`advancePanel` are real, dispatchable
actions — not once the classes compile. This is exactly the failure mode the doc itself calls out as *already having
happened once*: section "Purpose" states today `showPanel` exists only in a doc comment and in tests, "no executor is
registered (`Viewport.tsx:278` creates the registry and registers nothing)." Audio hit the identical gap before it
was wired in (`audio-system.md`: "Today nothing registers an executor"). Treat that as precedent, not a one-off —
a package can be fully built and still be invisible to the rule engine if the last wiring step is skipped or
deferred "for later."

Before calling `packages/text` done, verify, don't assume, each of these:

- `registerTextActions(registry, text, opts)` (section "Class design") is actually called somewhere real — the
  target is `Viewport.tsx` near L278, alongside wherever `registerAudioActions` already runs, not left as a
  standalone export nobody calls yet.
- All three actions in the "Action vocabulary" table (`showPanel`, `hidePanel`, `advancePanel`) have registered
  executors, not just the ones easiest to demo. `advancePanel`'s `dir: 'next' | 'prev'` param (section 7's
  prev/curr/next decision) is easy to half-implement — confirm both directions actually dispatch, not just `next`.
  `wait: true` on `showPanel` resuming an `ActionSequencer` step is its own path; test it, don't infer it from
  `playAudio`'s equivalent working.
  Confirm `componentId` really is accepted as an alias for `attachmentId` per the 2026-09-22 decision — an existing
  example rule depends on that alias not silently regressing.
- Every executor that opens a panel registers a disposer via `context.effects.add` (section "Action vocabulary"
  preamble), so a scene reset actually closes text panels — this is easy to skip because a panel *looks* closed
  (removed from `PanelManager`) without ever being wired to reset.
- `panelOpened`/`panelClosed` really do reach `emitRuntimeEvent` through `TextEventBridge` (section 9) — write a rule
  that says "when this panel closes, do X" and confirm it fires, don't just confirm the bridge code exists.
- `when-do-dispatch-engine.md` and `contracts.md` get their documentation sync (build sequence step 8) in the same
  pass as the wiring, not deferred to "later" — a stale doc that still says "no executor registered" after one
  exists is the exact drift this handoff is trying to prevent.

If any of these is "the class exists but nothing calls it yet," the subsystem is not done, regardless of what test
coverage looks like — tests exercise `packages/text` in isolation and will not catch a missing registration call.

## Then: follow the build sequence as written

`text-system.md`'s "Build sequence" section (near the bottom) is the actual step order — approve doc → shared
attachment work → core package with no browser dependency → overlay → runtime wiring → dev surface → T2 features →
docs sync. Don't reorder it based on what feels easiest; the order encodes real dependencies (e.g. `PanelManager`
needs `TextStateStore` before `TextPanelHost` can subscribe to anything).

Standard repo conventions apply on top of this ([`GIT_AND_HANDOFF_CONVENTIONS.md`](../../../../Agent%20Skills/GIT_AND_HANDOFF_CONVENTIONS.md)):
commit per logical step, keep `SESSION.md` current at the listed triggers, and record the verification command and
result before calling any step complete. `text-system.md`'s own "Verification" subsection lists the specific test
coverage expected (parser hostile-input cases, `UrlPolicy` scheme cases, `PanelManager` stack/modal/cap/auto-close
with an injected clock, and the manual browser checks) — treat that list as the acceptance criteria for step 3
onward, not just a suggestion.
