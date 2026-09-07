import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createInputAdapterRegistry } from '../../src/core/input/input-registry';
import type { NormalizedTestCatalog } from '../../src/core/input/input-normalization.types';
import { ExcelInputAdapter } from '../../src/input-adapters/excel/excel-input.adapter';
import { JsonInputAdapter } from '../../src/input-adapters/json/json-input.adapter';
import { UserStoryInputAdapter } from '../../src/input-adapters/user-story/user-story-input.adapter';

const root = process.cwd();
const outputDirectory = path.join(root, 'artifacts/input-preview');
const registry = createInputAdapterRegistry([new ExcelInputAdapter(), new JsonInputAdapter(), new UserStoryInputAdapter()]);

function importPreview(adapterId: string, inputFile: string, applicationId: string, outputName: string): NormalizedTestCatalog {
  const adapter = registry.get(adapterId);
  if (!adapter) throw new Error(`Unknown input adapter: ${adapterId}`);
  const resolved = path.resolve(root, inputFile);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('Input file must remain inside the workspace');
  const document = { fileName: path.basename(resolved), content: readFileSync(resolved), applicationId };
  if (!adapter.canHandle(document)) throw new Error(`${adapter.displayName} cannot handle ${document.fileName}`);
  const catalog = adapter.normalize(adapter.parse(document), { fileName: document.fileName, applicationId });
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(path.join(outputDirectory, outputName), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  return catalog;
}

function printResult(type: string, catalog: NormalizedTestCatalog): void {
  console.log(`${type}: cases=${catalog.cases.length}; caseIds=${catalog.cases.map(({ caseId }) => caseId).join(',') || '(none)'}; warnings=${catalog.warnings.join(' | ') || '(none)'}; validation=PASS`);
}

function run(): void {
  const [mode, file] = process.argv.slice(2);
  if (mode === 'demo') {
    const inputs = [
      ['excel', 'inputs/excel/saucedemo-cases.xlsx', 'excel-normalized.json'],
      ['json', 'inputs/json/saucedemo-cases.json', 'json-normalized.json'],
      ['user-story', 'inputs/user-story/cart-story.md', 'story-normalized.json'],
    ] as const;
    for (const [type, input, output] of inputs) printResult(type.toUpperCase(), importPreview(type, input, 'saucedemo', output));
    console.log('All inputs use the same Normalized Test Catalog model; previews require explicit human approval before catalog adoption.');
    return;
  }
  if (!mode || !file) throw new Error('Usage: import:<excel|json|story> -- <workspace-file>');
  const adapterId = mode === 'story' ? 'user-story' : mode;
  const outputName = `${mode}-normalized.json`;
  printResult(mode.toUpperCase(), importPreview(adapterId, file, process.env.INPUT_APPLICATION_ID ?? 'unassigned', outputName));
}

try { run(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
