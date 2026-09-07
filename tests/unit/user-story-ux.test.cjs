const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  approvalConfirmationText,
  approveCandidate,
  automationExecutionSelectionText,
  batchExecutionMenu,
  buildReuseRecord,
  buildGenerationHandoff,
  canExecuteAutomation,
  canExecuteReuse,
  changeCandidatePriority,
  codexClipboardInstruction,
  containsSecret,
  copyToClipboard,
  evaluateAutomationCoverage,
  executionMenu,
  findEquivalentAutomation,
  friendlyPriority,
  generationPreparedMenu,
  hydrateCandidateStates,
  incidentFlow,
  loadExecutionIncident,
  openLatestReport,
  preparationState,
  reportFallbackText,
  scenarioSelectionText,
  scenarioView,
  sanitizeIncidentMessage,
  sourceContextText,
  specTracesCase,
  technicalSummary,
  validateLatestReport,
} = require('../../tools/ux/testgenerator.cjs');

const candidates = [
  'El usuario puede eliminar un producto del carrito.',
  'El producto eliminado deja de mostrarse en el carrito.',
  'El contador del carrito se actualiza después de eliminar el producto.',
].map((criterion, index) => ({
  caseId: `US-SD-CART-REMOVE-001-AC-${index + 1}`,
  title: `Candidate ${index + 1}`,
  priority: 'unreviewed',
  reviewStatus: 'REQUIRES_QA_REVIEW',
  expectedResults: [criterion],
  steps: [{ order: 1, action: criterion, expectedResult: criterion }],
  source: { type: 'USER_STORY', file: 'remove-cart-item.md', sourceId: 'US-SD-CART-REMOVE-001' },
}));

test('separates undefined priority from pending QA status', () => {
  const view = scenarioView(candidates[0]);
  assert.equal(view.priority, 'Por definir');
  assert.equal(view.status, 'Pendiente de revisión QA');
  assert.notEqual(view.priority, view.status);
  assert.equal(friendlyPriority('unreviewed'), 'Por definir');
});

test('creates deterministic QA titles while preserving each original criterion', () => {
  assert.deepEqual(candidates.map((candidate) => scenarioView(candidate).title), [
    'Eliminar un producto agregado al carrito',
    'Verificar que el producto eliminado ya no aparezca en el carrito',
    'Verificar la actualización del contador del carrito',
  ]);
  candidates.forEach((candidate) => assert.equal(scenarioView(candidate).criterion, candidate.expectedResults[0]));
});

test('supports individual approval and explicit priority changes', () => {
  const prioritized = changeCandidatePriority(candidates[0], 'high');
  assert.equal(scenarioView(prioritized).priority, 'Alta');
  assert.equal(scenarioView(approveCandidate(prioritized)).status, 'Aprobado');
  assert.equal(candidates[0].reviewStatus, 'REQUIRES_QA_REVIEW');
});

test('requires an explicit bulk-approval confirmation message', () => {
  assert.equal(approvalConfirmationText(3), 'Se aprobarán 3 escenarios para automatización.');
});

test('shows bulk scenario selection as the first option', () => {
  const selection = scenarioSelectionText(candidates);
  assert.match(selection, /\[1\] Todos los escenarios/);
  assert.match(selection, /\[2\] Eliminar un producto agregado al carrito/);
  assert.match(selection, /\[3\] Verificar que el producto eliminado ya no aparezca en el carrito/);
  assert.match(selection, /\[4\] Verificar la actualización del contador del carrito/);
  assert.match(selection, /\[0\] Volver/);
});

test('offers all generated tests first and each test as an individual execution option', () => {
  const selection = automationExecutionSelectionText(candidates);
  assert.match(selection, /\[1\] Todos los tests seleccionados \(3\)/);
  assert.match(selection, /\[2\] \[US-SD-CART-REMOVE-001-AC-1\] Eliminar un producto agregado al carrito/);
  assert.match(selection, /\[3\] \[US-SD-CART-REMOVE-001-AC-2\] Verificar que el producto eliminado ya no aparezca en el carrito/);
  assert.match(selection, /\[4\] \[US-SD-CART-REMOVE-001-AC-3\] Verificar la actualización del contador del carrito/);
  assert.match(selection, /\[D\] Ver detalles/);
  assert.match(selection, /\[0\] Volver/);
});

