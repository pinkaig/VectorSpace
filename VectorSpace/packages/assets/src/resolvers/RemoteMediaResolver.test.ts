import { describe, expect, it } from 'vitest'
import { RemoteMediaResolver } from './RemoteMediaResolver'

describe('RemoteMediaResolver', () => {
  it('resolves to an error descriptor (not a thrown/rejected promise) since the backend does not exist yet', async () => {
    const resolver = new RemoteMediaResolver({ projectId: 'proj-1' })
    const descriptor = await resolver.resolve({ assetId: 'media-1', kind: 'cube' })
    expect(descriptor.status).toBe('error')
    expect(descriptor.errorMessage).toContain('not implemented')
  })
})
