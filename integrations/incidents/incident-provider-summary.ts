import type { IncidentAttachmentResult, IncidentProviderResult } from './providers/incident-provider.types';

export function formatIncidentProviderSummary(providerResult: IncidentProviderResult, incidentPreviewPath: string): string {
  return [
    'INCIDENT PROVIDER',
    '',
    'Proveedor:',
    providerResult.provider.toUpperCase(),
    '',
    'Estado:',
    formatProviderStatus(providerResult),
    '',
    'Incidente:',
    formatIncidentId(providerResult),
    '',
    'URL:',
    providerResult.incidentUrl ?? 'N/D',
    '',
    'Evidencias:',
    '',
    formatEvidenceAttachment('Screenshot', findEvidence(providerResult, 'screenshot')),
    '',
    formatEvidenceAttachment('Trace', findEvidence(providerResult, 'trace')),
    '',
    formatEvidenceAttachment('Video', findEvidence(providerResult, 'video')),
    '',
    'Incident Preview:',
    incidentPreviewPath,
    '',
  ].join('\n');
}

export function formatProviderStatus(providerResult: IncidentProviderResult): string {
  if (providerResult.status === 'DUPLICATE') {
    return 'DUPLICADO - NO CREADO';
  }

  if (providerResult.status === 'ERROR') {
    return providerResult.operation === 'validate' ? 'ERROR AL VALIDAR INCIDENTE' : 'ERROR AL PROCESAR INCIDENTE';
  }

  if (providerResult.status === 'VALIDATED') {
    return 'VALIDADO - NO CREADO';
  }

  if (providerResult.status === 'SKIPPED') {
    return providerResult.message ? `NO ENVIADO - ${providerResult.message}` : 'NO ENVIADO';
  }

  return providerResult.status;
}

function formatIncidentId(providerResult: IncidentProviderResult): string {
  if (!providerResult.incidentId) {
    return 'N/D';
  }

  return providerResult.provider === 'azure' ? `#${providerResult.incidentId}` : providerResult.incidentId;
}

function findEvidence(providerResult: IncidentProviderResult, type: IncidentAttachmentResult['type']): IncidentAttachmentResult | undefined {
  return providerResult.attachments?.find((attachment) => attachment.type === type);
}

function formatEvidenceAttachment(label: string, attachment: IncidentAttachmentResult | undefined): string {
  if (!attachment) {
    return `${label}:\nN/D`;
  }

  if (attachment.status === 'LINKED') {
    return `${label}:\nADJUNTADO`;
  }

  if (attachment.status === 'ALREADY_LINKED') {
    return `${label}:\nYA EXISTÍA - NO SE VOLVIÓ A ADJUNTAR`;
  }

  if (attachment.status === 'SKIPPED' && attachment.reason === 'VIDEO_DISABLED') {
    return `${label}:\nNO ENVIADO - VIDEO DESACTIVADO`;
  }

  if (attachment.status === 'SKIPPED' && attachment.reason === 'FILE_TOO_LARGE') {
    return `${label}:\nNO ADJUNTADO - ARCHIVO MAYOR A ${formatValue(attachment.maxMb)} MB`;
  }

  if (attachment.status === 'UPLOAD_ERROR') {
    return `${label}:\nERROR AL SUBIR`;
  }

  if (attachment.status === 'LINK_ERROR') {
    return `${label}:\nERROR AL VINCULAR`;
  }

  if (attachment.status === 'FILE_NOT_FOUND' || attachment.status === 'EMPTY_FILE') {
    return `${label}:\nNO ADJUNTADO - ${attachment.status}`;
  }

  if (attachment.status === 'SKIPPED') {
    return `${label}:\nNO ENVIADO`;
  }

  return `${label}:\n${attachment.status}`;
}

function formatValue(value: unknown): string {
  return value === undefined || value === null || value === '' ? 'N/D' : String(value);
}
