/**
 * Verifies the Stage 6 observable contract: resolving a SceneObject's asset
 * notifies subscribers through loading -> ready/error, a broken assetId
 * produces an observable error/placeholder instead of a silent failure, and
 * retry re-resolves rather than replaying the cached failure.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { SceneObject, TextAttachment } from '../model'
import {
  getAssetDescriptor,
  getAttachmentDescriptor,
  isPlaceholderDescriptor,
  resolveAsset,
  resolveAttachment,
  retryAsset,
  setProjectTextAssets,
  subscribeAssetResolution,
  subscribeAttachmentResolution,
} from './assetResolution'

const makeSceneObject = (overrides: Partial<SceneObject> = {}): SceneObject => ({
  id: overrides.id ?? 'object-1',
  name: 'Test object',
  assetId: overrides.assetId ?? 'primitive-cube',
  assetKind: overrides.assetKind ?? 'cube',
  visible: true,
  enabled: true,
  transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  ...overrides,
})

describe('assetResolution', () => {
  it('resolves a valid assetId to a ready descriptor and notifies subscribers of loading then ready', async () => {
    const object = makeSceneObject({ id: 'obj-ready' })
    const seenStatuses: string[] = []
    const unsubscribe = subscribeAssetResolution(object.id, (descriptor) => seenStatuses.push(descriptor.status))

    const descriptor = await resolveAsset(object)

    expect(descriptor.status).toBe('ready')
    expect(seenStatuses).toEqual(['loading', 'ready'])
    expect(getAssetDescriptor(object.id)?.status).toBe('ready')
    unsubscribe()
  })

  it('surfaces a deliberately broken assetId as a visible placeholder error, not a silent failure', async () => {
    const object = makeSceneObject({ id: 'obj-broken', assetId: 'does-not-exist' })

    const descriptor = await resolveAsset(object)

    expect(descriptor.status).toBe('error')
    expect(isPlaceholderDescriptor(descriptor)).toBe(true)
    expect(descriptor.errorMessage).toBeTruthy()
  })

  it('retry re-resolves rather than replaying a stale result', async () => {
    const object = makeSceneObject({ id: 'obj-retry', assetId: 'still-broken' })
    await resolveAsset(object)

    const retried = await retryAsset(object)

    expect(retried.status).toBe('error')
    expect(getAssetDescriptor(object.id)?.status).toBe('error')
  })
})

describe('attachment resolution', () => {
  const textAttachment: TextAttachment = { id: 'att-text', kind: 'text', assetId: 'text-1', presentation: { mode: 'panel' } }

  beforeEach(() => {
    setProjectTextAssets([{ assetId: 'text-1', name: 'Intro', format: 'plain', lang: 'en', content: 'Hello visitor' }])
  })

  it('resolves a text attachment from project data and notifies its subscribers', async () => {
    const seenStatuses: string[] = []
    const unsubscribe = subscribeAttachmentResolution('att-text', (descriptor) => seenStatuses.push(descriptor.status))

    const descriptor = await resolveAttachment(textAttachment)

    expect(descriptor.status).toBe('ready')
    expect(await descriptor.blob?.text()).toBe('Hello visitor')
    expect(seenStatuses).toEqual(['loading', 'ready'])
    expect(getAttachmentDescriptor('att-text')?.status).toBe('ready')
    unsubscribe()
  })

  it('serves edited text content instead of a stale cached descriptor', async () => {
    await resolveAttachment(textAttachment)
    setProjectTextAssets([{ assetId: 'text-1', name: 'Intro', format: 'plain', lang: 'en', content: 'Rewritten' }])

    const descriptor = await resolveAttachment(textAttachment)

    expect(await descriptor.blob?.text()).toBe('Rewritten')
  })

  it('surfaces a missing text asset as a visible placeholder error', async () => {
    const broken: TextAttachment = { id: 'att-missing', kind: 'text', assetId: 'no-such-text', presentation: { mode: 'panel' } }

    const descriptor = await resolveAttachment(broken)

    expect(descriptor.status).toBe('error')
    expect(isPlaceholderDescriptor(descriptor)).toBe(true)
  })

  it('keeps object and attachment descriptors apart even when their raw ids collide', async () => {
    const sharedId = 'shared-id'
    await resolveAsset(makeSceneObject({ id: sharedId }))
    await resolveAttachment({ ...textAttachment, id: sharedId })

    expect(getAssetDescriptor(sharedId)?.ref.kind).toBe('cube')
    expect(getAttachmentDescriptor(sharedId)?.ref.kind).toBe('text')
  })
})
