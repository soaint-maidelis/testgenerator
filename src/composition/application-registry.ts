import { exampleAdapter } from '../apps/example/example.adapter';
import { exampleProfile } from '../apps/example/config/example.profile';
import { demoLocalAdapter } from '../apps/demo-local/demo-local.adapter';
import { demoLocalProfile } from '../apps/demo-local/config/demo-local.profile';
import { realWorldAdapter } from '../apps/realworld/realworld.adapter';
import { realWorldProfile } from '../apps/realworld/config/realworld.profile';
import { sauceDemoAdapter } from '../apps/saucedemo/saucedemo.adapter';
import { sauceDemoProfile } from '../apps/saucedemo/config/saucedemo.profile';
import type { ApplicationRegistry } from '../core/config/application-adapter.types';
import {
  resolveApplicationProfile,
  validateApplicationRegistry,
} from '../core/config/application-profile.resolver';

export const applicationRegistry: ApplicationRegistry = Object.freeze({
  'demo-local': Object.freeze({ profile: demoLocalProfile, adapter: demoLocalAdapter }),
  example: Object.freeze({ profile: exampleProfile, adapter: exampleAdapter }),
  realworld: Object.freeze({ profile: realWorldProfile, adapter: realWorldAdapter }),
  saucedemo: Object.freeze({ profile: sauceDemoProfile, adapter: sauceDemoAdapter }),
});

validateApplicationRegistry(applicationRegistry);

export function resolveConfiguredApplication(appProfile = process.env.APP_PROFILE) {
  return resolveApplicationProfile(appProfile, applicationRegistry);
}
