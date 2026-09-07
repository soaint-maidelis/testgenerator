const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { findForbiddenImports } = require('../../tools/quality/audit-boundaries.cjs');

const rootDir = path.resolve(__dirname, '../..');
const options = {
  rootDir,
  appsDir: path.join(rootDir, 'src/apps'),
  aliases: [{ alias: '@apps/*', target: './src/apps/*' }],
};
const importer = path.join(rootDir, 'src/core/example.ts');

test('accepts imports that remain inside core', () => {
  assert.deepEqual(findForbiddenImports("import './config/value';", importer, options), []);
});

test('rejects aliased and relative imports from core to apps', () => {
  const source = [
    "import { adapter } from '@apps/example/adapter';",
    "export { profile } from '../apps/example/config/profile';",
  ].join('\n');
  const violations = findForbiddenImports(source, importer, options);
  assert.deepEqual(violations.map(({ specifier }) => specifier), [
    '@apps/example/adapter',
    '../apps/example/config/profile',
  ]);
});
