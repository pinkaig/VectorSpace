import { describe, expect, it } from 'vitest'
import { environmentLibrary } from './model'
import { listProceduralIds, loadEnvironment } from './environments'

describe('environment loading', () => {
  it('has a procedural builder for every procedural environment in the library', () => {
    const builders = new Set(listProceduralIds())
    environmentLibrary.filter((env) => env.kind === 'procedural').forEach((env) => {
      expect(builders.has(env.proceduralId ?? '')).toBe(true)
    })
  })

  it('loads every registered environment and returns a non-empty, disposable group', async () => {
    for (const definition of environmentLibrary) {
      const loaded = await loadEnvironment(definition.id)
      expect(loaded.group.children.length).toBeGreaterThan(0)
      expect(() => loaded.dispose()).not.toThrow()
    }
  })

  it('falls back to the first environment for an unknown id rather than throwing', async () => {
    const loaded = await loadEnvironment('env-does-not-exist')
    expect(loaded.group.children.length).toBeGreaterThan(0)
  })

  it('reports load progress from 0 to 1', async () => {
    const seen: number[] = []
    await loadEnvironment(environmentLibrary[0].id, { onProgress: (ratio) => seen.push(ratio) })
    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(1)
  })
})
