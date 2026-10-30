import { describe, expect, it } from 'vitest'
import { classifyMediaLink, descriptorForEntry, type LocalMediaEntry } from './localMediaLibrary'

const entry = (overrides: Partial<LocalMediaEntry>): LocalMediaEntry => ({
  id: 'm1', kind: 'video', source: 'youtube', label: 'x', approval: 'approved', addedBy: 'admin', addedAt: 0, providerId: 'dQw4w9WgXcQ', ...overrides,
})

describe('classifyMediaLink', () => {
  it('reads YouTube links as videos by id, with the same parser as the server', () => {
    expect(classifyMediaLink('https://youtu.be/dQw4w9WgXcQ?si=x')).toEqual({ source: 'youtube', kind: 'video', providerId: 'dQw4w9WgXcQ' })
  })

  it('accepts a direct https PNG, JPEG or WebP link as an image', () => {
    expect(classifyMediaLink('https://example.org/pics/T-rex.JPG')).toEqual({ source: 'web', kind: 'image', url: 'https://example.org/pics/T-rex.JPG', contentType: 'image/jpeg' })
    expect(classifyMediaLink('https://example.org/a.webp?w=400')).toMatchObject({ contentType: 'image/webp' })
  })

  it('refuses everything else', () => {
    for (const bad of ['http://example.org/a.png', 'https://example.org/a.svg', 'https://example.org/page', 'javascript:alert(1)', 'https://user@example.org/a.png', 'https://example.org:8443/a.png', 'https://vimeo.com/1', '', 'https://e.org/a.png\\x']) {
      expect(classifyMediaLink(bad)).toHaveProperty('error')
    }
  })
})

describe('descriptorForEntry', () => {
  const video = { kind: 'video' as const, assetId: 'm1' }
  it('plays approved YouTube links as embeds, and nothing else', () => {
    expect(descriptorForEntry(video, entry({}))).toMatchObject({ status: 'ready', embed: { provider: 'youtube', providerId: 'dQw4w9WgXcQ' } })
    expect(descriptorForEntry(video, entry({ approval: 'pending' }))).toMatchObject({ status: 'error', errorMessage: /waiting for an admin/ })
    expect(descriptorForEntry(video, entry({ approval: 'rejected' }))).toMatchObject({ status: 'error' })
    expect(descriptorForEntry(video, undefined)).toMatchObject({ status: 'error' })
    expect(descriptorForEntry({ kind: 'image', assetId: 'm1' }, entry({}))).toMatchObject({ status: 'error', errorMessage: /Expected image/ })
  })

  it('serves a stored file through its blob URL, and an approved image link through its URL', () => {
    const file = entry({ kind: 'video', source: 'file', providerId: undefined, contentType: 'video/mp4', sizeBytes: 10 })
    expect(descriptorForEntry(video, file, 'blob:abc')).toMatchObject({ status: 'ready', url: 'blob:abc', contentType: 'video/mp4' })
    expect(descriptorForEntry(video, file)).toMatchObject({ status: 'error', errorMessage: /not in this browser/ })
    const web = entry({ kind: 'image', source: 'web', providerId: undefined, url: 'https://e.org/a.png', contentType: 'image/png' })
    expect(descriptorForEntry({ kind: 'image', assetId: 'm1' }, web)).toMatchObject({ status: 'ready', url: 'https://e.org/a.png' })
  })
})
