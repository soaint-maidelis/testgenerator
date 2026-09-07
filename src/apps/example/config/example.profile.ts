import { normalizeAppProfile } from '../../../core/config/app-profile.validation';

/** Reserved .invalid host keeps the structural adapter disconnected from real systems. */
export const exampleProfile = normalizeAppProfile({
  id: 'example',
  displayName: 'Example',
  baseURL: 'https://example.invalid',
});
