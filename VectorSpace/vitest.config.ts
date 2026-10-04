import { defineConfig } from 'vitest/config'
import { audioManifestPlugin } from './vite.config'

export default defineConfig({
  plugins: [audioManifestPlugin()],
  test: {
    include: ['packages/**/*.test.ts', 'src/**/*.test.ts'],
  },
})