import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { parseTestCatalog, validateSpecCaseIds } from '../../src/core/cases/catalog.validation';

function filesBelow(directory: string, pattern: RegExp): readonly string[] {
  if (!statExists(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(resolved, pattern) : pattern.test(entry.name) ? [resolved] : [];
  });
}

function statExists(value: string): boolean {
  try {
    return statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function referencedCaseIds(specDirectory: string): readonly string[] {
  const ids: string[] = [];
  for (const file of filesBelow(specDirectory, /\.spec\.ts$/)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/g)) {
      ids.push(match[1]);
    }
  }
  return ids;
}

export function validateCatalogFiles(rootDirectory = process.cwd()): number {
  const catalogFiles = filesBelow(path.join(rootDirectory, 'cases'), /\.json$/);
  for (const catalogFile of catalogFiles) {
    const catalog = parseTestCatalog(JSON.parse(readFileSync(catalogFile, 'utf8')) as unknown);
    const specs = path.join(rootDirectory, 'tests/e2e', catalog.applicationId);
    validateSpecCaseIds(catalog, referencedCaseIds(specs));
  }
  return catalogFiles.length;
}

if (require.main === module) {
  try {
    const count = validateCatalogFiles();
    console.log(`Catalog validation PASS: ${count} catalog file(s) validated.`);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
