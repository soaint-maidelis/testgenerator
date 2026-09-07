import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.resolve(__dirname, '..'),
  testMatch: ['reporters/incident-reporter-html.fixture.spec.ts'],
  reporter: [[path.join(__dirname, 'incident-reporter-html.mock.ts')]],
  workers: 1,
  outputDir: 'test-results/incident-html-report/results',
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
