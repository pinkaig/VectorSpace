import { describe, expect, it } from 'vitest'
import { createLogger, createMemorySink } from './index'

describe('debugging logger', () => {
  it('filters levels and redacts sensitive context', () => {
    const memory = createMemorySink()
    const logger = createLogger('test', { level: 'warn', sink: memory.sink })

    logger.info('ignored')
    logger.warn('save failed', { token: 'private', projectId: 'project-1' })

    expect(memory.events).toHaveLength(1)
    expect(memory.events[0].context).toEqual({ token: '[REDACTED]', projectId: 'project-1' })
  })
})