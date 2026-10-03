/**
 * @file        attachments.ts
 * @brief       Pure read-only lookup helpers for attachments on their hosts.
 *
 * @responsibility
 * Answers "where is this attachment and what asset does it point at" without
 * owning any state: attachments live on SceneObject/ZoneDefinition hosts, and
 * these helpers only walk the project value they are given. Mutation belongs
 * to packages/authoring-engine; resolution belongs to the app's asset layer.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/attachment-integration.md section 6.3
 */
import type { Attachment, MediaKind, ProjectData, SceneData } from './index'

export interface AttachmentHostRef {
  kind: 'object' | 'zone'
  id: string
}

export interface AttachmentLocation {
  sceneId: string
  host: AttachmentHostRef
  attachment: Attachment
}

/** Attachment ids are unique project-wide, so at most one location matches. */
export const findAttachment = (project: ProjectData, attachmentId: string): AttachmentLocation | undefined => {
  for (const scene of project.scenes) {
    for (const object of scene.objects) {
      const attachment = object.attachments?.find((item) => item.id === attachmentId)
      if (attachment) return { sceneId: scene.id, host: { kind: 'object', id: object.id }, attachment }
    }
    for (const zone of scene.zones ?? []) {
      const attachment = zone.attachments?.find((item) => item.id === attachmentId)
      if (attachment) return { sceneId: scene.id, host: { kind: 'zone', id: zone.id }, attachment }
    }
  }
  return undefined
}

/** Every attachment in one scene — the set to warm on scene load. */
export const collectAttachments = (scene: SceneData): Array<{ host: AttachmentHostRef; attachment: Attachment }> => {
  const found: Array<{ host: AttachmentHostRef; attachment: Attachment }> = []
  for (const object of scene.objects) {
    for (const attachment of object.attachments ?? []) found.push({ host: { kind: 'object', id: object.id }, attachment })
  }
  for (const zone of scene.zones ?? []) {
    for (const attachment of zone.attachments ?? []) found.push({ host: { kind: 'zone', id: zone.id }, attachment })
  }
  return found
}

/** The AssetRef shape an attachment resolves through: its asset, as its kind. */
export const assetRefForAttachment = (attachment: Attachment): { assetId: string; kind: MediaKind } => ({
  assetId: attachment.assetId,
  kind: attachment.kind,
})
