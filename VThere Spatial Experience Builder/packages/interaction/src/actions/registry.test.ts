import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../RuntimeState'
import { createActionRegistry, createEffectRegistry } from './registry'
import type { ActionContext } from './types'

const context = (): ActionContext => ({
  state: createRuntimeState('scene-gallery'),
  effects: createEffectRegistry(),
})

describe('createActionRegistry', () => {
  it('runs the executor registered for an action kind', async () => {
    const registry = createActionRegistry()
    const ran: string[] = []
    registry.register('showPanel', (action, ctx) => {
      ran.push(String(action.params?.componentId))
      return ctx.state
    })
    await registry.execute({ kind: 'showPanel', params: { componentId: 'panel-1' } }, context())
    expect(ran).toEqual(['panel-1'])
  })

  it('supports a new action kind with no dispatcher change', () => {
    // The acceptance test: registration is the whole integration surface.
    const registry = createActionRegistry()
    expect(registry.has('startHaptics')).toBe(false)
    registry.register('startHaptics', (_action, ctx) => ctx.state)
    expect(registry.has('startHaptics')).toBe(true)
  })

  it('skips an unregistered kind and returns the state unchanged', async () => {
    // Rules outlive the app version that can run them, so an unknown kind is a
    // skip rather than a crash.
    const registry = createActionRegistry()
    const ctx = context()
    const next = await registry.execute({ kind: 'fromTheFuture' }, ctx)
    expect(next).toBe(ctx.state)
  })

  it('awaits an async executor', async () => {
    const registry = createActionRegistry()
    registry.register('playAudio', async (_action, ctx) => {
      await Promise.resolve()
      return { ...ctx.state, runtimeData: { played: true } }
    })
    const next = await registry.execute({ kind: 'playAudio' }, context())
    expect(next.runtimeData).toEqual({ played: true })
  })

  it('lets a later registration replace an earlier one', async () => {
    const registry = createActionRegistry()
    const ran: string[] = []
    registry.register('showPanel', (_a, ctx) => { ran.push('first'); return ctx.state })
    registry.register('showPanel', (_a, ctx) => { ran.push('second'); return ctx.state })
    await registry.execute({ kind: 'showPanel' }, context())
    expect(ran).toEqual(['second'])
  })
})

describe('createEffectRegistry', () => {
  it('disposes a single effect by handle', () => {
    const registry = createEffectRegistry()
    const closed: string[] = []
    const handle = registry.add(() => closed.push('panel'))
    expect(registry.size).toBe(1)
    registry.dispose(handle)
    expect(closed).toEqual(['panel'])
    expect(registry.size).toBe(0)
  })

  it('disposes everything newest first', () => {
    const registry = createEffectRegistry()
    const closed: string[] = []
    registry.add(() => closed.push('first'))
    registry.add(() => closed.push('second'))
    registry.add(() => closed.push('third'))
    registry.disposeAll()
    expect(closed).toEqual(['third', 'second', 'first'])
    expect(registry.size).toBe(0)
  })

  it('disposing twice is safe', () => {
    const registry = createEffectRegistry()
    const closed: string[] = []
    const handle = registry.add(() => closed.push('panel'))
    registry.dispose(handle)
    registry.dispose(handle)
    expect(closed).toEqual(['panel'])
  })

  it('one throwing disposer does not strand the others', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const registry = createEffectRegistry()
    const closed: string[] = []
    registry.add(() => closed.push('survivor'))
    registry.add(() => { throw new Error('bad panel') })
    registry.disposeAll()
    expect(closed).toEqual(['survivor'])
    expect(registry.size).toBe(0)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('disposeAll on an empty registry is a no-op', () => {
    const registry = createEffectRegistry()
    expect(() => registry.disposeAll()).not.toThrow()
    expect(registry.size).toBe(0)
  })
})
