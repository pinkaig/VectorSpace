/**
 * @file        serializer.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Project JSON serialization, validation, import, export, and draft recovery.
 *
 * @responsibility
 * Converts ProjectData to and from JSON, validates untrusted project input,
 * and manages current and backup browser draft records.
 *
 * @inputs
 * ProjectData, JSON strings, browser File values, and localStorage records.
 *
 * @outputs
 * Validated ProjectData, persistence results, downloaded JSON, and errors
 * describing rejected input or failed storage operations.
 *
 * @members
 * ProjectLoadResult, serializeProject, deserializeProject, importProjectFile,
 * loadProjectWithSource, saveProject, downloadProject, and copyProject.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Project-Serialization
 * Links point at the project wiki; migration is still in progress.
 */
import { Attachment, CardField, CardMedia, CardTask, ProjectData, TextPresentation, TextStyle, cloneProject, defaultAudioSettings, defaultCameraPose, defaultEnvironmentId, defaultProject } from './model'
  import { createLogger } from '@vectorspace/debugging'

const STORAGE_KEY = 'vectorspace-project-v1'
const BACKUP_STORAGE_KEY = 'vectorspace-project-v1-backup'

export type PersistenceResult = 'saved' | 'saved-with-backup' | 'failed'
export type ProjectLoadSource = 'draft' | 'backup' | 'default' | 'server'
export const MAX_PROJECT_FILE_BYTES = 2_000_000
const MAX_SCENES = 100
const MAX_OBJECTS = 5_000
const MAX_LABEL_LENGTH = 200
const MAX_ZONES = 500
const MAX_RULES = 5_000
const MAX_AUDIO_ASSETS = 1_000
const MAX_ATTACHMENTS_PER_HOST = 16
const MAX_ATTACHMENTS_TOTAL = 5_000
const MAX_TEXT_ASSETS = 1_000
// Text is project data with no file-backed escape valve, so these two caps are
// the entire storage policy: 64 KB per asset, 512 KB per project, keeping text
// inside the 2 MB project cap (text-system.md section 1).
const MAX_TEXT_ASSET_BYTES = 65_536
const MAX_PROJECT_TEXT_BYTES = 524_288
// card captions and alt text are a line or two, never a second text body
const MAX_CAPTION_LENGTH = 500
const MAX_CARD_FIELDS = 50
// a teacher's fixed words can run longer than a label; a student's answer longer still
const MAX_FIELD_TEXT = 500
const MAX_FIELD_ANSWER = 2000
const MAX_CARD_TASKS = 20
// a brief is something a student reads at a glance; these are generous ceilings, not targets
const MAX_BRIEF_ITEMS = 50

export interface ProjectLoadResult {
  project: ProjectData
  source: ProjectLoadSource
  /** A server project's status (draft, published or archived); unset for a browser draft. */
  status?: 'draft' | 'published' | 'archived'
  /** A server project's sharing state, for "Share your museum"; unset for a browser draft. */
  sharing?: ProjectSharing
}

export interface ProjectSharing {
  /** Its newest hand-in to the teacher (routers/submissions.py); null if never handed in. */
  reviewStatus: 'waiting' | 'approved' | 'sent_back' | null
  /** Who the student chose in "Who can visit?"; null if not chosen yet. */
  shareWith: 'public' | 'unlisted' | 'sign_in_only' | null
  /** The teacher's note from their last review, e.g. why it was sent back. */
  reviewComment: string | null
  /** Who assigned it, e.g. "Ms Tan"; null for a project nobody assigned. */
  teacherName: string | null
  /** The project's slug, the last part of its visitor link. */
  slug: string | null
}

const logger = createLogger('editor.persistence')

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const serializeProject = (project: ProjectData): string => JSON.stringify(project, null, 2)

/**
 * Adds missing data to older project files so they can still open correctly without crashing.
 */
// Control characters other than newline, tab and carriage return never belong in author text;
// they are stripped on load rather than rejected (text-system.md section 1). Written as escape
// codes, not the raw characters, so the file stays plain text that GitHub can show.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

