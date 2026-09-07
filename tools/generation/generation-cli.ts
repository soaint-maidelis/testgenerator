import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import type { CatalogCase, TestCatalog } from '../../src/core/cases/catalog.types';
import { parseTestCatalog } from '../../src/core/cases/catalog.validation';
import type { NormalizedTestCatalog } from '../../src/core/input/input-normalization.types';
import { selectStrategyCases, validateTestStrategy } from '../../src/core/strategy/test-strategy.validation';
import type { TestStrategy } from '../../src/core/strategy/test-strategy.types';
import { sauceDemoStrategy } from '../../src/apps/saucedemo/strategy/saucedemo.strategy';
import { UserStoryInputAdapter } from '../../src/input-adapters/user-story/user-story-input.adapter';

const root = process.cwd();
const previewPath = path.join(root, 'artifacts/input-preview/story-normalized.json');
const strategies: Readonly<Record<string, TestStrategy>> = { saucedemo: sauceDemoStrategy };

function options(values: readonly string[]): Readonly<Record<string, string | boolean>> {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < values.length; index += 1) if (values[index]?.startsWith('--')) result[values[index]!.slice(2)] = values[index + 1]?.startsWith('--') || values[index + 1] === undefined ? true : values[++index]!;
  return result;
}

function ensureStoryPreview(): NormalizedTestCatalog {
  if (existsSync(previewPath)) return JSON.parse(readFileSync(previewPath, 'utf8')) as NormalizedTestCatalog;
  const input = path.join(root, 'inputs/user-story/cart-story.md');
  const adapter = new UserStoryInputAdapter();
  const document = { fileName: path.basename(input), content: readFileSync(input) };
  const catalog = adapter.normalize(adapter.parse(document), { fileName: document.fileName, applicationId: 'saucedemo' });
  mkdirSync(path.dirname(previewPath), { recursive: true }); writeFileSync(previewPath, `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}

function approvalPath(app: string, caseId: string): string { return path.join(root, 'artifacts/generation/approvals', `${app}-${caseId}.json`); }
function requireString(value: string | boolean | undefined, name: string): string { if (typeof value !== 'string') throw new Error(`Missing --${name}`); return value; }

function approve(args: Readonly<Record<string, string | boolean>>): void {
  const app = requireString(args.app, 'app'); const caseId = requireString(args.case, 'case'); const preview = ensureStoryPreview();
  if (preview.applicationId !== app) throw new Error(`Candidate belongs to ${preview.applicationId}, not ${app}`);
  const candidate = preview.cases.find((entry) => entry.caseId === caseId); if (!candidate) throw new Error(`Candidate ${caseId} does not exist`);
  const approvedAt = new Date().toISOString(); const approval = { applicationProfile: app, caseId, status: 'APPROVED', priority: candidate.priority, approvedAt, source: candidate.source };
  const updated = { ...preview, cases: preview.cases.map((entry) => entry.caseId === caseId ? { ...entry, reviewStatus: 'APPROVED', approvedAt } : entry) };
  mkdirSync(path.dirname(approvalPath(app, caseId)), { recursive: true });
  writeFileSync(previewPath, `${JSON.stringify(updated, null, 2)}\n`); writeFileSync(approvalPath(app, caseId), `${JSON.stringify(approval, null, 2)}\n`);
  console.log(`QA APPROVAL: ${caseId} APPROVED at ${approvedAt}; source preserved; production catalog unchanged.`);
}

function loadCatalog(app: string): TestCatalog { return parseTestCatalog(JSON.parse(readFileSync(path.join(root, 'cases', app, 'catalog.json'), 'utf8')) as unknown); }
function loadApproval(app: string, caseId: string): Readonly<Record<string, unknown>> {
  const file = approvalPath(app, caseId); if (!existsSync(file)) throw new Error(`${caseId} remains REQUIRES_QA_REVIEW; run candidate:approve first`);
  return JSON.parse(readFileSync(file, 'utf8')) as Readonly<Record<string, unknown>>;
}
function candidate(caseId: string): CatalogCase { const value = ensureStoryPreview().cases.find((entry) => entry.caseId === caseId); if (!value) throw new Error(`Candidate ${caseId} does not exist`); return value; }

function plan(app: string, caseId: string): void {
  const selected = candidate(caseId); const approval = loadApproval(app, caseId); const strategy = strategies[app]; if (!strategy) throw new Error(`No TestStrategy for ${app}`);
  const feature = strategy.cases[caseId]?.feature ?? strategy.features.find((value) => `${selected.title} ${selected.description}`.toLowerCase().includes(value)) ?? 'unassigned';
  const appRoot = path.join(root, 'src/apps', app); const pages = names(path.join(appRoot, 'pages')); const fixtures = names(path.join(appRoot, 'fixtures')); const services = names(path.join(appRoot, 'services')); const tests = filesBelow(path.join(root, 'tests/e2e', app), /\.spec\.ts$/);
  const similar = tests.filter((file) => readFileSync(file, 'utf8').toLowerCase().includes(feature));
  const generatedTest = tests.find((file) => readFileSync(file, 'utf8').includes(caseId));
  console.log(`CASE: ${caseId}`); console.log(`SOURCE: ${selected.source?.type} ${selected.source?.file} ${selected.source?.sourceId}`); console.log(`QA STATUS: ${approval.status}`); console.log(`FEATURE: ${feature}`);
  console.log(`REUSABLE COMPONENTS: pages=${pages.join(',')}; fixtures=${fixtures.join(',')}; services=${services.join(',')}`);
  console.log(`MISSING COMPONENTS: ${pages.length && fixtures.length ? '(none)' : 'application components'}`);
  console.log(`EXISTING SIMILAR TESTS: ${similar.map((file) => path.relative(root, file)).join(',') || '(none)'}`);
  console.log(`FILES EXPECTED TO CHANGE: cases/${app}/catalog.json, ${generatedTest ? path.relative(root, generatedTest) : `tests/e2e/${app}/${feature}.generated.spec.ts`}`);
  console.log('QUALITY GATES REQUIRED: typecheck, cases:validate, audit:boundaries, audit:sanitize, POM anti-patterns, narrow Playwright case');
}

function group(args: Readonly<Record<string, string | boolean>>, listOnlyOverride = false): readonly CatalogCase[] {
  const app = requireString(args.app, 'app'); const strategy = strategies[app]; if (!strategy) throw new Error(`No TestStrategy for ${app}`); const catalog = loadCatalog(app);
  const filter = { ...(typeof args.suite === 'string' ? { suite: args.suite } : {}), ...(typeof args.feature === 'string' ? { feature: args.feature } : {}), ...(typeof args.priority === 'string' ? { priority: args.priority } : {}) };
  const matched = selectStrategyCases(strategy, catalog, filter); const filterText = Object.entries(filter).map(([key, value]) => `${key}=${value}`).join(',');
  console.log(`APPLICATION: ${app}`); console.log(`FILTER: ${filterText}`); console.log(`MATCHED CASES: ${matched.map(({ caseId }) => caseId).join(',') || '(none)'}`); console.log(`COUNT: ${matched.length}`);
  if (matched.length > 0 && args['list-only'] !== true && !listOnlyOverride) {
    const cli = require.resolve('@playwright/test/cli'); const regex = matched.map(({ caseId }) => caseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const result = spawnSync(process.execPath, [cli, 'test', '--config', 'playwright.config.ts', `tests/e2e/${app}`, '--grep', regex, '--workers=1'], { cwd: root, env: { ...process.env, APP_PROFILE: app, PW_WORKERS: '1' }, stdio: 'inherit' });
    if ((result.status ?? 1) !== 0) throw new Error('Selected test group failed');
  }
  return matched;
}

function record(app: string, caseId: string, qualityGateResult = 'PENDING_FINAL_VALIDATION'): void {
  const approval = loadApproval(app, caseId); const finishedAt = new Date().toISOString(); const startedAt = String(approval.approvedAt); const output = {
    caseId, applicationProfile: app, sourceType: 'USER_STORY', startedAt, finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    filesCreated: [`tests/e2e/${app}/cart-counter.generated.spec.ts`], filesModified: [`cases/${app}/catalog.json`, `src/apps/${app}/pages/inventory.page.ts`],
    componentsReused: ['LoginPage', 'InventoryPage', 'saucedemo.fixture', 'standardUser', 'selectedProduct'], componentsCreated: [], qualityGateResult,
  };
  const directory = path.join(root, 'artifacts/generation'); mkdirSync(directory, { recursive: true }); writeFileSync(path.join(directory, `${caseId}.json`), `${JSON.stringify(output, null, 2)}\n`);
}

function demoGeneration(): void {
  const caseId = 'US-SD-CART-001-AC-2'; const preview = ensureStoryPreview(); const approval = loadApproval('saucedemo', caseId);
  console.log('USER STORY: inputs/user-story/cart-story.md'); console.log(`CANDIDATES: ${preview.cases.map(({ caseId: id }) => id).join(',')}`); console.log(`QA STATUS: ${approval.status}; SELECTED: ${caseId}`); plan('saucedemo', caseId);
  console.log(`TEST STRATEGY: ${JSON.stringify(sauceDemoStrategy.cases[caseId])}`); group({ app: 'saucedemo', feature: 'cart', 'list-only': true }, true);
  const metricsFile = path.join(root, 'artifacts/generation', `${caseId}.json`); console.log(`METRICS: ${existsSync(metricsFile) ? readFileSync(metricsFile, 'utf8').trim() : '(pending generation record)'}`);
  console.log('QUALITY GATES EXPECTED: typecheck,catalog,boundaries,sanitize,narrow-test');
}
function demoStrategy(): void { group({ app: 'saucedemo', suite: 'smoke', 'list-only': true }, true); group({ app: 'saucedemo', feature: 'checkout', 'list-only': true }, true); group({ app: 'saucedemo', priority: 'high', 'list-only': true }, true); }
function names(directory: string): string[] { return existsSync(directory) ? readdirSync(directory).filter((name) => statSync(path.join(directory, name)).isFile()) : []; }
function filesBelow(directory: string, pattern: RegExp): string[] { return existsSync(directory) ? readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesBelow(path.join(directory, entry.name), pattern) : pattern.test(entry.name) ? [path.join(directory, entry.name)] : []) : []; }

try {
  const [mode, ...rest] = process.argv.slice(2); const args = options(rest);
  if (mode === 'approve') approve(args); else if (mode === 'plan') plan(requireString(args.app, 'app'), requireString(args.case, 'case')); else if (mode === 'group') group(args); else if (mode === 'demo-generation') demoGeneration(); else if (mode === 'demo-strategy') demoStrategy(); else if (mode === 'record') record(requireString(args.app, 'app'), requireString(args.case, 'case'), typeof args.result === 'string' ? args.result : undefined); else throw new Error(`Unknown generation command: ${mode}`);
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
