/**
 * @file        index.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Canonical shared project, scene, object, and transform model.
 *
 * @responsibility
 * Defines renderer-independent project data and creates safe default and
 * cloned project values for editor, serializer, and runtime consumers.
 *
 * @inputs
 * AssetKind and object index values for makeObject().
 *
 * @outputs
 * Typed project structures, defaultProject(), cloneProject(), and makeObject().
 *
 * @members
 * AssetKind, TransformData, SceneObject, SceneData, ProjectData,
 * MediaKind, AssetRefKind, Attachment (audio/text/image/video), CardMedia,
 * MediaViewProps, AttachmentCapabilities, TextAssetMeta, TextPresentation, CardField,
 * defaultProject, cloneProject, and makeObject.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Project-Serialization
 */
// Single-entry package (package.json "exports" is one string), so the
// attachment lookup helpers must be re-exported here to be importable.
export { assetRefForAttachment, collectAttachments, findAttachment } from './attachments'
export type { AttachmentHostRef, AttachmentLocation } from './attachments'
export { getAttachmentCapabilities, listAttachmentCapabilities } from './capabilities'
export type {
  ActionParamSpec, AttachmentActionDescriptor, AttachmentCapabilities, AttachmentCapabilityKey,
  AttachmentEventDescriptor, CapabilityStatus,
} from './capabilities'

export type AssetKind = 'cube' | 'sphere' | 'cylinder' | 'model'

export interface TransformData {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface SceneObject {
  id: string
  name: string
  assetId: string
  assetKind: AssetKind
  visible: boolean
  enabled: boolean
  // absent = top-level object; must reference an object in the same scene, no cycles
  parentId?: string
  transform: TransformData
  // absent in files written before attachments existed; left undefined (not
  // backfilled) to keep files small — attachments live on their host so
  // delete/duplicate/undo carry them automatically
  attachments?: Attachment[]
  // absent = fall back to colorFor(assetKind)'s shape-based default. A hex color
  // (e.g. 0x4ea7a0) that overrides the primitive material for just this object,
  // without needing a new AssetKind or touching asset resolution.
  color?: number
}

/**
* `procedural` environments are created directly in the app. 
* `glb` environments are loaded from a URL. 
* Procedural environments are used as temporary placeholders until 
* the final environment assets are approved. 
* This allows loading, orbit mode, and walk mode to be tested now.
 */
export type EnvironmentKind = 'procedural' | 'glb'

export interface EnvironmentDefinition {
  id: string
  name: string
  kind: EnvironmentKind
  description: string
  proceduralId?: string
  url?: string
}

export interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
}

export const environmentLibrary: EnvironmentDefinition[] = [
    {
    id: 'env-empty',
    name: 'Empty',
    kind: 'procedural',
    proceduralId: 'empty',
    description: 'No walls or floor — just the grid, for working against a blank scene.',
  },
  // `url` for these is relative to the app's src/ — the app bundles src/env/*.glb and
  // resolves it to the built file (see loadGlb in src/environments.ts).
  {
    id: 'env-room-1',
    name: 'Room 1',
    kind: 'glb',
    url: 'env/room_1.glb',
    description: 'Exhibition room 1.',
  },
  {
    id: 'env-room-2',
    name: 'Room 2',
    kind: 'glb',
    url: 'env/room_2.glb',
    description: 'Exhibition room 2.',
  },
  {
    id: 'env-room-3',
    name: 'Room 3',
    kind: 'glb',
    url: 'env/room_3.glb',
    description: 'Exhibition room 3.',
  },
  {
    id: 'env-room-4',
    name: 'Room 4',
    kind: 'glb',
    url: 'env/room_4.glb',
    description: 'Exhibition room 4.',
  },
  {
    id: 'env-room-5',
    name: 'Room 5',
    kind: 'glb',
    url: 'env/the_hallwyl_museum_1st_floor_combined.glb',
    description: 'Test environment.',
  },
]

export const defaultEnvironmentId =
  environmentLibrary.find((item) => item.proceduralId === 'empty')?.id ?? environmentLibrary[0].id

