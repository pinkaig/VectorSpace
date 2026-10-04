import { describe, expect, it } from 'vitest'
import { InlineTextResolver } from './InlineTextResolver'
import type { TextAssetMeta } from '@vthere/project'

const meta: TextAssetMeta = { assetId: 'text-1', name: 'Intro', format: 'plain', lang: 'en', content: 'Hello visitor' }

describe('InlineTextResolver', () => {
  it('resolves a project text asset as ready with no loading state', async () => {
    const resolver = new InlineTextResolver((assetId) => (assetId === 'text-1' ? meta : undefined))
    const descriptor = await resolver.resolve({ assetId: 'text-1', kind: 'text' })

    expect(descriptor.status).toBe('ready')
    expect(descriptor.contentType).toBe('text/plain')
    expect(await descriptor.blob?.text()).toBe('Hello visitor')
    expect(descriptor.sizeBytes).toBe(13)
  })

  it('returns an error descriptor for a missing asset or a non-text kind', async () => {
    const resolver = new InlineTextResolver(() => undefined)
    expect((await resolver.resolve({ assetId: 'missing', kind: 'text' })).status).toBe('error')
    expect((await resolver.resolve({ assetId: 'text-1', kind: 'audio' })).status).toBe('error')
  })
})
