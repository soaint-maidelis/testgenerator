import { access } from 'node:fs/promises';
import { basename } from 'node:path';

import type { IncidentModel } from '../core/incidents/incident.types';
import type { EvidenceKind } from '../core/results/normalized-test-result.types';

export type EvidenceUploadStatus = 'LINKED' | 'FILE_NOT_FOUND' | 'UPLOAD_ERROR' | 'SKIPPED';

export interface EvidenceUploadResult {
  readonly kind: EvidenceKind;
  readonly path: string;
  readonly fileName: string;
  readonly status: EvidenceUploadStatus;
  readonly message?: string;
}

export async function uploadIncidentEvidence(
  incident: IncidentModel,
  upload: (filePath: string, fileName: string, kind: EvidenceKind) => Promise<void>,
): Promise<readonly EvidenceUploadResult[]> {
  const results: EvidenceUploadResult[] = [];
  const evidence = incident.evidence.filter((item) => (
    item.kind === 'screenshot' || item.kind === 'video' || item.kind === 'trace'
  ));

  for (const item of evidence) {
    const fileName = `${incident.caseId}-${item.kind}-${basename(item.path)}`;
    try {
      await access(item.path);
    } catch {
      results.push({ kind: item.kind, path: item.path, fileName, status: 'FILE_NOT_FOUND' });
      continue;
    }

    try {
      await upload(item.path, fileName, item.kind);
      results.push({ kind: item.kind, path: item.path, fileName, status: 'LINKED' });
    } catch (error) {
      results.push({
        kind: item.kind,
        path: item.path,
        fileName,
        status: 'UPLOAD_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
