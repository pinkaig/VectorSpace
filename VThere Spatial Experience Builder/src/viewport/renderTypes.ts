/**
 * @file        renderTypes.ts
 * @brief       Shared status contracts for viewport rendering presentation.
 *
 * @responsibility
 * Defines renderer lifecycle status data shared by environment loading and
 * React overlays without owning rendering state.
 *
 * @documentation
 * Rendering map: docs/05-subsystems/viewport.md
 */
export interface EnvStatus {
  state: 'loading' | 'ready' | 'error'
  progress: number
  message?: string
}
