import type { AzureEvidenceAttachmentResult, AzureIncidentResult } from './incident.types';
import { mapAzureResultToProviderResult } from './providers/azure/azure.provider';
import { formatIncidentProviderSummary } from './incident-provider-summary';

export function formatAzureDevOpsSummary(azureResult: AzureIncidentResult, incidentPreviewPath: string): string {
  return formatIncidentProviderSummary(mapAzureResultToProviderResult(azureResult), incidentPreviewPath)
    .replace('INCIDENT PROVIDER', 'AZURE DEVOPS')
    .replace('Proveedor:\nAZURE\n\n', '')
    .replace('Incidente:', 'Bug Azure DevOps:');
}

function formatAzureStatus(azureResult: AzureIncidentResult): string {
  switch (azureResult.status) {
    case 'CREATED':
      return 'CREATED';
    case 'DUPLICATE':
      return 'DUPLICADO - NO CREADO';
    case 'VALIDATED':
      return 'VALIDADO - NO CREADO';
    case 'ERROR':
      return azureResult.operation === 'validate' ? 'ERROR AL VALIDAR INCIDENTE' : 'ERROR AL PROCESAR INCIDENTE';
    case 'SKIPPED':
      return `NO ENVIADO - ${azureResult.reason}`;
  }
}

function formatAzureBug(azureResult: AzureIncidentResult): string {
  return 'workItemId' in azureResult && azureResult.workItemId ? `#${azureResult.workItemId}` : 'N/D';
}

function findEvidence(
  azureResult: AzureIncidentResult,
  type: AzureEvidenceAttachmentResult['type'],
): AzureEvidenceAttachmentResult | undefined {
  return azureResult.attachments?.find((attachment) => attachment.type === type);
}

function formatAzureEvidenceAttachment(label: string, attachment: AzureEvidenceAttachmentResult | undefined): string {
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
