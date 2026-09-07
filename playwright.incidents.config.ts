import 'dotenv/config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['integrations/incidents/**/*.spec.ts', 'azure-devops/**/*.spec.ts', 'reporters/**/*.spec.ts'],
  reporter: [['list']],
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
