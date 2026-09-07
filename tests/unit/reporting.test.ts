import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { normalizePlaywrightResult } from '../../src/adapters/playwright/playwright-result.adapter';
import { writeExecutiveReports } from '../../src/core/reporting/executive-report';

function runnerInput(status: 'passed' | 'failed' | 'skipped') {
  const testCase = {
    title: `TG-REPORT-001 ${status}`,
    annotations: [{ type: 'caseId', description: `TG-REPORT-${status}` }],
  } as unknown as Parameters<typeof normalizePlaywrightResult>[0];
  const result = {
    status,
    duration: 5,
    startTime: new Date('2026-01-01T00:00:00.000Z'),
    attachments: [{ name: 'screenshot', contentType: 'image/png', path: 'artifacts/evidence/image.png' }],
    ...(status === 'failed' ? { error: { message: 'controlled failure' } } : {}),
  } as unknown as Parameters<typeof normalizePlaywrightResult>[1];
  return normalizePlaywrightResult(testCase, result, { applicationId: 'fixture' });
}

test('maps passed, failed, and skipped Playwright results without runner leakage', () => {
  const results = ['passed', 'failed', 'skipped'].map((status) => runnerInput(status as 'passed' | 'failed' | 'skipped'));
  assert.deepEqual(results.map(({ status }) => status), ['passed', 'failed', 'skipped']);
  assert.equal(results[1]?.failure?.message, 'controlled failure');
  assert.deepEqual(Object.keys(results[0] ?? {}).sort(), [
    'applicationId', 'caseId', 'durationMs', 'evidence', 'startedAt', 'status', 'title',
  ]);
});

test('writes equivalent executive JSON and Markdown from normalized results', async () => {
  const results = [runnerInput('passed'), runnerInput('failed'), runnerInput('skipped')];
  const output = await writeExecutiveReports({
    applicationId: 'fixture', generatedAt: '2026-01-01T00:00:10.000Z', results,
    classifications: { 'TG-REPORT-failed': 'UNKNOWN' },
  }, 'artifacts/test-reporting');
  const json = await readFile(output.artifacts[0]?.path ?? '', 'utf8');
  const markdown = await readFile(output.artifacts[1]?.path ?? '', 'utf8');
  assert.equal(output.summary.total, 3);
  assert.match(json, /"caseId": "TG-REPORT-failed"/);
  assert.match(json, /"classification": "UNKNOWN"/);
  assert.match(markdown, /TG-REPORT-failed/);
  assert.match(markdown, /screenshot: artifacts\/evidence\/image.png/);
});
