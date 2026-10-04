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
  const virtualId = 'virtual:audio-files'
  const resolvedId = `\0${virtualId}`
  const listAudioFiles = (root: string): string[] => {
    const dir = path.join(root, 'public', 'audio')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter((name) => AUDIO_EXTENSIONS.test(name)).sort()
  }
  return {
    name: 'vectorspace-audio-manifest',
    resolveId: (id) => (id === virtualId ? resolvedId : undefined),
    load(id) {
      if (id !== resolvedId) return undefined
      const files = listAudioFiles(this.environment?.config.root ?? process.cwd())
      return `export default ${JSON.stringify(files)}`
    },
  }
}

export default defineConfig({
  plugins: [react(), audioManifestPlugin()],
})
