import { normalizeAppProfile } from '../../../core/config/app-profile.validation';

export const demoLocalProfile = normalizeAppProfile({
  id: 'demo-local',
  displayName: 'TestGenerator Demo Portal',
  baseURL: 'http://127.0.0.1:4173',
  apiURL: 'http://127.0.0.1:4173/api',
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
