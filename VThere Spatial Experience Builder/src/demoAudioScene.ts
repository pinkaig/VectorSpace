/**
 * @file        demoAudioScene.ts
 * @brief       Seed data wiring the bundled audio clips into zones, click targets and When-Do rules.
 *
 * @responsibility
 * There is no rule-authoring UI yet (see audio-system.md's "Helper builders and
 * When-Do authoring plan"), so this is the concrete example of what an author
 * would eventually build with a rule inspector: one InteractionRule per audio
 * cue, using audioActionBuilders.ts rather than hand-rolled ActionSpec
 * literals. applyDemoAudioScene() merges this into a ProjectData so "Run
 * simulation" has something to actually play.
 *
 * Layout: four overlapping zones (deliberately overlapping, not partitioned)
 * so a visitor standing where they intersect hears the main BGM plus more
 * than one secondary BGM bed at once — each zone's secondary bed plays on the
 * 'secBgm' channel (not 'bgm', which the audio-system.md design reserves for
 * exclusive/crossfaded playback) so it layers under the main theme instead of
 * cutting it off. Three clickable objects trigger one-shot SFX on the
 * polyphonic 'sfx' channel.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/audio-system.md,
 * docs/code/subsystems/when-do-dispatch-engine.md
 */
import type { AudioAssetMeta, AudioSettings, InteractionRule, SceneData, SceneObject, ZoneDefinition } from '../packages/project/src/index'
import { audioRule, playAudioAction, stopAudioAction } from '../packages/audio/src/actions/audioActionBuilders'

const SFX_OBJECT_IDS = {
  cartoonComedySad: 'demo-sfx-comedy-sad',
  cartoonSneaky: 'demo-sfx-sneaky',
  rockDebris: 'demo-sfx-rock-debris',
} as const

// Overrides colorFor(assetKind)'s shape-based default (see SceneObject['color']) so every
// audio-trigger primitive reads as one recognizable family in the viewport, distinct from
// the app's ordinary cube/sphere/cylinder palette.
const AUDIO_TRIGGER_COLOR = 0x9b5de5

