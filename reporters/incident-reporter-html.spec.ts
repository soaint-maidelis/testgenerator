import { expect, test } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

type ZipFileReader = {
  entries(): Promise<string[]>;
  read(entryPath: string): Promise<Buffer>;
  close(): void;
};

const reportRoot = path.join(process.cwd(), 'test-results', 'incident-html-report');
const htmlReportDir = path.join(reportRoot, 'playwright-report');
const htmlIndexPath = path.join(htmlReportDir, 'index.html');
const diagnosticReportRoot = path.join(process.cwd(), 'test-results', 'incident-diagnostic-html-report');
const diagnosticHtmlIndexPath = path.join(diagnosticReportRoot, 'playwright-report', 'index.html');

test.describe('incident reporter HTML integration', () => {
  test('Azure summaries appear in a real Playwright HTML report with one HTML generator', async () => {
    fs.rmSync(reportRoot, { recursive: true, force: true });

    const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npx';
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx.cmd playwright test -c reporters/incident-reporter-html.config.ts']
      : ['playwright', 'test', '-c', 'reporters/incident-reporter-html.config.ts'];
    const run = spawnSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        AUTO_CREATE_INCIDENTS: 'true',
        AZURE_DEVOPS_ORGANIZATION: 'mock-org',
        AZURE_DEVOPS_PROJECT: 'mock-project',
        AZURE_DEVOPS_PAT: 'mock-pat',
        DEBUG_INCIDENTS: 'false',
      },
    });

    expect(run.error?.message ?? '').toBe('');
    expect(run.status, run.stderr).toBe(1);
    expect(run.stdout).toContain('[PROVIDER:AZURE]');
    expect(run.stdout).toContain('CREATED #60788');
    expect(run.stdout).toContain('DUPLICATE #60724');
    expect(run.stdout).not.toContain('attachment #');
    expect(run.stdout).not.toContain('AZURE DEVOPS\n\nEstado:');
    expect(fs.existsSync(htmlIndexPath)).toBe(true);
    expect(countFilesNamed(reportRoot, 'index.html')).toBe(1);

    const reportJson = await readHtmlReportJsonFiles(htmlIndexPath);
    const allJson = reportJson.map((entry) => JSON.stringify(entry.data)).join('\n');

    expect(allJson).toContain('incident-provider-summary');
    expect(allJson).toContain('incident-preview');
    expect(allJson).toContain('azure-devops-summary');
    expect(allJson).toContain('azure-devops-incident-preview');
    expect(allJson).toContain('#60788');
    expect(allJson).toContain('#60724');
    expect(allJson).toContain('Screenshot:\\nADJUNTADO');
    expect(allJson).toContain('Trace:\\nADJUNTADO');
    expect(allJson).toContain('Video:\\nADJUNTADO');
    expect(allJson).toContain('YA EXISTÍA - NO SE VOLVIÓ A ADJUNTAR');
    expect(allJson).toContain('NO ENVIADO - VIDEO DESACTIVADO');
  });

  test('HTML report uses enriched E37 diagnostic instead of legacy diagnostic error', async () => {
    fs.rmSync(diagnosticReportRoot, { recursive: true, force: true });

    const run = runPlaywrightConfig('reporters/incident-reporter-diagnostic-html.config.ts');

    expect(run.error?.message ?? '').toBe('');
    expect(run.status, run.stderr).toBe(1);
    expect(run.stdout).toContain('[PROVIDER:JIRA]');
    expect(run.stdout).toContain('DUPLICATE SCRUM-3');
    expect(fs.existsSync(diagnosticHtmlIndexPath)).toBe(true);

    const reportJson = await readHtmlReportJsonFiles(diagnosticHtmlIndexPath);
    const allJson = reportJson.map((entry) => JSON.stringify(entry.data)).join('\n');

    expect(allJson).toContain('OPTION_NOT_AVAILABLE');
    expect(allJson).toContain('Ejecutar accion Eliminar desde la tabla');
    expect(allJson).toContain('Debe existir la opcion Eliminar en el menu de acciones.');
    expect(allJson).toContain('Cuentas Contables');
    expect(allJson).toContain('incident-preview');
    expect(allJson).not.toContain('Fase: Abrir modulo y vista');
    expect(allJson).not.toContain('Causa probable: NAV_FAILURE');
    expect(allJson).not.toContain('No se encontro o no se pudo abrir el menu, modulo o vista esperada.');
    expect(allJson).not.toContain('Vista: No inferido');
  });
});

function runPlaywrightConfig(configPath: string) {
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npx.cmd playwright test -c ${configPath}`]
    : ['playwright', 'test', '-c', configPath];
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      AUTO_CREATE_INCIDENTS: 'true',
      INCIDENT_PROVIDER: 'jira',
      DEBUG_INCIDENTS: 'false',
    },
  });
}

async function readHtmlReportJsonFiles(indexPath: string): Promise<Array<{ name: string; data: unknown }>> {
  const html = fs.readFileSync(indexPath, 'utf8');
  const match = html.match(/<template id="playwrightReportBase64">data:application\/zip;base64,([^<]+)<\/template>/);
  expect(match, 'HTML report debe incluir el zip de datos base64').toBeTruthy();

  const zipPath = path.join(path.dirname(indexPath), 'playwright-report-data.zip');
  fs.writeFileSync(zipPath, Buffer.from(match?.[1] ?? '', 'base64'));

  const { ZipFile } = require('playwright-core/lib/coreBundle').utils as {
    ZipFile: new (fileName: string) => ZipFileReader;
  };
  const zip = new ZipFile(zipPath);
  try {
    const entries = await zip.entries();
    const jsonEntries = entries.filter((entry) => entry.endsWith('.json'));
    const values = [];
    for (const entry of jsonEntries) {
      values.push({ name: entry, data: JSON.parse((await zip.read(entry)).toString('utf8')) });
    }
    return values;
  } finally {
    zip.close();
  }
}

function countFilesNamed(root: string, fileName: string): number {
  if (!fs.existsSync(root)) {
    return 0;
  }

  let count = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      count += countFilesNamed(entryPath, fileName);
    } else if (entry.name === fileName) {
      count += 1;
    }
  }

  return count;
}