const backfillScenes = (project: ProjectData): ProjectData => {
  // Files written before WHEN→DO rules existed have neither field; both are
  // optional in the schema and default to empty, so schemaVersion stays 1 —
  // the same additive pattern as visible, enabled, and parentId.
  if (!Array.isArray(project.rules)) project.rules = []
  if (!Array.isArray(project.audioAssets)) project.audioAssets = []
  if (!project.audioSettings) project.audioSettings = defaultAudioSettings()
  if (!Array.isArray(project.textAssets)) project.textAssets = []
  // host attachments stay undefined when absent (not backfilled to []), so
  // untouched files keep their exact shape and stay small
  project.textAssets.forEach((meta) => {
    meta.content = meta.content.replace(CONTROL_CHARS, '')
    if (meta.variants) {
      for (const lang of Object.keys(meta.variants)) meta.variants[lang] = meta.variants[lang].replace(CONTROL_CHARS, '')
    }
  })
  // the brief is teacher-written text students read, so it gets the same control-character
  // clean-up as text assets; an absent brief stays absent
  if (project.missionBrief) {
    const brief = project.missionBrief
    brief.due = brief.due.replace(CONTROL_CHARS, '')
    for (const item of [...brief.todos, ...brief.rules]) item.text = item.text.replace(CONTROL_CHARS, '')
    for (const task of brief.cardTasks ?? []) {
      task.title = task.title.replace(CONTROL_CHARS, '')
      for (const field of task.fields) {
        field.label = field.label.replace(CONTROL_CHARS, '')
        if (field.prompt) field.prompt = field.prompt.replace(CONTROL_CHARS, '')
      }
    }
  }
  project.scenes.forEach((scene) => {
    if (!scene.environmentId) scene.environmentId = defaultEnvironmentId
    if (!scene.startCamera) scene.startCamera = defaultCameraPose()
    if (!Array.isArray(scene.zones)) scene.zones = []
    scene.objects.forEach((object) => {
      if (typeof object.visible !== 'boolean') object.visible = true
      if (typeof object.enabled !== 'boolean') object.enabled = true
    })
  })
  return project
}

const isTuple = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number' && Number.isFinite(item))

/**
 * Every parentId must reference another object in the same scene, and following
 * parent links must never loop; a cycle would hang any hierarchy traversal.
 */
const validateSceneHierarchy = (scene: ProjectData['scenes'][number]): void => {
  const objectsById = new Map(scene.objects.map((object) => [object.id, object]))
  for (const object of scene.objects) {
    if (object.parentId === undefined) continue
    if (object.parentId === object.id) throw new Error('Project contains an object parented to itself')
    if (!objectsById.has(object.parentId)) throw new Error('Project contains an object whose parent does not exist in its scene')
    const seen = new Set([object.id])
    let parent = objectsById.get(object.parentId)
    while (parent) {
      if (seen.has(parent.id)) throw new Error('Project contains a parent-child cycle')
      seen.add(parent.id)
      parent = parent.parentId === undefined ? undefined : objectsById.get(parent.parentId)
    }
  }
}

/**
 * Zones are spatial, so they belong to a scene. Validated for id uniqueness
 * within the scene and for a shape the zone tracker can actually test against —
 * a malformed extent would silently never match instead of failing loudly.
 */
const validateSceneZones = (scene: ProjectData['scenes'][number], zoneIds: Set<string>, attachmentTracker: { ids: Set<string>; count: number }): void => {
  if (scene.zones === undefined) return
  if (!Array.isArray(scene.zones)) throw new Error('Project contains an invalid zone list')
  if (scene.zones.length > MAX_ZONES) throw new Error('Project contains too many zones')
  for (const zone of scene.zones) {
    if (!zone || typeof zone !== 'object' || typeof zone.id !== 'string' || !zone.id || zone.id.length > MAX_LABEL_LENGTH || typeof zone.name !== 'string' || zone.name.length > MAX_LABEL_LENGTH || !isTuple(zone.position) || !zone.shape || typeof zone.shape !== 'object') {
      throw new Error('Project contains an invalid zone')
    }
    if (zone.shape.kind === 'box') {
      if (!isTuple(zone.shape.size) || zone.shape.size.some((value) => value <= 0)) throw new Error('Project contains a zone with an invalid box size')
    } else if (zone.shape.kind === 'sphere') {
      if (typeof zone.shape.radius !== 'number' || !Number.isFinite(zone.shape.radius) || zone.shape.radius <= 0) throw new Error('Project contains a zone with an invalid sphere radius')
    } else {
      throw new Error('Project contains a zone with an unknown shape')
    }
    if (zone.marker !== undefined && zone.marker !== 'hotspot') throw new Error('Project contains a zone with an unknown marker')
    if (zoneIds.has(zone.id)) throw new Error('Project contains duplicate zone IDs')
    zoneIds.add(zone.id)
    validateAttachments(zone.attachments, attachmentTracker)
  }
}