export const findEnvironment = (environmentId: string): EnvironmentDefinition =>
  environmentLibrary.find((item) => item.id === environmentId) ??
  environmentLibrary.find((item) => item.id === defaultEnvironmentId) ??
  environmentLibrary[0]

export const defaultCameraPose = (): CameraPose => ({ position: [7, 5.5, 8], target: [0, 0.7, 0] })

/**
 * A volume the WHEN→DO runtime tests occupancy against, to turn "someone walked
 * in here" into an event. Zones are spatial, so they belong to a scene; rules,
 * which reference them, belong to the project.
 */
export type ZoneShape =
  | { kind: 'box'; size: [number, number, number] }
  | { kind: 'sphere'; radius: number }

export interface ZoneDefinition {
  id: string
  name: string
  shape: ZoneShape
  position: [number, number, number]
  // same contract as SceneObject.attachments; a zone attachment has no
  // transform of its own — the zone's position and shape apply
  attachments?: Attachment[]
  // 'hotspot': a visible marker visitors click to open the zone's info card.
  // Absent = an ordinary invisible trigger zone, as in every save before hotspots.
  marker?: 'hotspot'
}

/**
 * One DO action a rule asks for. `params` carries arguments a bare kind string
 * could not — a componentId for showPanel, an assetId for playAudio.
 */
export interface ActionSpec {
  kind: string
  params?: Record<string, unknown>
}

/**
 * An authored WHEN→DO rule. Field names mirror the backend's interaction_rules
 * columns so the record round-trips without translation; objectId is optional
 * for the same reason its column is nullable — a sceneStart rule names no object.
 */
export interface InteractionRule {
  id: string
  objectId?: string
  zoneId?: string
  triggers: string[]
  actions: ActionSpec[]
  priority?: number
}

export interface SceneData {
  id: string
  name: string
  objects: SceneObject[]
  environmentId: string
  startCamera: CameraPose
  // absent in files written before zones existed; the serializer backfills to []
  zones?: ZoneDefinition[]
  // Cell on the rooms map: x grows east, z grows south. Absent on scenes made before
  // the map existed; the editor treats an unplaced first scene as the origin.
  layout?: RoomCell
}

export interface RoomCell {
  x: number
  z: number
}

/** A mix group with its own volume and mute. The four below always exist; a project may add custom ids. */
export type ChannelId = 'bgm' | 'sfx' | 'narration' | 'ambient' | (string & {})

/**
 * Authored presettings for one audio asset, stored on the project. Core
 * playback fields only — see https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Audio-System for the
 * full field set (spatial, captions, loop points, etc.) not yet implemented.
 */
export interface AudioAssetMeta {
  assetId: string
  name: string
  channel: ChannelId
  volume: number
  loop: boolean
}

export interface AudioSettings {
  master: number
  channels: Record<ChannelId, { volume: number; muted: boolean }>
}

/**
 * The media kinds the attachment model can bind to a host. Every kind now has
 * an Attachment shape: audio and text from the start, image and video added
 * for info cards (docs/handover/info-card-and-media-overview.md, Step 0).
 */
export type MediaKind = 'audio' | 'image' | 'video' | 'text'

/** What AssetRef.kind widens to: a placeable primitive/model or a media kind. */
export type AssetRefKind = AssetKind | MediaKind

export type TextFormat = 'plain' | 'markdown-lite'

/**
 * fontFamily names a role, never a font file or URL, so an author cannot pull
 * in remote type; the app maps roles to real fonts. Colours are validated as
 * hex so styling cannot smuggle a css url() (text-system.md section 4).
 */
export interface TextStyle {
  fontFamily?: 'body' | 'heading' | 'mono'
  sizePx?: number
  color?: string
  background?: string
  align?: 'left' | 'center' | 'right'
}

/**
 * A teacher blank on an info card: a spot a student fills in. Reserved only so
 * saves will not need a migration when teacher blanks arrive. Nothing reads it.
 */
