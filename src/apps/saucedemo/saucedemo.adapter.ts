import type { ApplicationAdapter } from '../../core/config/application-adapter.types';
import { sauceDemoProfile } from './config/saucedemo.profile';

export const sauceDemoAdapter: ApplicationAdapter = Object.freeze({
  id: sauceDemoProfile.id,
  profile: sauceDemoProfile,
});