/**
 * Rules are per-project, matching the backend's project_id foreign key. A rule
 * pointing at an object or zone that no longer exists would never fire and would
 * be invisible to the author, so an orphaned reference is rejected at load
 * rather than carried silently.
 */
const validateRules = (project: ProjectData, objectIds: Set<string>, zoneIds: Set<string>): void => {
  if (project.rules === undefined) return
  if (!Array.isArray(project.rules)) throw new Error('Project contains an invalid rule list')
  if (project.rules.length > MAX_RULES) throw new Error('Project contains too many interaction rules')
  const ruleIds = new Set<string>()
  for (const rule of project.rules) {
    if (!rule || typeof rule !== 'object' || typeof rule.id !== 'string' || !rule.id || rule.id.length > MAX_LABEL_LENGTH || !Array.isArray(rule.triggers) || !Array.isArray(rule.actions)) {
      throw new Error('Project contains an invalid interaction rule')
    }
    if (ruleIds.has(rule.id)) throw new Error('Project contains duplicate interaction rule IDs')
    ruleIds.add(rule.id)
    if (rule.triggers.some((trigger) => typeof trigger !== 'string' || trigger.length > MAX_LABEL_LENGTH)) throw new Error('Project contains an interaction rule with an invalid trigger')
    for (const action of rule.actions) {
      if (!action || typeof action !== 'object' || typeof action.kind !== 'string' || !action.kind || action.kind.length > MAX_LABEL_LENGTH) throw new Error('Project contains an interaction rule with an invalid action')
      if (action.params !== undefined && (typeof action.params !== 'object' || action.params === null || Array.isArray(action.params))) throw new Error('Project contains an interaction rule with invalid action parameters')
    }
    if (rule.priority !== undefined && (typeof rule.priority !== 'number' || !Number.isFinite(rule.priority))) throw new Error('Project contains an interaction rule with an invalid priority')
    if (rule.objectId !== undefined && !objectIds.has(rule.objectId)) throw new Error('Project contains an interaction rule referencing an object that does not exist')
    if (rule.zoneId !== undefined && !zoneIds.has(rule.zoneId)) throw new Error('Project contains an interaction rule referencing a zone that does not exist')
  }
}

/**
 * Presettings for an audio asset. Validated the same way as rules: optional,
 * so older saves load, but well-formed when present.
 */
const validateAudioAssets = (project: ProjectData): void => {
  if (project.audioAssets === undefined) return
  if (!Array.isArray(project.audioAssets)) throw new Error('Project contains an invalid audio asset list')
  if (project.audioAssets.length > MAX_AUDIO_ASSETS) throw new Error('Project contains too many audio assets')
  const seen = new Set<string>()
  for (const meta of project.audioAssets) {
    if (!meta || typeof meta !== 'object' || typeof meta.assetId !== 'string' || !meta.assetId || meta.assetId.length > MAX_LABEL_LENGTH || typeof meta.name !== 'string' || meta.name.length > MAX_LABEL_LENGTH || typeof meta.channel !== 'string' || !meta.channel || typeof meta.volume !== 'number' || !Number.isFinite(meta.volume) || meta.volume < 0 || meta.volume > 1 || typeof meta.loop !== 'boolean') {
      throw new Error('Project contains an invalid audio asset')
    }
    if (seen.has(meta.assetId)) throw new Error('Project contains duplicate audio asset IDs')
    seen.add(meta.assetId)
  }
}

const validateAudioSettings = (project: ProjectData): void => {
  if (project.audioSettings === undefined) return
  const settings = project.audioSettings
  if (!settings || typeof settings !== 'object' || typeof settings.master !== 'number' || !Number.isFinite(settings.master) || settings.master < 0 || settings.master > 1 || !settings.channels || typeof settings.channels !== 'object') {
    throw new Error('Project contains invalid audio settings')
  }
  for (const channel of Object.values(settings.channels)) {
    if (!channel || typeof channel !== 'object' || typeof channel.volume !== 'number' || !Number.isFinite(channel.volume) || channel.volume < 0 || channel.volume > 1 || typeof channel.muted !== 'boolean') {
      throw new Error('Project contains an invalid audio channel setting')
    }
  }
}

