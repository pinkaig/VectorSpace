import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 'list' prints each failure with its line in the terminal; the html report would also
  // open a browser and hold the terminal. CI keeps html for the uploaded artefact.
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // kept only for a failing test, so there is something to open without re-running it
    // (npx playwright show-trace test-results/<test>/trace.zip)
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Timing-sensitive; runs serially in its own project (npm run test:perf).
      testIgnore: /perf\//,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Headless Chromium in CI has no GPU, so WebGL context creation
          // (new THREE.WebGLRenderer in Viewport.tsx) silently fails unless
          // software rendering is forced on. Without this, RuntimeView's
          // setup effect throws on mount and the "Visitor view" screen never renders.
          args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
        },
      },
    },
    {
      name: 'perf',
      testMatch: /perf\/.*\.spec\.ts/,
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
        },
      },
    },
    {
      // Local only (npm run test:perf:gpu): headed Chromium on the real GPU.
      // The spec treats this project as report-only, nothing is asserted.
      name: 'perf-gpu',
      testMatch: /perf\/.*\.spec\.ts/,
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        launchOptions: {
          args: ['--enable-webgl', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})