test('keeps preparation distinct from generation and blocks execution', () => {
  assert.deepEqual(preparationState(0, 0, false), { prepared: true, generated: false, automationStatus: 'PENDING_GENERATION', executionEnabled: false });
  assert.equal(canExecuteAutomation({ spec: undefined, catalogTraced: false, componentsExist: true, qualityValidated: false }), false);
});

test('builds a complete secret-free one-case Codex handoff', () => {
  const selected = changeCandidatePriority(approveCandidate(candidates[0]), 'high');
  const handoff = buildGenerationHandoff({
    selected,
    scenario: scenarioView(selected),
    history: '# US-SD-CART-REMOVE-001 - Eliminar producto\n\nComo cliente quiero corregir mi carrito.',
    components: ['src/apps/saucedemo/pages/cart.page.ts', 'src/apps/saucedemo/fixtures/saucedemo.fixture.ts'],
    generationPlan: 'Reuse CartPage and the SauceDemo fixture.',
    agentsRules: 'Do not modify core. Preserve POM.',
  });
  for (const expected of ['ONE CASE AT A TIME', 'Application profile: saucedemo', 'El usuario puede eliminar un producto del carrito.', 'QA priority: Alta', 'cart.page.ts', 'playwright-test-implementation', 'Do not modify src/core']) assert.match(handoff, new RegExp(expected));
  assert.equal(containsSecret(handoff), false);
});

test('builds handoff source context from an Excel case', () => {
  const context = sourceContextText({
    caseId: 'XL-SD-INCIDENT-001',
    title: 'Controlled missing button failure',
    description: 'A controlled Excel case used to demonstrate incident evidence.',
    preconditions: ['The standard user is authenticated'],
    inputData: { product: 'Sauce Labs Backpack', marker: 'SIMULATED_DEMO_FAILURE' },
    steps: [{ order: 1, action: 'Click a missing checkout button', expectedResult: 'The framework captures the controlled failure' }],
    expectedResults: ['SIMULATED_DEMO_FAILURE evidence is available'],
    priority: 'high',
    type: 'synthetic-failure',
    tags: ['incident', 'simulated', 'excel'],
    automationStatus: 'candidate',
    source: { type: 'EXCEL', file: 'saucedemo-cases.xlsx', sourceId: 'XL-SD-INCIDENT-001', row: 5, originalReference: 'Excel demo' },
  });
  assert.match(context, /Source type: EXCEL/);
  assert.match(context, /Source row: 5/);
  assert.match(context, /Controlled missing button failure/);
  assert.match(context, /SIMULATED_DEMO_FAILURE evidence is available/);
  assert.match(context, /Click a missing checkout button => The framework captures the controlled failure/);
});

test('enables execution only after implementation and quality validation', () => {
  const base = { spec: 'tests/e2e/saucedemo/remove.spec.ts', catalogTraced: true, componentsExist: true };
  assert.equal(canExecuteAutomation({ ...base, qualityValidated: false }), false);
  assert.equal(canExecuteAutomation({ ...base, qualityValidated: true }), true);
});

test('restores approved priority by stable candidate identity after reimport', () => {
  const approvals = {
    'US-SD-CART-REMOVE-001-AC-1': {
      caseId: 'US-SD-CART-REMOVE-001-AC-1', status: 'APPROVED', priority: 'high', approvedAt: '2026-09-06T00:00:00.000Z',
      source: candidates[0].source,
    },
  };
  const hydrated = hydrateCandidateStates(candidates, approvals, []);
  assert.equal(scenarioView(hydrated[0]).priority, 'Alta');
  assert.equal(scenarioView(hydrated[0]).status, 'Aprobado');
  assert.equal(scenarioView(hydrated[1]).status, 'Pendiente de revisión QA');
  assert.equal(scenarioView(hydrated[2]).status, 'Pendiente de revisión QA');
});

test('uses matching catalog state for an older approval without persisted priority', () => {
  const approvals = { 'US-SD-CART-REMOVE-001-AC-1': { status: 'APPROVED', source: candidates[0].source } };
  const production = [{ ...candidates[0], priority: 'high', reviewStatus: 'APPROVED', automationStatus: 'automated' }];
  const hydrated = hydrateCandidateStates(candidates, approvals, production);
  assert.equal(scenarioView(hydrated[0]).priority, 'Alta');
  assert.equal(scenarioView(hydrated[0]).status, 'Aprobado');
});

