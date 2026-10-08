import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4321',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4321 --strictPort',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'mobile-chromium' }],
})
