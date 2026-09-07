import path from 'node:path';

import type { InputAdapter, InputDocument } from '../../core/input/input-adapter.types';
import type { InputNormalizationContext, NormalizedCatalogCase, NormalizedTestCatalog } from '../../core/input/input-normalization.types';
import { validateNormalizedCatalog } from '../../core/input/input-validation';

export class JsonInputAdapter implements InputAdapter<unknown> {
  readonly id = 'json';
  readonly displayName = 'JSON';
  readonly supportedExtensions = ['.json'];

  canHandle(document: InputDocument): boolean { return path.extname(document.fileName).toLowerCase() === '.json'; }

  parse(document: InputDocument): unknown {
    try { return JSON.parse(Buffer.isBuffer(document.content) ? document.content.toString('utf8') : document.content) as unknown; }
    catch (error) { throw new Error(`Invalid JSON in ${document.fileName}: ${error instanceof Error ? error.message : String(error)}`); }
  }

  normalize(parsed: unknown, context: InputNormalizationContext): NormalizedTestCatalog {
    const record = isRecord(parsed) ? parsed : undefined;
    const rawCases = Array.isArray(parsed) ? parsed : Array.isArray(record?.cases) ? record.cases : [parsed];
    const applicationId = text(record?.applicationId) ?? context.applicationId;
    if (!applicationId) throw new Error('JSON input requires applicationId in the document or import context');
    const cases = rawCases.map((value, index) => {
      if (!isRecord(value)) throw new Error(`JSON case at index ${index} must be an object`);
      const { applicationId: _ignored, ...testCase } = value;
      return {
        ...testCase,
        source: { type: 'JSON', file: context.fileName, ...(text(value.caseId) ? { sourceId: text(value.caseId) } : {}) },
      } as unknown as NormalizedCatalogCase;
    });
    return validateNormalizedCatalog({ applicationId, cases, warnings: [] });
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function text(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
