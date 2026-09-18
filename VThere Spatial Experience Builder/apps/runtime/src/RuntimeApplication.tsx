/**
 * @file        RuntimeApplication.tsx
 * @brief       Transitional visitor runtime application entry boundary.
 *
 * @responsibility
 * Provides the documented apps/runtime import boundary while the visitor view
 * continues to reuse the shared prototype viewport for editor/runtime parity.
 *
 * @outputs
 * The current read-only RuntimeView component.
 *
 * @documentation
 * Application boundary: docs/02-architecture/UNDATED--FOUNDATION--architecture.md
 */
import RuntimeView from '../../../src/RuntimeView'

/** Transitional runtime application boundary; the visitor view still uses the shared prototype viewport. */
export default RuntimeView
