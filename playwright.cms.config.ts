import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/cms',
  outputDir: './qa/cms-test-results',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4330',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 4330 --bind 127.0.0.1 --directory dist',
    url: 'http://127.0.0.1:4330/admin/',
    reuseExistingServer: false,
  },
});
