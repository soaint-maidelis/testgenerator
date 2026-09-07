const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const findings = [];
const scannedRoots = ['src', 'cases', 'tests/e2e', 'playwright.config.ts'];
const secretAssignment = /\b(?:password|secret|access[_-]?token|refresh[_-]?token|api[_-]?key)\s*[:=]\s*['"][^'"]{6,}['"]/gi;
// Loopback is permitted for the deterministic demo; routed private-network endpoints remain prohibited.
const privateEndpoint = /https?:\/\/(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)/gi;
const pomAntiPatterns = [
  { name: 'absolute XPath', pattern: /['"]\/html\//g },
  { name: 'waitForTimeout', pattern: /\.waitForTimeout\s*\(/g },
  { name: 'generic networkidle', pattern: /waitUntil\s*:\s*['"]networkidle['"]|waitForLoadState\s*\(\s*['"]networkidle['"]/g },
];

function walk(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(target, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}

for (const relative of scannedRoots) {
  for (const file of walk(path.join(root, relative))) {
    if (!/\.(?:ts|tsx|js|cjs|mjs|json)$/.test(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (secretAssignment.test(source)) findings.push(`${path.relative(root, file)} contains a secret-like literal`);
    secretAssignment.lastIndex = 0;
    if (privateEndpoint.test(source)) findings.push(`${path.relative(root, file)} contains a private endpoint`);
    privateEndpoint.lastIndex = 0;
    if (file.includes(`${path.sep}tests${path.sep}e2e${path.sep}`)) {
      for (const check of pomAntiPatterns) {
        if (check.pattern.test(source)) findings.push(`${path.relative(root, file)} contains ${check.name}`);
        check.pattern.lastIndex = 0;
      }
    }
  }
}

for (const forbidden of ['.auth']) {
  if (fs.existsSync(path.join(root, forbidden))) findings.push(`${forbidden} must not exist in the workspace`);
}

const ignored = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/).map((line) => line.trim());
for (const required of ['.auth/', '.env', '.env.*', '!.env.example', 'node_modules/', 'artifacts/', 'test-results/', 'playwright-report/']) {
  if (!ignored.includes(required)) findings.push(`.gitignore is missing ${required}`);
}

if (findings.length > 0) {
  findings.forEach((finding) => console.error(finding));
  process.exitCode = 1;
} else {
  console.log('Sanitize audit PASS: active code, evidence paths, auth state, and POM patterns are safe.');
}
