import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { resolveConfiguredApplication } from './src/composition/application-registry';

const selectedApplication = resolveConfiguredApplication();

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [...selectedApplication.profile.testMatch],
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : Number(process.env.PW_WORKERS) || undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'reports/playwright-results.json' }],
    ['./src/adapters/playwright/demo-artifact.reporter.ts'],
    ['list'],
  ],

  use: {
    baseURL: selectedApplication.profile.baseURL,
    headless: process.env.HEADLESS !== 'false',
    channel: process.env.PW_CHANNEL,
    trace: selectedApplication.profile.evidencePolicy.trace,
    screenshot: selectedApplication.profile.evidencePolicy.screenshot,
    video: selectedApplication.profile.evidencePolicy.video,
    actionTimeout: 20_000,
    navigationTimeout: 40_000,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  outputDir: 'test-results',
});
