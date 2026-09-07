import type { ApplicationAdapter } from '../../core/config/application-adapter.types';
import { demoLocalProfile } from './config/demo-local.profile';

export const demoLocalAdapter: ApplicationAdapter = Object.freeze({
  id: demoLocalProfile.id,
  profile: demoLocalProfile,
});
