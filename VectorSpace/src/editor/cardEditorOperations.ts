/**
 * @file        cardEditorOperations.ts
 * @project     Spatial Experience Builder
 * @author      Weian Ching
 * @brief       Editor adapters that add, change and remove an info card (the
 *              "fact card") or a video on an object, or create a hotspot that
 *              holds a card.
 *
 * @responsibility
 * A card is a text attachment in 'card' mode plus the text asset it shows.
 * Every function here returns one new project value holding both changes, so
 * the editor commits once and one undo reverts the whole card. Nothing here
 * opens a card or wires a rule: showing it is the text system's job, and when
 * it opens is the rules side's.
 *
 * Inputs are checked against the same caps the serializer enforces on load,
 * so the editor can never produce a save that fails to open.
 *
 * @documentation
 * docs/handover/info-card-work-package.md steps A4 and A5.
 */
/******************************************************************************/
import { cloneProject, type CardField, type CardMedia, type ProjectData, type SceneObject, type TextAssetMeta, type TextAttachment, type VideoAttachment, type ZoneDefinition } from '../project/model'

// every text asset a card creates starts with this; rule clean-up only touches 'message-' assets, so cards are never swept up by it
const CARD_ASSET_PREFIX = 'card-'
const CARD_ATTACHMENT_PREFIX = 'att-card-'

// the serializer's limits (src/project/serializer.ts), repeated here so a save is valid before it is written
export const MAX_CARD_TITLE_LENGTH = 200
export const MAX_CARD_BODY_BYTES = 65_536
export const MAX_CARD_CAPTION_LENGTH = 500
const MAX_ATTACHMENTS_PER_HOST = 16

/** What the author fills in on the card form. */
export interface CardInput {
  title: string
  body: string            // markdown-lite: paragraphs, headings, lists, bold, italic, https links
  media?: CardMedia       // a media library reference, never a URL
  autoCloseMs?: number    // close by itself after this long; absent = stays until closed
  // a card written from the teacher's task (mission brief): its fields with the answers,
  // and which task it is. body is then built from the answers (src/mission/cardTasks.ts).
  fields?: CardField[]
  taskId?: string
  inRoom?: boolean        // also show the card as a sign above its thing in the room
}

export type CardOperationResult =
  | { ok: true; project: ProjectData; attachmentId: string }
  | { ok: false; error: string }

/** The card on an object or zone, with the text it shows, if it has one. */
export const findCard = (project: ProjectData, host: { attachments?: SceneObject['attachments'] }): { attachment: TextAttachment; meta?: TextAssetMeta } | undefined => {
  const attachment = host.attachments?.find((item): item is TextAttachment => item.kind === 'text' && item.presentation.mode === 'card')
  if (!attachment) return undefined
  return { attachment, meta: project.textAssets?.find((asset) => asset.assetId === attachment.assetId) }
}

/** Returns an error message for input the serializer would reject, or null when it is fine. */
export const checkCardInput = (input: CardInput): string | null => {
  if (!input.title.trim()) return 'Give the card a title'
  if (input.title.length > MAX_CARD_TITLE_LENGTH) return `The title can be at most ${MAX_CARD_TITLE_LENGTH} characters`
  if (new TextEncoder().encode(input.body).length > MAX_CARD_BODY_BYTES) return 'The text is too long for one card'
  if (input.media) {
    if (!input.media.assetId) return 'Pick an image or video from the library'
    if ((input.media.caption?.length ?? 0) > MAX_CARD_CAPTION_LENGTH) return `The caption can be at most ${MAX_CARD_CAPTION_LENGTH} characters`
    if ((input.media.alt?.length ?? 0) > MAX_CARD_CAPTION_LENGTH) return `The description can be at most ${MAX_CARD_CAPTION_LENGTH} characters`
    // the caption doubles as the description for visitors who cannot see the picture
    if (input.media.kind === 'image' && !input.media.caption?.trim() && !input.media.alt?.trim()) return 'Add a caption saying what is in the picture'
  }
  if (input.autoCloseMs !== undefined && (!Number.isFinite(input.autoCloseMs) || input.autoCloseMs <= 0)) return 'The timer must be a positive number of seconds'
  return null
}

// only the fields an author set, so the save stays small and matches what was typed
const presentationFor = (input: CardInput): TextAttachment['presentation'] => ({
  mode: 'card',
  title: input.title.trim(),
  ...(input.media ? { media: cleanMedia(input.media) } : {}),
  ...(input.autoCloseMs !== undefined ? { autoCloseMs: input.autoCloseMs } : {}),
  ...(input.fields && input.taskId ? { fields: input.fields.map((field) => ({ ...field })), taskId: input.taskId } : {}),
  ...(input.inRoom ? { inRoom: true } : {}),
})

const cleanMedia = (media: CardMedia): CardMedia => {
  const caption = media.caption?.trim()
  // with no separate description, the caption is what a screen reader says
  const alt = media.alt?.trim() || (media.kind === 'image' ? caption : undefined)
  return { kind: media.kind, assetId: media.assetId, ...(caption ? { caption } : {}), ...(alt ? { alt } : {}) }
}

const metaFor = (assetId: string, input: CardInput): TextAssetMeta => ({
  assetId,
  name: input.title.trim(),
  format: 'markdown-lite',
  lang: 'en',
  content: input.body,
})

const findObject = (project: ProjectData, sceneId: string, objectId: string): SceneObject | undefined =>
  project.scenes.find((scene) => scene.id === sceneId)?.objects.find((object) => object.id === objectId)

/**
 * Adds a card to an object, or changes the one it has. An object holds at
 * most one card, so pressing "Add info card" twice edits rather than stacks.
 */
