export const env = {
  applicationProfile: (process.env.APP_PROFILE ?? '').trim(),
  headless: process.env.HEADLESS !== 'false',
  workers: Number(process.env.PW_WORKERS ?? 1),
  slowMo: Number(process.env.PW_SLOWMO ?? 0),
};

export function validateRequiredEnv(): void {
  if (!env.applicationProfile) {
    throw new Error('APP_PROFILE is required.');
  }
}
