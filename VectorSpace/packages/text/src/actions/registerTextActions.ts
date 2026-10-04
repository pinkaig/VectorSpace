/**
 * @file        registerTextActions.ts
 * @brief       Registers the showPanel/hidePanel/advancePanel executors.
 *
 * @responsibility
 * The bridge between the WHEN→DO action vocabulary (packages/interaction)
 * and TextSystem, mirroring registerAudioActions. Every executor that opens
 * a panel registers a disposer with context.effects.add, so resetRuntime()'s
 * effects.disposeAll() closes all text panels. componentId is accepted as an
 * alias of attachmentId (2026-09-22 decision) so existing example rules keep
 * working. Unknown or invalid params are ignored with a console warning,
 * never thrown, matching the registry's no-op policy.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Text-System "Action vocabulary"
 * Links point at the project wiki; migration is still in progress.
 */
import type { ActionRegistry } from '@vthere/interaction'
import type { TextAttachment } from '@vthere/project'
import type { TextSystem } from '../TextSystem'

export interface RegisterTextActionsOptions {
  /**
   * Looks a text attachment up in the live project. Injected because the
   * executor context carries runtime state, not ProjectData — the app layer
   * owns the project feed and supplies this closure.
   */
  findAttachment: (attachmentId: string) => TextAttachment | undefined
}

const targetAttachmentId = (params: Record<string, unknown>): string | undefined => {
  if (typeof params.attachmentId === 'string' && params.attachmentId) return params.attachmentId
  if (typeof params.componentId === 'string' && params.componentId) return params.componentId
  return undefined
}

export const registerTextActions = (registry: ActionRegistry, text: TextSystem, opts: RegisterTextActionsOptions): void => {
  registry.register('showPanel', (action, ctx) => {
    const params = action.params ?? {}
    const attachmentId = targetAttachmentId(params)
    let attachment: TextAttachment | undefined
    if (attachmentId !== undefined) {
      attachment = opts.findAttachment(attachmentId)
    } else if (typeof params.assetId === 'string' && params.assetId) {
      // hostless form: a panel addressed by asset alone, like a scene soundtrack
      attachment = { id: `asset:${params.assetId}`, kind: 'text', assetId: params.assetId, presentation: { mode: 'panel' } }
    }
    if (!attachment) {
      console.warn('[text] showPanel requires attachmentId (or componentId) naming a text attachment, or an assetId', action)
      return ctx.state
    }
    const handle = text.open(attachment, {
      modal: typeof params.modal === 'boolean' ? params.modal : undefined,
      autoCloseMs: typeof params.autoCloseMs === 'number' ? params.autoCloseMs : undefined,
      title: typeof params.title === 'string' ? params.title : undefined,
    })
    ctx.effects.add(() => handle.close())
    if (params.wait === true) {
      // honest gap, not a silent one: resuming an ActionSequencer step on close
      // needs a wait-for-event primitive the sequencer does not have yet
      console.warn('[text] showPanel wait:true is not implemented yet; the panel opens without pausing the sequence', action)
    }
    return ctx.state
  })

  registry.register('hidePanel', (action, ctx) => {
    const params = action.params ?? {}
    const attachmentId = targetAttachmentId(params)
    if (params.all === true) text.closeAll()
    else if (params.top === true) text.close({ top: true })
    else if (attachmentId !== undefined) text.close({ attachmentId })
    else if (typeof params.assetId === 'string' && params.assetId) text.close({ assetId: params.assetId })
    else console.warn('[text] hidePanel requires attachmentId, assetId, top: true, or all: true', action)
    return ctx.state
  })

  registry.register('advancePanel', (action, ctx) => {
    const params = action.params ?? {}
    const dir = params.dir === 'prev' ? 'prev' : 'next'
    const attachmentId = targetAttachmentId(params)
    if (params.top === true) text.advance({ top: true }, dir)
    else if (attachmentId !== undefined) text.advance({ attachmentId }, dir)
    else console.warn('[text] advancePanel requires attachmentId or top: true', action)
    return ctx.state
  })
}