test('does not apply persisted state from a different source identity', () => {
  const approvals = { 'US-SD-CART-REMOVE-001-AC-1': { status: 'APPROVED', priority: 'high', source: { ...candidates[0].source, file: 'different.md' } } };
  const hydrated = hydrateCandidateStates(candidates, approvals, []);
  hydrated.forEach((candidate) => assert.equal(scenarioView(candidate).status, 'Pendiente de revisión QA'));
});

function reportIo({ html = true, json = true, modifiedAt = 2000, caseId = 'CASE-1', status = 'passed' } = {}) {
  return {
    existsSync: (file) => file.endsWith('index.html') ? html : json,
    statSync: () => ({ mtimeMs: modifiedAt }),
    readFileSync: () => JSON.stringify({ suites: [{ title: `[${caseId}] generated case`, tests: [{ results: [{ status }] }] }] }),
  };
}

test('opens the current execution report through the injected browser launcher', async () => {
  let openedPath;
  const execution = { caseId: 'CASE-1', startedAt: 1000, result: 'PASS' };
  const result = await openLatestReport(execution, { io: reportIo(), launch: async (file) => { openedPath = file; } });
  assert.equal(result.opened, true);
  assert.match(openedPath, /playwright-report[\\/]index\.html$/);
  assert.equal(result.validation.caseId, 'CASE-1');
});

test('uses a friendly fallback when the report does not exist or cannot open', async () => {
  const execution = { caseId: 'CASE-1', startedAt: 1000, result: 'PASS' };
  assert.equal((await openLatestReport(execution, { io: reportIo({ html: false }), launch: async () => {} })).opened, false);
  assert.equal((await openLatestReport(execution, { io: reportIo(), launch: async () => { throw new Error('blocked'); } })).opened, false);
});

test('shows the friendly fallback and keeps the execution menu usable', async () => {
  const choices = ['1', '4'];
  const output = [];
  const action = await executionMenu(
    { caseId: 'CASE-1', startedAt: 1000, result: 'PASS' },
    {
      question: async () => choices.shift(),
      openReport: async () => ({ opened: false }),
      log: (message) => output.push(message),
      success: (message) => output.push(message),
    },
  );
  assert.equal(action, '4');
  assert.equal(output.filter((message) => message.includes('[1] Ver reporte')).length, 2);
  assert.ok(output.includes(reportFallbackText()));
  assert.match(output.join('\n'), /No fue posible abrir el reporte automáticamente[\s\S]*Ruta:\nplaywright-report\/index\.html[\s\S]*Comando alternativo:\nnpx playwright show-report/);
});

test('rejects stale or mismatched reports instead of opening an old execution', () => {
  const execution = { caseId: 'CASE-1', startedAt: 4001, result: 'PASS' };
  assert.equal(validateLatestReport(execution, reportIo({ modifiedAt: 2000 })).reason, 'stale');
  assert.equal(validateLatestReport({ ...execution, startedAt: 1000 }, reportIo({ caseId: 'OTHER' })).reason, 'mismatch');
});

test('validates the PASS or FAIL result for the latest case execution', () => {
  const current = { caseId: 'CASE-1', startedAt: 1000 };
  assert.equal(validateLatestReport({ ...current, result: 'PASS' }, reportIo({ status: 'passed' })).valid, true);
  assert.equal(validateLatestReport({ ...current, result: 'FAIL' }, reportIo({ status: 'failed' })).valid, true);
  assert.equal(validateLatestReport({ ...current, result: 'FAIL' }, reportIo({ status: 'passed' })).reason, 'mismatch');
});

test('validates a current batch report independently of which case failed', () => {
  const execution = { caseIds: ['CASE-1', 'CASE-2'], startedAt: 1000, result: 'FAIL' };
  const io = {
    ...reportIo({ caseId: 'CASE-1', status: 'passed' }),
    readFileSync: () => JSON.stringify({ suites: [
      { title: '[CASE-1] first case', tests: [{ results: [{ status: 'passed' }] }] },
      { title: '[CASE-2] controlled failure', tests: [{ results: [{ status: 'failed' }] }] },
    ] }),
  };
  assert.equal(validateLatestReport(execution, io).valid, true);
});

