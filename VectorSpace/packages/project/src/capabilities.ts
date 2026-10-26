/**
 * @file        capabilities.ts
 * @author      Weian Ching
 * @brief       Read-only capability descriptors, one per attachment kind and
 *              object-form variant.
 *
 * @responsibility
 * Publishes what each kind of attachment can do (its actions and their
 * params) and which events it can emit, so the WHEN→DO rules side can read it
 * without importing any media or text code. This file only describes: it
 * registers no action, wires no rule and adds no trigger. Hover is out of
 * scope and is deliberately absent.
 *
 * @inputs
 * An AttachmentCapabilityKey ('text', 'video-screen', ...).
 *
 * @outputs
 * Frozen AttachmentCapabilities entries via getAttachmentCapabilities() and
 * listAttachmentCapabilities().
 *
 * @documentation
 * docs/handover/info-card-and-media-overview.md sections 2 and 3 (items C1-C3).
 */
import type { Attachment } from './index'

/**
 * 'available' means code exists today that does this (an executor is
 * registered, or the event is emitted). 'planned' means the name is reserved
 * for the info-card and media work and nothing handles it yet, so the rules
 * side should not offer it to authors until it flips.
 */
export type CapabilityStatus = 'available' | 'planned'

export interface ActionParamSpec {
  name: string
  type: 'string' | 'number' | 'boolean'
  required?: boolean
  values?: readonly string[]   // allowed values when the param is a fixed choice
  description: string
}

export interface AttachmentActionDescriptor {
  kind: string                 // the ActionSpec.kind a rule would use
  status: CapabilityStatus
  description: string
  params: readonly ActionParamSpec[]
}

export interface AttachmentEventDescriptor {
  kind: string                 // the RuntimeEvent.kind a rule trigger would match
  status: CapabilityStatus
  description: string
  payload: readonly string[]   // payload field names
}

/** The plain attachment kinds plus the object-form variants (a kind given a body in the scene). */
export type AttachmentCapabilityKey = Attachment['kind'] | 'video-screen' | 'hotspot-card'

export interface AttachmentCapabilities {
  key: AttachmentCapabilityKey
  attachmentKind: Attachment['kind']   // the Attachment.kind this entry stores as
  form: 'attachment' | 'object' | 'zone'  // 'attachment' = no body of its own
  label: string
  description: string
  actions: readonly AttachmentActionDescriptor[]
  events: readonly AttachmentEventDescriptor[]
}

// shared param specs, so the same name means the same thing in every entry
const attachmentIdParam: ActionParamSpec = { name: 'attachmentId', type: 'string', required: true, description: 'The attachment to act on' }
const optionalAttachmentIdParam: ActionParamSpec = { ...attachmentIdParam, required: false }

const textActions: readonly AttachmentActionDescriptor[] = [
  {
    kind: 'showPanel', status: 'available', description: 'Open the text as a panel',
    params: [
      { ...optionalAttachmentIdParam, description: 'The text attachment to open (componentId is accepted as an alias)' },
      { name: 'assetId', type: 'string', description: 'Open a text asset with no host, used when attachmentId is absent' },
      { name: 'modal', type: 'boolean', description: 'Block the scene behind the panel' },
      { name: 'autoCloseMs', type: 'number', description: 'Close by itself after this many milliseconds' },
      { name: 'title', type: 'string', description: 'Override the panel title' },
    ],
  },
  {
    kind: 'hidePanel', status: 'available', description: 'Close one panel, the top panel, or all panels',
    params: [
      optionalAttachmentIdParam,
      { name: 'assetId', type: 'string', description: 'Close panels showing this text asset' },
      { name: 'top', type: 'boolean', description: 'Close only the top panel' },
      { name: 'all', type: 'boolean', description: 'Close every panel' },
    ],
  },
  {
    kind: 'advancePanel', status: 'available', description: 'Turn a paged panel to its next or previous page',
    params: [
      optionalAttachmentIdParam,
      { name: 'top', type: 'boolean', description: 'Act on the top panel' },
      { name: 'dir', type: 'string', values: ['next', 'prev'], description: 'Which way to turn; defaults to next' },
    ],
  },
]

const textEvents: readonly AttachmentEventDescriptor[] = [
  { kind: 'panelOpened', status: 'available', description: 'A panel for this attachment opened', payload: ['attachmentId', 'assetId', 'panelId'] },
  { kind: 'panelClosed', status: 'available', description: 'A panel for this attachment closed', payload: ['attachmentId', 'assetId', 'panelId'] },
]

