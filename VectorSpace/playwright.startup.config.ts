import { defineConfig, devices } from '@playwright/test'

// Startup measurements need the production build; the dev server's unbundled
// modules would make cold-load numbers meaningless. Kept separate from
// playwright.config.ts so the smoke and perf suites are unaffected.
// Run: npx playwright test -c playwright.startup.config.ts
const PORT = 4174

export default defineConfig({
  testDir: './tests/startup',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices['Desktop Chrome'],
    launchOptions: {
      // Same software-GL flags as the other projects so the WebGL context exists headless.
      args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    // Never reuse: a stale preview of an old build would silently give wrong numbers.
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
