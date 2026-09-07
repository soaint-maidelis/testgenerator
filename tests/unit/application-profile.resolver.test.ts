import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listApplicationProfiles,
  resolveApplicationProfile,
  validateApplicationRegistry,
} from '../../src/core/config/application-profile.resolver';
import { normalizeAppProfile } from '../../src/core/config/app-profile.validation';

const profile = normalizeAppProfile({
  id: 'fixture',
  displayName: 'Fixture',
  baseURL: 'https://fixture.invalid',
});
const adapter = { id: profile.id, profile };
const registry = Object.freeze({ fixture: Object.freeze({ profile, adapter }) });

test('resolves and lists a known static profile', () => {
  validateApplicationRegistry(registry);
  assert.equal(resolveApplicationProfile('fixture', registry).adapter, adapter);
  assert.deepEqual(listApplicationProfiles(registry), ['fixture']);
});

test('rejects absent and unknown APP_PROFILE values explicitly', () => {
  assert.throws(() => resolveApplicationProfile(undefined, registry), /APP_PROFILE is required/);
  assert.throws(() => resolveApplicationProfile('missing', registry), /Unknown APP_PROFILE/);
});

test('rejects inconsistent registry entries', () => {
  assert.throws(
    () => validateApplicationRegistry({ wrong: { profile, adapter } }),
    /must match both profile.id and adapter.id/,
  );
});
