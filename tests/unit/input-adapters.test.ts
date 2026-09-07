import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';

import { ExcelInputAdapter } from '../../src/input-adapters/excel/excel-input.adapter';
import { JsonInputAdapter } from '../../src/input-adapters/json/json-input.adapter';
import { UserStoryInputAdapter } from '../../src/input-adapters/user-story/user-story-input.adapter';

const baseCase = (caseId = 'SD-CART-001') => ({
  caseId, title: 'Add product to cart', description: 'Cart behavior', preconditions: ['User is signed in'],
  inputData: { product: 'Sauce Labs Backpack' }, steps: [{ order: 1, action: 'Add product', expectedResult: 'Product is added' }],
  expectedResults: ['Cart badge is updated'], priority: 'high', type: 'functional', tags: ['cart'], automationStatus: 'candidate',
});

function excelBuffer(headers = ['Scenario', 'Case ID', 'Test Case', 'Description', 'Precondition', 'Input Data', 'Test Steps', 'Expected Result', 'Priority', 'Type', 'Tags', 'Automation Status']): Buffer {
  const values: Record<string, string> = {
    Scenario: 'Shopping cart', 'Case ID': 'SD-CART-001', 'Test Case': 'Add product to cart', Description: 'Cart behavior',
    Precondition: 'User is signed in', 'Input Data': '{"product":"Sauce Labs Backpack"}', 'Test Steps': 'Add product => Product is added',
    'Expected Result': 'Cart badge is updated', Priority: 'high', Type: 'functional', Tags: 'cart;smoke', 'Automation Status': 'candidate',
  };
  const sheet = XLSX.utils.aoa_to_sheet([headers, headers.map((header) => values[header] ?? '')]);
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Cases');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

test('Excel adapter normalizes a valid workbook with source row traceability', () => {
  const adapter = new ExcelInputAdapter(); const parsed = adapter.parse({ fileName: 'cases.xlsx', content: excelBuffer() });
  const catalog = adapter.normalize(parsed, { fileName: 'cases.xlsx', applicationId: 'saucedemo' });
  assert.equal(catalog.cases[0]?.source?.row, 2); assert.equal(catalog.cases[0]?.source?.type, 'EXCEL');
});
test('Excel adapter recognizes common column aliases', () => {
  const adapter = new ExcelInputAdapter(); const catalog = adapter.normalize(adapter.parse({ fileName: 'cases.xlsx', content: excelBuffer() }), { fileName: 'cases.xlsx', applicationId: 'saucedemo' });
  assert.equal(catalog.cases[0]?.caseId, 'SD-CART-001');
});
test('Excel adapter reports a missing required column clearly', () => {
  const adapter = new ExcelInputAdapter(); assert.throws(() => adapter.parse({ fileName: 'cases.xlsx', content: excelBuffer(['Case ID']) }), /row 1, field title/);
});

test('JSON adapter accepts one case', () => {
  const adapter = new JsonInputAdapter(); const value = { applicationId: 'saucedemo', ...baseCase() };
  assert.equal(adapter.normalize(adapter.parse({ fileName: 'case.json', content: JSON.stringify(value) }), { fileName: 'case.json' }).cases.length, 1);
});
test('JSON adapter accepts an array of cases', () => {
  const adapter = new JsonInputAdapter(); const parsed = adapter.parse({ fileName: 'cases.json', content: JSON.stringify([baseCase()]) });
  assert.equal(adapter.normalize(parsed, { fileName: 'cases.json', applicationId: 'saucedemo' }).cases.length, 1);
});
test('JSON adapter accepts an object with cases', () => {
  const adapter = new JsonInputAdapter(); const parsed = adapter.parse({ fileName: 'cases.json', content: JSON.stringify({ applicationId: 'saucedemo', cases: [baseCase()] }) });
  assert.equal(adapter.normalize(parsed, { fileName: 'cases.json' }).applicationId, 'saucedemo');
});
test('JSON adapter rejects invalid JSON', () => {
  assert.throws(() => new JsonInputAdapter().parse({ fileName: 'bad.json', content: '{bad' }), /Invalid JSON/);
});
test('normalized input rejects duplicate case IDs', () => {
  const adapter = new JsonInputAdapter(); const parsed = adapter.parse({ fileName: 'cases.json', content: JSON.stringify([baseCase(), baseCase()]) });
  assert.throws(() => adapter.normalize(parsed, { fileName: 'cases.json', applicationId: 'saucedemo' }), /caseId must be unique/);
});

const englishStory = '# US-001 - Shopping cart\n\nAs a customer\nI want to add products\nSo that I can buy them\n\n## Acceptance Criteria\n- Product can be added.\n- Cart counter is updated.';
const spanishStory = '# US-002 - Carrito\n\nComo cliente\nquiero agregar productos\npara comprarlos después\n\nCriterios de aceptación:\n- El producto aparece en el carrito.';
test('User Story adapter parses English format and acceptance criteria', () => {
  const adapter = new UserStoryInputAdapter(); const catalog = adapter.normalize(adapter.parse({ fileName: 'story.md', content: englishStory }), { fileName: 'story.md', applicationId: 'saucedemo' });
  assert.equal(catalog.cases.length, 2); assert.equal(catalog.cases[0]?.source?.sourceId, 'US-001');
});
test('User Story adapter parses Spanish format', () => {
  const adapter = new UserStoryInputAdapter(); const catalog = adapter.normalize(adapter.parse({ fileName: 'story.md', content: spanishStory }), { fileName: 'story.md', applicationId: 'saucedemo' });
  assert.equal(catalog.cases.length, 1); assert.equal(catalog.cases[0]?.inputData.role, 'cliente');
});
test('User Story adapter warns and invents no candidate for missing criteria', () => {
  const adapter = new UserStoryInputAdapter(); const catalog = adapter.normalize(adapter.parse({ fileName: 'story.md', content: '# US-003 - Incomplete\nAs a user' }), { fileName: 'story.md', applicationId: 'saucedemo' });
  assert.equal(catalog.cases.length, 0); assert.match(catalog.warnings.join(' '), /Acceptance criteria are missing/);
});
test('every User Story candidate requires QA review', () => {
  const adapter = new UserStoryInputAdapter(); const catalog = adapter.normalize(adapter.parse({ fileName: 'story.md', content: englishStory }), { fileName: 'story.md', applicationId: 'saucedemo' });
  assert.ok(catalog.cases.every(({ sourceType, reviewStatus }) => sourceType === 'USER_STORY' && reviewStatus === 'REQUIRES_QA_REVIEW'));
});
