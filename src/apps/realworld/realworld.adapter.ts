import type { ApplicationAdapter } from '../../core/config/application-adapter.types';
import { realWorldProfile } from './config/realworld.profile';

export const realWorldAdapter: ApplicationAdapter = Object.freeze({
  id: realWorldProfile.id,
  profile: realWorldProfile,
});
