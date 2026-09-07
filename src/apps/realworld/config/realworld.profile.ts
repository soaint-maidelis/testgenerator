import { normalizeAppProfile } from '../../../core/config/app-profile.validation';

export const realWorldProfile = normalizeAppProfile({
  id: 'realworld',
  displayName: 'RealWorld Demo',
  baseURL: 'https://demo.realworld.show',
  apiURL: 'https://api.realworld.show/api',
  capabilities: {
    authentication: true,
    apiDataSetup: true,
    networkInterception: true,
    incidentReporting: true,
  },
  evidencePolicy: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