/** Three primitives placed a few units apart, purely as click targets for the SFX demo. */
export const demoAudioObjects: SceneObject[] = [
  {
    id: SFX_OBJECT_IDS.cartoonComedySad,
    name: 'Comedy Sad SFX trigger',
    assetId: 'primitive-cube',
    assetKind: 'cube',
    visible: true,
    enabled: true,
    transform: { position: [-3, 0.55, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    color: AUDIO_TRIGGER_COLOR,
  },
  {
    id: SFX_OBJECT_IDS.cartoonSneaky,
    name: 'Sneaky SFX trigger',
    assetId: 'primitive-sphere',
    assetKind: 'sphere',
    visible: true,
    enabled: true,
    transform: { position: [0, 0.65, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    color: AUDIO_TRIGGER_COLOR,
  },
  {
    id: SFX_OBJECT_IDS.rockDebris,
    name: 'Rock Debris SFX trigger',
    assetId: 'primitive-cylinder',
    assetKind: 'cylinder',
    visible: true,
    enabled: true,
    transform: { position: [3, 0.6, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    color: AUDIO_TRIGGER_COLOR,
  },
]

/**
 * Four overlapping spheres. Radii and centers are chosen so every pair of
 * neighbours overlaps — walking through the middle plays every Sec BGM at once
 * alongside the Main BGM, which is the "experience all at once" case asked for.
 */
export const demoAudioZones: ZoneDefinition[] = [
  { id: 'zone-museum', name: 'Museum ambience', shape: { kind: 'sphere', radius: 6 }, position: [-4, 0, -4] },
  { id: 'zone-fire', name: 'Fire ambience', shape: { kind: 'sphere', radius: 6 }, position: [4, 0, -4] },
  { id: 'zone-musical', name: 'Musical ambience', shape: { kind: 'sphere', radius: 6 }, position: [-4, 0, 4] },
  { id: 'zone-vehicle', name: 'Vehicle ambience', shape: { kind: 'sphere', radius: 6 }, position: [4, 0, 4] },
]

// Values are audioAssets.ts's auto-derived assetIds (the bundled file's name minus
// extension) — must stay in sync with the actual filenames under public/audio/.
const SEC_BGM_BY_ZONE: Record<string, string> = {
  'zone-museum': 'sec-bgm-ambience-museum',
  'zone-fire': 'sec-bgm-fire-burning',
  'zone-musical': 'sec-bgm-musical-voice',
  'zone-vehicle': 'sec-bgm-vehicle-sounds',
}

/** One playAudio on sceneStart, one enter/exit pair per zone, one click per SFX object. */
export const demoAudioRules: InteractionRule[] = [
  audioRule({ id: 'rule-main-bgm-start', triggers: ['sceneStart'] }, [
    playAudioAction('main-bgm-crowd-galley', { channel: 'bgm', loop: true }),
  ]),
  ...demoAudioZones.flatMap((zone): InteractionRule[] => {
    const assetId = SEC_BGM_BY_ZONE[zone.id]
    return [
      audioRule({ id: `rule-${zone.id}-enter`, triggers: ['zoneEnter'], zoneId: zone.id }, [
        playAudioAction(assetId, { channel: 'secBgm', loop: true }),
      ]),
      audioRule({ id: `rule-${zone.id}-exit`, triggers: ['zoneExit'], zoneId: zone.id }, [
        stopAudioAction({ assetId }),
      ]),
    ]
  }),
  audioRule({ id: 'rule-sfx-comedy-sad', triggers: ['click'], objectId: SFX_OBJECT_IDS.cartoonComedySad }, [
    playAudioAction('sfx-cartoon-comedy-sad', { channel: 'sfx' }),
  ]),
  audioRule({ id: 'rule-sfx-sneaky', triggers: ['click'], objectId: SFX_OBJECT_IDS.cartoonSneaky }, [
    playAudioAction('sfx-cartoon-sneaky', { channel: 'sfx' }),
  ]),
  audioRule({ id: 'rule-sfx-rock-debris', triggers: ['click'], objectId: SFX_OBJECT_IDS.rockDebris }, [
    playAudioAction('sfx-rock-debris', { channel: 'sfx' }),
  ]),
]

/**
 * Per-asset loudness relative to master (AudioAssetLibrary.resolve's meta
 * fallback — see audio-system.md section 2's resolution order). Sec BGMs sit
 * well under the main theme so up to four can layer without mud; individual
 * clips are nudged off that 0.35 baseline to correct for how loud each source
 * file was mastered (museum's clip runs hot, fire's runs quiet), not because
 * their zones should be perceptually louder than each other. SFX stays at
 * full volume since it is a brief, deliberate cue. Lives only in project data;
 * nothing here needs a mixer UI.
 */
export const demoAudioAssets: AudioAssetMeta[] = [
  { assetId: 'main-bgm-crowd-galley', name: 'Crowd Galley (Main BGM)', channel: 'bgm', volume: 0.8, loop: true },
  { assetId: 'sec-bgm-ambience-museum', name: 'Ambience Museum (Sec BGM)', channel: 'secBgm', volume: 0.25, loop: true },
  { assetId: 'sec-bgm-fire-burning', name: 'Fire Burning (Sec BGM)', channel: 'secBgm', volume: 0.7, loop: true },
  { assetId: 'sec-bgm-musical-voice', name: 'Musical With Voice (Sec BGM)', channel: 'secBgm', volume: 0.35, loop: true },
  { assetId: 'sec-bgm-vehicle-sounds', name: 'Vehicle Sounds (Sec BGM)', channel: 'secBgm', volume: 0.35, loop: true },
  { assetId: 'sfx-cartoon-comedy-sad', name: 'Cartoon Comedy Sad (SFX)', channel: 'sfx', volume: 1, loop: false },
  { assetId: 'sfx-cartoon-sneaky', name: 'Cartoon Sneaky (SFX)', channel: 'sfx', volume: 1, loop: false },
  { assetId: 'sfx-rock-debris', name: 'Rock Debris (SFX)', channel: 'sfx', volume: 1, loop: false },
]

export const demoAudioSettings: AudioSettings = {
  master: 1,
  channels: {
    bgm: { volume: 1, muted: false },
    secBgm: { volume: 1, muted: false },
    sfx: { volume: 1, muted: false },
    narration: { volume: 1, muted: false },
    ambient: { volume: 1, muted: false },
  },
}

/**
 * Merges the demo objects/zones/rules/audioAssets/audioSettings into a
 * scene+project pair. Additive: appends to whatever the scene/project already
 * have rather than replacing them, so this is safe to call on a project that
 * already has unrelated objects or rules.
 */
export const applyDemoAudioScene = <P extends { rules?: InteractionRule[]; audioAssets?: AudioAssetMeta[]; audioSettings?: AudioSettings }>(
  project: P,
  scene: SceneData,
): { project: P; scene: SceneData } => ({
  project: {
    ...project,
    rules: [...(project.rules ?? []), ...demoAudioRules],
    audioAssets: [...(project.audioAssets ?? []), ...demoAudioAssets],
    audioSettings: project.audioSettings ?? demoAudioSettings,
  },
  scene: {
    ...scene,
    objects: [...scene.objects, ...demoAudioObjects],
    zones: [...(scene.zones ?? []), ...demoAudioZones],
  },
})
