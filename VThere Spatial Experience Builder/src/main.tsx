/**
 * @file        main.tsx
 * @author      Sherman Goh Wee Hao
 * @date        2026-09-13
 * @reviewed    2026-09-13
 * @brief       Browser entry point for the VThere React application.
 *
 * @responsibility
 * Finds the HTML root element and mounts the top-level App component.
 *
 * @inputs
 * The #root element supplied by index.html.
 *
 * @outputs
 * A React application mounted into the browser DOM.
 *
 * @members
 * StrictMode wrapper and createRoot mounting call.
 *
 * @documentation
 * Larger system guide: docs/01-product/UNDATED--CURRENT--project-context.md
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../apps/editor/src/EditorApplication'
import { validateAudioCatalog } from './audioAssets'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Not awaited: the UI renders immediately with the full catalog, which then
// shrinks in place (see audioAssets.ts) if any bundled file turns out not to
// actually be decodable audio.
void validateAudioCatalog()
