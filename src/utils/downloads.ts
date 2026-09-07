import path from 'path';
import fs from 'fs';
import { Download, Page } from '@playwright/test';

export async function saveDownload(page: Page, trigger: () => Promise<void>, targetDir = 'artifacts/downloads'): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await trigger();
  const download: Download = await downloadPromise;

  const outputDir = path.resolve(targetDir);
  fs.mkdirSync(outputDir, { recursive: true });

  const filePath = path.join(outputDir, download.suggestedFilename());
  await download.saveAs(filePath);
  return filePath;
}