// #rgb, #rrggbb or #rrggbbaa only — a colour can never smuggle a css url()
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

const validateTextStyle = (style: TextStyle): void => {
  if (!style || typeof style !== 'object') throw new Error('Project contains a text attachment with an invalid style')
  if (style.fontFamily !== undefined && !['body', 'heading', 'mono'].includes(style.fontFamily)) throw new Error('Project contains a text attachment with an invalid font role')
  if (style.sizePx !== undefined && (typeof style.sizePx !== 'number' || !Number.isFinite(style.sizePx) || style.sizePx <= 0 || style.sizePx > 512)) throw new Error('Project contains a text attachment with an invalid font size')
  if (style.color !== undefined && (typeof style.color !== 'string' || !HEX_COLOR.test(style.color))) throw new Error('Project contains a text attachment with an invalid colour')
  if (style.background !== undefined && (typeof style.background !== 'string' || !HEX_COLOR.test(style.background))) throw new Error('Project contains a text attachment with an invalid colour')
  if (style.align !== undefined && !['left', 'center', 'right'].includes(style.align)) throw new Error('Project contains a text attachment with an invalid alignment')
}

const isShortText = (value: unknown, max: number): boolean => typeof value === 'string' && value.length <= max

// the card's media slot holds a library entry id and short author text, never a URL or bytes
const validateCardMedia = (media: CardMedia): void => {
  if (!media || typeof media !== 'object' || !['image', 'video'].includes(media.kind) || typeof media.assetId !== 'string' || !media.assetId || media.assetId.length > MAX_LABEL_LENGTH) throw new Error('Project contains an info card with invalid media')
  if (media.caption !== undefined && !isShortText(media.caption, MAX_CAPTION_LENGTH)) throw new Error('Project contains an info card with an invalid caption')
  if (media.alt !== undefined && !isShortText(media.alt, MAX_CAPTION_LENGTH)) throw new Error('Project contains an info card with invalid alt text')
}

// reserved for teacher blanks: checked so a bad file is caught now, read by nothing yet
const validateCardFields = (fields: CardField[]): void => {
  if (!Array.isArray(fields) || fields.length > MAX_CARD_FIELDS) throw new Error('Project contains an info card with an invalid field list')
  for (const field of fields) {
    if (!field || typeof field !== 'object' || !isShortText(field.key, MAX_LABEL_LENGTH) || !field.key || !isShortText(field.label, MAX_FIELD_TEXT) || (field.locked !== undefined && typeof field.locked !== 'boolean') || (field.prompt !== undefined && !isShortText(field.prompt, MAX_LABEL_LENGTH)) || (field.value !== undefined && !isShortText(field.value, MAX_FIELD_ANSWER))) {
      throw new Error('Project contains an info card with an invalid field')
    }
  }
}

const validateTextPresentation = (presentation: TextPresentation): void => {
  if (!presentation || typeof presentation !== 'object' || !['panel', 'card', 'label', 'surface', 'dialogue'].includes(presentation.mode)) throw new Error('Project contains a text attachment with an invalid presentation')
  if (presentation.title !== undefined && (typeof presentation.title !== 'string' || presentation.title.length > MAX_LABEL_LENGTH)) throw new Error('Project contains a text attachment with an invalid title')
  if (presentation.anchor !== undefined && !['center', 'top', 'bottom', 'left', 'right'].includes(presentation.anchor)) throw new Error('Project contains a text attachment with an invalid anchor')
  if (presentation.size !== undefined && (!Array.isArray(presentation.size) || presentation.size.length !== 2 || presentation.size.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value <= 0))) throw new Error('Project contains a text attachment with an invalid size')
  if (presentation.offset !== undefined && !isTuple(presentation.offset)) throw new Error('Project contains a text attachment with an invalid offset')
  if (presentation.modal !== undefined && typeof presentation.modal !== 'boolean') throw new Error('Project contains a text attachment with an invalid modal flag')
  if (presentation.autoCloseMs !== undefined && (typeof presentation.autoCloseMs !== 'number' || !Number.isFinite(presentation.autoCloseMs) || presentation.autoCloseMs <= 0)) throw new Error('Project contains a text attachment with an invalid auto-close delay')
  if (presentation.paging !== undefined && !['none', 'auto'].includes(presentation.paging)) throw new Error('Project contains a text attachment with an invalid paging mode')
  if (presentation.style !== undefined) validateTextStyle(presentation.style)
  if (presentation.media !== undefined) validateCardMedia(presentation.media)
  if (presentation.fields !== undefined) validateCardFields(presentation.fields)
  if (presentation.taskId !== undefined && (!isShortText(presentation.taskId, MAX_LABEL_LENGTH) || !presentation.taskId)) throw new Error('Project contains an info card with an invalid task')
}

