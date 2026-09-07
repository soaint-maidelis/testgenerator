const fs = require('node:fs');
const path = require('node:path');

const IMPORT_PATTERN = /(?:\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?|\brequire\s*\(|\bimport\s*\()\s*['"]([^'"]+)['"]/g;

function readAliases(tsconfigPath) {
  const parsed = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  return Object.entries(parsed.compilerOptions?.paths ?? {}).flatMap(([alias, targets]) =>
    targets.map((target) => ({ alias, target })),
  );
}

function matchesPattern(value, pattern) {
  const [prefix, suffix = ''] = pattern.split('*');
  return value.startsWith(prefix) && value.endsWith(suffix);
}

function targetsApps(specifier, importer, options) {
  if (specifier.startsWith('.')) {
    const resolved = path.resolve(path.dirname(importer), specifier);
    return resolved === options.appsDir || resolved.startsWith(`${options.appsDir}${path.sep}`);
  }

  return options.aliases.some(({ alias, target }) => {
    if (!matchesPattern(specifier, alias)) return false;
    const targetPath = path.resolve(options.rootDir, target.replace('*', ''));
    return targetPath === options.appsDir || targetPath.startsWith(`${options.appsDir}${path.sep}`);
  });
}

function findForbiddenImports(source, importer, options) {
  const violations = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    if (targetsApps(match[1], importer, options)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      violations.push({ file: importer, line, specifier: match[1] });
    }
  }
  return violations;
}

function walkTypeScriptFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkTypeScriptFiles(resolved);
    return /\.(?:c|m)?tsx?$/.test(entry.name) ? [resolved] : [];
  });
}

function auditBoundaries(rootDir = process.cwd()) {
  const coreDir = path.resolve(rootDir, 'src/core');
  const appsDir = path.resolve(rootDir, 'src/apps');
  const options = {
    rootDir: path.resolve(rootDir),
    appsDir,
    aliases: readAliases(path.resolve(rootDir, 'tsconfig.json')),
  };

  return walkTypeScriptFiles(coreDir).flatMap((file) =>
    findForbiddenImports(fs.readFileSync(file, 'utf8'), file, options),
  );
}

if (require.main === module) {
  const violations = auditBoundaries();
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${path.relative(process.cwd(), violation.file)}:${violation.line} imports ${violation.specifier}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Boundary audit PASS: src/core has no dependency on src/apps.');
  }
}

module.exports = { auditBoundaries, findForbiddenImports, readAliases };
