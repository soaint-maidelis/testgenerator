import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { DefaultFailureClassifier } from '../../src/core/incidents/failure-classifier';
import { FilePreviewProvider } from '../../src/core/incidents/file-preview.provider';
import { createIncidentModel } from '../../src/core/incidents/incident-model';
import type { NormalizedFailure, NormalizedTestResult } from '../../src/core/results/normalized-test-result.types';

function failedResult(failure: NormalizedFailure): NormalizedTestResult {
  return {
    applicationId: 'fixture', caseId: 'TG-INC-001', title: 'Controlled failure',
    status: 'failed', durationMs: 10, startedAt: '2026-01-01T00:00:00.000Z', evidence: [], failure,
  };
}

test('covers every classification while generic failures remain UNKNOWN', () => {
  const classifier = new DefaultFailureClassifier();
  const sources = [
    ['product', 'PRODUCT_DEFECT'], ['automation', 'AUTOMATION_DEFECT'],
    ['test-data', 'TEST_DATA'], ['environment', 'ENVIRONMENT'],
  ] as const;
  for (const [source, expected] of sources) {
    assert.equal(classifier.classify(failedResult({ message: 'controlled', source })).classification, expected);
  }
  assert.equal(classifier.classify(failedResult({ message: 'generic assertion failed' })).classification, 'UNKNOWN');
});

test('creates a simulated incident preview in a local sanitized file', async () => {
  const result = failedResult({ message: 'token=unsafe-value' });
  const classification = new DefaultFailureClassifier().classify(result);
  const incident = createIncidentModel(result, classification, '2026-01-01T00:00:01.000Z');
  const artifact = await new FilePreviewProvider('artifacts/test-incident-preview').writePreview(incident);
  const content = await readFile(artifact.path, 'utf8');
  assert.equal(artifact.providerId, 'file');
  assert.match(content, /"simulated": true/);
  assert.match(content, /\[REDACTED\]/);
  assert.doesNotMatch(content, /unsafe-value/);
});

test('rejects non-failures and non-local output paths', () => {
  const passed: NormalizedTestResult = {
    applicationId: 'fixture', caseId: 'TG-INC-002', title: 'Passed', status: 'passed',
    durationMs: 1, startedAt: '2026-01-01T00:00:00.000Z', evidence: [],
  };
  assert.throws(() => createIncidentModel(passed, { classification: 'UNKNOWN', reason: 'none' }), /requires a failed/);
  assert.throws(() => new FilePreviewProvider('../outside'), /inside the current workspace/);
});