/**
 * Attachment ids are unique across the whole project (objects and zones
 * alike), the same contract as object ids, so a rule's attachmentId can never
 * be ambiguous. Only the kinds with approved shapes are accepted. Image and
 * video carry nothing beyond id, name and assetId (a media library entry), so
 * the shared checks above are their whole validation.
 */
const validateAttachments = (attachments: Attachment[] | undefined, tracker: { ids: Set<string>; count: number }): void => {
  if (attachments === undefined) return
  if (!Array.isArray(attachments)) throw new Error('Project contains an invalid attachment list')
  if (attachments.length > MAX_ATTACHMENTS_PER_HOST) throw new Error('Project contains a host with too many attachments')
  for (const attachment of attachments) {
    tracker.count += 1
    if (tracker.count > MAX_ATTACHMENTS_TOTAL) throw new Error('Project contains too many attachments')
    if (!attachment || typeof attachment !== 'object' || typeof attachment.id !== 'string' || !attachment.id || attachment.id.length > MAX_LABEL_LENGTH || (attachment.name !== undefined && (typeof attachment.name !== 'string' || attachment.name.length > MAX_LABEL_LENGTH)) || typeof attachment.assetId !== 'string' || !attachment.assetId || attachment.assetId.length > MAX_LABEL_LENGTH) {
      throw new Error('Project contains an invalid attachment')
    }
    // assetId is deliberately NOT checked against any catalog: an unknown
    // asset is a runtime placeholder, not a load failure
    if (attachment.kind === 'text') validateTextPresentation(attachment.presentation)
    else if (!['audio', 'image', 'video'].includes(attachment.kind)) throw new Error('Project contains an attachment with an unknown kind')
    if (tracker.ids.has(attachment.id)) throw new Error('Project contains duplicate attachment IDs')
    tracker.ids.add(attachment.id)
  }
}

const utf8ByteLength = (value: string): number => new TextEncoder().encode(value).length

/**
 * Inline author text, the only place project bytes can grow with writing.
 * A variant counts toward its asset's 64 KB cap and the project's 512 KB
 * total, so localisation cannot multiply text past the budget unseen.
 */
const validateTextAssets = (project: ProjectData): void => {
  if (project.textAssets === undefined) return
  if (!Array.isArray(project.textAssets)) throw new Error('Project contains an invalid text asset list')
  if (project.textAssets.length > MAX_TEXT_ASSETS) throw new Error('Project contains too many text assets')
  const seen = new Set<string>()
  let totalBytes = 0
  for (const meta of project.textAssets) {
    if (!meta || typeof meta !== 'object' || typeof meta.assetId !== 'string' || !meta.assetId || meta.assetId.length > MAX_LABEL_LENGTH || typeof meta.name !== 'string' || meta.name.length > MAX_LABEL_LENGTH || (meta.format !== 'plain' && meta.format !== 'markdown-lite') || typeof meta.lang !== 'string' || !meta.lang || meta.lang.length > MAX_LABEL_LENGTH || typeof meta.content !== 'string' || (meta.title !== undefined && (typeof meta.title !== 'string' || meta.title.length > MAX_LABEL_LENGTH)) || (meta.maxLength !== undefined && (typeof meta.maxLength !== 'number' || !Number.isFinite(meta.maxLength) || meta.maxLength <= 0))) {
      throw new Error('Project contains an invalid text asset')
    }
    let assetBytes = utf8ByteLength(meta.content)
    if (meta.variants !== undefined) {
      if (!meta.variants || typeof meta.variants !== 'object' || Array.isArray(meta.variants)) throw new Error('Project contains a text asset with invalid variants')
      for (const [lang, content] of Object.entries(meta.variants)) {
        if (!lang || lang.length > MAX_LABEL_LENGTH || typeof content !== 'string') throw new Error('Project contains a text asset with invalid variants')
        assetBytes += utf8ByteLength(content)
      }
    }
    if (assetBytes > MAX_TEXT_ASSET_BYTES) throw new Error('Project contains a text asset larger than 64 KB')
    totalBytes += assetBytes
    if (totalBytes > MAX_PROJECT_TEXT_BYTES) throw new Error('Project text content exceeds the 512 KB limit')
    if (seen.has(meta.assetId)) throw new Error('Project contains duplicate text asset IDs')
    seen.add(meta.assetId)
  }
}

