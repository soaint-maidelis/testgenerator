import { normalizeAppProfile } from '../../../core/config/app-profile.validation';

export const portalDemoProfile = normalizeAppProfile({
  id: 'portal-demo',
  displayName: "Portal Demo",
  baseURL: "https://example.com",
});
