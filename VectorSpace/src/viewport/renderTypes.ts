/**
 * @file        renderTypes.ts
 * @brief       Shared status contracts for viewport rendering presentation.
 *
 * @responsibility
 * Defines renderer lifecycle status data shared by environment loading and
 * React overlays without owning rendering state.
 *
 * @documentation
 * Rendering map: https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Viewport
 * Links point at the project wiki; migration is still in progress.
 */
export interface EnvStatus {
  state: 'loading' | 'ready' | 'error'
  progress: number
  message?: string
}