/**
 * The teacher's mission brief: optional, like rules. Each to-do and rule is one line of text
 * with an id unique within its own list.
 */
const validateMissionBrief = (project: ProjectData): void => {
  if (project.missionBrief === undefined) return
  const brief = project.missionBrief
  if (!brief || typeof brief !== 'object' || typeof brief.due !== 'string' || brief.due.length > MAX_LABEL_LENGTH) throw new Error('Project contains an invalid mission brief')
  for (const list of [brief.todos, brief.rules]) {
    if (!Array.isArray(list)) throw new Error('Project contains an invalid mission brief')
    if (list.length > MAX_BRIEF_ITEMS) throw new Error('Project mission brief has too many to-dos or rules')
    const ids = new Set<string>()
    for (const item of list) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > MAX_LABEL_LENGTH || typeof item.text !== 'string' || item.text.length > MAX_LABEL_LENGTH) {
        throw new Error('Project contains an invalid mission brief item')
      }
      if (ids.has(item.id)) throw new Error('Project mission brief contains duplicate IDs')
      ids.add(item.id)
    }
  }
  if (brief.cardTasks !== undefined) validateCardTasks(brief.cardTasks)
}

// the info cards a teacher asks for: a title, a kind and the same fields a card carries
const validateCardTasks = (tasks: CardTask[]): void => {
  if (!Array.isArray(tasks) || tasks.length > MAX_CARD_TASKS) throw new Error('Project mission brief has an invalid list of info card tasks')
  const ids = new Set<string>()
  for (const task of tasks) {
    if (!task || typeof task !== 'object' || !isShortText(task.id, MAX_LABEL_LENGTH) || !task.id || !isShortText(task.title, MAX_LABEL_LENGTH) || !['blanks', 'prompts'].includes(task.kind)) {
      throw new Error('Project mission brief contains an invalid info card task')
    }
    validateCardFields(task.fields)
    if (ids.has(task.id)) throw new Error('Project mission brief contains duplicate IDs')
    ids.add(task.id)
  }
}

// allowed environment for students set by the teacher 
const validateEnvironment = (project: ProjectData): void => {
  const kinds = project.validateEnvironment
  if (kinds === undefined) return
  if (!Array.isArray(kinds) || kinds.length > MAX_SCENES || kinds.some((id) => typeof id !== 'string' || !id || id.length > MAX_LABEL_LENGTH)) {
    throw new Error('Project contains an invalid list of room kinds')
  }
}

