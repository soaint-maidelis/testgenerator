import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { sanitizeSensitiveText } from '../security/sanitize';
import type { NormalizedTestResult } from '../results/normalized-test-result.types';
import type {
  ReportArtifact,
  ReportingInput,
  ReportingOutput,
  ReportingSummary,
} from './reporting.types';

export async function writeExecutiveReports(
  input: ReportingInput,
  outputDirectory = 'artifacts/reports',
): Promise<ReportingOutput> {
  const directory = resolveLocalOutput(outputDirectory);
  await mkdir(directory, { recursive: true });
  const summary = summarizeResults(input.results);
  const rows = input.results.map((result) => ({
    caseId: result.caseId,
    title: sanitizeSensitiveText(result.title),
    outcome: result.status,
    durationMs: result.durationMs,
    classification: input.classifications?.[result.caseId] ?? 'UNKNOWN',
    evidence: result.evidence.map(({ kind, path: evidencePath }) => ({
      kind,
      path: sanitizeSensitiveText(evidencePath),
    })),
  }));
  const model = { applicationId: input.applicationId, generatedAt: input.generatedAt, summary, results: rows };
  const jsonPath = path.join(directory, 'executive-report.json');
  const markdownPath = path.join(directory, 'executive-report.md');
  await writeFile(jsonPath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, renderMarkdown(model), 'utf8');

  const artifacts: readonly ReportArtifact[] = [
    { format: 'json', path: relativePath(jsonPath) },
    { format: 'markdown', path: relativePath(markdownPath) },
  ];
  return { summary, artifacts };
}

export function summarizeResults(results: readonly NormalizedTestResult[]): ReportingSummary {
  return {
    total: results.length,
    passed: results.filter(({ status }) => status === 'passed').length,
    failed: results.filter(({ status }) => status === 'failed').length,
    skipped: results.filter(({ status }) => status === 'skipped').length,
    durationMs: results.reduce((total, { durationMs }) => total + durationMs, 0),
  };
}

function renderMarkdown(model: {
  readonly applicationId: string;
  readonly generatedAt: string;
  readonly summary: ReportingSummary;
  readonly results: readonly {
    readonly caseId: string;
    readonly title: string;
    readonly outcome: string;
    readonly durationMs: number;
    readonly classification: string;
    readonly evidence: readonly { readonly kind: string; readonly path: string }[];
  }[];
}): string {
  const lines = [
    '# Executive test report', '',
    `Application: ${escapeMarkdown(model.applicationId)}`,
    `Generated: ${escapeMarkdown(model.generatedAt)}`, '',
    `Total: ${model.summary.total} | Passed: ${model.summary.passed} | Failed: ${model.summary.failed} | Skipped: ${model.summary.skipped} | Duration: ${model.summary.durationMs} ms`, '',
    '| Case | Title | Outcome | Duration (ms) | Classification | Evidence |',
    '|---|---|---:|---:|---|---|',
  ];
  for (const result of model.results) {
    const evidence = result.evidence.map(({ kind, path: evidencePath }) => `${kind}: ${evidencePath}`).join('<br>') || 'none';
    lines.push(`| ${escapeMarkdown(result.caseId)} | ${escapeMarkdown(result.title)} | ${result.outcome} | ${result.durationMs} | ${result.classification} | ${escapeMarkdown(evidence)} |`);
  }
  return `${lines.join('\n')}\n`;
}

function resolveLocalOutput(outputDirectory: string): string {
  const workspace = path.resolve(process.cwd());
  const resolved = path.resolve(workspace, outputDirectory);
  if (resolved !== workspace && !resolved.startsWith(`${workspace}${path.sep}`)) {
    throw new Error('Report output must remain inside the current workspace');
  }
  return resolved;
}

function relativePath(value: string): string {
  return path.relative(process.cwd(), value).replace(/\\/g, '/');
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}
