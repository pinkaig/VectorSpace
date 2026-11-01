/**
 * @file        builtInInteractions.ts
 * @author      Weian Ching
 * @brief       What an exhibit does in Play with no reaction set up: its info card
 *              (or, with no card, its video) shows when a visitor clicks it or
 *              reaches it on a tour. Also the "play its video" action.
 *
 * @responsibility
 * The viewport turns every click on a thing into a 'click' runtime event, in
 * Tap to go, Walk and Tour spots alike; arriving at a tour spot counts as a
 * click too. clickPanelFor() names the panel that click opens, so an info card
 * works as a hotspot as soon as it exists, without the student writing a rule.
 * Reactions the student adds still run as well (a rule that also opens the
 * card does not open it twice: panels are kept one per attachment).
 * registerMediaActions() adds the playMedia / stopMedia executors the
 * "play its video" reaction uses; the video opens in a pop-up card.
 *
 * @documentation
 * packages/project/src/capabilities.ts (video: playMedia, stopMedia).
 */
import type { ActionRegistry } from '../../packages/interaction/src/index'
import type { TextSystem } from '../../packages/text/src/index'
import type { SceneObject, TextAttachment, VideoAttachment } from '../project/model'

const isCard = (item: NonNullable<SceneObject['attachments']>[number]): item is TextAttachment =>
  item.kind === 'text' && item.presentation.mode === 'card'

/** A video shown on its own: a card with the thing's name and only the video in it. */
export const videoPopup = (object: Pick<SceneObject, 'name'>, video: VideoAttachment): TextAttachment => ({
  id: `video:${video.id}`,
  kind: 'text',
  assetId: '',
  presentation: { mode: 'card', title: object.name, media: { kind: 'video', assetId: video.assetId } },
})

/** The panel a click on this thing opens: its info card, else its video, else nothing. */
export const clickPanelFor = (object: SceneObject | undefined): TextAttachment | undefined => {
  if (!object || object.visible === false || object.enabled === false) return undefined
  const card = object.attachments?.find(isCard)
  if (card) return card
  const video = object.attachments?.find((item): item is VideoAttachment => item.kind === 'video')
  return video ? videoPopup(object, video) : undefined
}

/**
 * playMedia opens the named video attachment in a pop-up; stopMedia closes it.
 * findVideo looks the attachment up in the live scene, as registerTextActions does.
 */
export const registerMediaActions = (
  registry: ActionRegistry,
  text: TextSystem,
  findVideo: (attachmentId: string) => { object: SceneObject; video: VideoAttachment } | undefined,
): void => {
  const target = (params: Record<string, unknown> | undefined) =>
    typeof params?.attachmentId === 'string' ? params.attachmentId : undefined

  registry.register('playMedia', (action, ctx) => {
    const attachmentId = target(action.params)
    const found = attachmentId ? findVideo(attachmentId) : undefined
    if (!found) {
      console.warn('[media] playMedia needs attachmentId naming a video attachment', action)
      return ctx.state
    }
    const handle = text.open(videoPopup(found.object, found.video))
    ctx.effects.add(() => handle.close())
    return ctx.state
  })

  registry.register('stopMedia', (action, ctx) => {
    const attachmentId = target(action.params)
    if (attachmentId) text.close({ attachmentId: `video:${attachmentId}` })
    return ctx.state
  })
}
