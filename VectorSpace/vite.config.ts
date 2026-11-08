import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const AUDIO_EXTENSIONS = /\.(ogg|mp3|wav)$/i

// public/ is served/copied as-is and is deliberately invisible to the module graph
// (that's what keeps those files unhashed, stable URLs) — so import.meta.glob can't
// list it. This exposes the file list as its own virtual module instead, read fresh
// from disk on every request/build so a dropped-in file shows up without restarting.
export const audioManifestPlugin = (): Plugin => {
  // virtual:audio-files is the student library (public/audio), virtual:ui-sfx-files the
  // platform's own UI sounds (public/audio/SFX), kept apart so neither list shows the other
  const folders: Record<string, string[]> = {
    '\0virtual:audio-files': ['public', 'audio'],
    '\0virtual:ui-sfx-files': ['public', 'audio', 'SFX'],
  }
  const listAudioFiles = (root: string, folder: string[]): string[] => {
    const dir = path.join(root, ...folder)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter((name) => AUDIO_EXTENSIONS.test(name)).sort()
  }
  return {
    name: 'vectorspace-audio-manifest',
    resolveId: (id) => (`\0${id}` in folders ? `\0${id}` : undefined),
    load(id) {
      const folder = folders[id]
      if (!folder) return undefined
      const files = listAudioFiles(this.environment?.config.root ?? process.cwd(), folder)
      return `export default ${JSON.stringify(files)}`
    },
  }
}

export default defineConfig({
  plugins: [react(), audioManifestPlugin()],
  build: {
    // three.js alone is ~630 kB minified (~160 kB gzipped) and can't be split further;
    // the warning still fires if our own code grows past this
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      // second page: the standalone UI-audio prototype, so it ships at
      // /prototypes/ui-audio/index.html instead of existing only on the dev server
      input: {
        main: 'index.html',
        uiAudio: 'prototypes/ui-audio/index.html',
      },
      output: {
        // three.js in a file of its own: it rarely changes, so after an update returning
        // visitors keep it cached and only download the app code that did change
        manualChunks: (id) => (id.includes('/node_modules/three/') ? 'three' : undefined),
      },
    },
  },
})