// the media player's states as events; names follow MediaViewState
const mediaEvent = (state: string, description: string): AttachmentEventDescriptor =>
  ({ kind: `media${state}`, status: 'planned', description, payload: ['attachmentId', 'assetId'] })

const imageEvents: readonly AttachmentEventDescriptor[] = [
  mediaEvent('Ready', 'The image finished loading'),
  mediaEvent('Unavailable', 'The image could not be shown and the fallback is visible'),
]

const videoActions: readonly AttachmentActionDescriptor[] = [
  {
    kind: 'playMedia', status: 'planned', description: 'Play the video (muted if the browser blocks sound)',
    params: [attachmentIdParam, { name: 'startAt', type: 'number', description: 'Start this many seconds in' }],
  },
  { kind: 'pauseMedia', status: 'planned', description: 'Pause the video where it is', params: [attachmentIdParam] },
  { kind: 'stopMedia', status: 'planned', description: 'Stop the video and go back to the start', params: [attachmentIdParam] },
]

const videoEvents: readonly AttachmentEventDescriptor[] = [
  mediaEvent('Ready', 'The video can start playing'),
  mediaEvent('Playing', 'The video started or resumed'),
  mediaEvent('Paused', 'The video paused'),
  mediaEvent('Ended', 'The video reached its end'),
  mediaEvent('Unavailable', 'The video could not play and the fallback is visible'),
]

// a click on a host that has a body; 'click' is the existing trigger name, nothing new
const clickEvent = (status: CapabilityStatus, description: string): AttachmentEventDescriptor =>
  ({ kind: 'click', status, description, payload: ['objectId'] })

const entries: AttachmentCapabilities[] = [
  {
    key: 'text', attachmentKind: 'text', form: 'attachment', label: 'Text',
    description: 'Formatted text shown as a panel; becomes an info card when its presentation mode is card',
    actions: textActions, events: textEvents,
  },
  {
    key: 'audio', attachmentKind: 'audio', form: 'attachment', label: 'Sound',
    description: 'A sound from the audio library',
    actions: [
      {
        kind: 'playAudio', status: 'available', description: 'Play a sound',
        params: [
          { name: 'assetId', type: 'string', required: true, description: 'The sound to play' },
          { name: 'channel', type: 'string', description: 'The mix channel' },
          { name: 'volume', type: 'number', description: 'Volume from 0 to 1' },
          { name: 'loop', type: 'boolean', description: 'Repeat until stopped' },
          { name: 'rate', type: 'number', description: 'Playback speed' },
          { name: 'startAt', type: 'number', description: 'Start this many seconds in' },
        ],
      },
      {
        kind: 'stopAudio', status: 'available', description: 'Stop sounds by voice, asset or channel (at least one)',
        params: [
          { name: 'voiceId', type: 'string', description: 'One playing voice' },
          { name: 'assetId', type: 'string', description: 'Every voice of this sound' },
          { name: 'channel', type: 'string', description: 'Every voice on this channel' },
        ],
      },
    ],
    events: [],
  },
  {
    key: 'image', attachmentKind: 'image', form: 'attachment', label: 'Image',
    description: 'An uploaded image from the media library, shown in an info card',
    actions: [], events: imageEvents,
  },
  {
    key: 'video', attachmentKind: 'video', form: 'attachment', label: 'Video',
    description: 'An uploaded video or an approved link, shown in an info card',
    actions: videoActions, events: videoEvents,
  },
  {
    key: 'video-screen', attachmentKind: 'video', form: 'object', label: 'Video screen',
    description: 'A scene object that plays a video on its face',
    actions: videoActions,
    events: [...videoEvents, clickEvent('available', 'The visitor clicked the screen')],
  },
  {
    key: 'hotspot-card', attachmentKind: 'text', form: 'zone', label: 'Hotspot',
    description: 'A visible marker that opens an info card when clicked',
    actions: textActions.filter((action) => action.kind !== 'advancePanel'),
    events: [...textEvents, clickEvent('planned', 'The visitor clicked the hotspot marker')],
  },
]

// frozen all the way down, so a caller cannot change what every other caller reads
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

const table: ReadonlyMap<AttachmentCapabilityKey, Readonly<AttachmentCapabilities>> =
  new Map(entries.map((entry) => [entry.key, deepFreeze(entry)]))

/** The descriptor for one kind or variant, or undefined for a key it does not know. */
export const getAttachmentCapabilities = (key: string): Readonly<AttachmentCapabilities> | undefined =>
  table.get(key as AttachmentCapabilityKey)

/** Every descriptor, in a stable order: the plain kinds first, then the object-form variants. */
export const listAttachmentCapabilities = (): readonly Readonly<AttachmentCapabilities>[] => [...table.values()]
