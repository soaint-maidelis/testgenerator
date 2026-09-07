import { parseTestCatalog } from '../cases/catalog.validation';
import type { NormalizedTestCatalog } from './input-normalization.types';

export function validateNormalizedCatalog(value: NormalizedTestCatalog): NormalizedTestCatalog {
  parseTestCatalog(value);
  const errors: string[] = [];
  value.cases.forEach((testCase, index) => {
    if (testCase.source === undefined) errors.push(`cases[${index}].source is required for imported cases`);
    if (testCase.sourceType === 'USER_STORY' && !['REQUIRES_QA_REVIEW', 'APPROVED'].includes(testCase.reviewStatus ?? '')) {
      errors.push(`cases[${index}].reviewStatus must represent an explicit QA state`);
    }
    if (testCase.reviewStatus === 'APPROVED' && (!testCase.approvedAt || Number.isNaN(Date.parse(testCase.approvedAt)))) {
      errors.push(`cases[${index}].approvedAt must be an ISO timestamp for approved candidates`);
    }
  });
  if (errors.length > 0) throw new Error(`Invalid normalized input catalog:\n- ${errors.join('\n- ')}`);
  return value;
}