test('keeps the batch execution menu open after opening its report', async () => {
  const choices = ['1', '3'];
  const output = [];
  const action = await batchExecutionMenu(
    { caseIds: ['CASE-1', 'CASE-2'], startedAt: 1000, result: 'FAIL' },
    {
      question: async () => choices.shift(),
      openReport: async () => ({ opened: true }),
      log: (message) => output.push(message),
      success: (message) => output.push(message),
    },
  );
  assert.equal(action, '3');
  assert.equal(output.filter((message) => message.includes('[1] Ver reporte')).length, 2);
  assert.ok(output.includes('Reporte abierto para 2 tests'));
});

test('offers direct Trello registration after a failed batch and keeps the menu usable', async () => {
  const choices = ['2', '3'];
  const output = [];
  let registrations = 0;
  await batchExecutionMenu(
    { caseIds: ['CASE-1'], startedAt: 1000, result: 'FAIL' },
    {
      question: async () => choices.shift(),
      registerIncident: async () => { registrations += 1; },
      log: (message) => output.push(message),
    },
  );
  assert.equal(registrations, 1);
  assert.equal(output.filter((message) => message.includes('[2] Registrar incidencia en Trello')).length, 2);
});

test('loads the controlled incident created by the current failed execution', () => {
  const incident = { applicationId: 'saucedemo', caseId: 'CASE-2', simulated: true, context: { marker: 'SIMULATED_DEMO_FAILURE' } };
  const io = {
    existsSync: (file) => file.endsWith('saucedemo-CASE-2.json'),
    statSync: () => ({ mtimeMs: 2000 }),
    readFileSync: () => JSON.stringify(incident),
  };
  assert.equal(loadExecutionIncident({ caseIds: ['CASE-1', 'CASE-2'], startedAt: 1000 }, io).caseId, 'CASE-2');
});

const addProductCandidate = {
  ...candidates[0],
  caseId: 'US-SD-CART-001-AC-1',
  title: 'Shopping cart - criterion 1',
  description: 'add products to my cart',
  steps: [{ order: 1, action: 'Product can be added to cart.', expectedResult: 'Product can be added to cart.' }],
  expectedResults: ['Product can be added to cart.'],
  reviewStatus: 'APPROVED',
};
const existingCartCase = {
  caseId: 'SD-CART-001', title: 'Add product to cart', description: 'A selected product updates badge and cart content.',
  preconditions: ['The standard user is authenticated'], inputData: { product: 'Sauce Labs Backpack' },
  steps: [{ order: 1, action: 'Add the product and open cart', expectedResult: 'Badge and cart show the product' }],
  expectedResults: ['Cart contains exactly the selected product'], priority: 'critical', type: 'functional', tags: ['smoke', 'cart'], automationStatus: 'automated',
};
const cartSpecSource = "test('@cart [SD-CART-001] add product', async () => { test.info().annotations.push({ type: 'caseId', description: 'SD-CART-001' }); await inventoryPage.addProduct(selectedProduct); await cartPage.expectProduct(selectedProduct); });";

test('keeps the prepared handoff hidden while writing only the concise Codex prompt', async () => {
  const output = [];
  const handoff = { output: 'artifacts/generation-handoff/CASE-1.md', content: '# Handoff\n\nNeeded context\n\n## Permanent project rules\nFULL AGENTS CONTENT' };
  const choices = ['1', '3'];
  await generationPreparedMenu(addProductCandidate, Array(6).fill('component.ts'), 'EXISTING SIMILAR TESTS: tests/e2e/saucedemo/cart.spec.ts', handoff, {
    question: async () => choices.shift(), log: (message) => output.push(message),
  });
  const prompt = fs.readFileSync('artifacts/generation-handoff/CASE-1.prompt.txt', 'utf8');
  assert.doesNotMatch(output.join('\n'), /FULL AGENTS CONTENT|Needed context/);
  assert.match(output.join('\n'), /Handoff preparado:\nSí[\s\S]*Instrucción preparada para Codex[\s\S]*Prompt:\nartifacts[\\/]generation-handoff[\\/]CASE-1\.prompt\.txt[\s\S]*Siguiente paso:/);
  assert.match(prompt, /Needed context/);
  assert.doesNotMatch(prompt, /FULL AGENTS CONTENT|Permanent project rules/);
  assert.doesNotMatch(codexClipboardInstruction(handoff), /FULL AGENTS CONTENT/);
});

