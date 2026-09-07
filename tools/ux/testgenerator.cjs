const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const readline = require('node:readline/promises');

const root = path.resolve(__dirname, '../..');
const ui = require.main === module ? readline.createInterface({ input: process.stdin, output: process.stdout }) : undefined;
const scriptedChoices = (process.env.TESTGENERATOR_CHOICES || '').split(',').map((value) => value.trim()).filter(Boolean);
if (ui && scriptedChoices.length > 0) {
  ui.question = async (prompt) => {
    const answer = scriptedChoices.shift() || '0';
    process.stdout.write(`${prompt}${answer}\n`);
    return answer;
  };
}
const line = '='.repeat(52);
const shortLine = '-'.repeat(52);
const catalogFile = path.join(root, 'cases/saucedemo/catalog.json');
const strategyFile = path.join(root, 'src/apps/saucedemo/strategy/saucedemo.strategy.ts');
const automationStatuses = Object.freeze({ NOT_IMPLEMENTED: 'NOT_IMPLEMENTED', PENDING_GENERATION: 'PENDING_GENERATION', IMPLEMENTED: 'IMPLEMENTED', REUSED_EXISTING: 'REUSED_EXISTING', VALIDATED: 'VALIDATED' });

function title(text) { console.log(`\n${shortLine}\n${text}\n${shortLine}`); }
function check(text) { console.log(`✓ ${text}`); }
function friendlyPriority(value) {
  return ({ critical: 'Alta', high: 'Alta', medium: 'Media', low: 'Baja' })[value] || 'Por definir';
}
function friendlyStatus(value) {
  return ({ APPROVED: 'Aprobado', REJECTED: 'Rechazado' })[value] || 'Pendiente de revisión QA';
}
function run(script, args = [], visible = false, extraEnv = {}) {
  const commands = {
    'import:story': ['tools/input/input-cli.cjs', 'story'],
    'import:excel': ['tools/input/input-cli.cjs', 'excel'],
    'import:json': ['tools/input/input-cli.cjs', 'json'],
    'candidate:approve': ['tools/generation/generation-cli.cjs', 'approve'],
    'generation:plan': ['tools/generation/generation-cli.cjs', 'plan'],
    'demo:trello-incident': ['tools/trello/trello-cli.cjs', 'demo-incident'],
    'submit:trello-incident': ['tools/trello/trello-cli.cjs', 'submit-incident'],
  };
  const command = commands[script];
  if (!command) throw new Error(`Unsupported internal operation: ${script}`);
  const result = spawnSync(process.execPath, [...command, ...args], {
    cwd: root, env: { ...process.env, ...extraEnv }, encoding: 'utf8', stdio: visible ? 'inherit' : 'pipe',
  });
  if ((result.status ?? 1) !== 0) throw new Error((result.stderr || result.stdout || `${script} failed`).trim());
  return `${result.stdout || ''}${result.stderr || ''}`;
}
function files(directory, extensions) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('~$') && extensions.includes(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(directory, entry.name));
}
function displayName(file) {
  if (/\.(md|txt)$/i.test(file)) {
    const heading = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((value) => value.startsWith('# '));
    return cleanText(heading ? heading.replace(/^#\s+[^ ]+\s*[-–:]\s*/, '') : path.basename(file, path.extname(file)));
  }
  return path.basename(file, path.extname(file)).replace(/[-_]/g, ' ');
}
async function choose(items, heading) {
  title(heading);
  items.forEach((item, index) => console.log(`[${index + 1}] ${displayName(item)}`));
  console.log('[0] Volver');
  const selected = Number(await ui.question('\nSeleccione una opción:\n> '));
  return selected > 0 && selected <= items.length ? items[selected - 1] : undefined;
}
async function chooseInputFiles(items, heading, includeAll = false) {
  title(heading);
  if (includeAll && items.length > 1) {
    console.log('[1] Todas las historias');
    items.forEach((item, index) => console.log(`[${index + 2}] ${displayName(item)}`));
  } else {
    items.forEach((item, index) => console.log(`[${index + 1}] ${displayName(item)}`));
  }
  console.log('[0] Volver');
  const selected = Number(await ui.question('\nSeleccione una opción:\n> '));
  if (selected === 0) return [];
  if (includeAll && items.length > 1) {
    if (selected === 1) return items;
    const index = selected - 2;
    return items[index] ? [items[index]] : [];
  }
  const index = selected - 1;
  return items[index] ? [items[index]] : [];
}
function previewPath(kind) { return path.join(root, `artifacts/input-preview/${kind}-normalized.json`); }
function importCases(kind, file) {
  const command = kind === 'user-story' ? 'import:story' : `import:${kind}`;
  run(command, [path.relative(root, file)], false, { INPUT_APPLICATION_ID: 'saucedemo' });
  const artifact = previewPath(kind === 'user-story' ? 'story' : kind);
  return JSON.parse(fs.readFileSync(artifact, 'utf8'));
}
function importInputFiles(kind, selectedFiles) {
  const catalogs = selectedFiles.map((file) => importCases(kind, file));
  if (catalogs.length === 1) return catalogs[0];
  const merged = {
    applicationId: catalogs[0].applicationId,
    cases: catalogs.flatMap((catalog) => catalog.cases),
    warnings: catalogs.flatMap((catalog) => catalog.warnings || []),
  };
  const artifact = previewPath(kind === 'user-story' ? 'story' : kind);
  fs.writeFileSync(artifact, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return merged;
}
function cleanText(value) { return /Ã|â/.test(value) ? Buffer.from(value, 'latin1').toString('utf8') : value; }
function originalCriterion(testCase) { return cleanText(testCase.expectedResults?.[0] || testCase.steps?.[0]?.action || testCase.title); }
function scenarioLabel(testCase) {
  if (testCase.source?.type === 'EXCEL' || testCase.source?.type === 'JSON') return cleanText(testCase.title);
  const criterion = originalCriterion(testCase).replace(/\s*\.\s*$/, '').trim();
  const exactTitles = new Map([
    ['El usuario puede eliminar un producto del carrito', 'Eliminar un producto agregado al carrito'],
    ['El producto eliminado deja de mostrarse en el carrito', 'Verificar que el producto eliminado ya no aparezca en el carrito'],
    ['El contador del carrito se actualiza después de eliminar el producto', 'Verificar la actualización del contador del carrito'],
    ['Product can be added to cart', 'Agregar un producto al carrito'],
    ['Cart counter is updated', 'Verificar la actualización del contador del carrito'],
    ['Added product is visible in cart', 'Verificar que el producto agregado aparezca en el carrito'],
  ]);
  const exact = exactTitles.get(criterion);
  if (exact) return exact;
  const userCan = criterion.match(/^El usuario puede\s+(.+)$/i);
  if (userCan) return userCan[1].charAt(0).toUpperCase() + userCan[1].slice(1);
  return `Verificar ${criterion.charAt(0).toLowerCase()}${criterion.slice(1)}`;
}
function scenarioView(testCase) {
  return { title: scenarioLabel(testCase), criterion: originalCriterion(testCase), priority: friendlyPriority(testCase.priority), status: friendlyStatus(testCase.reviewStatus) };
}
function sameSource(candidate, persisted) {
  if (!persisted?.source || !candidate.source) return true;
  return persisted.source.sourceId === candidate.source.sourceId && persisted.source.file === candidate.source.file;
}
function hydrateCandidateStates(candidates, approvals, catalogCases) {
  return candidates.map((candidate) => {
    const approval = approvals[candidate.caseId];
    const catalogCase = catalogCases.find((entry) => entry.caseId === candidate.caseId);
    const approved = approval?.status === 'APPROVED' && sameSource(candidate, approval);
    const catalogMatches = catalogCase && sameSource(candidate, catalogCase);
    const priority = approved && ['high', 'medium', 'low', 'critical'].includes(approval.priority)
      ? approval.priority
      : catalogMatches && ['high', 'medium', 'low', 'critical'].includes(catalogCase.priority) ? catalogCase.priority : candidate.priority;
    const reviewStatus = approved || (catalogMatches && catalogCase.reviewStatus === 'APPROVED') ? 'APPROVED' : candidate.reviewStatus;
    return { ...candidate, priority, reviewStatus, ...(approval?.approvedAt ? { approvedAt: approval.approvedAt } : {}) };
  });
}
function loadPersistedCandidateStates(catalog) {
  const approvals = {};
  for (const candidate of catalog.cases) {
    const file = path.join(root, `artifacts/generation/approvals/saucedemo-${candidate.caseId}.json`);
    if (fs.existsSync(file)) {
      try { approvals[candidate.caseId] = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* Invalid state remains unapplied. */ }
    }
  }
  const production = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  return { ...catalog, cases: hydrateCandidateStates(catalog.cases, approvals, production.cases) };
}
function changeCandidatePriority(testCase, priority) {
  if (!['high', 'medium', 'low'].includes(priority)) throw new Error('Prioridad no permitida');
  return { ...testCase, priority };
}
function approveCandidate(testCase) { return { ...testCase, reviewStatus: 'APPROVED' }; }
function approvalConfirmationText(count) { return `Se aprobarán ${count} escenarios para automatización.`; }
function showScenarios(cases) {
  title('ESCENARIOS PROPUESTOS');
  cases.forEach((entry, index) => {
    const view = scenarioView(entry);
    console.log(`\n[${index + 1}] ${view.title}`);
    console.log(`    Prioridad: ${view.priority}`);
    console.log(`    Estado: ${view.status}`);
    if (canExecuteAutomation(implementationState(entry.caseId))) console.log('    Automatización: Lista');
  });
  console.log(`\n${shortLine}\n\n${cases.length} escenarios propuestos a partir de los\ncriterios de aceptación.`);
  console.log('\nTodos requieren validación de QA antes\nde generar automatización.');
}
function scenarioSelectionText(cases) {
  const lines = ['\nSeleccione el escenario:', '', '[1] Todos los escenarios'];
  cases.forEach((entry, index) => lines.push(`[${index + 2}] ${scenarioView(entry).title}`));
  lines.push('[0] Volver');
  return lines.join('\n');
}
function automationExecutionSelectionText(cases) {
  const lines = ['\n¿Qué pruebas desea ejecutar?', '', `[1] Todos los tests seleccionados (${cases.length})`];
  cases.forEach((entry, index) => lines.push(`[${index + 2}] [${entry.caseId}] ${scenarioLabel(entry)}`));
  lines.push('[D] Ver detalles');
  lines.push('[0] Volver');
  return lines.join('\n');
}
async function reviewCandidate(testCase) {
  let current = testCase;
  while (true) {
    const view = scenarioView(current);
    const automation = implementationState(current.caseId);
    const implemented = Boolean(automation.spec && automation.catalogTraced);
    const validated = canExecuteAutomation(automation);
    title('ESCENARIO');
    console.log(`Título:\n${view.title}\n\nBasado en:\n${view.criterion}\n\nPrioridad:\n${view.priority}\n\nEstado QA:\n${view.status}\n\nAutomatización:\n${implemented ? 'Implementada' : 'No implementada'}\n\nValidación:\n${validated ? 'Superada' : implemented ? 'Pendiente' : 'No aplica'}`);
    if (current.reviewStatus === 'APPROVED') {
      console.log(validated ? '\n[1] Ejecutar prueba\n[2] Ver detalles\n[3] Volver' : '\n[1] Continuar preparación\n[2] Ver detalles\n[3] Volver');
      const persistedAction = await ui.question('> ');
      if (persistedAction === '1') {
        if (validated) await executeCase(current.caseId);
        else await generationFlow(current);
        return undefined;
      }
      if (persistedAction === '2') console.log(`\nCaso: ${current.caseId}\nSpec: ${automation.spec ? path.relative(root, automation.spec) : 'No disponible'}\nValidación vigente: ${validated ? 'Sí' : 'No'}`);
      else if (persistedAction === '3') return undefined;
      continue;
    }
    console.log('\n[1] Aprobar\n[2] Cambiar prioridad\n[3] Volver');
    const action = await ui.question('> ');
    if (action === '1') return approveCandidate(current);
    if (action === '3') return undefined;
    if (action === '2') {
      console.log('\n[1] Alta\n[2] Media\n[3] Baja');
      const selected = await ui.question('> ');
      const priority = ({ '1': 'high', '2': 'medium', '3': 'low' })[selected];
      if (priority) { current = changeCandidatePriority(current, priority); check(`Prioridad actualizada: ${friendlyPriority(priority)}`); }
    }
  }
}
function saveApproval(catalog, selected) {
  const preview = path.join(root, 'artifacts/input-preview/story-normalized.json');
  fs.mkdirSync(path.dirname(preview), { recursive: true });
  fs.writeFileSync(preview, `${JSON.stringify(catalog, null, 2)}\n`);
  run('candidate:approve', ['--app', 'saucedemo', '--case', selected.caseId]);
}
function reusableComponents() {
  return ['pages', 'fixtures', 'services'].flatMap((folder) => files(path.join(root, `src/apps/saucedemo/${folder}`), ['.ts']));
}
function specTracesCase(source, caseId) {
  const escaped = caseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\[${escaped}\\]`).test(source) && new RegExp(`description:\\s*['\"]${escaped}['\"]`).test(source);
}
function findSpec(caseId) {
  return files(path.join(root, 'tests/e2e/saucedemo'), ['.ts']).find((file) => file.endsWith('.spec.ts') && specTracesCase(fs.readFileSync(file, 'utf8'), caseId));
}
function normalizedBehavior(value) {
  return cleanText(String(value || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function behaviorKind(value) {
  const text = normalizedBehavior(value);
  if (/(remove|eliminar|removed|eliminado)/.test(text) && /(product|producto)/.test(text) && /(cart|carrito)/.test(text)) return 'REMOVE_PRODUCT_FROM_CART';
  if (/(counter|badge|contador)/.test(text) && /(update|updated|display|show|actualiza|muestra)/.test(text)) return 'CART_COUNT_UPDATED';
  if (/(visible|present|contains|show|aparece|contiene)/.test(text) && /(product|producto)/.test(text) && /(cart|carrito)/.test(text)) return 'PRODUCT_VISIBLE_IN_CART';
  if (/(add|added|agregar|anadir)/.test(text) && /(product|producto)/.test(text) && /(cart|carrito)/.test(text)) return 'ADD_PRODUCT_TO_CART';
  return 'OTHER';
}
function caseFeature(testCase) {
  const text = normalizedBehavior([testCase.title, testCase.description, ...(testCase.tags || []), ...(testCase.expectedResults || [])].join(' '));
  return text.includes('cart') || text.includes('carrito') ? 'cart' : 'other';
}
function evaluateAutomationCoverage(candidate, existing, specSource) {
  const candidateText = [candidate.title, ...candidate.steps.flatMap((step) => [step.action, step.expectedResult]), ...candidate.expectedResults].join(' ');
  const existingActions = existing.steps.map((step) => step.action).join(' ');
  const existingResults = [...existing.steps.map((step) => step.expectedResult), ...existing.expectedResults];
  const candidateBehavior = behaviorKind(candidateText);
  const existingAction = behaviorKind(existingActions);
  const existingResultKinds = existingResults.map(behaviorKind);
  const existingResult = existingResultKinds.find((kind) => kind === 'PRODUCT_VISIBLE_IN_CART') || behaviorKind(existingResults.join(' '));
  const sameFeature = caseFeature(candidate) === caseFeature(existing);
  const candidatePreconditions = candidate.preconditions || [];
  const preconditionsCompatible = candidatePreconditions.length === 0 || candidatePreconditions.every((condition) => normalizedBehavior((existing.preconditions || []).join(' ')).includes(normalizedBehavior(condition)));
  const traced = specTracesCase(specSource, existing.caseId);
  const implementationEvidence = specSource.includes('addProduct(') && specSource.includes('expectProduct(');
  const behaviorCovered = candidateBehavior === 'ADD_PRODUCT_TO_CART'
    && existingAction === 'ADD_PRODUCT_TO_CART'
    && existingResultKinds.includes('PRODUCT_VISIBLE_IN_CART')
    && implementationEvidence;
  return { equivalent: sameFeature && preconditionsCompatible && traced && behaviorCovered, candidateBehavior, existingAction, existingResult, sameFeature, preconditionsCompatible, traced, implementationEvidence };
}
function findEquivalentAutomation(selected, dependencies = {}) {
  const catalog = dependencies.catalog || JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const locateSpec = dependencies.findSpec || findSpec;
  const read = dependencies.readFileSync || fs.readFileSync;
  for (const existing of catalog.cases.filter((entry) => entry.automationStatus === 'automated')) {
    const spec = locateSpec(existing.caseId);
    if (!spec) continue;
    const equivalence = evaluateAutomationCoverage(selected, existing, read(spec, 'utf8'));
    if (equivalence.equivalent) return { existingCaseId: existing.caseId, spec, equivalence };
  }
  return undefined;
}
function reuseRecordPath(caseId) { return path.join(root, `artifacts/generation-reuse/${caseId}.json`); }
function buildReuseRecord(selected, match, components, validation = 'PENDING') {
  return {
    caseId: selected.caseId, applicationProfile: 'saucedemo', automationStatus: automationStatuses.REUSED_EXISTING, existingCaseId: match.existingCaseId,
    spec: path.relative(root, match.spec).replace(/\\/g, '/'), source: selected.source, equivalence: match.equivalence,
    componentsReused: components.map((file) => path.basename(file)), componentsCreated: 0, filesCreated: 0, filesModified: 0,
    validation, execution: validation === 'SUPERADA' ? 'PASS' : 'NO APLICA', recordedAt: new Date().toISOString(),
  };
}
function writeReuseRecord(record) {
  const output = reuseRecordPath(record.caseId);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
  return output;
}
function loadReuseRecord(selected, match, components) {
  const file = reuseRecordPath(selected.caseId);
  if (fs.existsSync(file)) {
    try {
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      const expectedSpec = path.relative(root, match.spec).replace(/\\/g, '/');
      if (record.automationStatus === automationStatuses.REUSED_EXISTING && record.existingCaseId === match.existingCaseId && record.spec === expectedSpec) return record;
    } catch { /* Invalid reuse state is replaced with a fresh pending record. */ }
  }
  return buildReuseRecord(selected, match, components);
}
function canExecuteReuse(record) { return record?.automationStatus === automationStatuses.REUSED_EXISTING && record.validation === 'SUPERADA'; }
function implementationState(caseId) {
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const spec = findSpec(caseId);
  const catalogTraced = catalog.cases.some((entry) => entry.caseId === caseId && entry.automationStatus === 'automated');
  const componentsExist = reusableComponents().length > 0;
  const fingerprint = spec && catalogTraced ? crypto.createHash('sha256').update(fs.readFileSync(spec)).update(fs.readFileSync(catalogFile)).digest('hex') : undefined;
  const validationFile = path.join(root, `artifacts/generation-validation/${caseId}.json`);
  let qualityValidated = false;
  if (fingerprint && fs.existsSync(validationFile)) {
    try { qualityValidated = JSON.parse(fs.readFileSync(validationFile, 'utf8')).fingerprint === fingerprint; } catch { qualityValidated = false; }
  }
  return { spec, catalogTraced, componentsExist, fingerprint, qualityValidated };
}
function canExecuteAutomation(state) {
  return Boolean(state.spec && state.catalogTraced && state.componentsExist && state.qualityValidated);
}
function selectCandidateForAutomation(candidates) {
  return candidates.find((candidate) => !canExecuteAutomation(implementationState(candidate.caseId)) && !findEquivalentAutomation(candidate)) || candidates[0];
}
function preparationState(filesCreated, filesModified, implemented) {
  return { prepared: true, generated: implemented, automationStatus: implemented ? automationStatuses.IMPLEMENTED : automationStatuses.PENDING_GENERATION, executionEnabled: implemented && filesCreated + filesModified > 0 };
}
function containsSecret(text) {
  return /(?:TRELLO_API_KEY|TRELLO_API_TOKEN)\s*=\s*\S+|ATTA[a-zA-Z0-9]{20,}|\b[a-f0-9]{32}\b/i.test(text);
}
function formatList(values) {
  return (values || []).map((value) => `- ${cleanText(value)}`).join('\n') || '- (none)';
}
function formatSteps(steps) {
  return (steps || []).map((step) => `- ${cleanText(step.action)}${step.expectedResult ? ` => ${cleanText(step.expectedResult)}` : ''}`).join('\n') || '- (none)';
}
function sourceInputRoot(sourceType) {
  if (sourceType === 'USER_STORY') return path.join(root, 'inputs/user-story');
  if (sourceType === 'EXCEL') return path.join(root, 'inputs/excel');
  if (sourceType === 'JSON') return path.join(root, 'inputs/json');
  return undefined;
}
function resolveSourceInput(source) {
  const sourceFile = source?.file;
  const inputRoot = sourceInputRoot(source?.type);
  if (!sourceFile || !inputRoot) return undefined;
  const resolved = path.resolve(inputRoot, sourceFile);
  const allowedRoot = path.resolve(inputRoot);
  if (resolved !== allowedRoot && resolved.startsWith(`${allowedRoot}${path.sep}`) && fs.existsSync(resolved)) return resolved;
  return undefined;
}
function sourceContextText(selected) {
  const source = selected.source || {};
  const sourcePath = resolveSourceInput(source);
  if (source.type === 'USER_STORY') {
    if (!sourcePath) throw new Error('La historia original no está disponible.');
    return cleanText(fs.readFileSync(sourcePath, 'utf8'));
  }
  return [
    `Source type: ${source.type || 'Not provided'}`,
    `Source file: ${source.file || 'Not provided'}`,
    `Source row: ${source.row || 'Not provided'}`,
    `Source reference: ${source.originalReference || source.sourceId || 'Not provided'}`,
    `Source file available: ${sourcePath ? 'YES' : 'NO'}`,
    '',
    `Case ID: ${selected.caseId}`,
    `Title: ${cleanText(selected.title)}`,
    `Description: ${cleanText(selected.description)}`,
    '',
    'Preconditions:',
    formatList(selected.preconditions),
    '',
    'Input data:',
    JSON.stringify(selected.inputData || {}, null, 2),
    '',
    'Steps:',
    formatSteps(selected.steps),
    '',
    'Expected results:',
    formatList(selected.expectedResults),
    '',
    `Priority: ${cleanText(selected.priority)}`,
    `Type: ${cleanText(selected.type)}`,
    `Tags: ${(selected.tags || []).join(', ') || '(none)'}`,
    `Automation status: ${cleanText(selected.automationStatus)}`,
  ].join('\n');
}
function buildGenerationHandoff({ selected, scenario, history, components, generationPlan, agentsRules }) {
  const componentList = components.map((file) => `- ${path.relative(root, file).replace(/\\/g, '/')}`).join('\n');
  const content = `# Generation handoff: ${selected.caseId}\n\n## Objective\nImplement exactly one approved Playwright case. ONE CASE AT A TIME.\n\n## Approved QA context\n- Application profile: saucedemo\n- Case: ${selected.caseId}\n- Scenario: ${scenario.title}\n- Acceptance criterion: ${scenario.criterion}\n- QA priority: ${scenario.priority}\n- QA status: Aprobado\n\n## Original input context\n${history.trim()}\n\n## Reusable application context\n${componentList}\n\nUse the existing Page Objects, fixture, services, data, and application profile before adding code. Create only the minimum missing implementation. Do not modify src/core.\n\n## Existing generation plan\n\u0060\u0060\u0060text\n${generationPlan.trim()}\n\u0060\u0060\u0060\n\n## Implementation procedure\nUse the playwright-test-implementation skill. Preserve case traceability, POM, semantic locators, test.step Given/When/Then wording, and strong assertions. Do not use XPath, waitForTimeout, generic networkidle, retries that mask failures, or duplicated login logic.\n\nAfter implementation run: typecheck, cases:validate, audit:boundaries, audit:sanitize, then the narrow Playwright case.\n\n## Permanent project rules\n${agentsRules.trim()}\n`;
  if (containsSecret(content)) throw new Error('El handoff contiene información sensible y no fue guardado.');
  return content;
}
function writeGenerationHandoff(selected, components, generationPlan) {
  const content = buildGenerationHandoff({
    selected,
    scenario: scenarioView(selected),
    history: sourceContextText(selected),
    components,
    generationPlan,
    agentsRules: fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'),
  });
  const directory = path.join(root, 'artifacts/generation-handoff');
  fs.mkdirSync(directory, { recursive: true });
  const output = path.join(directory, `${selected.caseId}.md`);
  fs.writeFileSync(output, content);
  return { output, content };
}
function codexClipboardInstruction(handoff) {
  const concise = handoff.content.split('\n## Permanent project rules\n')[0].trim();
  return `${concise}\n\nFollow the repository AGENTS.md instructions.\nHandoff: ${path.relative(root, handoff.output).replace(/\\/g, '/')}`;
}
function writeCodexPrompt(handoff) {
  const output = handoff.output.replace(/\.md$/i, '.prompt.txt');
  fs.writeFileSync(output, `${codexClipboardInstruction(handoff)}\n`);
  return output;
}
function copyToClipboard(content, dependencies = {}) {
  const copy = dependencies.spawnSync || spawnSync;
  if (process.platform !== 'win32' && !dependencies.spawnSync) return false;
  const result = copy('clip.exe', [], { input: content, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'], timeout: 3000 });
  return (result.status ?? 1) === 0;
}
function generatedSpecPath(caseId) {
  const slug = caseId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return path.join(root, 'tests/e2e/saucedemo', `${slug}.generated.spec.ts`);
}
function classifySauceDemoFeature(selected) {
  const text = `${selected.caseId} ${selected.title} ${selected.description} ${(selected.tags || []).join(' ')} ${selected.type}`.toLowerCase();
  if (text.includes('incident') || text.includes('failure') || text.includes('simulated')) return 'incident';
  if (text.includes('checkout')) return 'checkout';
  if (text.includes('cart')) return 'cart';
  if (text.includes('auth') || text.includes('login')) return 'authentication';
  throw new Error(`El caso ${selected.caseId} requiere implementación asistida porque no coincide con una plantilla SauceDemo conocida.`);
}
function sauceDemoStrategyMetadata(feature) {
  if (feature === 'incident') return { feature: 'cart', suites: ['regression'], risk: 'controlled', role: 'standard_user' };
  if (feature === 'authentication') return { feature, suites: ['smoke', 'regression', 'critical'], risk: 'high', role: 'standard_user' };
  if (feature === 'cart') return { feature, suites: ['smoke', 'regression', 'critical'], risk: 'high', role: 'standard_user' };
  if (feature === 'checkout') return { feature, suites: ['smoke', 'regression', 'critical'], risk: 'high', role: 'standard_user' };
  return { feature: 'cart', suites: ['regression'], risk: 'medium', role: 'standard_user' };
}
function testTitle(selected, feature) {
  const tags = selected.tags || [];
  const tagText = [...new Set([...tags.filter((tag) => tag !== 'excel').map((tag) => `@${tag}`), `@${feature === 'authentication' ? 'auth' : feature}`])].join(' ');
  return `${tagText} [${selected.caseId}] ${selected.title.toLowerCase()}`;
}
function sauceDemoSpecSource(selected, feature) {
  const title = JSON.stringify(testTitle(selected, feature));
  const caseId = JSON.stringify(selected.caseId);
  if (feature === 'authentication') return `import { standardUser } from '../../../src/apps/saucedemo/data/saucedemo.data';
import { test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test(${title}, async ({ session, loginPage }) => {
  test.info().annotations.push({ type: 'caseId', description: ${caseId} });
  await test.step('Given the SauceDemo login is open', async () => { await loginPage.goto(); });
  await test.step('When the standard user submits public credentials', async () => { await loginPage.login(standardUser.username, standardUser.password); });
  await test.step('Then the inventory is displayed', async () => { await loginPage.expectAccepted(); });
});
`;
  if (feature === 'cart') return `import { selectedProduct, standardUser } from '../../../src/apps/saucedemo/data/saucedemo.data';
import { test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test(${title}, async ({ session, loginPage, inventoryPage, cartPage }) => {
  test.info().annotations.push({ type: 'caseId', description: ${caseId} });
  await test.step('Given the standard user is authenticated', async () => { await loginPage.goto(); await loginPage.login(standardUser.username, standardUser.password); await loginPage.expectAccepted(); });
  await test.step('When a product is added and the cart is opened', async () => { await inventoryPage.addProduct(selectedProduct); await inventoryPage.openCart(); });
  await test.step('Then the selected product is present', async () => { await cartPage.expectProduct(selectedProduct); });
});
`;
  if (feature === 'checkout') return `import { checkoutCustomer, selectedProduct, standardUser } from '../../../src/apps/saucedemo/data/saucedemo.data';
import { test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test(${title}, async ({ session, loginPage, inventoryPage, cartPage, checkoutPage }) => {
  test.info().annotations.push({ type: 'caseId', description: ${caseId} });
  await test.step('Given an authenticated user has a product in the cart', async () => { await loginPage.goto(); await loginPage.login(standardUser.username, standardUser.password); await loginPage.expectAccepted(); await inventoryPage.addProduct(selectedProduct); await inventoryPage.openCart(); await cartPage.expectProduct(selectedProduct); });
  await test.step('When valid checkout information is completed', async () => { await cartPage.checkout(); await checkoutPage.completeInformation(checkoutCustomer()); });
  await test.step('Then the order is completed successfully', async () => { await checkoutPage.finish(); });
});
`;
  return `import { expect, test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test(${title}, async ({ session, inventoryPage, page }) => {
  test.info().annotations.push({ type: 'caseId', description: ${caseId} });
  await test.step('Given an isolated artificial cart state with no external dependency', async () => {
    await page.setContent('<main><h1>Simulated cart</h1><span data-test="shopping-cart-badge">0</span></main>');
  });
  await test.step('When an artificial cart persistence condition is evaluated', async () => {
    await test.info().attach('SIMULATED_DEMO_FAILURE', {
      body: Buffer.from(JSON.stringify({ caseId: ${caseId}, classification: 'PRODUCT_DEFECT', url: page.url(), browser: test.info().project.name })),
      contentType: 'application/json',
    });
    await expect(inventoryPage.cartBadge(), 'SIMULATED_DEMO_FAILURE: controlled Excel condition expected one item').toHaveText('1');
  });
});
`;
}
function upsertCatalogCase(selected) {
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const generated = { ...selected, automationStatus: 'automated', reviewStatus: 'APPROVED' };
  const exists = catalog.cases.some((entry) => entry.caseId === selected.caseId);
  catalog.cases = exists ? catalog.cases.map((entry) => entry.caseId === selected.caseId ? { ...entry, ...generated } : entry) : [...catalog.cases, generated];
  fs.writeFileSync(catalogFile, `${JSON.stringify(catalog, null, 2)}\n`);
  return exists ? 'modified' : 'created';
}
function upsertStrategyCase(selected, feature) {
  const strategyFile = path.join(root, 'src/apps/saucedemo/strategy/saucedemo.strategy.ts');
  const source = fs.readFileSync(strategyFile, 'utf8');
  if (source.includes(`'${selected.caseId}'`)) return 'unchanged';
  const metadata = sauceDemoStrategyMetadata(feature);
  const line = `    '${selected.caseId}': { feature: '${metadata.feature}', suites: ${JSON.stringify(metadata.suites)}, risk: '${metadata.risk}', role: '${metadata.role}' },\n`;
  const updated = source.replace(/  },\r?\n}\);\r?\n?$/, `${line}  },\n});\n`);
  if (updated === source) throw new Error('No fue posible actualizar la estrategia SauceDemo.');
  fs.writeFileSync(strategyFile, updated);
  return 'modified';
}
function implementSauceDemoCase(selected) {
  const feature = classifySauceDemoFeature(selected);
  const spec = generatedSpecPath(selected.caseId);
  fs.mkdirSync(path.dirname(spec), { recursive: true });
  const specExisted = fs.existsSync(spec);
  fs.writeFileSync(spec, sauceDemoSpecSource(selected, feature));
  const catalogChange = upsertCatalogCase(selected);
  const strategyChange = upsertStrategyCase(selected, feature);
  return {
    spec,
    filesCreated: [specExisted ? undefined : spec].filter(Boolean),
    filesModified: [specExisted ? spec : undefined, catalogFile, strategyChange === 'modified' ? path.join(root, 'src/apps/saucedemo/strategy/saucedemo.strategy.ts') : undefined].filter(Boolean),
    catalogChange,
    strategyChange,
  };
}
function generationPlanValue(generationPlan, label) {
  return generationPlan.split(/\r?\n/).find((line) => line.startsWith(`${label}:`))?.slice(label.length + 1).trim() || '(none)';
}
function technicalSummary(selected, components, generationPlan) {
  return [
    `Case: ${selected.caseId}`,
    'Application: saucedemo',
    `QA status: ${friendlyStatus(selected.reviewStatus)}`,
    `Priority: ${friendlyPriority(selected.priority)}`,
    `Reusable components: ${components.length}`,
    `Similar tests: ${generationPlanValue(generationPlan, 'EXISTING SIMILAR TESTS')}`,
    `Expected files: ${generationPlanValue(generationPlan, 'FILES EXPECTED TO CHANGE')}`,
    `Quality gates: ${generationPlanValue(generationPlan, 'QUALITY GATES REQUIRED')}`,
  ].join('\n');
}
async function generationPreparedMenu(selected, components, generationPlan, handoff, dependencies = {}) {
  const question = dependencies.question || ((prompt) => ui.question(prompt));
  const log = dependencies.log || console.log;
  while (true) {
    title('GENERACIÓN PREPARADA');
    log(`Escenario:\n${scenarioLabel(selected)}\n\nEstado:\nListo para implementación asistida\n\nComponentes reutilizables:\n${components.length}\n\nHandoff preparado:\nSí`);
    log('\n¿Qué desea hacer?\n\n[1] Preparar instrucción para Codex\n[2] Ver resumen técnico\n[3] Volver');
    const choice = await question('> ');
    if (choice === '1') {
      const handoffPath = path.relative(root, handoff.output).replace(/\\/g, '/');
      const promptPath = path.relative(root, writeCodexPrompt(handoff)).replace(/\\/g, '/');
      log(`\nInstrucción preparada para Codex.\n\nPrompt:\n${promptPath}\n\nHandoff:\n${handoffPath}\n\nSiguiente paso:\nAbra el archivo prompt y pegue su contenido en el panel Codex.`);
      continue;
    }
    if (choice === '2') { log(`\n${technicalSummary(selected, components, generationPlan)}`); continue; }
    return;
  }
}
function executeValidationCommand(label, executable, args) {
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if ((result.status ?? 1) !== 0) throw new Error(`${label}: ${(result.stderr || result.stdout || 'validación fallida').trim()}`);
}
function validateReusedAutomation(selected, match, components, dependencies = {}) {
  const execute = dependencies.spawnSync || spawnSync;
  const cli = require.resolve('@playwright/test/cli');
  const result = execute(process.execPath, [cli, 'test', '--config', 'playwright.config.ts', path.relative(root, match.spec), '--grep', match.existingCaseId, '--workers=1'], {
    cwd: root, env: { ...process.env, APP_PROFILE: 'saucedemo', PW_WORKERS: '1', HEADLESS: 'true' }, stdio: 'inherit',
  });
  if ((result.status ?? 1) !== 0) throw new Error('La automatización reutilizada no superó la validación.');
  const record = buildReuseRecord(selected, match, components, 'SUPERADA');
  if (!dependencies.skipWrite) writeReuseRecord(record);
  return record;
}
async function reusedAutomationMenu(selected, match, components, dependencies = {}) {
  const question = dependencies.question || ((prompt) => ui.question(prompt));
  const log = dependencies.log || console.log;
  const validate = dependencies.validate || (() => validateReusedAutomation(selected, match, components));
  let record = dependencies.initialRecord || loadReuseRecord(selected, match, components);
  if (!dependencies.skipWrite && !fs.existsSync(reuseRecordPath(selected.caseId))) writeReuseRecord(record);
  while (true) {
    title('AUTOMATIZACIÓN EXISTENTE ENCONTRADA');
    log(`El escenario ya está cubierto por una automatización existente.\n\nComponentes reutilizados:\n${components.length}\n\nNo es necesario generar código nuevo.\n\nEstado:\n${canExecuteReuse(record) ? 'Lista para ejecución' : 'Lista para validación'}`);
    log('\n[1] Validar automatización\n[2] Ver detalles\n[3] Volver');
    const choice = await question('> ');
    if (choice === '1') {
      record = await validate();
      log('\nAutomation:\nReutilizada\n\nValidation:\nSuperada\n\nExecution:\nPASS');
      continue;
    }
    if (choice === '2') {
      log(`\nCase: ${selected.caseId}\nAutomation status: REUSED_EXISTING\nExisting case: ${match.existingCaseId}\nSpec: ${path.relative(root, match.spec)}\nFiles created: 0\nFiles modified: 0\nComponents created: 0`);
      continue;
    }
    return record;
  }
}
function validateImplementation(caseId) {
  let state = implementationState(caseId);
  if (!state.spec || !state.catalogTraced || !state.componentsExist || !state.fingerprint) throw new Error('La implementación aún no contiene spec trazado, catálogo y componentes requeridos.');
  const tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc');
  executeValidationCommand('TypeScript', process.execPath, [tsc, '--noEmit']);
  executeValidationCommand('Catálogo', process.execPath, [tsc, '--project', 'tsconfig.quality.json']);
  executeValidationCommand('Catálogo', process.execPath, ['artifacts/quality/tools/quality/validate-cases.js']);
  executeValidationCommand('Límites', process.execPath, ['tools/quality/audit-boundaries.cjs']);
  executeValidationCommand('Seguridad', process.execPath, ['tools/quality/audit-sanitize.cjs']);
  const directory = path.join(root, 'artifacts/generation-validation');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, `${caseId}.json`), `${JSON.stringify({ caseId, fingerprint: state.fingerprint, validatedAt: new Date().toISOString(), gates: ['typecheck', 'cases:validate', 'audit:boundaries', 'audit:sanitize'] }, null, 2)}\n`);
  state = implementationState(caseId);
  return state;
}
async function generationFlow(selected) {
  const started = Date.now();
  console.log('\nPreparando automatización...');
  check('Requerimiento validado');
  const components = reusableComponents();
  check('Componentes reutilizables identificados');
  const generationPlan = run('generation:plan', ['--app', 'saucedemo', '--case', selected.caseId]);
  check('Contexto de generación preparado');
  const equivalent = findEquivalentAutomation(selected);
  if (equivalent) return reusedAutomationMenu(selected, equivalent, components);
  let state = implementationState(selected.caseId);
  if (canExecuteAutomation(state)) return readyAutomationMenu(selected, components);
  if (state.spec && state.catalogTraced) {
    title('AUTOMATIZACIÓN IMPLEMENTADA');
    console.log('Estado:\nPendiente de validación');
    console.log('\n[1] Validar automatización\n[2] Ver detalles\n[3] Volver');
    const action = await ui.question('> ');
    if (action === '1') {
      console.log('\nValidando implementación...');
      state = validateImplementation(selected.caseId);
      if (canExecuteAutomation(state)) { check('Validaciones de calidad superadas'); return readyAutomationMenu(selected, components); }
    }
    if (action === '2') console.log(`\nSpec: ${state.spec ? path.relative(root, state.spec) : 'No disponible'}\nCatálogo trazado: ${state.catalogTraced ? 'Sí' : 'No'}\nValidación vigente: ${state.qualityValidated ? 'Sí' : 'No'}`);
    return;
  }
  const preparation = preparationState(0, 0, false);
  title('AUTOMATIZACIÓN PREPARADA');
  check('Requerimiento validado'); check('Componentes reutilizables identificados'); check('Contexto de generación preparado');
  console.log(`\nTiempo de preparación: ${Date.now() - started} ms\nComponentes reutilizables: ${components.length}\n\nEstado:\nPendiente de generación asistida`);
  while (true) {
    console.log('\n¿Qué desea hacer?\n\n[1] Generar test automatizado\n[2] Ver detalles\n[3] Volver');
    const choice = await ui.question('> ');
    if (choice === '1') {
      if (preparation.executionEnabled) throw new Error('Estado de preparación inconsistente.');
      console.log('\nGenerando implementación...');
      const implementation = implementSauceDemoCase(selected);
      check('Spec Playwright generado');
      check('Catálogo actualizado');
      check('Estrategia de pruebas actualizada');
      console.log('\nValidando implementación...');
      state = validateImplementation(selected.caseId);
      if (canExecuteAutomation(state)) {
        check('Validaciones de calidad superadas');
        console.log(`\nArchivos creados:\n${implementation.filesCreated.map((file) => path.relative(root, file).replace(/\\/g, '/')).join('\n') || '(ninguno)'}\n\nArchivos actualizados:\n${implementation.filesModified.map((file) => path.relative(root, file).replace(/\\/g, '/')).join('\n') || '(ninguno)'}`);
        return readyAutomationMenu(selected, components);
      }
      throw new Error('La implementación fue generada, pero no quedó lista para ejecución.');
    }
    if (choice === '2') {
      console.log(`\nCaso: ${selected.caseId}\nComponentes reutilizables: ${components.map((file) => path.basename(file)).join(', ')}`);
      console.log('Archivos creados: 0\nArchivos actualizados: 0\nEjecución habilitada: No');
    } else return;
  }
}
async function generationFlowBatch(selectedCases) {
  const started = Date.now();
  const components = reusableComponents();
  console.log('\nPreparando automatización por lote...');
  check(`${selectedCases.length} requerimientos validados`);
  check('Componentes reutilizables identificados');
  check('Contexto de generación preparado');
  title('AUTOMATIZACIÓN EN PROCESO');
  console.log(`Casos seleccionados:\n${selectedCases.map((entry) => `- ${entry.caseId}: ${scenarioLabel(entry)}`).join('\n')}`);
  console.log(`\nTiempo de preparación: ${Date.now() - started} ms\nComponentes reutilizables: ${components.length}\n\nEstado:\nGenerando automatización`);
  const created = [];
  const modified = [];
  console.log('\nGenerando implementaciones...');
  for (const selected of selectedCases) {
    if (!canExecuteAutomation(implementationState(selected.caseId))) {
      const implementation = implementSauceDemoCase(selected);
      created.push(...implementation.filesCreated);
      modified.push(...implementation.filesModified);
    }
    check(`${selected.caseId} generado`);
  }
  console.log('\nValidando implementaciones...');
  for (const selected of selectedCases) {
    validateImplementation(selected.caseId);
    check(`${selected.caseId} validado`);
  }
  title('AUTOMATIZACIÓN LISTA');
  check('Specs trazados');
  check('Catálogo validado');
  check('Controles de calidad superados');
  console.log(`\nCasos listos: ${selectedCases.length}\nComponentes reutilizados: ${components.length}`);
  console.log(`\nArchivos creados:\n${[...new Set(created)].map((file) => path.relative(root, file).replace(/\\/g, '/')).join('\n') || '(ninguno)'}\n\nArchivos actualizados:\n${[...new Set(modified)].map((file) => path.relative(root, file).replace(/\\/g, '/')).join('\n') || '(ninguno)'}`);
  await automationExecutionMenu(selectedCases);
}
async function automationExecutionMenu(selectedCases) {
  while (true) {
    console.log(automationExecutionSelectionText(selectedCases));
    const choice = (await ui.question('> ')).trim().toLowerCase();
    if (choice === '0') return;
    if (choice === 'd') {
      console.log(`\nTests disponibles:\n${selectedCases.map((entry) => `- ${entry.caseId}: ${path.relative(root, findSpec(entry.caseId) || generatedSpecPath(entry.caseId)).replace(/\\/g, '/')}`).join('\n')}`);
      continue;
    }
    const selectedIndex = Number(choice);
    if (selectedIndex === 1) {
      await executeCases(selectedCases.map((entry) => entry.caseId));
      return;
    }
    const selected = selectedCases[selectedIndex - 2];
    if (selected) {
      await executeCase(selected.caseId);
      return;
    }
    console.log('\nOpción no válida. Seleccione todos los tests o uno de la lista.');
  }
}
async function readyAutomationMenu(selected, components) {
  title('AUTOMATIZACIÓN LISTA');
  check('Spec trazado'); check('Catálogo validado'); check('Controles de calidad superados');
  console.log(`\nComponentes reutilizados: ${components.length}\nValidación de calidad: SUPERADA`);
  await automationExecutionMenu([selected]);
}
async function executeCase(caseId) {
  const started = Date.now();
  console.log('\nIniciando ejecución...');
  const cli = require.resolve('@playwright/test/cli');
  const headless = process.env.TESTGENERATOR_HEADLESS === '1';
  const result = spawnSync(process.execPath, [cli, 'test', '--config', 'playwright.config.ts', 'tests/e2e/saucedemo', '--grep', caseId, '--workers=1', ...(headless ? [] : ['--headed'])], {
    cwd: root, env: { ...process.env, APP_PROFILE: 'saucedemo', PW_WORKERS: '1', HEADLESS: headless ? 'true' : 'false' }, stdio: 'inherit',
  });
  if ((result.status ?? 1) !== 0) throw new Error('La ejecución automatizada no terminó correctamente.');
  check('Ejecución completada');
  console.log(`\nResultado: APROBADO\nDuración: ${Date.now() - started} ms`);
  console.log('\nEvidencias disponibles:'); check('Reporte'); check('Capturas configuradas'); check('Trazabilidad');
  await executionMenu({ caseId, startedAt: started, result: 'PASS' });
}
async function executeCases(caseIds) {
  const started = Date.now();
  console.log('\nIniciando ejecución del lote...');
  const cli = require.resolve('@playwright/test/cli');
  const headless = process.env.TESTGENERATOR_HEADLESS === '1';
  const grep = caseIds.map((caseId) => caseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const result = spawnSync(process.execPath, [cli, 'test', '--config', 'playwright.config.ts', 'tests/e2e/saucedemo', '--grep', grep, '--workers=1', ...(headless ? [] : ['--headed'])], {
    cwd: root, env: { ...process.env, APP_PROFILE: 'saucedemo', PW_WORKERS: '1', HEADLESS: headless ? 'true' : 'false' }, stdio: 'inherit',
  });
  const passed = (result.status ?? 1) === 0;
  check(passed ? 'Ejecución completada' : 'Ejecución completada con incidencia');
  console.log(`\nResultado: ${passed ? 'APROBADO' : 'CON INCIDENCIAS'}\nDuración: ${Date.now() - started} ms\nCasos ejecutados: ${caseIds.length}\n\nEvidencias disponibles:\n✓ Reporte\n✓ Capturas configuradas\n✓ Trazabilidad`);
  await batchExecutionMenu({ caseIds, startedAt: started, result: passed ? 'PASS' : 'FAIL' });
}
function reportContainsResult(report, caseId, result) {
  if (Array.isArray(report)) return report.some((value) => reportContainsResult(value, caseId, result));
  if (!report || typeof report !== 'object') return false;
  const serialized = JSON.stringify(report);
  if (typeof report.title === 'string' && report.title.includes(caseId)) {
    return result === 'PASS' ? serialized.includes('"status":"passed"') : serialized.includes('"status":"failed"');
  }
  return Object.values(report).some((value) => reportContainsResult(value, caseId, result));
}
function validateLatestReport(execution, io = fs) {
  const htmlPath = path.join(root, 'playwright-report/index.html');
  const jsonPath = path.join(root, 'reports/playwright-results.json');
  if (!io.existsSync(htmlPath) || !io.existsSync(jsonPath)) return { valid: false, htmlPath, reason: 'missing' };
  if (io.statSync(htmlPath).mtimeMs + 1000 < execution.startedAt || io.statSync(jsonPath).mtimeMs + 1000 < execution.startedAt) return { valid: false, htmlPath, reason: 'stale' };
  let report;
  try { report = JSON.parse(io.readFileSync(jsonPath, 'utf8')); } catch { return { valid: false, htmlPath, reason: 'invalid' }; }
  if (Array.isArray(execution.caseIds)) {
    const serialized = JSON.stringify(report);
    if (!execution.caseIds.every((caseId) => serialized.includes(caseId))) return { valid: false, htmlPath, reason: 'mismatch' };
    return { valid: true, htmlPath, caseIds: execution.caseIds, result: execution.result };
  }
  if (!reportContainsResult(report, execution.caseId, execution.result)) return { valid: false, htmlPath, reason: 'mismatch' };
  return { valid: true, htmlPath, caseId: execution.caseId, result: execution.result };
}
function launchDefaultBrowser(file) {
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  return new Promise((resolve, reject) => {
    const child = spawn(command, [file], { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
async function openLatestReport(execution, dependencies = {}) {
  const validation = validateLatestReport(execution, dependencies.io || fs);
  if (!validation.valid) return { opened: false, validation };
  try {
    await (dependencies.launch || launchDefaultBrowser)(validation.htmlPath);
    return { opened: true, validation };
  } catch {
    return { opened: false, validation };
  }
}
function reportFallbackText() {
  return '\nNo fue posible abrir el reporte automáticamente.\n\nRuta:\nplaywright-report/index.html\n\nComando alternativo:\nnpx playwright show-report';
}
async function executionMenu(execution, dependencies = {}) {
  const question = dependencies.question || ((prompt) => ui.question(prompt));
  const openReport = dependencies.openReport || openLatestReport;
  const log = dependencies.log || console.log;
  const success = dependencies.success || check;
  while (true) {
    log('\n[1] Ver reporte\n[2] Ejecutar otra prueba\n[3] Simular un fallo\n[4] Menú principal');
    const choice = await question('> ');
    if (choice === '1') {
      const report = await openReport(execution);
      if (report.opened) success(`Reporte abierto para ${execution.caseId}`);
      else log(reportFallbackText());
      continue;
    }
    if (choice === '2') await existingTests();
    else if (choice === '3') await incidentFlow();
    return choice;
  }
}
async function batchExecutionMenu(execution, dependencies = {}) {
  const question = dependencies.question || ((prompt) => ui.question(prompt));
  const openReport = dependencies.openReport || openLatestReport;
  const log = dependencies.log || console.log;
  const success = dependencies.success || check;
  const registerIncident = dependencies.registerIncident || ((currentExecution) => incidentFlow({ prepare: () => loadExecutionIncident(currentExecution), initialAction: 'register' }));
  while (true) {
    log(execution.result === 'FAIL'
      ? '\n[1] Ver reporte\n[2] Registrar incidencia en Trello\n[3] Menú principal'
      : '\n[1] Ver reporte\n[2] Menú principal');
    const choice = await question('> ');
    if (choice === '1') {
      const report = await openReport(execution);
      if (report.opened) success(`Reporte abierto para ${execution.caseIds.length} tests`);
      else log(reportFallbackText());
      continue;
    }
    if (execution.result === 'FAIL' && choice === '2') {
      await registerIncident(execution);
      continue;
    }
    if ((execution.result === 'FAIL' && choice === '3') || (execution.result !== 'FAIL' && choice === '2')) return choice;
    log('\nOpción no válida.');
  }
}
async function processInput(kind, directory, extensions) {
  const selectedFiles = await chooseInputFiles(files(path.join(root, directory), extensions), kind === 'user-story' ? 'Historias disponibles' : 'Archivos disponibles', kind === 'user-story');
  if (selectedFiles.length === 0) return;
  console.log('\nAnalizando información...');
  const importedCatalog = importInputFiles(kind, selectedFiles);
  const catalog = kind === 'user-story' ? loadPersistedCandidateStates(importedCatalog) : importedCatalog;
  check(kind === 'user-story' ? selectedFiles.length === 1 ? 'Historia identificada' : `${selectedFiles.length} historias identificadas` : 'Archivo identificado');
  check(kind === 'user-story' ? 'Criterios de aceptación encontrados' : `${catalog.cases.length} casos encontrados`);
  check('Escenarios de prueba propuestos');
  showScenarios(catalog.cases);
  console.log(scenarioSelectionText(catalog.cases));
  const action = Number(await ui.question('> '));
  if (action === 0) return;
  let approved = [];
  let bulkSelected = false;
  if (action === 1) {
    console.log(`\n${approvalConfirmationText(catalog.cases.length)}\n\n¿Desea continuar?\n\n[S] Sí\n[N] No`);
    if ((await ui.question('> ')).toLowerCase() === 's') {
      approved = catalog.cases.map(approveCandidate);
      bulkSelected = true;
    }
  } else if (action > 1) {
    const index = action - 2;
    const reviewed = catalog.cases[index] ? await reviewCandidate(catalog.cases[index]) : undefined;
    approved = reviewed ? [reviewed] : [];
  }
  for (const entry of approved) saveApproval({ ...catalog, cases: catalog.cases.map((candidate) => candidate.caseId === entry.caseId ? entry : candidate) }, entry);
  if (approved.length === 0) return;
  check(approved.length === 1 ? 'Escenario aprobado por QA' : `${approved.length} escenarios aprobados por QA`);
  if (bulkSelected) {
    console.log(`\nAplicación objetivo: SauceDemo\nEscenarios seleccionados: ${approved.length}\nEstado: Listos para automatización`);
    console.log('\n[1] Generar pruebas automatizadas\n[2] Revisar otro escenario\n[3] Volver al menú principal');
    const next = await ui.question('> ');
    if (next === '1') await generationFlowBatch(approved);
    else if (next === '2') await processInput(kind, directory, extensions);
    return;
  }
  const selected = selectCandidateForAutomation(approved);
  console.log(`\nAplicación objetivo: SauceDemo\nNivel de prioridad: ${friendlyPriority(selected.priority)}\nEstado: Listo para automatización`);
  console.log('\n[1] Generar prueba automatizada\n[2] Revisar otro escenario\n[3] Volver al menú principal');
  const next = await ui.question('> ');
  if (next === '1') await generationFlow(selected);
  else if (next === '2') await processInput(kind, directory, extensions);
}
function strategyMetadata() {
  const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
  const source = fs.readFileSync(strategyFile, 'utf8');
  return catalog.cases.map((entry) => {
    const block = source.match(new RegExp(`['"]${entry.caseId}['"]:\\s*\\{([^}]+)\\}`))?.[1] || '';
    return { ...entry, feature: block.match(/feature:\s*['"]([^'"]+)/)?.[1] || 'other', suites: [...block.matchAll(/['"](smoke|regression|critical)['"]/g)].map((match) => match[1]) };
  });
}
async function existingTests() {
  const cases = strategyMetadata();
  title('CATÁLOGO DE PRUEBAS');
  console.log(`Aplicación: SauceDemo\n\nTotal: ${cases.length}\n\nPor funcionalidad:`);
  for (const feature of ['authentication', 'inventory', 'cart', 'checkout']) console.log(`${feature}: ${cases.filter((entry) => entry.feature === feature).length}`);
  console.log('\nPor conjunto:');
  for (const suite of ['smoke', 'regression', 'critical']) console.log(`${suite}: ${cases.filter((entry) => entry.suites.includes(suite)).length}`);
  console.log('\n[1] Ver Smoke\n[2] Ver Regresión\n[3] Ver Críticas\n[4] Filtrar por funcionalidad\n[0] Volver');
  const choice = await ui.question('> ');
  let selected = [];
  if (choice === '1') selected = cases.filter((entry) => entry.suites.includes('smoke'));
  if (choice === '2') selected = cases.filter((entry) => entry.suites.includes('regression'));
  if (choice === '3') selected = cases.filter((entry) => entry.suites.includes('critical'));
  if (choice === '4') { const feature = await ui.question('Funcionalidad (authentication, inventory, cart, checkout):\n> '); selected = cases.filter((entry) => entry.feature === feature); }
  selected.forEach((entry) => console.log(`- ${entry.title}`));
}
function loadPreparedIncident(io = fs) {
  const file = path.join(root, 'artifacts/incidents/saucedemo-SD-INCIDENT-001.json');
  if (!io.existsSync(file)) throw new Error('La evidencia local de la incidencia no está disponible.');
  return JSON.parse(io.readFileSync(file, 'utf8'));
}
function loadExecutionIncident(execution, io = fs) {
  for (const caseId of execution.caseIds || []) {
    const file = path.join(root, `artifacts/incidents/saucedemo-${caseId}.json`);
    if (!io.existsSync(file) || io.statSync(file).mtimeMs + 1000 < execution.startedAt) continue;
    const incident = JSON.parse(io.readFileSync(file, 'utf8'));
    if (incident.simulated && incident.context?.marker === 'SIMULATED_DEMO_FAILURE') return incident;
  }
  throw new Error('No se encontró una incidencia controlada correspondiente a esta ejecución.');
}
function friendlyClassification(value) {
  return ({ PRODUCT_DEFECT: 'Defecto funcional', AUTOMATION_DEFECT: 'Defecto de automatización', TEST_DATA: 'Datos de prueba', ENVIRONMENT: 'Entorno', UNKNOWN: 'Sin determinar' })[value] || 'Sin determinar';
}
function sanitizeIncidentMessage(error, environment = process.env) {
  let message = error instanceof Error ? error.message : String(error);
  for (const name of ['TRELLO_API_KEY', 'TRELLO_API_TOKEN']) {
    const secret = environment[name];
    if (secret) message = message.split(secret).join('[REDACTED]');
  }
  return message.replace(/([?&](?:key|token)=)[^&\s]+/gi, '$1[REDACTED]').replace(/\u001b\[[0-9;]*m/g, '').trim();
}
function parseTrelloRegistration(output) {
  return {
    url: output.match(/Card URL:\s*(https:\/\/trello\.com\/\S+)/)?.[1],
    boardFound: output.includes('Board name: TestGenerator - Demo QA'),
    listFound: output.includes('List name: Detected'),
    markerVerified: output.includes('Marker verified: YES'),
    cardVerified: output.includes('Card verified: YES'),
  };
}
async function incidentFlow(dependencies = {}) {
  const question = dependencies.question || ((prompt) => ui.question(prompt));
  const log = dependencies.log || console.log;
  const success = dependencies.success || check;
  const heading = dependencies.title || title;
  const prepare = dependencies.prepare || (() => { runDemoIncidentLocally(); return loadPreparedIncident(); });
  const register = dependencies.register || ((preparedIncident) => run('submit:trello-incident', [`artifacts/incidents/${preparedIncident.applicationId}-${preparedIncident.caseId}.json`]));
  const openCard = dependencies.openCard || openUrl;
  log('\nEjecutando escenario controlado...');
  const incident = await prepare();
  const classification = friendlyClassification(incident.classification?.classification);
  log(`\nSe ha detectado una incidencia.\n\nClasificación:\n${classification}\n\nEstado:\nRegistrando evidencia...`);
  success('Evidencia recopilada'); success('Incidencia clasificada');
  heading('INCIDENCIA PREPARADA');
  log(`Clasificación:\n${classification}\n\nCaso:\n${incident.caseId}\n\nEvidencia:\nDisponible`);
  const directRegistration = dependencies.initialAction === 'register';
  if (!directRegistration) log('\n¿Qué desea hacer?\n\n[1] Registrar incidencia en Trello\n[2] Guardar solo evidencia local\n[3] Cancelar');
  const choice = directRegistration ? '1' : await question('> ');
  if (choice === '2') { log('\nLa evidencia local se conserva.'); return { status: 'LOCAL_ONLY', incident }; }
  if (choice !== '1') { log('\nRegistro cancelado. La evidencia local se conserva.'); return { status: 'CANCELLED', incident }; }
  try {
    const registration = parseTrelloRegistration(await register(incident));
    if (!registration.url || !registration.boardFound || !registration.listFound || !registration.markerVerified || !registration.cardVerified) throw new Error('Trello no devolvió una confirmación verificable.');
    success('Incidencia registrada en Trello');
    log(`\nTarjeta:\n${registration.url}\n\nLista:\nDetected`);
    log('\n[1] Abrir tarjeta\n[2] Volver al menú');
    if (await question('> ') === '1' && !(await openCard(registration.url))) log('\nNo fue posible abrir la tarjeta automáticamente.');
    return { status: 'TRELLO_CREATED', incident, ...registration };
  } catch (error) {
    log(`\nNo fue posible registrar la incidencia en Trello.\n\nMotivo:\n${sanitizeIncidentMessage(error)}\n\nLa evidencia local se conserva.`);
    return { status: 'TRELLO_FAILED', incident };
  }
}
function runDemoIncidentLocally() {
  const result = spawnSync(process.execPath, ['tools/demo/demo-cli.cjs', 'sauce-incident'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if ((result.status ?? 1) !== 0) throw new Error((result.stderr || result.stdout || 'Synthetic incident failed').trim());
  return `${result.stdout || ''}${result.stderr || ''}`;
}
async function openUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || (parsed.hostname !== 'trello.com' && !parsed.hostname.endsWith('.trello.com'))) return false;
    await launchDefaultBrowser(url);
    return true;
  } catch { return false; }
}
async function demoMenu() {
  console.log('\n[1] Flujo exitoso\n[2] Flujo con incidencia\n[3] Demo completa\n[0] Volver');
  const choice = await ui.question('> ');
  if (choice === '1') await executeCase('SD-AUTH-001');
  else if (choice === '2') await incidentFlow();
  else if (choice === '3') await processInput('user-story', 'inputs/user-story', ['.md', '.txt']);
}
function personalization() {
  title('CÓMO SE ADAPTA TESTGENERATOR');
  console.log('TestGenerator puede adaptarse en tres puntos:\n\n1. ENTRADAS\n   Excel\n   JSON\n   Historias de Usuario\n\n2. APLICACIÓN\n   Configuración\n   Componentes de pantalla\n   Datos\n   Estrategia de pruebas\n\n3. SALIDAS\n   Reportes\n   Gestión de incidencias\n\nEl núcleo, controles de calidad y gobierno se reutilizan.');
}
async function main() {
  console.log(`\n${line}\n                 TESTGENERATOR\n           Acelerador de Pruebas QA\n${line}\n\nTransformamos requisitos funcionales en pruebas\nautomatizadas trazables y controladas.`);
  while (true) {
    console.log('\n¿Qué desea procesar?\n\n[1] Historia de Usuario\n[2] Archivo Excel\n[3] Archivo JSON\n[4] Ver pruebas existentes\n[5] Ejecutar una demostración\n[P] ¿Cómo se adapta TestGenerator a otro proyecto?\n[0] Salir');
    const choice = (await ui.question('\nSeleccione una opción:\n> ')).toLowerCase();
    try {
      if (choice === '0') break;
      if (choice === '1') await processInput('user-story', 'inputs/user-story', ['.md', '.txt']);
      else if (choice === '2') await processInput('excel', 'inputs/excel', ['.xlsx', '.xls']);
      else if (choice === '3') await processInput('json', 'inputs/json', ['.json']);
      else if (choice === '4') await existingTests();
      else if (choice === '5') await demoMenu();
      else if (choice === 'p') personalization();
      else console.log('\nSeleccione una opción válida.');
    } catch (error) {
      console.log('\nNo fue posible completar la operación. Revise la información seleccionada o contacte al equipo QA Automation.');
      if ((await ui.question('[V] Ver detalle técnico  [Enter] Continuar\n> ')).toLowerCase() === 'v') console.log(error instanceof Error ? error.message : String(error));
    }
  }
  console.log('\nSesión finalizada.');
  ui.close();
}

if (require.main === module) {
  main().catch((error) => { console.error('No fue posible iniciar TestGenerator.'); if (process.env.TESTGENERATOR_DEBUG === '1') console.error(error); process.exitCode = 1; ui.close(); });
}

module.exports = { approvalConfirmationText, approveCandidate, automationExecutionSelectionText, automationStatuses, batchExecutionMenu, behaviorKind, buildGenerationHandoff, buildReuseRecord, canExecuteAutomation, canExecuteReuse, changeCandidatePriority, codexClipboardInstruction, containsSecret, copyToClipboard, evaluateAutomationCoverage, executionMenu, findEquivalentAutomation, friendlyClassification, friendlyPriority, friendlyStatus, generationPreparedMenu, hydrateCandidateStates, incidentFlow, loadExecutionIncident, loadPreparedIncident, loadReuseRecord, openLatestReport, openUrl, originalCriterion, parseTrelloRegistration, preparationState, reportContainsResult, reportFallbackText, reusedAutomationMenu, sanitizeIncidentMessage, scenarioLabel, scenarioSelectionText, scenarioView, selectCandidateForAutomation, sourceContextText, specTracesCase, technicalSummary, validateLatestReport, validateReusedAutomation, writeReuseRecord };