const validateProject = (parsed: unknown): ProjectData => {
  if (!parsed || typeof parsed !== 'object') throw new Error('Project file must contain a JSON object')
  const candidate = parsed as Partial<ProjectData>
  if (candidate.schemaVersion !== 1) throw new Error('Unsupported project format')
  if (typeof candidate.id !== 'string' || !candidate.id || candidate.id.length > MAX_LABEL_LENGTH || typeof candidate.name !== 'string' || !candidate.name || candidate.name.length > MAX_LABEL_LENGTH) throw new Error('Project identity is invalid')
  if (!Array.isArray(candidate.scenes) || candidate.scenes.length === 0 || candidate.scenes.length > MAX_SCENES) throw new Error('Project must contain between one and 100 scenes')
  if (typeof candidate.activeSceneId !== 'string') throw new Error('Project active scene is invalid')
  const sceneIds = new Set<string>()
  const objectIds = new Set<string>()
  const zoneIds = new Set<string>()
  // one id space and one total across objects and zones in every scene
  const attachmentTracker = { ids: new Set<string>(), count: 0 }
  let objectCount = 0
  for (const scene of candidate.scenes) {
    if (!scene || typeof scene !== 'object' || typeof scene.id !== 'string' || typeof scene.name !== 'string' || scene.id.length > MAX_LABEL_LENGTH || scene.name.length > MAX_LABEL_LENGTH || !Array.isArray(scene.objects)) throw new Error('Project contains an invalid scene')
    if (sceneIds.has(scene.id)) throw new Error('Project contains duplicate scene IDs')
    sceneIds.add(scene.id)
    for (const object of scene.objects) {
      objectCount += 1
      if (objectCount > MAX_OBJECTS) throw new Error('Project contains too many scene objects')
      if (!object || typeof object !== 'object' || typeof object.id !== 'string' || typeof object.name !== 'string' || typeof object.assetId !== 'string' || object.id.length > MAX_LABEL_LENGTH || object.name.length > MAX_LABEL_LENGTH || object.assetId.length > MAX_LABEL_LENGTH || !['cube', 'sphere', 'cylinder', 'model'].includes(object.assetKind) || (object.visible !== undefined && typeof object.visible !== 'boolean') || (object.enabled !== undefined && typeof object.enabled !== 'boolean') || (object.parentId !== undefined && (typeof object.parentId !== 'string' || object.parentId.length > MAX_LABEL_LENGTH)) || !object.transform || !isTuple(object.transform.position) || !isTuple(object.transform.rotation) || !isTuple(object.transform.scale)) throw new Error('Project contains an invalid scene object')
      if (objectIds.has(object.id)) throw new Error('Project contains duplicate object IDs')
      objectIds.add(object.id)
      validateAttachments(object.attachments, attachmentTracker)
    }
    validateSceneHierarchy(scene)
    validateSceneZones(scene, zoneIds, attachmentTracker)
  }
  if (!sceneIds.has(candidate.activeSceneId)) throw new Error('Project active scene does not exist')
  // Rules are validated after every scene, so object and zone ids from the whole
  // project are available to check references against.
  validateRules(candidate as ProjectData, objectIds, zoneIds)
  validateAudioAssets(candidate as ProjectData)
  validateAudioSettings(candidate as ProjectData)
  validateTextAssets(candidate as ProjectData)
  validateMissionBrief(candidate as ProjectData)
  validateEnvironment(candidate as ProjectData)
  return backfillScenes(parsed as ProjectData)
}

export const deserializeProject = (value: string): ProjectData => {
  try {
    return validateProject(JSON.parse(value) as unknown)
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Project file contains invalid JSON')
    throw error
  }
}

export const importProjectFile = async (file: File): Promise<ProjectData> => {
  if (file.size > MAX_PROJECT_FILE_BYTES) throw new Error('Project file is too large')
  if (file.type && file.type !== 'application/json' && file.type !== 'text/json') throw new Error('Choose a JSON project file')
  if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Choose a .json project file')
  return deserializeProject(await file.text())
}

export const loadProjectWithSource = (): ProjectLoadResult => {
  const candidates = [[STORAGE_KEY, readStorage(STORAGE_KEY)], [BACKUP_STORAGE_KEY, readStorage(BACKUP_STORAGE_KEY)] as const]
  for (const [source, saved] of candidates) {
    if (!saved) continue
    try {
      logger.debug('Loading project draft', { source })
      return { project: deserializeProject(saved), source: source === STORAGE_KEY ? 'draft' : 'backup' }
    } catch (error) {
      logger.warn('Project draft was invalid; trying the next recovery source', { source, error })
      continue
    }
  }
  logger.info('No valid local project found; creating a clean project')
  return { project: defaultProject(), source: 'default' }
}

export const loadProject = (): ProjectData => loadProjectWithSource().project

export const saveProject = (project: ProjectData): PersistenceResult => {
  const serialized = serializeProject(project)
  const previous = readStorage(STORAGE_KEY)
  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, previous ?? serialized)
    localStorage.setItem(STORAGE_KEY, serialized)
    return 'saved'
  } catch (error) {
    logger.warn('Primary project save failed; trying backup storage', { error })
    try {
      localStorage.setItem(BACKUP_STORAGE_KEY, serialized)
      return 'saved-with-backup'
    } catch (backupError) {
      logger.error('Primary and backup project saves failed', { error, backupError })
      return 'failed'
    }
  }
}

export const downloadProject = (project: ProjectData): void => {
  const blob = new Blob([serializeProject(project)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export const copyProject = (project: ProjectData): ProjectData => cloneProject(project)