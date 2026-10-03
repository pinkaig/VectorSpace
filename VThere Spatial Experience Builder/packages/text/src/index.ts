/**
 * @file        index.ts
 * @brief       Public entry point for the text system package.
 *
 * @responsibility
 * Re-exports the facade, its internals, and their types. This file is the
 * package's only entry point: package.json declares
 * `"exports": "./src/index.ts"` as a single string, so subpath imports do
 * not resolve. Anything consumers need must be re-exported here. The action
 * executors and event bridge (registerTextActions, TextEventBridge) arrive
 * with the runtime-wiring build step, not this core.
 *
 * @documentation
 * Larger system guide: docs/code/subsystems/text-system.md
 */
export { TextSystem, type PanelHandle, type TextStats, type TextSystemOptions } from './TextSystem'
export { registerTextActions, type RegisterTextActionsOptions } from './actions/registerTextActions'
export { createTextEventBridge, type TextRuntimeEvent } from './actions/TextEventBridge'
export { TextLibrary } from './TextLibrary'
export { UrlPolicy } from './UrlPolicy'
export { RichTextParser } from './parse/RichTextParser'
export { DEFAULT_TEXT_LIMITS, type InlineNode, type TextLimits, type TextNode } from './parse/nodes'
export { TextLayout, type LayoutLine, type TextLayoutResult } from './layout/TextLayout'
export { FakeTextMeasurer, type FontSpec, type TextMeasurer } from './layout/TextMeasurer'
export { PanelManager, type OpenPanelInput, type PanelSelector } from './PanelManager'
export {
  TextStateStore,
  type PanelStatus,
  type TextEvent,
  type TextEventListener,
  type TextSnapshot,
  type TextSnapshotListener,
} from './TextStateStore'