test('shows only prompt and handoff paths when preparing Codex instruction', async () => {
  const output = [];
  const choices = ['1', '3'];
  const handoff = { output: 'artifacts/generation-handoff/CASE-1.md', content: 'SECRET TECHNICAL BODY' };
  await generationPreparedMenu(addProductCandidate, [], '', handoff, {
    question: async () => choices.shift(), log: (message) => output.push(message),
  });
  assert.match(output.join('\n'), /Prompt:\nartifacts[\\/]generation-handoff[\\/]CASE-1\.prompt\.txt/);
  assert.match(output.join('\n'), /Handoff:\nartifacts[\\/]generation-handoff[\\/]CASE-1\.md/);
  assert.match(output.join('\n'), /Abra el archivo prompt y pegue su contenido/);
  assert.doesNotMatch(output.join('\n'), /SECRET TECHNICAL BODY/);
});

test('limits clipboard copy attempts so the guided menu does not hang', () => {
  let options;
  const copied = copyToClipboard('Codex instruction', {
    spawnSync: (_command, _args, copyOptions) => {
      options = copyOptions;
      return { status: 1 };
    },
  });
  assert.equal(copied, false);
  assert.equal(options.timeout, 3000);
});

test('renders a brief technical summary with only the allowed fields', () => {
  const summary = technicalSummary(addProductCandidate, Array(6).fill('component.ts'), [
    'EXISTING SIMILAR TESTS: tests/e2e/saucedemo/cart.spec.ts',
    'FILES EXPECTED TO CHANGE: cases/saucedemo/catalog.json',
    'QUALITY GATES REQUIRED: typecheck, narrow Playwright case',
  ].join('\n'));
  for (const label of ['Case:', 'Application:', 'QA status:', 'Priority:', 'Reusable components:', 'Similar tests:', 'Expected files:', 'Quality gates:']) assert.match(summary, new RegExp(label));
  assert.equal(summary.split('\n').length, 8);
  assert.doesNotMatch(summary, /AGENTS|Permanent project rules|Implementation procedure/);
});

test('classifies the existing cart test as equivalent and records reuse without a duplicate spec', () => {
  const equivalence = evaluateAutomationCoverage(addProductCandidate, existingCartCase, cartSpecSource);
  assert.equal(equivalence.equivalent, true);
  const match = findEquivalentAutomation(addProductCandidate, {
    catalog: { cases: [existingCartCase] }, findSpec: () => 'tests/e2e/saucedemo/cart.spec.ts', readFileSync: () => cartSpecSource,
  });
  assert.equal(match.existingCaseId, 'SD-CART-001');
  const record = buildReuseRecord(addProductCandidate, match, Array(6).fill('component.ts'));
  assert.equal(record.automationStatus, 'REUSED_EXISTING');
  assert.equal(record.filesCreated, 0);
  assert.equal(record.filesModified, 0);
  assert.equal(record.componentsCreated, 0);
});

test('requires exact case traceability and rejects a longer caseId containing the same text', () => {
  assert.equal(specTracesCase(cartSpecSource, 'SD-CART-001'), true);
  const otherSpec = "test('[US-SD-CART-001-AC-2]', () => { test.info().annotations.push({ type: 'caseId', description: 'US-SD-CART-001-AC-2' }); });";
  assert.equal(specTracesCase(otherSpec, 'SD-CART-001'), false);
});

test('keeps generation pending for a similar cart test with different behavior', () => {
  const removeCandidate = {
    ...addProductCandidate,
    caseId: 'REMOVE-1',
    steps: [{ order: 1, action: 'Remove the selected product from the cart', expectedResult: 'The product is absent from the cart' }],
    expectedResults: ['The product is absent from the cart'],
  };
  assert.equal(evaluateAutomationCoverage(removeCandidate, existingCartCase, cartSpecSource).equivalent, false);
  assert.equal(findEquivalentAutomation(removeCandidate, {
    catalog: { cases: [existingCartCase] }, findSpec: () => 'tests/e2e/saucedemo/cart.spec.ts', readFileSync: () => cartSpecSource,
  }), undefined);
});

