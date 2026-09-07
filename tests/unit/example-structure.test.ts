import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import { applicationRegistry } from '../../src/composition/application-registry';
import { listApplicationProfiles } from '../../src/core/config/application-profile.resolver';

test('registers application adapters without changing core composition', () => {
  assert.deepEqual(listApplicationProfiles(applicationRegistry), ['demo-local', 'example', 'realworld', 'saucedemo']);
  assert.equal(applicationRegistry['demo-local']?.adapter.profile, applicationRegistry['demo-local']?.profile);
  assert.equal(applicationRegistry.example?.adapter.profile, applicationRegistry.example?.profile);
  assert.equal(applicationRegistry.realworld?.adapter.profile, applicationRegistry.realworld?.profile);
  assert.equal(applicationRegistry.saucedemo?.adapter.profile, applicationRegistry.saucedemo?.profile);
  assert.equal(applicationRegistry.realworld?.profile.capabilities.authentication, true);
  assert.equal(applicationRegistry.realworld?.profile.capabilities.fileUpload, false);
});

test('provides every approved application directory', () => {
  for (const applicationId of ['example', 'demo-local']) {
    for (const directory of ['config', 'pages', 'fixtures', 'services', 'data']) {
      assert.equal(existsSync(`src/apps/${applicationId}/${directory}`), true);
    }
    assert.equal(existsSync(`cases/${applicationId}`), true);
    assert.equal(existsSync(`tests/e2e/${applicationId}`), true);
  }
});
