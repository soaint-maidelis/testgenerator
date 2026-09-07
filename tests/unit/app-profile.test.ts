import assert from 'node:assert/strict';
import test from 'node:test';

import { INITIAL_CAPABILITY_KEYS } from '../../src/core/config/app-profile.types';
import { getAppProfileValidationErrors, normalizeAppProfile } from '../../src/core/config/app-profile.validation';

test('accepts and normalizes a minimal profile with safe defaults', () => {
  const profile = normalizeAppProfile({ id: 'fixture', displayName: 'Fixture', baseURL: 'https://fixture.invalid' });
  assert.equal(profile.apiURL, undefined);
  assert.deepEqual(profile.roles, [{ id: 'default', displayName: 'Default', reusableAuthentication: false }]);
  assert.deepEqual(profile.featureFlags, {});
  assert.equal(profile.evidencePolicy.video, 'off');
  assert.deepEqual(profile.incidentPolicy, { mode: 'preview', provider: 'file' });
  assert.ok(INITIAL_CAPABILITY_KEYS.every((key) => profile.capabilities[key] === false));
});

test('accepts optional API and declarative capability extensions', () => {
  const profile = normalizeAppProfile({
    id: 'fixture', displayName: 'Fixture', baseURL: 'https://fixture.invalid',
    apiURL: 'https://api.fixture.invalid', capabilities: { authentication: true, customCapability: true },
  });
  assert.equal(profile.apiURL, 'https://api.fixture.invalid');
  assert.equal(profile.capabilities.authentication, true);
  assert.equal(profile.capabilities.customCapability, true);
});

test('accepts video retention for successful executions when explicitly enabled', () => {
  const profile = normalizeAppProfile({
    id: 'fixture',
    displayName: 'Fixture',
    baseURL: 'https://fixture.invalid',
    evidencePolicy: { video: 'on' },
  });
  assert.equal(profile.evidencePolicy.video, 'on');
});

test('rejects invalid IDs and URLs', () => {
  const errors = getAppProfileValidationErrors({ id: '', displayName: 'Fixture', baseURL: 'not-a-url' });
  assert.ok(errors.some((error) => error.startsWith('id ')));
  assert.ok(errors.some((error) => error.startsWith('baseURL ')));
});

test('rejects missing required fields', () => {
  assert.throws(() => normalizeAppProfile({}), /displayName must be a non-empty string/);
});

test('rejects invalid capability values', () => {
  assert.throws(
    () => normalizeAppProfile({ id: 'fixture', displayName: 'Fixture', baseURL: 'https://fixture.invalid', capabilities: { authentication: 'yes' } }),
    /capabilities.authentication must be boolean/,
  );
});

test('rejects unsafe incident modes and providers', () => {
  const input = { id: 'fixture', displayName: 'Fixture', baseURL: 'https://fixture.invalid' };
  assert.throws(() => normalizeAppProfile({ ...input, incidentPolicy: { mode: 'create' } }), /mode must be preview/);
  assert.throws(() => normalizeAppProfile({ ...input, incidentPolicy: { provider: 'external' } }), /provider must be file/);
});
