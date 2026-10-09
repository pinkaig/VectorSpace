import { describe, expect, it } from 'vitest'
import { environmentLibrary } from '../project/model'
import { listProceduralIds, loadEnvironment, resolveEnvironmentUrl } from './environments'

describe('environment loading', () => {
  it('has a procedural builder for every procedural environment in the library', () => {
    const builders = new Set(listProceduralIds())
    environmentLibrary.filter((env) => env.kind === 'procedural').forEach((env) => {
      expect(builders.has(env.proceduralId ?? '')).toBe(true)
    })
  })

  // GLB files need a browser fetch to load, so they're checked for presence below instead.
  it('loads every procedural environment as a disposable group, non-empty unless the environment is deliberately blank', async () => {
    for (const definition of environmentLibrary.filter((env) => env.kind === 'procedural')) {
      const loaded = await loadEnvironment(definition.id)
      if (definition.proceduralId !== 'empty') expect(loaded.group.children.length).toBeGreaterThan(0)
      expect(() => loaded.dispose()).not.toThrow()
    }
  })

  it('bundles a model file for every GLB environment in the library', () => {
    const glbs = environmentLibrary.filter((env) => env.kind === 'glb')
    expect(glbs.length).toBeGreaterThan(0)
    glbs.forEach((env) => {
      // An unbundled path comes back unchanged — i.e. the file is missing from src/env.
      expect(resolveEnvironmentUrl(env.url ?? '')).not.toBe(env.url)
    })
  })

  it('falls back to the default (empty) environment for an unknown id rather than throwing', async () => {
    const loaded = await loadEnvironment('env-does-not-exist')
    expect(loaded.group.name).toBe('env-empty')
    expect(() => loaded.dispose()).not.toThrow()
  })

  it('reports load progress from 0 to 1', async () => {
    const seen: number[] = []
    await loadEnvironment(environmentLibrary[0].id, { onProgress: (ratio) => seen.push(ratio) })
    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(1)
  })
})
