/**
 * @file        index.ts
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Small typed logger with level filtering and context redaction.
 *
 * @responsibility
 * Creates namespace-aware loggers, filters events by minimum level, protects
 * sensitive context values, and supports injectable sinks for tests.
 *
 * @inputs
 * Namespace, LoggerOptions, log level, message, and optional context values.
 *
 * @outputs
 * LogEvent values sent to the configured sink.
 *
 * @members
 * LogLevel, LogEvent, LogSink, LoggerOptions, createLogger, and
 * createMemorySink.
 *
 *
 * @status
 * NOT PART OF M1. Implemented and unit-tested, but imported by nothing: no
 * production code calls createLogger yet. Kept because it is the logging surface
 * the architecture declares, and wiring it up is a later milestone.
 *
 * @documentation
 * Larger system guide: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Debugging-and-Logging
 * Links point at the project wiki; migration is still in progress.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEvent {
  timestamp: string
  level: LogLevel
  namespace: string
  message: string
  context?: Record<string, unknown>
}

export type LogSink = (event: LogEvent) => void

export interface LoggerOptions {
  level?: LogLevel
  sink?: LogSink
  context?: Record<string, unknown>
}

const levelRank: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const sensitiveKey = /(password|secret|token|authorization|cookie|api[-_]?key)/i
const validLevels = new Set<LogLevel>(['debug', 'info', 'warn', 'error'])

const configuredLevel = (): LogLevel => {
  try {
    const value = globalThis.localStorage?.getItem('vthere:log-level') as LogLevel | null
    return value && validLevels.has(value) ? value : 'info'
  } catch {
    return 'info'
  }
}

const safeValue = (key: string, value: unknown): unknown => {
  if (sensitiveKey.test(key)) return '[REDACTED]'
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack }
  if (Array.isArray(value)) return value.map((item) => safeValue(key, item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, safeValue(childKey, childValue)]))
  }
  return value
}

const safeContext = (context: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(context).map(([key, value]) => [key, safeValue(key, value)]))

const defaultSink: LogSink = (event) => {
  const method = event.level === 'error' ? console.error : event.level === 'warn' ? console.warn : event.level === 'debug' ? console.debug : console.info
  method(`[${event.namespace}] ${event.message}`, event.context ?? {})
}

export const createLogger = (namespace: string, options: LoggerOptions = {}) => {
  const minimum = options.level ?? configuredLevel()
  const sink = options.sink ?? defaultSink
  const baseContext = options.context ?? {}
  const write = (level: LogLevel, message: string, context: Record<string, unknown> = {}) => {
    if (levelRank[level] < levelRank[minimum]) return
    sink({ timestamp: new Date().toISOString(), level, namespace, message, context: safeContext({ ...baseContext, ...context }) })
  }

  return {
    debug: (message: string, context?: Record<string, unknown>) => write('debug', message, context),
    info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
    warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
    error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
    child: (childNamespace: string, childContext: Record<string, unknown> = {}) => createLogger(`${namespace}.${childNamespace}`, { level: minimum, sink, context: { ...baseContext, ...childContext } }),
  }
}

export const createMemorySink = () => {
  const events: LogEvent[] = []
  return { events, sink: (event: LogEvent) => events.push(event) }
}