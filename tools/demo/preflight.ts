import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { applicationRegistry } from '../../src/composition/application-registry';
import { resolveApplicationProfile } from '../../src/core/config/application-profile.resolver';

async function checkEndpoint(name: string, url: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
}

async function main(): Promise<void> {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(major) || major < 20) throw new Error('Node 20 or newer is required');
  await access(require.resolve('@playwright/test'));
  await access(chromium.executablePath());

  const selected = resolveApplicationProfile(process.env.APP_PROFILE, applicationRegistry);
  if (selected.profile.id !== 'realworld' || selected.profile.apiURL === undefined) {
    throw new Error('APP_PROFILE must resolve to the RealWorld profile with an API URL');
  }

  await Promise.all([
    checkEndpoint('RealWorld frontend', selected.profile.baseURL),
    checkEndpoint('RealWorld API', `${selected.profile.apiURL}/tags`),
  ]);

  const evidenceDirectory = path.resolve('artifacts/preflight');
  const probe = path.join(evidenceDirectory, '.write-check');
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(probe, 'ok', 'utf8');
  await unlink(probe);
  console.log('Demo preflight PASS: Node, dependencies, Chromium, endpoints, profile, and evidence path are ready.');
}

main().catch((error: unknown) => {
  console.error(`Demo preflight BLOCKED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