export const saveObjectCard = (project: ProjectData, sceneId: string, objectId: string, input: CardInput): CardOperationResult => {
  const problem = checkCardInput(input)
  if (problem) return { ok: false, error: problem }
  const next = cloneProject(project)
  const object = findObject(next, sceneId, objectId)
  if (!object) return { ok: false, error: 'That object is no longer in the scene' }

  const existing = findCard(next, object)
  if (existing) {
    existing.attachment.presentation = presentationFor(input)
    const meta = metaFor(existing.attachment.assetId, input)
    next.textAssets = existing.meta
      ? (next.textAssets ?? []).map((asset) => (asset.assetId === meta.assetId ? { ...asset, name: meta.name, content: meta.content } : asset))
      : [...(next.textAssets ?? []), meta]
    return { ok: true, project: next, attachmentId: existing.attachment.id }
  }

  if ((object.attachments?.length ?? 0) >= MAX_ATTACHMENTS_PER_HOST) return { ok: false, error: 'This object already has as many attachments as it can hold' }
  // random ids, because loading rejects duplicate attachment or text asset ids
  const id = crypto.randomUUID()
  const attachment: TextAttachment = { id: `${CARD_ATTACHMENT_PREFIX}${id}`, kind: 'text', assetId: `${CARD_ASSET_PREFIX}${id}`, presentation: presentationFor(input) }
  object.attachments = [...(object.attachments ?? []), attachment]
  next.textAssets = [...(next.textAssets ?? []), metaFor(attachment.assetId, input)]
  return { ok: true, project: next, attachmentId: attachment.id }
}

/** Removes an object's card and the text it showed, in one project value. */
export const removeObjectCard = (project: ProjectData, sceneId: string, objectId: string): ProjectData => {
  const next = cloneProject(project)
  const object = findObject(next, sceneId, objectId)
  const existing = object && findCard(next, object)
  if (!object || !existing) return project
  object.attachments = object.attachments?.filter((item) => item.id !== existing.attachment.id)
  // a card's text belongs to that card alone (it is created with it), so it goes too, unless something else still shows it
  const stillUsed = next.scenes.some((scene) =>
    [...scene.objects, ...(scene.zones ?? [])].some((host) => host.attachments?.some((item) => item.assetId === existing.attachment.assetId)))
  if (!stillUsed && existing.attachment.assetId.startsWith(CARD_ASSET_PREFIX)) {
    next.textAssets = (next.textAssets ?? []).filter((asset) => asset.assetId !== existing.attachment.assetId)
  }
  return next
}

/**
 * Creates a hotspot: a small sphere zone marked 'hotspot' that holds one card.
 * Drawing the marker and opening the card on click belong to the viewport;
 * this only adds the data.
 */
export const createHotspotCard = (project: ProjectData, sceneId: string, position: [number, number, number], input: CardInput): CardOperationResult => {
  const problem = checkCardInput(input)
  if (problem) return { ok: false, error: problem }
  const next = cloneProject(project)
  const scene = next.scenes.find((item) => item.id === sceneId)
  if (!scene) return { ok: false, error: 'That room is no longer in the project' }
  const id = crypto.randomUUID()
  const attachment: TextAttachment = { id: `${CARD_ATTACHMENT_PREFIX}${id}`, kind: 'text', assetId: `${CARD_ASSET_PREFIX}${id}`, presentation: presentationFor(input) }
  const zone: ZoneDefinition = {
    id: `hotspot-${id}`,
    name: input.title.trim(),
    shape: { kind: 'sphere', radius: 0.5 },
    position,
    marker: 'hotspot',
    attachments: [attachment],
  }
  scene.zones = [...(scene.zones ?? []), zone]
  next.textAssets = [...(next.textAssets ?? []), metaFor(attachment.assetId, input)]
  return { ok: true, project: next, attachmentId: attachment.id }
}

const VIDEO_ATTACHMENT_PREFIX = 'att-video-'

/** The video on an object, if it has one. An object holds at most one, like its card. */
export const findVideo = (host: { attachments?: SceneObject['attachments'] }): VideoAttachment | undefined =>
  host.attachments?.find((item): item is VideoAttachment => item.kind === 'video')

/**
 * Sets the object's video to a media library entry, adding the attachment or
 * changing the one it has. Playing it (the "play a video" reaction) is the
 * rules side's job; this only records which video belongs to the object.
 */
export const saveObjectVideo = (project: ProjectData, sceneId: string, objectId: string, assetId: string, screen = false): CardOperationResult => {
  if (!assetId) return { ok: false, error: 'Pick a video from the library' }
  const next = cloneProject(project)
  const object = findObject(next, sceneId, objectId)
  if (!object) return { ok: false, error: 'That object is no longer in the scene' }
  const existing = findVideo(object)
  if (existing) {
    existing.assetId = assetId
    if (screen) existing.screen = true
    else delete existing.screen
    return { ok: true, project: next, attachmentId: existing.id }
  }
  if ((object.attachments?.length ?? 0) >= MAX_ATTACHMENTS_PER_HOST) return { ok: false, error: 'This object already has as many attachments as it can hold' }
  const attachment: VideoAttachment = { id: `${VIDEO_ATTACHMENT_PREFIX}${crypto.randomUUID()}`, kind: 'video', assetId, ...(screen ? { screen: true } : {}) }
  object.attachments = [...(object.attachments ?? []), attachment]
  return { ok: true, project: next, attachmentId: attachment.id }
}

/** Removes the object's video attachment; the library entry itself stays. */
export const removeObjectVideo = (project: ProjectData, sceneId: string, objectId: string): ProjectData => {
  const next = cloneProject(project)
  const object = findObject(next, sceneId, objectId)
  const existing = object && findVideo(object)
  if (!object || !existing) return project
  object.attachments = object.attachments?.filter((item) => item.id !== existing.id)
  return next
}
