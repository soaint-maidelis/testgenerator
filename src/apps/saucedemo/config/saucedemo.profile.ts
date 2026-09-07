import { normalizeAppProfile } from '../../../core/config/app-profile.validation';

export const sauceDemoProfile = normalizeAppProfile({
  id: 'saucedemo',
  displayName: 'SauceDemo',
  baseURL: 'https://www.saucedemo.com/',
  capabilities: {
    authentication: true,
    networkInterception: true,
    incidentReporting: true,
  },
  evidencePolicy: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'on',
  },
});
