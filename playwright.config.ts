import { defineConfig, devices } from '@playwright/test'

/**
 * Browser journeys run against the PRODUCTION build, served at a repository
 * sub-path with NO isolation headers — the same posture as GitHub Pages.
 * Both of those differences have produced real bugs, so the tests must not
 * be run against a friendlier server.
 */
const BASE = '/botgineer/'
// Overridable, because two checkouts of this repo (a worktree, say) will
// otherwise fight over one port — and `reuseExistingServer` means the
// loser silently tests the winner's build rather than failing.
const PORT = Number(process.env.PORT ?? 8619)

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run serve:subpath',
    url: `http://127.0.0.1:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_BASE: BASE, BASE_PATH: BASE, PORT: String(PORT) },
  },
})
