import fs from 'fs/promises';
import path from 'path';
import type { IncidentAttachmentResult } from '../incident-provider.types';
import { debug } from '../../incident-logger';
import { TrelloRequestError, type TrelloAttachment } from './trello.types';

const DEFAULT_TRELLO_MAX_ATTACHMENT_MB = 10;

export type TrelloEvidenceFile = {
  type: IncidentAttachmentResult['type'];
  filePath: string;
  fileName?: string;
  maxVideoMb?: number;
  maxAttachmentMb?: number;
};

export async function uploadTrelloEvidenceFiles(
  client: {
    getCardAttachments(cardId: string): Promise<TrelloAttachment[]>;
    uploadAttachment(cardId: string, filePath: string, fileName?: string): Promise<TrelloAttachment>;
  },
  cardId: string,
  files: TrelloEvidenceFile[],
): Promise<IncidentAttachmentResult[]> {
  let existingAttachments: TrelloAttachment[] = [];
  try {
    existingAttachments = await client.getCardAttachments(cardId);
  } catch {
    existingAttachments = [];
  }

  const results: IncidentAttachmentResult[] = [];
  for (const file of files) {
    results.push(await uploadTrelloEvidenceFile(client, cardId, file, existingAttachments));
  }
  return results;
}

export async function uploadTrelloEvidenceFile(
  client: { uploadAttachment(cardId: string, filePath: string, fileName?: string): Promise<TrelloAttachment> },
  cardId: string,
  file: TrelloEvidenceFile,
  existingAttachments: TrelloAttachment[],
): Promise<IncidentAttachmentResult> {
  const fileName = file.fileName ?? path.basename(file.filePath);

  let size = 0;
  try {
    const stat = await fs.stat(file.filePath);
    size = stat.size;
  } catch {
    return { type: file.type, status: 'FILE_NOT_FOUND', fileName };
  }

  if (size === 0) {
    return { type: file.type, status: 'EMPTY_FILE', fileName };
  }

  const maxAttachmentMb = file.maxAttachmentMb ?? readTrelloMaxAttachmentMb();
  if (size > maxAttachmentMb * 1024 * 1024) {
    const result: IncidentAttachmentResult = {
      type: file.type,
      status: 'SKIPPED',
      reason: 'FILE_TOO_LARGE',
      fileName,
      maxMb: maxAttachmentMb,
      size,
    };
    logTrelloEvidenceSkipped(file.type, size, maxAttachmentMb);
    return result;
  }

  if (file.type === 'video' && file.maxVideoMb !== undefined && size > file.maxVideoMb * 1024 * 1024) {
    return { type: file.type, status: 'SKIPPED', reason: 'VIDEO_TOO_LARGE', fileName, maxMb: file.maxVideoMb };
  }

  if (hasTrelloAttachmentWithFileName(existingAttachments, fileName)) {
    return { type: file.type, status: 'ALREADY_LINKED', fileName };
  }

  try {
    const uploaded = await client.uploadAttachment(cardId, file.filePath, fileName);
    return {
      type: file.type,
      status: 'LINKED',
      fileName,
      attachmentId: uploaded.id,
      mimeType: uploaded.mimeType,
      size: uploaded.bytes,
      contentUrl: uploaded.url,
    };
  } catch (error) {
    if (isTrelloAttachmentTooLargeError(error)) {
      return {
        type: file.type,
        status: 'SKIPPED',
        reason: 'FILE_TOO_LARGE',
        fileName,
        maxMb: file.maxAttachmentMb ?? readTrelloMaxAttachmentMb(),
      };
    }

    return {
      type: file.type,
      status: 'UPLOAD_ERROR',
      fileName,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function hasTrelloAttachmentWithFileName(attachments: TrelloAttachment[], fileName: string): boolean {
  const expected = normalizeTrelloFileName(fileName);
  return attachments.some((attachment) => normalizeTrelloFileName(attachment.name) === expected);
}

export function normalizeTrelloFileName(fileName: string): string {
  return fileName.trim().toLowerCase();
}

export function readTrelloMaxAttachmentMb(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.TRELLO_MAX_ATTACHMENT_MB);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TRELLO_MAX_ATTACHMENT_MB;
}

function isTrelloAttachmentTooLargeError(error: unknown): boolean {
  if (error instanceof TrelloRequestError) {
    return error.statusCode === 413;
  }

  return error instanceof Error && /\b413\b/.test(error.message);
}

function logTrelloEvidenceSkipped(type: IncidentAttachmentResult['type'], sizeBytes: number, limitMb: number): void {
  debug('[TRELLO EVIDENCE]', {
    type,
    sizeMB: formatSizeMb(sizeBytes),
    limitMB: limitMb,
    status: 'SKIPPED',
    reason: 'FILE_TOO_LARGE',
  });
}

function formatSizeMb(sizeBytes: number): string {
  const sizeMb = sizeBytes / 1024 / 1024;
  return String(Math.floor(sizeMb * 10) / 10);
}