export interface CardField {
  key: string
  label: string
  locked?: boolean   // the teacher's text, which a student cannot change
  prompt?: string    // the hint shown in an empty blank
}

/**
 * How a text attachment is shown. 'panel' is the plain pop-up and 'card' is
 * the info card (title, text, one media slot). 'label', 'surface' and
 * 'dialogue' are reserved names that nothing renders yet; they stay so saves
 * that already use them keep loading.
 */
export interface TextPresentation {
  mode: 'panel' | 'card' | 'label' | 'surface' | 'dialogue'
  title?: string
  anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  size?: [number, number]
  offset?: [number, number, number]
  style?: TextStyle
  modal?: boolean
  autoCloseMs?: number
  paging?: 'none' | 'auto'
  media?: CardMedia     // card mode only: the image or video under the title, by reference
  fields?: CardField[]  // card mode only: reserved for teacher blanks, unused
}

/**
 * Author text stored inline in the project — there is no file-backed text
 * kind and no network fetch for text content, by decision (text-system.md
 * section 1). Size is bounded by the serializer's 64 KB per-asset and 512 KB
 * per-project caps instead of a storage tier.
 */
export interface TextAssetMeta {
  assetId: string
  name: string
  format: TextFormat
  lang: string                       // BCP 47, e.g. 'en'
  content: string
  variants?: Record<string, string>  // T2: content by language
  maxLength?: number                 // author-set cap, never above the system limit
  title?: string
}

/**
 * A binding of one asset to one host. Behaviour is not here: an attachment
 * declares that content belongs to a host; a WHEN→DO rule says when it happens
 * (attachment-integration.md section 2).
 */
export interface AttachmentBase {
  id: string        // unique across the whole project, objects and zones alike
  name?: string
}
export interface AudioAttachment extends AttachmentBase { kind: 'audio'; assetId: string }
export interface TextAttachment extends AttachmentBase { kind: 'text'; assetId: string; presentation: TextPresentation }
/**
 * Image and video attachments hold only the id of a media library entry. The
 * entry (an uploaded file or a teacher-approved link) is looked up at run
 * time, so no bytes or URLs are ever stored in ProjectData.
 */
export interface ImageAttachment extends AttachmentBase { kind: 'image'; assetId: string }
export interface VideoAttachment extends AttachmentBase { kind: 'video'; assetId: string }
export type Attachment = AudioAttachment | TextAttachment | ImageAttachment | VideoAttachment

/**
 * The one media slot on an info card: an image or a video, by reference.
 * assetId names a media library entry; caption and alt are short author text
 * shown with it. Nothing reads this until the card mode lands (Track A1).
 */
export interface CardMedia {
  kind: 'image' | 'video'
  assetId: string
  caption?: string
  alt?: string
}

/** What MediaView reports as it loads and plays; 'unavailable' is the visible fallback, not an error. */
export type MediaViewState = 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'unavailable'

/**
 * The fixed seam between the info card and the media player. Kept here, not
 * in the component, so the card and the player can be built apart and joined
 * with one import. Change it only with both sides agreeing.
 */
export interface MediaViewProps {
  media: CardMedia
  autoplay?: boolean   // video only; default false
  onState?: (state: MediaViewState) => void
}

export interface ProjectData {
  schemaVersion: 1
  id: string
  name: string
  scenes: SceneData[]
  activeSceneId: string
  // absent in files written before rules existed; the serializer backfills to []
  rules?: InteractionRule[]
  // absent in files written before audio existed; the serializer backfills to []
  audioAssets?: AudioAssetMeta[]
  // absent in files written before audio existed; the serializer backfills to defaultAudioSettings()
  audioSettings?: AudioSettings
  // absent in files written before text existed; the serializer backfills to []
  textAssets?: TextAssetMeta[]
}

export const defaultAudioSettings = (): AudioSettings => ({
  master: 1,
  channels: {
    bgm: { volume: 1, muted: false },
    sfx: { volume: 1, muted: false },
    narration: { volume: 1, muted: false },
    ambient: { volume: 1, muted: false },
  },
})