test('enables reused automation only after successful validation', () => {
  const match = { existingCaseId: 'SD-CART-001', spec: 'tests/e2e/saucedemo/cart.spec.ts', equivalence: { equivalent: true } };
  assert.equal(canExecuteReuse(buildReuseRecord(addProductCandidate, match, [], 'PENDING')), false);
  assert.equal(canExecuteReuse(buildReuseRecord(addProductCandidate, match, [], 'SUPERADA')), true);
});

const simulatedIncident = {
  applicationId: 'saucedemo', caseId: 'SD-INCIDENT-001', title: 'Controlled failure', simulated: true,
  classification: { classification: 'PRODUCT_DEFECT', reason: 'Controlled simulation' },
  evidence: [{ kind: 'trace', path: 'test-results/trace.zip' }], context: { marker: 'SIMULATED_DEMO_FAILURE' },
};

function incidentDependencies(choices, overrides = {}) {
  const output = [];
  return {
    output,
    dependencies: {
      question: async () => choices.shift(),
      log: (message) => output.push(message),
      success: (message) => output.push(`SUCCESS: ${message}`),
      title: (message) => output.push(`TITLE: ${message}`),
      prepare: async () => simulatedIncident,
      ...overrides,
    },
  };
}

test('incident UX preserves local evidence without calling Trello', async () => {
  let registrations = 0;
  const setup = incidentDependencies(['2'], { register: async () => { registrations += 1; } });
  const result = await incidentFlow(setup.dependencies);
  assert.equal(result.status, 'LOCAL_ONLY');
  assert.equal(registrations, 0);
  assert.match(setup.output.join('\n'), /INCIDENCIA PREPARADA[\s\S]*La evidencia local se conserva/);
});

test('incident UX explicitly registers in Trello, shows its URL, and can open it', async () => {
  let opened = '';
  const setup = incidentDependencies(['1', '1'], {
    register: async () => 'Board name: Demo-Playwright\nList name: Bugs\nMarker verified: YES\nCard verified: YES\nAttachment screenshot: LINKED\nAttachment video: LINKED\nCard URL: https://trello.com/c/example',
    openCard: async (url) => { opened = url; return true; },
  });
  const result = await incidentFlow(setup.dependencies);
  assert.equal(result.status, 'TRELLO_CREATED');
  assert.equal(result.boardFound, true);
  assert.equal(result.listFound, true);
  assert.deepEqual(result.attachments, [{ kind: 'screenshot', status: 'LINKED' }, { kind: 'video', status: 'LINKED' }]);
  assert.equal(opened, 'https://trello.com/c/example');
  assert.match(setup.output.join('\n'), /Incidencia registrada en Trello[\s\S]*https:\/\/trello.com\/c\/example[\s\S]*Lista:\nBugs[\s\S]*screenshot: LINKED[\s\S]*video: LINKED/);
});

test('incident UX reports a sanitized Trello failure and preserves local evidence', async () => {
  const secret = 'private-trello-token';
  const setup = incidentDependencies(['1'], { register: async () => { throw new Error(`Request failed token=${secret}`); } });
  const previous = process.env.TRELLO_API_TOKEN;
  process.env.TRELLO_API_TOKEN = secret;
  try {
    const result = await incidentFlow(setup.dependencies);
    assert.equal(result.status, 'TRELLO_FAILED');
    assert.match(setup.output.join('\n'), /No fue posible registrar[\s\S]*La evidencia local se conserva/);
    assert.doesNotMatch(setup.output.join('\n'), new RegExp(secret));
  } finally {
    if (previous === undefined) delete process.env.TRELLO_API_TOKEN; else process.env.TRELLO_API_TOKEN = previous;
  }
  assert.doesNotMatch(sanitizeIncidentMessage(new Error(`key=${secret}`), { TRELLO_API_KEY: secret }), new RegExp(secret));
});

test('incident UX cancellation never creates a Trello card', async () => {
  let registrations = 0;
  const setup = incidentDependencies(['3'], { register: async () => { registrations += 1; } });
  const result = await incidentFlow(setup.dependencies);
  assert.equal(result.status, 'CANCELLED');
  assert.equal(registrations, 0);
});
