# Audio system: what is built, what is not, and what is worth building

For whoever picks up audio next, or decides what to fund.
Sherman · 2026-10-23 (updated the same day: the first four "do now" items below are now built)

Checked against the code on branch `sherman-audio-implementation-branch`. The 83 tests in `packages/audio` and `src/content` pass. Nobody has listened to the result, so "works" here means the code and tests agree, not that it sounds right. The design doc's "Feature tiers" table lives in the project wiki and was not available when this was written; the deferred list below comes from code comments and earlier handoffs, so compare it with the wiki.

---

## 1. Overview

Audio does two different jobs in VectorSpace, and they need different things:

| Job | Who hears it | What it must do |
| --- | --- | --- |
| **World audio** | A visitor walking a published museum | Make a room feel like a place: music, ambience, reactions to what the visitor does |
| **UI audio** | A student building, a teacher reviewing | Confirm that a click, drop or send registered |

The engine underneath is shared. World audio is driven by When-Do rules; UI audio is driven by `CueBank`, which sits on top of the same engine on its own `ui` channel.

**Short verdict.** The playback engine is complete for a first release. What is missing is mostly *shaping*: how sounds start, end and blend as a visitor moves, and the controls a visitor and an author need to adjust them. The expensive features (3D audio, reverb) matter least.

## 2. Core classes and functions

| Piece | Where | Job |
| --- | --- | --- |
| `AudioSystem` | `packages/audio/src/AudioSystem.ts` | The one object other code holds. `play`, `stop`, `pause`, `resume`, `seek`, volumes, `unlock`, `stopAll` |
| `AudioVoice` | `AudioVoice.ts` | One playing instance of a clip, with its own status (loading, playing, ended, error) |
| `MasterBus`, `ChannelBus` | `mix/` | The volume and mute knobs. Four built-in channels (`bgm`, `sfx`, `narration`, `ambient`); any other id is created on first use |
| `AudioAssetLibrary` | `AudioAssetLibrary.ts` | Merges per-play settings over the project's saved settings over built-in defaults |
| `AudioBackend` | `backend/` | The seam to the browser. `WebAudioBackend` is real; `FakeAudioBackend` is for tests |
| `registerAudioActions` | `actions/` | Registers the six rule actions: `playAudio`, `stopAudio`, `pauseAudio`, `resumeAudio`, `setChannelVolume`, `setMasterVolume` |
| `audioActionBuilders` | `actions/` | Helpers that build those actions and whole rules without hand-writing them |
| `CueBank` | `cues/CueBank.ts` | UI sounds: cue id to sound variants, gain, cooldown, random pitch variation. Staged, not committed |
| Catalog and loading | `src/content/audio*.ts` | Bundled clips from `public/audio/`, user imports, two-tier loading |

**Two-tier loading.** Long audio (music, ambience, voice) is fetched when needed and not stored. Short clips (effects) are kept in IndexedDB after the first fetch, up to 32 MB, oldest first out. Decoded audio is also kept in memory, up to 32 clips.

## 3. Procedural capabilities

What an author or developer can do today.

**Author, in the editor**
1. Add a rule whose action is "play a sound" and pick from the catalog (`WhenDoRuleSection`).
2. Import their own .ogg, .mp3 or .wav; it is stored in that browser only.
3. Load the audio demo: one main track, four overlapping zone beds, three clickable effects.

**Developer, in code**
1. Build rules with `audioRule`, `playAudioAction`, `stopAudioAction`.
2. Set a clip's channel, volume and loop in the project's `audioAssets`.
3. Drop a file into `public/audio/` and it joins the catalog if it decodes. The filename prefix (`main-bgm-`, `sec-bgm-`, `sfx-`) picks its channel and loading tier.
4. Add UI cues in `prototypes/ui-audio/cue-map.json` (37 cues, tiers P1 to P3).

**Visitor, in the simulation.** A "Sound on/off" button, a volume slider and the **M** key sit in the top bar. The choice is remembered in the browser. The tab-hidden pause is automatic.

**Fades and cooldown, in rules.** `playAudioAction(id, { fadeIn: 1.5, cooldownMs: 400 })` and `stopAudioAction({ assetId }, { fadeOut: 1.5 })`. The demo's zone beds and click effects already use them.

## 4. Current state versus future

### Built

Playback and mixing, the unlock-on-first-gesture queue, voice cleanup, the six rule actions, both loading tiers, the catalog, rule-builder picker, user imports, the demo, and `CueBank`. Added 23 Oct: fade in and fade out, retrigger cooldown for world sounds, pause when the tab is hidden, and a visitor volume and mute control. These have unit tests; the controls were checked in the browser, but nobody has listened to a fade.

### Not built, with a verdict

Each feature is scored on one question: **does it change what a visitor experiences in a museum, or how a builder feels about their clicks?** Cost is rough engineering effort.

