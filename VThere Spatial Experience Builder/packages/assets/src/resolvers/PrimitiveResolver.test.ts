import { describe, expect, it } from 'vitest'
import { PrimitiveResolver } from './PrimitiveResolver'

describe('PrimitiveResolver', () => {
  it('resolves cube/sphere/cylinder to ready descriptors', async () => {
    const resolver = new PrimitiveResolver()
    for (const kind of ['cube', 'sphere', 'cylinder'] as const) {
      const descriptor = await resolver.resolve({ assetId: `primitive-${kind}`, kind })
      expect(descriptor.status).toBe('ready')
      expect(descriptor.contentType).toContain(kind)
    }
  })

  it('returns an error descriptor for an unknown kind', async () => {
    const resolver = new PrimitiveResolver()
    // @ts-expect-error deliberately invalid kind to exercise the error path
    const descriptor = await resolver.resolve({ assetId: 'x', kind: 'glb' })
    expect(descriptor.status).toBe('error')
    expect(descriptor.errorMessage).toBeDefined()
  })
})
