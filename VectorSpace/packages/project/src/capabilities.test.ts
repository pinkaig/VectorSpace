import { describe, expect, it } from 'vitest'
import { getAttachmentCapabilities, listAttachmentCapabilities } from './index'

describe('attachment capability descriptors', () => {
  it('has one entry per attachment kind and per object-form variant, in a stable order', () => {
    expect(listAttachmentCapabilities().map((entry) => entry.key)).toEqual(['text', 'audio', 'image', 'video', 'video-screen', 'hotspot-card'])
  })

  it('looks an entry up by key and returns undefined for an unknown key', () => {
    expect(getAttachmentCapabilities('video-screen')).toMatchObject({ attachmentKind: 'video', form: 'object' })
    expect(getAttachmentCapabilities('hotspot-card')).toMatchObject({ attachmentKind: 'text', form: 'zone' })
    expect(getAttachmentCapabilities('hologram')).toBeUndefined()
  })

  it('marks the text actions that have executors today as available', () => {
    const text = getAttachmentCapabilities('text')
    expect(text?.actions.map((action) => [action.kind, action.status])).toEqual([
      ['showPanel', 'available'], ['hidePanel', 'available'], ['advancePanel', 'available'],
    ])
    expect(text?.events.map((event) => event.kind)).toEqual(['panelOpened', 'panelClosed'])
  })

  it('marks every media action and event as planned until the media track builds them', () => {
    for (const key of ['image', 'video']) {
      const entry = getAttachmentCapabilities(key)
      expect(entry?.actions.every((action) => action.status === 'planned')).toBe(true)
      expect(entry?.events.every((event) => event.status === 'planned')).toBe(true)
    }
  })

  it('publishes no hover event anywhere', () => {
    const events = listAttachmentCapabilities().flatMap((entry) => entry.events.map((event) => event.kind))
    expect(events.some((kind) => /hover/i.test(kind))).toBe(false)
  })

  it('cannot be changed by a caller', () => {
    const video = getAttachmentCapabilities('video')!
    expect(() => { (video.actions as unknown as unknown[]).push({}) }).toThrow()
    expect(() => { (video as { label: string }).label = 'changed' }).toThrow()
    expect(getAttachmentCapabilities('video')?.label).toBe('Video')
  })
})