| Feature | Value to a visitor | Value to UI feedback | Cost | Verdict |
| --- | --- | --- | --- | --- |
| ~~**Visitor volume and mute control**~~ **Built 23 Oct** | High. School rooms, shared speakers, a visitor who wants quiet | High. A teacher must be able to mute `ui` alone | Low. The engine methods exist; only a control is missing | Done. Mute button, slider and M key in the simulation top bar, remembered per browser. The *authored* mix (per-channel volumes) is still not visitor-editable |
| ~~**Fades and crossfade**~~ **Fades built 23 Oct** | High. Today a zone's music snaps on and off at the boundary, which reads as a glitch rather than a place | Low | Low to medium. Gain ramps already exist in the buses | Done for start and stop: a zone bed fades in and out over 1.5 s. A true crossfade (one sound replacing another on an exclusive channel) is not built; re-entering a zone while its bed fades out overlaps the two, which sounds like one. Listen before building more |
| ~~**Pause when the tab is hidden, and recover from a suspended context**~~ **Built 23 Oct** | Medium. Music keeps playing from a background tab | Medium. A late first click can be missed | Low | Done. Hiding the tab suspends the audio context; showing it resumes from the same spot. Not built: recovering from a context the browser suspends on its own (for example a phone call on iOS) |
| **Ducking** (lower music while narration or a fact card speaks) | High once any narration exists, because speech over loud music is unintelligible | Low | Low to medium | **Do when the first narration clip ships.** Skip until then |
| ~~**Retrigger gating for world sounds**~~ **Built 23 Oct** | Medium. Mashing a trigger stacks voices into a roar | `CueBank` already has cooldown, so UI is covered | Low | Done as an opt-in `cooldownMs` on `playAudio`; the demo's three click effects use 400 ms. A rule without it still stacks |
| **Seamless loops** (loop points, or gapless files) | Medium. Audible gaps in a looping bed break the illusion; mp3 and ogg add padding that causes them | Low | Low if the files are prepared properly; medium if done in code | **Fix at the asset level first**, in what is delivered |
| **Captions** | High for deaf and hard-of-hearing students, and wherever narration plays on a muted device | None | Medium. Needs the text system | **Decide with the first narration clip.** Probably required in a school setting, so confirm before shipping narration |
| **Audio as a property of an object or zone** (attachments) | None directly | None | Medium | **Defer.** Easier authoring, same sound; rules already reach it |
| **Real 3D / spatial audio** | High *in principle*: walking toward an exhibit and hearing it grow is the museum feeling. But classroom speakers are often mono, and the existing zone beds already give a rough version | Low | High. Needs a listener tied to the camera and a position on every sound | **Decide after fades.** Fades plus zones cover most of it. Build real spatial audio only if the consultant says it is worth it |
| **Mixer snapshots and playlists** | Low to medium. A "gallery mode" or a tour playlist is nice, not necessary | None | Medium | **Defer** |
| **Reverb and occlusion** (sound muffled behind walls) | Low. A showpiece; students will not notice its absence | None | High | **Skip for now** |
| **Metering** | None | None | Medium | **Skip.** Only useful inside a mixer UI that does not exist |
| **Author controls for volume, channel and mix** | Indirect: it is how levels get right | Indirect | Medium to high, since it is new UI | **Do before more clips ship.** The engine cannot make a quiet file louder, and every correction is currently a code edit |

### Gaps in what is built

- **No tests** for `audioByteCache.ts`, the IndexedDB path or `WebAudioBackend`. Vitest runs under Node, which has neither.
- **The left rail is switched off**, so the Audio panel that lived there is unreachable (restore from commit `68caea5`).
- **Placeholders.** 16 of the 27 UI sounds are synthesised tones, and 9 of the 15 P1 cues still use them. See `prototypes/ui-audio/CONSULTATION.md`.
- **Level control.** `AudioSystem` caps volume at 1, so quiet files cannot be boosted. Ask for files delivered at one level.
- **Trimmed tails.** Several UI files are seconds long for a fraction of a second of sound, and each play holds a voice for the whole file.

## 5. Next steps

In order, with the reason for the order:

1. ~~Visitor volume and mute control~~ Done 23 Oct. Still to do: a separate `ui` mute for the editor, which has no control yet.
2. ~~Fades~~ Done 23 Oct. **Listen to them in the demo,** walking between zones: that tells you whether true spatial audio is still worth its cost.
3. ~~Pause on tab hidden~~ Done 23 Oct.
4. ~~Retrigger cooldown~~ Done 23 Oct. Consider a default cooldown for the `sfx` channel so authors do not have to opt in.
5. **Settle the four open decisions** (below), at least the first two, before more sounds are produced.
6. **Add ducking and captions** together, when the first narration clip is commissioned.
7. **Add author controls** for volume and channel once there are enough clips that code edits hurt.

### Open decisions

1. Where UI sounds and `cue-map.json` live. `public/audio/` is the student-facing catalogue, so UI sounds must not land there.
2. Which deferred features the sound consultant is asked to weigh in on. The brief already raises spatial audio, ducking and crossfade.
3. Whether captions are required for narration in the target schools.
4. Whether to add the missing tests before merging.

### Not verified

How anything sounds; touch devices and iPad; Safari and Firefox; the real latency of a UI sound on a low-end classroom machine.
