const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const environment = { ...process.env, APP_PROFILE: 'realworld', PW_WORKERS: '1' };
const localEnvironment = { ...process.env, APP_PROFILE: 'demo-local', PW_WORKERS: '1' };
const sauceEnvironment = { ...process.env, APP_PROFILE: 'saucedemo', PW_WORKERS: '1' };
const localServer = path.join(root, 'tools/demo/demo-local-server.cjs');

function runNode(args, env = environment) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  return result.status ?? 1;
}

function compileDemoTools() {
  const tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc');
  return runNode([tsc, '--project', 'tsconfig.demo-tools.json']);
}

function runPlaywright(args, extraEnvironment = {}) {
  const cli = require.resolve('@playwright/test/cli');
  return runNode([cli, 'test', '--config', 'playwright.config.ts', ...args], {
    ...environment,
    ...extraEnvironment,
  });
}

function runNpmScript(script) {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(executable, ['run', script], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

function scaffold(args) {
  const values = Object.fromEntries(args.reduce((pairs, value, index) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), args[index + 1]]);
    return pairs;
  }, []));
  const id = values.id;
  const name = values.name;
  const baseURL = values['base-url'];
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id ?? '') || !name || !baseURL) {
    console.error('Usage: app:scaffold -- --id <kebab-id> --name <display name> --base-url <https-url>');
    return 1;
  }
  try {
    const parsed = new URL(baseURL);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
  } catch {
    console.error('base-url must be an absolute HTTP(S) URL');
    return 1;
  }

  const appRoot = path.join(root, 'src/apps', id);
  const caseRoot = path.join(root, 'cases', id);
  const testRoot = path.join(root, 'tests/e2e', id);
  if ([appRoot, caseRoot, testRoot].some(fs.existsSync)) {
    console.error(`Application "${id}" already exists; nothing was overwritten.`);
    return 1;
  }

  for (const directory of ['config', 'pages', 'fixtures', 'services', 'data']) {
    fs.mkdirSync(path.join(appRoot, directory), { recursive: true });
    if (directory !== 'config') fs.writeFileSync(path.join(appRoot, directory, '.gitkeep'), '');
  }
  fs.mkdirSync(caseRoot, { recursive: true });
  fs.mkdirSync(testRoot, { recursive: true });
  const variable = id.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
  fs.writeFileSync(path.join(appRoot, 'config', `${id}.profile.ts`), [
    "import { normalizeAppProfile } from '../../../core/config/app-profile.validation';",
    '',
    `export const ${variable}Profile = normalizeAppProfile({`,
    `  id: '${id}',`,
    `  displayName: ${JSON.stringify(name)},`,
    `  baseURL: ${JSON.stringify(baseURL)},`,
    '});',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(caseRoot, 'catalog.json'), `${JSON.stringify({ applicationId: id, cases: [] }, null, 2)}\n`);
  fs.writeFileSync(path.join(testRoot, 'README.md'), `# ${name} E2E\n\nAdd catalog-backed specs here.\n`);
  console.log(`Scaffold created for ${id}; src/core was not modified.`);
  return 0;
}

function validateReports() {
  const files = ['playwright-report/index.html', 'artifacts/reports/executive-report.json', 'artifacts/reports/executive-report.md'];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  if (missing.length > 0) {
    console.error(`Missing report artifacts: ${missing.join(', ')}`);
    return 1;
  }
  console.log('Executive reporting PASS: HTML, JSON, and Markdown artifacts exist.');
  return 0;
}

function validateArtifacts(applicationId = 'realworld', caseId = 'RW-INCIDENT-001') {
  if (validateReports() !== 0) return 1;
  const preview = path.join(root, `artifacts/incidents/${applicationId}-${caseId}.json`);
  if (!fs.existsSync(preview) || !fs.readFileSync(preview, 'utf8').includes('SIMULATED_DEMO_FAILURE')) {
    console.error('The expected simulated incident preview is missing or invalid.');
    return 1;
  }
  console.log('Demo artifact validation PASS.');
  return 0;
}

function runIncident(applicationId = 'realworld', caseId = 'RW-INCIDENT-001', spec = 'tests/e2e/realworld/incident.spec.ts', env = environment) {
  const preview = path.join(root, `artifacts/incidents/${applicationId}-${caseId}.json`);
  if (fs.existsSync(preview)) fs.unlinkSync(preview);
  const playwrightStatus = runPlaywright([spec, '--workers=1'], env);
  const validPreview = fs.existsSync(preview) && fs.readFileSync(preview, 'utf8').includes('SIMULATED_DEMO_FAILURE');
  if (playwrightStatus !== 0 && validPreview) {
    console.log('Synthetic incident PASS: expected failure and local preview were verified.');
    return 0;
  }
  console.error(playwrightStatus === 0 ? 'Synthetic incident unexpectedly passed.' : 'Synthetic incident preview was not created.');
  return 1;
}

