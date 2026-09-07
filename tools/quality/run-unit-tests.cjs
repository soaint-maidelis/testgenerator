const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function testFilesBelow(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) return testFilesBelow(resolved);
    return /\.test\.(?:js|cjs)$/.test(entry.name) ? [resolved] : [];
  });
}

const files = [
  ...testFilesBelow(path.resolve('artifacts/unit/tests/unit')),
  ...testFilesBelow(path.resolve('tests/unit')).filter((file) => file.endsWith('.test.cjs')),
].sort();

if (files.length === 0) {
  console.error('No unit test files were found.');
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}
