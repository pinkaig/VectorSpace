# What kinds of sound VectorSpace needs

For the sound designer. It sorts the 37 sound moments ("cues") into six kinds by what each one *means* to the person hearing it, then says how they are managed. [CONSULTATION.md](CONSULTATION.md) has the questions and the delivery spec; this is the map of what we are asking for.

**How the numbers were measured.** A hidden copy of the mockup was put into each of 31 screen states and every control on it was pressed, recording what played. That is 807 pressable controls. A button that appears on two screens counts twice, and a press that plays two sounds counts for both, so the figures show how *widely* a sound is used, not how *often* a visitor hears it. Press the **Scan all screens** button on the board to repeat it, and **Download component list (CSV)** for the full control-by-control sheet.

## 1. Six kinds of sound

| Kind | The question it answers | Who hears it | Cues | Control presses it covers | Real audio today |
| --- | --- | --- | --- | --- | --- |
| **Touch feedback** | "Did it hear me?" | Everyone, constantly | 7 | 410 across 156 controls | 0 of 7 |
| **Switches and doors** | "Did something open, close or flip?" | Builders, teachers, admins | 4 | 85 across 47 controls | 0 of 4 |
| **Movement and transition** | "Did I go somewhere?" | Builders, visitors | 8 | 274 across 48 controls | 0 of 8 |
| **Building** | "Did my object land?" | Builders | 4 | 51 across 10 controls | 0 of 4 |
| **Outcome and reward** | "Did it work?" | Builders, teachers | 6 | 13 across 8 controls | 0 of 6 |
| **The museum itself** | "What does this room sound like?" | Visitors, and builders previewing | 8 | 34 across 6 controls | 1 of 8 |

"Real" means the cue plays a real recording from `public/audio`. Only one does (room music "Museum hum"). The other 36 of 37 cues play a synthesised stand-in so the app sounds complete before real audio exists; no third-party sample pack is included.

### Touch feedback

`ui.click`, `ui.click.primary`, `ui.click.confirm`, `ui.select`, `ui.hover`, `editor.undo`, `editor.rotate`

- **Means:** acknowledgement. Nothing happened in the world; the app is saying it registered the touch.
- **Weights.** Three levels of click carry meaning by weight alone: the default (a button), primary (the purple main action), and confirm (a commit such as Send to Ms Tan). `ui.select` is the "one option picked from a group" sound and is the single most widely used cue in the app (134 presses over 62 controls).
- **Character to ask for:** short (under 150 ms), dry, no pitch that fights the music, many variants. This is the sound heard most, so the failure mode is fatigue, not weakness.
- **Managed by:** variants that cycle (`ui.click` has two), a cooldown so a double-click does not machine-gun (25 ms), small random pitch changes. Hover is the optional one: it is bound to every button, tab and menu (777 of the 832 controls scanned), and the open question is whether 30 students in one classroom should hear it at all.

### Switches and doors

`ui.toggle.on`, `ui.toggle.off`, `ui.dialog.open`, `ui.close`

- **Means:** a state flipped, or a layer of the interface opened or closed.
- **Design rule worth agreeing:** these come in **mirrored pairs**. On and off should read as opposites (a rising and a falling version of one sound). Open and close likewise. A pair is easy to learn; four unrelated sounds are not.
- **Managed by:** `ui.close` already has four variants chosen at random, so dismissing several cards in a row does not repeat. Switches turn off 21 times and on 12 times across the screens scanned (permissions, rooms and asset packs among them).

### Movement and transition

`nav.screen`, `nav.carousel`, `editor.step`, `editor.camera`, `editor.zoom`, `play.start`, `play.stop`, `ui.loading`

