import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

import { DefaultFailureClassifier } from '../../core/incidents/failure-classifier';
import { FilePreviewProvider } from '../../core/incidents/file-preview.provider';
import { createIncidentModel } from '../../core/incidents/incident-model';
import type { FailureClassification } from '../../core/incidents/incident.types';
import { writeExecutiveReports } from '../../core/reporting/executive-report';
import type { NormalizedTestResult } from '../../core/results/normalized-test-result.types';
import { normalizePlaywrightResult } from './playwright-result.adapter';

export default class DemoArtifactReporter implements Reporter {
  private readonly results: NormalizedTestResult[] = [];
  private readonly classifications: Record<string, FailureClassification> = {};
  private readonly classifier = new DefaultFailureClassifier();

  async onTestEnd(testCase: TestCase, result: TestResult): Promise<void> {
    const normalized = normalizePlaywrightResult(testCase, result, {
      applicationId: process.env.APP_PROFILE ?? 'unknown',
    });
    this.results.push(normalized);

    const marker = simulatedMarker(result);
    const classification = marker === undefined
      ? this.classifier.classify(normalized)
      : {
          classification: 'PRODUCT_DEFECT' as const,
          reason: 'Explicitly classified inside the controlled SIMULATED_DEMO_FAILURE scenario.',
        };
    this.classifications[normalized.caseId] = classification.classification;

    if (marker !== undefined && normalized.status === 'failed') {
      const incident = createIncidentModel(normalized, classification, new Date().toISOString(), {
        marker: 'SIMULATED_DEMO_FAILURE',
        url: marker.url,
        browser: marker.browser,
        environment: process.env.APP_PROFILE ?? 'unknown',
        scenario: normalized.title,
        priority: 'high',
        sourceType: 'SIMULATED_DEMO',
        expected: 'The controlled simulated condition passes.',
        actual: normalized.failure?.message ?? 'The controlled simulated condition failed.',
      });
      await new FilePreviewProvider().writePreview(incident);
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (this.results.length === 0) return;
    await writeExecutiveReports({
      applicationId: process.env.APP_PROFILE ?? 'unknown',
      generatedAt: new Date().toISOString(),
      results: this.results,
      classifications: this.classifications,
    });
  }
}

function simulatedMarker(result: TestResult): { readonly url: string; readonly browser: string } | undefined {
  const attachment = result.attachments.find(({ name }) => name === 'SIMULATED_DEMO_FAILURE');
  if (attachment?.body === undefined) return undefined;
  try {
    const parsed = JSON.parse(attachment.body.toString('utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const record = parsed as Readonly<Record<string, unknown>>;
    return {
      url: typeof record.url === 'string' ? record.url : 'unknown',
      browser: typeof record.browser === 'string' ? record.browser : 'unknown',
    };
  } catch {
    return undefined;
  }
}
