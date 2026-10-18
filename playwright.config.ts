import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'qa/browser-results.json' }]],
  use: { baseURL: process.env.NOTES_TEST_URL ?? 'http://127.0.0.1:4321', trace: 'retain-on-failure' },
});