export const makeScene = (id: string, name: string): SceneData => ({
  id,
  name,
  objects: [],
  environmentId: defaultEnvironmentId,
  startCamera: defaultCameraPose(),
})

export const defaultProject = (): ProjectData => ({
  schemaVersion: 1,
  id: 'project-vectorspace-demo',
  name: 'Tide Lines Exhibition',
  activeSceneId: 'scene-gallery',
  scenes: [makeScene('scene-gallery', 'Gallery')],
})

export const cloneProject = (project: ProjectData): ProjectData =>
  JSON.parse(JSON.stringify(project)) as ProjectData

// half the height of each primitive's geometry, so a freshly placed object rests on the
// floor. GLB models carry no known height here — 0 assumes the source model's own pivot
// sits at its base; the author repositions it via the transform gizmo if that's not true.
const restingHeight: Record<AssetKind, number> = { cube: 0.55, sphere: 0.65, cylinder: 0.6, model: 0 }

export const makeObject = (assetKind: AssetKind, index: number, assetId?: string): SceneObject => ({
  id: `${assetKind}-${Date.now()}-${index}`,
  name: `${assetKind[0].toUpperCase()}${assetKind.slice(1)} ${index}`,
  assetId: assetId ?? `primitive-${assetKind}`,
  assetKind,
  visible: true,
  enabled: true,
  transform: {
    position: [0, restingHeight[assetKind], 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
})

/**
 * PSEUDO-CODE: responsibilities retained by this project package.
 *
 * This is documentation only. The executable lifecycle operations live in
 * `packages/authoring-engine`. This package remains the canonical, serializable
 * project contract and must not become a mutable object registry.
 *
 * ProjectData:
 *   owns project identity, schemaVersion, scene ordering, and active scene ID
 *   contains every authored SceneObject exactly once
 *   is safe to clone, serialize, migrate, validate, and restore
 *   owns InteractionRule[] (WHEN→DO rules); zones live on SceneData because
 *   they are spatial. Both were added by additive migration — optional and
 *   backfilled to [], so schemaVersion stayed 1, as with parentId. Because they
 *   are ProjectData fields, undo/redo covers them with no extra work.
 *   Runtime state is deliberately NOT here: see
 *   https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/When-Do-Dispatch-Engine
 * Links point at the project wiki; migration is still in progress.
 *
 * SceneObject:
 *   owns persistent object identity, display name, asset identity, asset kind,
 *   visibility/enabled flags, optional parentId, and transform data
 *   visible, enabled, and parentId were added through schema migration; the
 *   serializer backfills or validates them on load. `status` remains future
 *   work behind another migration.
 *
 * Project package pure helpers:
 *   makeScene(sceneId, name)
 *     -> create a valid empty scene with default environment and camera
 *
 *   makeObject(assetKind, displayIndex)
 *     -> create default primitive data for an authoring command to insert
 *
 *   cloneProject(project)
 *     -> return a defensive snapshot copy for history or editing
 *
 *   findScene(project, sceneId)
 *     -> read-only lookup; return a scene or an explicit missing-scene result
 *
 *   findObject(project, sceneId, objectId)
 *     -> read-only lookup; return an object or an explicit missing-object result
 *
 * Authoring-engine boundary:
 *   input = { projectSnapshot, operation, dependencies }
 *   result = authoringEngine.apply(input)
 *   result.projectSnapshot = a new validated ProjectData value
 *   result.historyData = undo/redo information for the command timeline
 *
 *   create / duplicate / remove / transform / rename operations
 *     -> belong to `packages/authoring-engine`
 *     -> never mutate this package's global state because none exists
 *
 * Persistence and renderer boundaries:
 *   serializer.save(projectSnapshot)
 *   viewport.observe(projectSnapshot)
 *   runtime.load(validatedProjectSnapshot)
 *
 * None of those adapters may become the authority for object meaning. They
 * observe or restore ProjectData; the authoring engine creates the next
 * snapshot, and the project package defines its shape.
 */

