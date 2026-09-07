import fs from 'fs/promises';
import path from 'path';
import type { IncidentAttachmentResult } from '../incident-provider.types';
import type { JiraClient } from './jira.client';
import type { JiraAttachment } from './jira.types';

export type JiraEvidenceFile = {
  type: IncidentAttachmentResult['type'];
  filePath: string;
  fileName?: string;
  maxVideoMb?: number;
};

export async function uploadJiraEvidenceFiles(
  client: Pick<JiraClient, 'getIssueAttachments' | 'uploadAttachment'>,
  issueKey: string,
  files: JiraEvidenceFile[],
): Promise<IncidentAttachmentResult[]> {
  let existingAttachments: JiraAttachment[] = [];
  try {
    existingAttachments = await client.getIssueAttachments(issueKey);
  } catch {
    existingAttachments = [];
  }

  const results: IncidentAttachmentResult[] = [];
  for (const file of files) {
    results.push(await uploadJiraEvidenceFile(client, issueKey, file, existingAttachments));
  }
  return results;
}

export async function uploadJiraEvidenceFile(
  client: Pick<JiraClient, 'uploadAttachment'>,
  issueKey: string,
  file: JiraEvidenceFile,
  existingAttachments: JiraAttachment[],
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

  if (file.type === 'video' && file.maxVideoMb !== undefined && size > file.maxVideoMb * 1024 * 1024) {
    return { type: file.type, status: 'SKIPPED', reason: 'VIDEO_TOO_LARGE', fileName, maxMb: file.maxVideoMb };
  }

  if (hasAttachmentWithFileName(existingAttachments, fileName)) {
    return { type: file.type, status: 'ALREADY_LINKED', fileName };
  }

  try {
    const uploaded = await client.uploadAttachment(issueKey, file.filePath, fileName);
    const attachment = findUploadedAttachment(uploaded, fileName);
    return {
      type: file.type,
      status: 'LINKED',
      fileName,
      attachmentId: attachment?.id,
      mimeType: attachment?.mimeType,
      size: attachment?.size,
      contentUrl: attachment?.content,
    };
  } catch (error) {
    return {
      type: file.type,
      status: 'UPLOAD_ERROR',
      fileName,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function hasAttachmentWithFileName(attachments: JiraAttachment[], fileName: string): boolean {
  const expected = normalizeFileName(fileName);
  return attachments.some((attachment) => normalizeFileName(attachment.filename) === expected);
}

export function normalizeFileName(fileName: string): string {
  return fileName.trim().toLowerCase();
}

function findUploadedAttachment(attachments: JiraAttachment[], fileName: string): JiraAttachment | undefined {
  return attachments.find((attachment) => normalizeFileName(attachment.filename) === normalizeFileName(fileName)) ?? attachments[0];
}