function runLocalDemo(headed = false) {
  let status = runNpmScript('demo:local:start');
  if (status !== 0) return status;
  let stopStatus = 0;
  try {
    status = runNode([localServer, 'preflight'], localEnvironment);
    if (status === 0 && headed) {
      status = runPlaywright([
        'tests/e2e/demo-local', '--grep', 'DL-AUTH-001|DL-ITEM-001|DL-COMMENT-001', '--headed', '--workers=1',
      ], { ...localEnvironment, HEADLESS: 'false' });
    } else if (status === 0) {
      status = runPlaywright(['tests/e2e/demo-local', '--grep-invert', 'DL-INCIDENT-001', '--workers=1'], localEnvironment);
      if (status === 0) status = validateReports();
      if (status === 0) status = runIncident('demo-local', 'DL-INCIDENT-001', 'tests/e2e/demo-local/incident.spec.ts', localEnvironment);
      if (status === 0) status = validateArtifacts('demo-local', 'DL-INCIDENT-001');
    }
  } finally {
    stopStatus = runNpmScript('demo:local:stop');
  }
  return status === 0 ? stopStatus : status;
}

function runSauceDemo(headed = false) {
  if (headed) {
    return runPlaywright([
      'tests/e2e/saucedemo', '--grep', '\\[SD-AUTH-001\\]|\\[SD-CART-001\\]|\\[SD-CHECKOUT-001\\]', '--headed', '--workers=1',
    ], { ...sauceEnvironment, HEADLESS: 'false' });
  }
  let status = runPlaywright(['tests/e2e/saucedemo', '--grep-invert', 'SD-INCIDENT-001', '--workers=1'], sauceEnvironment);
  if (status === 0) status = validateReports();
  if (status === 0) status = runIncident('saucedemo', 'SD-INCIDENT-001', 'tests/e2e/saucedemo/incident.spec.ts', sauceEnvironment);
  if (status === 0) status = validateArtifacts('saucedemo', 'SD-INCIDENT-001');
  return status;
}

function hashCore() {
  const files = [];
  const visit = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(resolved);
    else files.push(resolved);
  });
  visit(path.join(root, 'src/core'));
  const hash = crypto.createHash('sha256');
  files.sort().forEach((file) => hash.update(path.relative(root, file)).update(fs.readFileSync(file)));
  return hash.digest('hex');
}

function validateScaffold() {
  const id = 'demo-validation-app';
  const targets = [path.join(root, 'src/apps', id), path.join(root, 'cases', id), path.join(root, 'tests/e2e', id)];
  if (targets.some(fs.existsSync)) {
    console.error(`${id} already exists; scaffold validation will not remove pre-existing content.`);
    return 1;
  }
  const before = hashCore();
  try {
    if (scaffold(['--id', id, '--name', 'Demo Validation App', '--base-url', 'https://example.invalid']) !== 0) return 1;
    const required = [
      ...['config', 'pages', 'fixtures', 'services', 'data'].map((directory) => path.join(targets[0], directory)),
      targets[1], targets[2],
    ];
    if (!required.every(fs.existsSync) || before !== hashCore()) {
      console.error('Scaffold validation failed structure or core-integrity checks.');
      return 1;
    }
    console.log('Scaffold validation PASS: structure created without a core change.');
    return 0;
  } finally {
    for (const target of targets) {
      const resolved = path.resolve(target);
      if (!resolved.endsWith(`${path.sep}${id}`)) throw new Error('Unsafe scaffold cleanup target');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

function runFullDemo() {
  if (runNpmScript('demo:preflight') !== 0) return 1;
  for (const gate of ['typecheck', 'test:unit', 'cases:validate', 'audit:boundaries', 'audit:sanitize']) {
    if (runNpmScript(gate) !== 0) return 1;
  }
  if (runPlaywright(['tests/e2e/realworld', '--grep-invert', 'RW-INCIDENT-001', '--workers=1']) !== 0) return 1;
  if (validateReports() !== 0 || runIncident() !== 0) return 1;
  return validateArtifacts();
}

const [mode, ...args] = process.argv.slice(2);
let status = 1;
if (mode === 'preflight') {
  status = compileDemoTools();
  if (status === 0) status = runNode(['artifacts/demo-tools/tools/demo/preflight.js']);
} else if (mode === 'list') {
  status = runPlaywright(['tests/e2e/realworld', '--list']);
} else if (mode === 'smoke') {
  status = runPlaywright(['tests/e2e/realworld', '--grep', 'RW-AUTH-001|RW-AUTH-002|RW-ARTICLE-001', '--workers=1']);
} else if (mode === 'headed') {
  status = runPlaywright(['tests/e2e/realworld', '--grep', 'RW-AUTH-001|RW-ARTICLE-001|RW-COMMENT-001', '--headed', '--workers=1'], { HEADLESS: 'false' });
} else if (mode === 'incident') {
  status = runIncident();
} else if (mode === 'full') {
  status = runFullDemo();
} else if (mode === 'local') {
  status = runLocalDemo();
} else if (mode === 'local-headed') {
  status = runLocalDemo(true);
} else if (mode === 'sauce') {
  status = runSauceDemo();
} else if (mode === 'sauce-headed') {
  status = runSauceDemo(true);
} else if (mode === 'sauce-incident') {
  status = runIncident('saucedemo', 'SD-INCIDENT-001', 'tests/e2e/saucedemo/incident.spec.ts', sauceEnvironment);
} else if (mode === 'report') {
  status = validateReports();
} else if (mode === 'scaffold') {
  status = scaffold(args);
} else if (mode === 'validate-scaffold') {
  status = validateScaffold();
} else {
  console.error(`Unknown demo command: ${mode ?? '(missing)'}`);
}
process.exitCode = status;
