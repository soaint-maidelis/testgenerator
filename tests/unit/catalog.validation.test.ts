import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CatalogValidationError,
  parseTestCatalog,
  validateSpecCaseIds,
} from '../../src/core/cases/catalog.validation';

const completeCase = {
  caseId: 'TG-DEMO-001',
  title: 'Synthetic case',
  description: 'Exercises the catalog contract',
  preconditions: ['Synthetic data is available'],
  inputData: { value: 'synthetic' },
  steps: [{ order: 1, action: 'Perform an action', expectedResult: 'The outcome is visible' }],
  expectedResults: ['The outcome is visible'],
  priority: 'medium',
  type: 'functional',
  tags: ['demo'],
  automationStatus: 'planned',
};

test('accepts a complete catalog and preserves caseId traceability', () => {
  const catalog = parseTestCatalog({ applicationId: 'fixture', cases: [completeCase] });
  assert.equal(catalog.cases[0]?.caseId, 'TG-DEMO-001');
  assert.doesNotThrow(() => validateSpecCaseIds(catalog, ['TG-DEMO-001']));
});

test('rejects missing fields, invalid types, and duplicate IDs with useful errors', () => {
  assert.throws(
    () => parseTestCatalog({ applicationId: 'fixture', cases: [completeCase, { ...completeCase, title: 4 }] }),
    (error: unknown) => {
      assert.ok(error instanceof CatalogValidationError);
      assert.match(error.message, /title must be a non-empty string/);
      assert.match(error.message, /caseId must be unique/);
      return true;
    },
  );
});

test('rejects unknown spec case IDs', () => {
  const catalog = parseTestCatalog({ applicationId: 'fixture', cases: [completeCase] });
  assert.throws(() => validateSpecCaseIds(catalog, ['TG-MISSING-999']), /unknown caseId/);
});
