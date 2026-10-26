/**
 * @file        useBlockStrayFileDrop.ts
 * @author      Goh Pin Kai
 * @date        2026-10-12
 * @extracted   2026-10-12 by Sherman Goh Wee Hao, from src/pages/EditorPage.tsx
 * @brief       Stops a file dropped outside the library from navigating away.
 *
 * @responsibility
 * Adds window-level dragover/drop listeners that cancel file drags only.
 *
 * @inputs
 * None.
 *
 * @outputs
 * None; it is an effect.
 *
 * @boundary
 * Call it from the page, never from a panel: it is a window listener and must stay
 * active when the Assets tab is not showing.
 *
 * @documentation
 * https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Application-Shell-and-Routing
 */
import { useEffect } from 'react'

export function useBlockStrayFileDrop() {
  // A file dropped just outside the library would otherwise make the browser navigate
  // away to open it, discarding the editor. Only file drags are affected.
  useEffect(() => {
    const blockFileDrop = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    window.addEventListener('dragover', blockFileDrop)
    window.addEventListener('drop', blockFileDrop)
    return () => {
      window.removeEventListener('dragover', blockFileDrop)
      window.removeEventListener('drop', blockFileDrop)
    }
  }, [])
}
