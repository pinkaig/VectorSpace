import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { embedAssetDescriptor, errorAssetDescriptor, readyAssetDescriptor, type AssetDescriptor } from '../../packages/assets/src/index'
import type { CardMedia } from '../project/model'
import { MediaViewBody } from './MediaView'
import { createMediaLibrary } from './mediaLibrary'
import { youtubeEmbedUrl } from './youtube'

const image: CardMedia = { kind: 'image', assetId: 'media-1', caption: 'Found in 1799', alt: 'A dark stone slab' }
const video: CardMedia = { kind: 'video', assetId: 'media-2', caption: 'The dig site' }
const render = (media: CardMedia, descriptor: AssetDescriptor | null, autoplay = false) =>
  renderToStaticMarkup(createElement(MediaViewBody, { media, descriptor, autoplay, report: () => undefined }))

describe('MediaViewBody', () => {
  it('shows a loading box, with the caption, while resolving', () => {
    const html = render(image, null)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Found in 1799')
  })

  it('draws an image with its alt text, lazily', () => {
    const html = render(image, readyAssetDescriptor({ kind: 'image', assetId: 'media-1' }, { contentType: 'image/png', url: 'https://store.test/a.png' }))
    expect(html).toMatch(/<img[^>]+src="https:\/\/store.test\/a.png"/)
    expect(html).toContain('alt="A dark stone slab"')
    expect(html).toContain('loading="lazy"')
  })

  it('draws an uploaded video with native controls and no autoplay or sound by default', () => {
    const html = render(video, readyAssetDescriptor({ kind: 'video', assetId: 'media-2' }, { contentType: 'video/mp4', url: 'https://store.test/b.mp4' }))
    expect(html).toMatch(/<video[^>]+controls/)
    expect(html).toContain('preload="metadata"')
    expect(html).toContain('playsInline')
    expect(html).not.toContain('autoPlay')
  })

  it('only autoplays a video muted', () => {
    const html = render(video, readyAssetDescriptor({ kind: 'video', assetId: 'media-2' }, { contentType: 'video/mp4', url: 'https://store.test/b.mp4' }), true)
    expect(html).toContain('autoPlay')
    expect(html).toContain('muted')
  })

  it('draws a YouTube embed as a sandboxed iframe on the privacy domain, rebuilt from the id', () => {
    const html = render(video, embedAssetDescriptor({ kind: 'video', assetId: 'media-2' }, { provider: 'youtube', providerId: 'dQw4w9WgXcQ' }))
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?')
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"')
    expect(html).toContain('referrerPolicy="strict-origin-when-cross-origin"')
    expect(html).not.toContain('allow-top-navigation')
    expect(html).not.toContain('allow-popups')
  })

  it('shows "unavailable" and keeps the caption for an error, an embed on an image, or a bad id', () => {
    const cases: Array<[CardMedia, AssetDescriptor, string]> = [
      [image, errorAssetDescriptor({ kind: 'image', assetId: 'media-1' }, 'gone'), 'Image unavailable'],
      [video, errorAssetDescriptor({ kind: 'video', assetId: 'media-2' }, 'waiting for approval'), 'Video unavailable'],
      [image, embedAssetDescriptor({ kind: 'image', assetId: 'media-1' }, { provider: 'youtube', providerId: 'dQw4w9WgXcQ' }), 'Image unavailable'],
      [video, embedAssetDescriptor({ kind: 'video', assetId: 'media-2' }, { provider: 'youtube', providerId: 'bad"id' }), 'Video unavailable'],
    ]
    for (const [media, descriptor, text] of cases) {
      const html = render(media, descriptor)
      expect(html).toContain(text)
      expect(html).toContain(media.caption)
      expect(html).not.toMatch(/<(img|video|iframe)/)
    }
  })
})

describe('youtubeEmbedUrl', () => {
  it('builds the address from a well-formed id only', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&enablejsapi=1')
    expect(youtubeEmbedUrl('dQw4w9WgXcQ', { autoplay: true })).toContain('autoplay=1&mute=1')
    for (const bad of ['', 'short', 'dQw4w9WgXcQ?x=1', '../../evil', 'javascript:alert(1)']) expect(youtubeEmbedUrl(bad)).toBeNull()
  })
})

describe('media library', () => {
  it('reports an error descriptor, not a throw, when no server is set', async () => {
    const resolve = createMediaLibrary({ projectId: 'p' })
    expect((await resolve({ kind: 'image', assetId: 'media-1' })).status).toBe('error')
  })
})
