import path from 'node:path';
import * as XLSX from 'xlsx';

import type { CatalogStep } from '../../core/cases/catalog.types';
import type { InputAdapter, InputDocument } from '../../core/input/input-adapter.types';
import type { InputNormalizationContext, NormalizedCatalogCase, NormalizedTestCatalog } from '../../core/input/input-normalization.types';
import { validateNormalizedCatalog } from '../../core/input/input-validation';

type CatalogField = 'caseId' | 'title' | 'description' | 'preconditions' | 'inputData' | 'steps' | 'expectedResults' | 'priority' | 'type' | 'tags' | 'automationStatus';
type ParsedWorkbook = readonly { readonly row: number; readonly values: Readonly<Record<string, unknown>> }[];

const aliases: Readonly<Record<CatalogField | 'scenario', readonly string[]>> = {
  scenario: ['Scenario'],
  caseId: ['CaseId', 'Case ID', 'ID', 'Test Case ID'],
  title: ['Title', 'Test Case', 'Case Name'],
  description: ['Description'],
  preconditions: ['Preconditions', 'Precondition'],
  inputData: ['InputData', 'Input Data'],
  steps: ['Steps', 'Test Steps'],
  expectedResults: ['ExpectedResults', 'Expected Result', 'Expected Results'],
  priority: ['Priority'],
  type: ['Type'],
  tags: ['Tags'],
  automationStatus: ['AutomationStatus', 'Automation Status'],
};

export class ExcelInputAdapter implements InputAdapter<ParsedWorkbook> {
  readonly id = 'excel';
  readonly displayName = 'Excel';
  readonly supportedExtensions = ['.xlsx', '.xls'];
  constructor(private readonly customAliases: Partial<Record<keyof typeof aliases, readonly string[]>> = {}) {}

  canHandle(document: InputDocument): boolean {
    return this.supportedExtensions.includes(path.extname(document.fileName).toLowerCase());
  }

  parse(document: InputDocument): ParsedWorkbook {
    const workbook = XLSX.read(asBuffer(document.content), { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error('Excel input must contain at least one worksheet');
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet]!, { header: 1, defval: '' });
    const headers = (rows[0] ?? []).map(String);
    const resolved = this.resolveHeaders(headers);
    return rows.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== '')).map((row, index) => ({
      row: index + 2,
      values: Object.fromEntries(Object.entries(resolved).map(([field, column]) => [field, row[column] ?? ''])),
    }));
  }

  normalize(parsed: ParsedWorkbook, context: InputNormalizationContext): NormalizedTestCatalog {
    const applicationId = requiredText(context.applicationId, 1, 'applicationId');
    const cases = parsed.map(({ row, values }) => this.normalizeRow(values, row, context.fileName));
    return validateNormalizedCatalog({ applicationId, cases, warnings: [] });
  }

  private resolveHeaders(headers: readonly string[]): Record<CatalogField | 'scenario', number> {
    const normalized = headers.map(normalizeHeader);
    const result = {} as Record<CatalogField | 'scenario', number>;
    for (const [field, defaults] of Object.entries(aliases) as [CatalogField | 'scenario', readonly string[]][]) {
      const configured = [...(this.customAliases[field] ?? []), ...defaults].map(normalizeHeader);
      const index = normalized.findIndex((header) => configured.includes(header));
      if (index < 0 && field !== 'scenario') throw new Error(`Excel row 1, field ${field}: required column is missing`);
      result[field] = index;
    }
    return result;
  }

  private normalizeRow(values: Readonly<Record<string, unknown>>, row: number, file: string): NormalizedCatalogCase {
    const caseId = requiredText(values.caseId, row, 'caseId');
    const scenario = optionalText(values.scenario);
    return {
      caseId,
      title: requiredText(values.title, row, 'title'),
      description: requiredText(values.description, row, 'description'),
      preconditions: requiredList(values.preconditions, row, 'preconditions'),
      inputData: requiredObject(values.inputData, row, 'inputData'),
      steps: requiredSteps(values.steps, row),
      expectedResults: requiredList(values.expectedResults, row, 'expectedResults'),
      priority: requiredText(values.priority, row, 'priority'),
      type: requiredText(values.type, row, 'type'),
      tags: requiredList(values.tags, row, 'tags'),
      automationStatus: requiredText(values.automationStatus, row, 'automationStatus'),
      source: { type: 'EXCEL', file, sourceId: caseId, row, ...(scenario ? { originalReference: scenario } : {}) },
    };
  }
}

function normalizeHeader(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function asBuffer(value: string | Buffer): Buffer { return Buffer.isBuffer(value) ? value : Buffer.from(value); }
function optionalText(value: unknown): string | undefined { const text = String(value ?? '').trim(); return text || undefined; }
function requiredText(value: unknown, row: number, field: string): string { const text = optionalText(value); if (!text) throw new Error(`Excel row ${row}, field ${field}: value is required`); return text; }
function requiredList(value: unknown, row: number, field: string): string[] { const text = requiredText(value, row, field); return text.split(/\r?\n|[;|]/).map((entry) => entry.trim()).filter(Boolean); }
function requiredObject(value: unknown, row: number, field: string): Readonly<Record<string, unknown>> {
  const text = requiredText(value, row, field);
  try { const parsed = JSON.parse(text) as unknown; if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(); return parsed as Readonly<Record<string, unknown>>; }
  catch { throw new Error(`Excel row ${row}, field ${field}: expected a JSON object`); }
}
function requiredSteps(value: unknown, row: number): CatalogStep[] {
  const text = requiredText(value, row, 'steps');
  if (text.startsWith('[')) {
    try { const parsed = JSON.parse(text) as unknown; if (Array.isArray(parsed)) return parsed as CatalogStep[]; } catch {}
    throw new Error(`Excel row ${row}, field steps: expected a JSON step array or delimited actions`);
  }
  return text.split(/\r?\n|[;|]/).map((entry, index) => {
    const [action, expectedResult] = entry.split(/\s*=>\s*/, 2);
    return { order: index + 1, action: action!.trim(), ...(expectedResult?.trim() ? { expectedResult: expectedResult.trim() } : {}) };
  }).filter(({ action }) => action.length > 0);
}
