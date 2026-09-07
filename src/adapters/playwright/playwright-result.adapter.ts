import path from 'node:path';

import type { TestCase, TestResult } from '@playwright/test/reporter';

import type {
  EvidenceKind,
  EvidenceReference,
  NormalizedTestResult,
  NormalizedTestStatus,
} from '../../core/results/normalized-test-result.types';

export interface PlaywrightResultAdapterContext {
  readonly applicationId: string;
  readonly caseId?: string;
}

export function normalizePlaywrightResult(
  testCase: TestCase,
  result: TestResult,
  context: PlaywrightResultAdapterContext,
): NormalizedTestResult {
  const caseId = context.caseId ?? findCaseId(testCase);
  if (caseId === undefined) {
    throw new Error(`Playwright test "${testCase.title}" has no traceable caseId`);
  }

  const failure = result.error === undefined
    ? undefined
    : {
        message: result.error.message ?? result.error.value ?? 'Unknown Playwright failure',
        ...(result.error.stack === undefined ? {} : { stack: result.error.stack }),
      };

  return {
    applicationId: context.applicationId,
    caseId,
    title: testCase.title,
    status: normalizeStatus(result.status),
    durationMs: result.duration,
    startedAt: result.startTime.toISOString(),
    evidence: result.attachments.flatMap(toEvidenceReference),
    ...(failure === undefined ? {} : { failure }),
  };
}

function findCaseId(testCase: TestCase): string | undefined {
  const annotation = testCase.annotations.find(({ type }) => type.toLowerCase() === 'caseid');
  if (annotation?.description?.trim()) return annotation.description.trim();
  return testCase.title.match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/)?.[0];
}

function normalizeStatus(status: TestResult['status']): NormalizedTestStatus {
  if (status === 'passed') return 'passed';
  if (status === 'skipped' || status === 'interrupted') return 'skipped';
  return 'failed';
}

function toEvidenceReference(
  attachment: TestResult['attachments'][number],
): readonly EvidenceReference[] {
  if (attachment.path === undefined) return [];
  const normalizedPath = safeRelativePath(attachment.path);
  return [{ kind: inferEvidenceKind(attachment.name, attachment.contentType), path: normalizedPath }];
}

function inferEvidenceKind(name: string, contentType: string): EvidenceKind {
  const value = `${name} ${contentType}`.toLowerCase();
  if (value.includes('image')) return 'screenshot';
  if (value.includes('trace')) return 'trace';
  if (value.includes('video')) return 'video';
  if (value.includes('text') || value.includes('log')) return 'log';
  return 'other';
}

function safeRelativePath(value: string): string {
  const workspace = path.resolve(process.cwd());
  const resolved = path.resolve(value);
  return resolved.startsWith(`${workspace}${path.sep}`)
    ? path.relative(workspace, resolved).replace(/\\/g, '/')
    : path.basename(resolved);
}
