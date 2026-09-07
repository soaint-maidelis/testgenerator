import type { NormalizedTestResult } from '../results/normalized-test-result.types';
import type {
  FailureClassification,
  FailureClassificationResult,
  FailureClassifier,
} from './incident.types';

const SOURCE_CLASSIFICATIONS: Readonly<Record<string, FailureClassification>> = Object.freeze({
  product: 'PRODUCT_DEFECT',
  automation: 'AUTOMATION_DEFECT',
  'test-data': 'TEST_DATA',
  environment: 'ENVIRONMENT',
});

export class DefaultFailureClassifier implements FailureClassifier {
  classify(result: NormalizedTestResult): FailureClassificationResult {
    if (result.status !== 'failed' || result.failure === undefined) {
      return { classification: 'UNKNOWN', reason: 'The result has no normalized failure to classify.' };
    }

    const source = result.failure.source?.trim().toLowerCase();
    if (source !== undefined && SOURCE_CLASSIFICATIONS[source] !== undefined) {
      return {
        classification: SOURCE_CLASSIFICATIONS[source],
        reason: `The normalized failure explicitly identifies source "${source}".`,
      };
    }

    const details = `${result.failure.message}\n${result.failure.stack ?? ''}`.toLowerCase();
    if (/fixture|test data|missing data|seed data/.test(details)) {
      return { classification: 'TEST_DATA', reason: 'Failure evidence indicates missing or invalid test data.' };
    }
    if (/econnrefused|enotfound|service unavailable|environment unavailable/.test(details)) {
      return { classification: 'ENVIRONMENT', reason: 'Failure evidence indicates an unavailable environment.' };
    }
    if (/invalid selector|strict mode violation|locator resolved|detached from dom/.test(details)) {
      return { classification: 'AUTOMATION_DEFECT', reason: 'Failure evidence identifies an automation implementation issue.' };
    }

    return {
      classification: 'UNKNOWN',
      reason: 'Failure alone is insufficient to identify a product defect.',
    };
  }
}
