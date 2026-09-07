import type { ApplicationAdapter } from '../../core/config/application-adapter.types';
import { exampleProfile } from './config/example.profile';

export const exampleAdapter: ApplicationAdapter = Object.freeze({
  id: exampleProfile.id,
  profile: exampleProfile,
});
