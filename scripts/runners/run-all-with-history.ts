const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const historyRoot = path.join(repoRoot, 'reports', 'history');
const defaultWorkers = '2';

const evidenceTargets = [
  { name: 'playwright-report', source: path.join(repoRoot, 'playwright-report') },
  { name: 'playwright-results.json', source: path.join(repoRoot, 'reports', 'playwright-results.json') },
  { name: 'results.json', source: path.join(repoRoot, 'reports', 'results.json') },
  { name: 'executive-report', source: path.join(repoRoot, 'reports', 'executive-report') },
  { name: 'test-results', source: path.join(repoRoot, 'test-results') },
  { name: 'artifacts', source: path.join(repoRoot, 'artifacts') },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function buildTimestamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
  ].join('-');
}

function uniqueDir(baseDir) {
  if (!fs.existsSync(baseDir)) return baseDir;

  let counter = 2;
  while (fs.existsSync(`${baseDir}-${counter}`)) {
    counter += 1;
  }

  return `${baseDir}-${counter}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyEvidence(targetDir) {
  ensureDir(targetDir);

  const copied = [];
  const missing = [];

  for (const target of evidenceTargets) {
    if (!fs.existsSync(target.source)) {
      missing.push(target.name);
      continue;
    }

    const destination = path.join(targetDir, target.name);
    fs.cpSync(target.source, destination, { recursive: true });
    copied.push(target.name);
  }

  return { copied, missing };
}

function writeManifest(targetDir, data) {
  ensureDir(targetDir);
  fs.writeFileSync(
    path.join(targetDir, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...data,
      },
      null,
      2,
    ),
    'utf8',
  );
}

function run(command, args, env, options = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
    shell: options.shell ?? false,
  });

  if (result.error) {
    console.error(`No se pudo ejecutar el comando: ${result.error.message}`);
  }

  return result;
}

function main() {
  const timestamp = buildTimestamp();
  const runHistoryDir = uniqueDir(path.join(historyRoot, timestamp));
  const beforeRunDir = path.join(runHistoryDir, 'before-run');
  const currentRunDir = path.join(runHistoryDir, 'current-run');

  ensureDir(runHistoryDir);

  console.log(`Guardando evidencia previa en ${path.relative(repoRoot, beforeRunDir)}...`);
  const before = copyEvidence(beforeRunDir);
  writeManifest(beforeRunDir, {
    label: 'before-run',
    copied: before.copied,
    missing: before.missing,
  });

  const env = {
    ...process.env,
    PW_WORKERS: process.env.PW_WORKERS || defaultWorkers,
  };

  console.log(`Ejecutando suite completa con ${env.PW_WORKERS} workers...`);
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const testResult = run(npxCommand, ['playwright', 'test'], env, {
    shell: process.platform === 'win32',
  });

  console.log('\nGenerando reporte ejecutivo...');
  const nodeCommand = process.execPath;
  const executiveResult = run(nodeCommand, ['--experimental-strip-types', 'scripts/reports/generate-executive-report.ts'], env);

  console.log(`\nGuardando evidencia de la corrida en ${path.relative(repoRoot, currentRunDir)}...`);
  const current = copyEvidence(currentRunDir);
  writeManifest(currentRunDir, {
    label: 'current-run',
    workers: Number(env.PW_WORKERS),
    testExitCode: testResult.status,
    testError: testResult.error?.message,
    executiveReportExitCode: executiveResult.status,
    executiveReportError: executiveResult.error?.message,
    copied: current.copied,
    missing: current.missing,
    reports: {
      playwrightHtml: 'playwright-report/index.html',
      playwrightJson: 'playwright-results.json',
      executiveHtml: 'executive-report/index.html',
      executiveJson: 'executive-report/summary.json',
    },
  });

  writeManifest(runHistoryDir, {
    label: 'run',
    workers: Number(env.PW_WORKERS),
    testExitCode: testResult.status,
    testError: testResult.error?.message,
    executiveReportExitCode: executiveResult.status,
    executiveReportError: executiveResult.error?.message,
    beforeRun: path.relative(runHistoryDir, beforeRunDir).replace(/\\/g, '/'),
    currentRun: path.relative(runHistoryDir, currentRunDir).replace(/\\/g, '/'),
  });

  const finalExitCode =
    testResult.status ??
    (testResult.error ? 1 : undefined) ??
    executiveResult.status ??
    (executiveResult.error ? 1 : undefined) ??
    0;
  process.exit(finalExitCode);
}

main();
