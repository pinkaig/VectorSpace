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
 * Application boundary: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Contracts
 * Links point at the project wiki; migration is still in progress.
 */
import RuntimeView from '../../../src/runtime/RuntimeView'

/** Transitional runtime application boundary; the visitor view still uses the shared prototype viewport. */
export default RuntimeView