- **Means:** "you are somewhere else now". Whooshes and sweeps.
- **Direction carries meaning.** Up and forward for going in (the next step, entering Play), down and back for going out (Stop). `play.start` and `play.stop` are the clearest pair.
- **The largest unmet need.** 274 presses over 48 controls play one of these, and none has real audio yet. Five of the eight share one placeholder, a soft whoosh, which is an honest picture of the problem: screen changes, view changes, zoom, the carousel and the loading popup need to be distinguishable from each other and from clicks.
- **Managed by:** these are **layered** over a click rather than replacing it (`nav.screen` plays under the button's own sound), and `editor.zoom` has a 120 ms cooldown because the zoom buttons get tapped repeatedly.

### Building

`editor.pick-up`, `editor.drop`, `editor.room-added`, `editor.info-added`

- **Means:** the physical act of making a museum. This is the sound closest to the product's promise, the moment a student feels they made something.
- **Rarest in count, most important per press.** Dropping an object is P1, and it is one control (the "Fits here, click to drop it" chip). Picking up is any of the six catalogue items, on seven screens.
- **Open question:** a drop that depends on what was dropped (a stone statue versus a plant) is possible with the same structure, by giving each catalogue item its own cue. The cost is audio volume, not code.

### Outcome and reward

`ui.task-complete`, `publish.sent`, `review.approve`, `review.send-back`, `ui.notify`, `ui.error`

- **Means:** the result of something that took effort or could fail.
- **A ladder of three, on purpose.** A small tick when a Mission-brief to-do completes (`ui.task-complete`), a bigger moment when a museum is sent or approved (`publish.sent`, `review.approve`, both currently the same placeholder as the tick, so there is no ladder yet), and a clear negative for errors (`ui.error`).
- **Heard rarely, so they can be expressive.** 13 presses over 8 controls. Five of the six are P1.
- **Managed by:** `ui.task-complete` is the only cue in the app that is a *reward*, so it is flagged as the one to protect; it stacks on top of whatever the press itself plays.

### The museum itself

`play.bgm.hum`, `play.bgm.piano`, `play.footstep`, `play.tap-go`, `play.door`, `play.card-open`, `play.tour-move`, `world.reaction-sound`

- **Means:** the world, not the interface. These are what a visitor to a published museum hears, and they are the only sounds that should survive publishing.
- **Different in kind, not just in family.** Two are **loops** (room music), one is **student-chosen** (`world.reaction-sound` plays whatever a student picked from the curated library), and several would ideally depend on **where the visitor is** (footsteps, music by room, "only nearby" reactions). The audio system does not do spatial sound, ducking or crossfade yet; that is a separate engineering decision this brief asks the consultant about.
- **Managed by:** these use the existing `sfx` and `bgm` channels, while everything above uses a new `ui` channel (proposed). That split is what lets a published museum leave the editor's sounds out.
- **Weakest on real audio:** 7 of 8 are stand-ins. Room music has one real bed (a museum-foyer ambience) and one placeholder.

## 2. How the sounds are managed

**Shared on purpose.** One cue serves many controls, so changing one sound changes all of them. The widest-reaching cues are where a good sound pays off first:

| Cue | Presses | Distinct controls | Screens |
| --- | --- | --- | --- |
| `ui.click` | 159 | 74 | 31 |
| `ui.select` | 134 | 62 | 24 |
| `ui.click.primary` | 73 | 29 | 28 |
| `editor.step` | 66 | 12 | 14 |
| `nav.screen` | 52 | 17 | 25 |
| `editor.zoom` | 49 | 4 | 14 |
| `editor.pick-up` | 45 | 7 | 7 |
| `editor.camera` | 43 | 5 | 14 |

Eight cues out of 37 are the first sound of 70% of all presses. The board's **Sounds** tab lists, under each cue, the components that use it, and the **On this screen** tab shows the same thing from the page's side: each control, numbered to match the outlines on the page, with the sound it plays. The two ends of the table are very different jobs: the top rows are heard constantly and must never tire, the bottom rows (15 cues are on six controls or fewer, and five are on none) are heard rarely and can carry character.

**One press, one sound.** If a press causes something with its own sound (Place things changes the step, so you hear the step sound), the click is dropped, not stacked. A step pill is then not "a button" but "a transition". Layered cues (`nav.screen`, `ui.task-complete`) are the exception and play on top. The consultation asks whether that rule is right (question 4).

**Priority tiers.** Every cue has a tier: 15 are P1 (the app feels broken without it), 16 are P2 (polish), 6 are P3 (nice to have). A render can fire several outcomes; the most important one wins. Tiers also say what to commission first.

**Channels.** `ui` for editor chrome (20 sounds), `sfx` for world one-shots (5), `bgm` for room music (2). Each has its own volume and mute on the board's mixer, which is the audio system's own control. Whether some `ui` sounds that are really in the world, such as the drop and the door, belong on `sfx` instead is a call for the designer.

**Repetition control.** Variants (`ui.click` cycles two, `ui.close` picks among four at random without repeating), cooldowns (hover 70 ms, click 25 ms, zoom 120 ms, footstep 330 ms) and small random pitch shifts (six cues) keep repeated sounds from sounding mechanical.

**Where each decision lives.**

| To change… | Edit | Who |
| --- | --- | --- |
| Which audio a moment plays, how loud, variants | `cue-map.json` (or on the board, then **Copy cue-map.json**) | Sound designer |
| Which control or state fires which moment | `bindings.json` | Developer |
| The audio itself | the file in `sfx/` (same name), or drop one onto a row | Sound designer |

## 3. What the scan found that the list alone would not show

- **All 27 silent presses are one thing:** the two walls (and in Play mode the floor) of the 3D room are clickable in the mockup but make no sound. Clicking a wall only does something while an object is being carried into it, which plays the error sound. A decision: should a wall or floor press ever sound?
- **Five cues are not caused by any control:** `ui.hover` (pointer only), `play.bgm.piano` (needs a Music setting), `play.card-open` (a visitor reaching an object), `play.footstep` (keys), `play.door` (not wired in the mockup). They are real moments that no button press will demonstrate, so every cue has a preview button on the board.
- **The old prediction was wrong for 32 of 48 controls on one screen.** The binding rules say a button plays `ui.click`, but 32 of those controls change something with its own sound, which replaces the click. The debug view now reports what a press really plays, by pressing it in a hidden copy.
- **`ui.select` may not need to exist.** It is the busiest cue, and today it plays a quieter copy of the default click. Whether picking from a group deserves its own sound, or should simply be the click, is a designer's call, and it is the largest single simplification on offer.

## 4. Decisions to bring

1. Is a distinct `ui.select` worth designing, or does it fold into `ui.click`?
2. Should hover make a sound in a classroom of 30?
3. Do on/off, open/close and start/stop get mirrored pairs as a house rule?
4. Does the reward ladder get three rungs (tick, milestone, approved), given that sent-for-approval and approved currently share the tick?
5. Do `ui` sounds in the world (drop, door) move to `sfx`?
6. Should the walls and floor ever sound?
7. Does a drop depend on the object dropped?
