const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc');
let result = spawnSync(process.execPath, [tsc, '--project', 'tsconfig.input-tools.json'], { cwd: root, stdio: 'inherit' });
if ((result.status ?? 1) === 0) {
  result = spawnSync(process.execPath, ['artifacts/input-tools/tools/input/import-input.js', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
}
process.exitCode = result.status ?? 1;
