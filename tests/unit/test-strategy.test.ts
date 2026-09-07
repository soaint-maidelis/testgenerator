import assert from 'node:assert/strict';
import test from 'node:test';

import type { TestCatalog } from '../../src/core/cases/catalog.types';
import { selectStrategyCases, validateTestStrategy } from '../../src/core/strategy/test-strategy.validation';
import type { TestStrategy } from '../../src/core/strategy/test-strategy.types';

const catalog: TestCatalog = { applicationId: 'app', cases: ['A', 'B'].map((caseId) => ({ caseId, title: caseId, description: caseId, preconditions: [], inputData: {}, steps: [{ order: 1, action: caseId }], expectedResults: [caseId], priority: caseId === 'A' ? 'high' : 'low', type: 'functional', tags: [], automationStatus: 'automated' })) };
const strategy: TestStrategy = { applicationId: 'app', suites: ['smoke'], features: ['feature'], cases: { A: { feature: 'feature', suites: ['smoke'], risk: 'high' }, B: { feature: 'feature', suites: [], risk: 'low', dependencies: ['A'] } } };

test('TestStrategy selects generic suite, feature, and priority dimensions', () => {
  assert.deepEqual(selectStrategyCases(strategy, catalog, { suite: 'smoke' }).map(({ caseId }) => caseId), ['A']);
  assert.deepEqual(selectStrategyCases(strategy, catalog, { priority: 'low' }).map(({ caseId }) => caseId), ['B']);
});
test('TestStrategy rejects missing dependencies', () => {
  const invalid = { ...strategy, cases: { ...strategy.cases, B: { ...strategy.cases.B!, dependencies: ['MISSING'] } } };
  assert.throws(() => validateTestStrategy(invalid, catalog), /missing dependency/);
});
test('TestStrategy rejects simple dependency cycles', () => {
  const invalid: TestStrategy = { ...strategy, cases: { A: { ...strategy.cases.A!, dependencies: ['B'] }, B: { ...strategy.cases.B!, dependencies: ['A'] } } };
  assert.throws(() => validateTestStrategy(invalid, catalog), /dependency cycle/);
});
