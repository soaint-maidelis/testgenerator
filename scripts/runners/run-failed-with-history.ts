const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const historyRoot = path.join(repoRoot, 'reports', 'history');
const defaultWorkers = '2';

const candidateResultsPaths = [
  path.join(repoRoot, 'reports', 'playwright-results.json'),
  path.join(repoRoot, 'reports', 'results.json'),
];

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

function latestExistingPath(paths) {
  const existing = paths.filter((filePath) => fs.existsSync(filePath));
  if (!existing.length) return undefined;

  return existing
    .map((filePath) => ({
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.filePath;
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
    fs.cpSync(target.source, destination, { recursive: true, force: true });
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

function collectSpecs(node, bucket = [], titlePath = []) {
  if (!node || typeof node !== 'object') return bucket;

  const nextTitlePath = node.title ? [...titlePath, node.title] : titlePath;

  if (Array.isArray(node.specs)) {
    for (const spec of node.specs) {
      bucket.push({
        file: spec.file || node.file || '',
        line: spec.line,
        column: spec.column,
        title: spec.title || '',
        tests: spec.tests || [],
        titlePath: nextTitlePath.filter(Boolean),
      });
    }
  }

  if (Array.isArray(node.suites)) {
    for (const suite of node.suites) {
      collectSpecs(suite, bucket, nextTitlePath);
    }
  }

  return bucket;
}

function finalStatus(test) {
  const results = Array.isArray(test.results) ? test.results : [];
  return [...results].reverse().find((result) => result.status)?.status || test.status || 'unknown';
}

function escapeRegExp(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function normalizeTestFile(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const marker = '/tests/e2e/';
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex >= 0) return normalized.slice(markerIndex + 1);
  if (normalized.toLowerCase().startsWith('tests/e2e/')) return normalized;
  return path.join('tests', 'e2e', normalized).replace(/\\/g, '/');
}

function toRootRelativeTestFile(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  if (normalized.toLowerCase().startsWith('tests/e2e/')) return normalized.slice('tests/e2e/'.length);
  return normalized;
}

function collectFailedTests(report) {
  const failedStatuses = new Set(['failed', 'timedOut', 'interrupted']);
  const failed = [];

  for (const spec of collectSpecs(report)) {
    for (const test of spec.tests) {
      if (!failedStatuses.has(finalStatus(test))) continue;
      failed.push({
        file: toRootRelativeTestFile(spec.file),
        runFile: normalizeTestFile(spec.file),
        line: spec.line,
        column: spec.column,
        projectName: test.projectName || test.projectId,
        titlePath: [...spec.titlePath, spec.title].filter((title) => title && !/\.spec\.ts$/i.test(String(title))),
      });
    }
  }

  return failed;
}

function formatTestListLine(test) {
  const location =
    test.line && test.column ? `${test.file}:${test.line}:${test.column}` : test.file;
  const project = test.projectName ? `[${test.projectName}] › ` : '';
  return `${project}${[location, ...test.titlePath].join(' › ')}`;
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
  const requestedResultsPath = process.argv[2] ? path.resolve(repoRoot, process.argv[2]) : undefined;
  const resultsPath = requestedResultsPath || latestExistingPath(candidateResultsPaths);
  if (!resultsPath) {
    console.error('No se encontro un JSON de Playwright para detectar fallidos.');
    process.exit(1);
  }
  if (!fs.existsSync(resultsPath)) {
    console.error(`No existe el JSON solicitado: ${path.relative(repoRoot, resultsPath)}`);
    process.exit(1);
  }

  const previousReport = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const failedTests = collectFailedTests(previousReport);
  const failedFiles = [...new Set(failedTests.map((test) => test.runFile))].sort();

  const timestamp = buildTimestamp();
  const runHistoryDir = uniqueDir(path.join(historyRoot, timestamp));
  const beforeRunDir = path.join(runHistoryDir, 'before-run');
  const currentRunDir = path.join(runHistoryDir, 'current-run');

  ensureDir(runHistoryDir);

  console.log(`Detectados ${failedTests.length} tests fallidos en ${path.relative(repoRoot, resultsPath)}.`);
  console.log(`Guardando evidencia previa en ${path.relative(repoRoot, beforeRunDir)}...`);
  const before = copyEvidence(beforeRunDir);
  writeManifest(beforeRunDir, {
    label: 'before-run',
    copied: before.copied,
    missing: before.missing,
  });

  if (!failedTests.length) {
    console.log('No hay tests fallidos para re-ejecutar.');
    writeManifest(runHistoryDir, {
      label: 'run',
      mode: 'failed-from-report',
      failedTests: 0,
      beforeRun: path.relative(runHistoryDir, beforeRunDir).replace(/\\/g, '/'),
    });
    process.exit(0);
  }

  const env = {
    ...process.env,
    PW_WORKERS: process.env.PW_WORKERS || defaultWorkers,
  };

  const testListPath = path.join(runHistoryDir, 'failed-test-list.txt');
  fs.writeFileSync(testListPath, failedTests.map(formatTestListLine).join('\n'), 'utf8');

  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const testArgs = [
    'playwright',
    'test',
    ...failedFiles,
    '--test-list',
    path.relative(repoRoot, testListPath),
    `--workers=${env.PW_WORKERS}`,
  ];

  console.log(`Ejecutando solo ${failedTests.length} tests fallidos con ${env.PW_WORKERS} workers...`);
  const testResult = run(npxCommand, testArgs, env, {
    shell: process.platform === 'win32',
  });

  console.log('\nGenerando reporte ejecutivo...');
  const executiveResult = run(process.execPath, ['--experimental-strip-types', 'scripts/reports/generate-executive-report.ts'], env);

  console.log(`\nGuardando evidencia de la corrida en ${path.relative(repoRoot, currentRunDir)}...`);
  const current = copyEvidence(currentRunDir);
  writeManifest(currentRunDir, {
    label: 'current-run',
    mode: 'failed-from-report',
    workers: Number(env.PW_WORKERS),
    selectedFailedTests: failedTests.length,
    selectedFiles: failedFiles,
    testList: path.relative(currentRunDir, testListPath).replace(/\\/g, '/'),
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
    mode: 'failed-from-report',
    workers: Number(env.PW_WORKERS),
    selectedFailedTests: failedTests.length,
    testList: path.relative(runHistoryDir, testListPath).replace(/\\/g, '/'),
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
