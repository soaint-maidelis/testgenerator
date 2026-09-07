import fs from 'fs';
import path from 'path';
import type { TestCase, TestResult } from '@playwright/test/reporter';
import { getRoleByProject } from '../../src/config/roles';
import { classifyFailure } from '../../tests/e2e/_globalshared/diagnostics/diagnostic-error';
import type { FailureCause } from '../../tests/e2e/_globalshared/diagnostics/failure-cause';
import { debugIncident, sourceFile } from './incident-debug';
import { decideIncident } from './incident-policy';
import type {
  AzureIncidentResult,
  IncidentAction,
  IncidentCandidate,
  IncidentDecision,
  IncidentEvidence,
  TechnicalDiagnostic,
} from './incident.types';

const CASE_ID_PATTERN = /\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/i;
const DIAGNOSTIC_CAUSE_PATTERN = /Causa probable:\s*([A-Z_]+)/i;
const DIAGNOSTIC_PHASE_PATTERN = /Fase:\s*(.+)/i;
const DIAGNOSTIC_URL_PATTERN = /URL final:\s*(.+)/i;
const DIAGNOSTIC_MESSAGE_PATTERN = /Mensaje:\s*(.+)/i;
const DIAGNOSTIC_EXPECTED_ROLE_PATTERN = /Rol esperado:\s*(.+)/i;
const DIAGNOSTIC_EXPECTED_PROJECT_PATTERN = /Proyecto esperado:\s*(.+)/i;
const DIAGNOSTIC_USED_PROJECT_PATTERN = /Proyecto usado:\s*(.+)/i;
const DIAGNOSTIC_VIEW_PATTERN = /Vista:\s*(.+)/i;
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

type StepLike = {
  title?: string;
  category?: string;
  error?: unknown;
  steps?: StepLike[];
};

export function buildIncidentCandidate(test: TestCase, result: TestResult): IncidentCandidate {
  const errors = collectErrors(result);
  const error = errors[0];
  const errorText = formatErrors(errors);
  const stackText = errors.map((item) => item.stack).filter(Boolean).join('\n');
  const classification = extractClassification(errorText) ?? classifyFailure(error, `${test.location.file}\n${test.title}`);
  const caseId = inferCaseId(test);
  const title = sanitizeTitle(test.title);
  const project = test.parent.project()?.name ?? 'N/D';
  const role = getRoleByProject(project)?.id ?? 'N/D';
  const browser = inferBrowser(project, test.parent.project()?.use.browserName);
  const expected = extractExpected(errorText);
  const received = extractReceived(errorText);
  const expectedResult = buildExpectedResult(errorText, expected);
  const observedResult = buildObservedResult(errorText);
  const timeout = extractTimeout(errorText);
  const finalUrl = extractFinalUrl(errorText, result);
  const phase = extractFailedStep(result) || inferFunctionalPhase(errorText, stackText) || extractDiagnosticValue(errorText, DIAGNOSTIC_PHASE_PATTERN);
  const evidence = collectEvidence(result);
  const specFile = inferSpecFile(test, caseId);
  const block = inferBlock(specFile);
  const errorOrigin = inferErrorOrigin(stackText);
  const diagnosticText = buildDiagnosticSourceText(errorText, result);
  const baseTechnicalDiagnostic = buildTechnicalDiagnostic({
    caseId,
    classification,
    diagnosticText,
    errorText,
    fallbackPhase: phase,
    fallbackMessage: summarizeMessage(errorText),
    fallbackRole: role,
    fallbackProject: project,
    specFile,
    errorOrigin,
    finalUrl,
  });
  const incidentDecision = decideIncident({
    frameworkClassification: classification,
    expectedRole: baseTechnicalDiagnostic.expectedRole,
    usedRole: role,
    expectedProject: baseTechnicalDiagnostic.expectedProject,
    usedProject: project,
    phase,
    message: baseTechnicalDiagnostic.message,
    expected,
    received,
    observedResult,
    errorText,
    stack: stackText,
    contextText: diagnosticText,
    caseTitle: title,
    technicalOrigin: errorOrigin,
    view: baseTechnicalDiagnostic.view,
  });
  const technicalDiagnostic = alignDiagnosticWithFinalDecision(baseTechnicalDiagnostic, incidentDecision, {
    phase,
    errorText,
    finalUrl,
  });
  const bugTitle = buildBugTitle(caseId, buildShortDescription(title, errorText, observedResult, technicalDiagnostic.phase, technicalDiagnostic.view));
  debugIncident('builder:buildIncidentCandidate', {
    builderFile: sourceFile(__filename),
    caseId,
    testTitle: test.title,
    testLocationFile: sourceFile(test.location.file),
    testTitlePath: test.titlePath(),
    classification,
    specFile,
    block,
    phase: technicalDiagnostic.phase,
    message: technicalDiagnostic.message,
    expectedResult,
    playwrightFailureType: classification,
    expectedRole: technicalDiagnostic.expectedRole,
    usedRole: role,
    roleMatches: technicalDiagnostic.expectedRole === 'N/D' || role === 'N/D' || technicalDiagnostic.expectedRole === role,
    expectedProject: technicalDiagnostic.expectedProject,
    usedProject: project,
    projectMatches:
      technicalDiagnostic.expectedProject === 'N/D' || project === 'N/D' || technicalDiagnostic.expectedProject === project,
    view: technicalDiagnostic.view,
    technicalOrigin: errorOrigin,
    evidenceScreenshots: evidence.screenshot.join(', ') || 'N/D',
    decisionAfterPolicy: incidentDecision.decision,
    confidenceAfterPolicy: incidentDecision.confidence,
  });

  return {
    caseId,
    title,
    bugTitle,
    bugDescription: buildBugDescription({
      caseId,
      block,
      title,
      phase: technicalDiagnostic.phase,
      expectedResult,
      expected,
      received,
      observedResult,
      classification,
      project,
      role,
      browser,
      finalUrl,
      errorMessage: technicalDiagnostic.message,
      timeout,
      specFile,
      errorOrigin,
      executedAt: new Date().toISOString(),
    }),
    block,
    specFile,
    project,
    role,
    browser,
    status: result.status.toUpperCase(),
    durationMs: result.duration,
    retry: result.retry,
    finalUrl,
    phase: technicalDiagnostic.phase,
    classification,
    errorMessage: technicalDiagnostic.message,
    expectedResult,
    observedResult,
    stackSummary: summarizeStack(stackText),
    expected,
    received,
    errorOrigin,
    timeout,
    executedAt: new Date().toISOString(),
    evidence,
    action: actionForDecision(incidentDecision.decision),
    technicalDiagnostic,
    incidentDecision,
    originalError: collectOriginalError(result, errorText),
  };
}

export function formatIncidentPreview(candidate: IncidentCandidate, mode: string, azureResult?: AzureIncidentResult): string {
  const diagnostic = candidate.technicalDiagnostic;
  const azureStatus = formatAzureIncidentStatus(azureResult, mode);
  const azureBugId = azureResult && 'workItemId' in azureResult ? azureResult.workItemId : undefined;
  const azureUrl = azureResult && 'url' in azureResult ? azureResult.url : undefined;
  const azureMessage = azureResult && 'message' in azureResult ? azureResult.message : undefined;

  return [
    '==================================================',
    'AZURE DEVOPS INCIDENT PREVIEW',
    '=============================',
    '',
    'Caso:',
    formatValue(candidate.caseId),
    '',
    'Bloque:',
    formatValue(candidate.block),
    '',
    'Titulo:',
    formatValue(candidate.bugTitle),
    '',
    'Estado:',
    formatValue(candidate.status),
    '',
    'Tipo de fallo Playwright:',
    formatValue(candidate.classification),
    '',
    'Clasificacion tecnica:',
    formatValue(candidate.incidentDecision.classification),
    '',
    'Causa probable:',
    formatValue(candidate.incidentDecision.probableCause),
    '',
    'Decision:',
    formatValue(candidate.incidentDecision.decision),
    '',
    'Confianza:',
    formatValue(candidate.incidentDecision.confidence),
    '',
    'Motivo:',
    formatValue(candidate.incidentDecision.reason),
    '',
    'Recomendacion:',
    formatValue(candidate.incidentDecision.recommendation),
    '',
    'Elegibilidad Azure DevOps:',
    formatValue(candidate.incidentDecision.azureDevOpsEligibility),
    '',
    '---',
    '',
    '## DIAGNOSTICO TECNICO',
    '',
    'Error:',
    formatValue(diagnostic.error),
    '',
    'Caso:',
    formatValue(diagnostic.caseId),
    '',
    'Fase:',
    formatValue(diagnostic.phase),
    '',
    'Causa probable:',
    formatValue(candidate.incidentDecision.probableCause),
    '',
    'Mensaje:',
    formatValue(diagnostic.message),
    '',
    'Rol esperado:',
    formatValue(diagnostic.expectedRole),
    '',
    'Proyecto esperado:',
    formatValue(diagnostic.expectedProject),
    '',
    'Proyecto usado:',
    formatValue(diagnostic.usedProject),
    '',
    'Archivo:',
    formatValue(diagnostic.file),
    '',
    'Origen tecnico:',
    formatValue(diagnostic.technicalOrigin),
    '',
    'Vista:',
    formatValue(diagnostic.view),
    '',
    '---',
    '',
    '## RESULTADO',
    '',
    'Resultado esperado:',
    formatValue(candidate.expectedResult),
    '',
    'Expected:',
    formatValue(candidate.expected),
    '',
    'Received:',
    formatValue(candidate.received),
    '',
    'Resultado observado:',
    formatValue(candidate.observedResult),
    '',
    'URL:',
    formatValue(candidate.finalUrl),
    '',
    'Duracion:',
    formatDuration(candidate.durationMs),
    '',
    'Retry:',
    formatValue(candidate.retry),
    '',
    'Timeout:',
    formatValue(candidate.timeout),
    '',
    'Fecha:',
    formatValue(candidate.executedAt),
    '',
    '---',
    '',
    '## EVIDENCIAS',
    '',
    formatEvidence(candidate.evidence),
    '',
    '---',
    '',
    '## AZURE DEVOPS',
    '',
    'Elegibilidad Azure DevOps:',
    formatValue(candidate.incidentDecision.azureDevOpsEligibility),
    '',
    'Estado Azure DevOps:',
    formatValue(azureStatus),
    ...(azureBugId
      ? [
          '',
          'Bug Azure DevOps:',
          `#${azureBugId}`,
        ]
      : []),
    ...(azureUrl
      ? [
          '',
          'URL Azure DevOps:',
          azureUrl,
        ]
      : []),
    ...(azureMessage
      ? [
          '',
          'Detalle Azure DevOps:',
          azureMessage,
        ]
      : []),
    ...(azureResult?.attachments
      ? [
          '',
          'Evidencias Azure DevOps:',
          '',
          formatAzureEvidenceAttachments(azureResult.attachments),
        ]
      : []),
    '',
    '---',
    '',
    '## ERROR ORIGINAL',
    '',
    formatValue(candidate.originalError),
    '',
    '==================================================',
  ].join('\n');
}

export function formatVisibleDiagnosticError(candidate: IncidentCandidate): string {
  const diagnostic = candidate.technicalDiagnostic;
  return [
    'DIAGNOSTICO',
    `Caso: ${candidate.caseId}`,
    `Fase: ${diagnostic.phase}`,
    `Causa probable: ${candidate.incidentDecision.probableCause}`,
    `Mensaje: ${diagnostic.message}`,
    `Rol esperado: ${diagnostic.expectedRole}`,
    `Proyecto esperado: ${diagnostic.expectedProject}`,
    `Proyecto usado: ${diagnostic.usedProject}`,
    `URL final: ${candidate.finalUrl}`,
    `Archivo: ${diagnostic.file}`,
    `Vista: ${diagnostic.view}`,
  ].join('\n');
}

function formatAzureEvidenceAttachments(attachments: NonNullable<AzureIncidentResult['attachments']>): string {
  if (attachments.every((attachment) => attachment.status === 'SKIPPED' && attachment.reason === 'AZURE_DEVOPS_ATTACH_EVIDENCE=false')) {
    return 'NO ENVIADAS - AZURE_DEVOPS_ATTACH_EVIDENCE=false';
  }

  return [
    formatAzureEvidenceAttachment('Screenshot', attachments.find((attachment) => attachment.type === 'screenshot')),
    formatAzureEvidenceAttachment('Trace', attachments.find((attachment) => attachment.type === 'trace')),
    formatAzureEvidenceAttachment('Video', attachments.find((attachment) => attachment.type === 'video')),
  ].join('\n\n');
}

function formatAzureEvidenceAttachment(label: string, attachment: NonNullable<AzureIncidentResult['attachments']>[number] | undefined): string {
  if (!attachment) {
    return `${label}:\nN/D`;
  }

  if (attachment.status === 'LINKED') {
    return `${label}:\nADJUNTADO`;
  }

  if (attachment.status === 'ALREADY_LINKED') {
    return `${label}:\nYA EXISTIA - NO SE VOLVIO A ADJUNTAR`;
  }

  if (attachment.status === 'FILE_NOT_FOUND' || attachment.status === 'EMPTY_FILE') {
    return `${label}:\nNO ADJUNTADO - ${attachment.status}`;
  }

  if (attachment.status === 'SKIPPED') {
    if (attachment.reason === 'VIDEO_DISABLED') {
      return `${label}:\nNO ENVIADO - VIDEO DESACTIVADO`;
    }

    if (attachment.reason === 'VIDEO_TOO_LARGE') {
      return `${label}:\nNO ADJUNTADO - ARCHIVO MAYOR A ${formatValue(attachment.maxMb)} MB`;
    }

    if (attachment.reason === 'FILE_TOO_LARGE') {
      return `${label}:\nNO ADJUNTADO - ARCHIVO MAYOR A ${formatValue(attachment.maxMb)} MB`;
    }

    return `${label}:\nNO ENVIADO`;
  }

  if (attachment.status === 'UPLOAD_ERROR') {
    return `${label}:\nERROR AL SUBIR`;
  }

  if (attachment.status === 'LINK_ERROR') {
    return `${label}:\nERROR AL VINCULAR`;
  }

  return `${label}:\n${attachment.status}`;
}

function formatAzureIncidentStatus(azureResult: AzureIncidentResult | undefined, mode: string): string {
  if (!azureResult) {
    return `NO ENVIADO - INCIDENT_MODE=${formatValue(mode)}`;
  }

  switch (azureResult.status) {
    case 'CREATED':
      return 'CREADO';
    case 'DUPLICATE':
      return 'DUPLICADO - NO CREADO';
    case 'VALIDATED':
      return 'VALIDADO - NO CREADO';
    case 'ERROR':
      if (azureResult.operation === 'validate') {
        return 'ERROR AL VALIDAR INCIDENTE';
      }

      return 'ERROR AL PROCESAR INCIDENTE';
    case 'SKIPPED':
      return `NO ENVIADO - ${azureResult.reason}`;
  }
}

function buildBugDescription(input: {
  caseId: string;
  block: string;
  title: string;
  phase: string;
  expectedResult: string;
  expected: string;
  received: string;
  observedResult: string;
  classification: FailureCause;
  project: string;
  role: string;
  browser: string;
  finalUrl: string;
  errorMessage: string;
  timeout: string;
  specFile: string;
  errorOrigin: string;
  executedAt: string;
}) {
  return [
    `Caso: ${input.caseId}`,
    `Bloque: ${input.block}`,
    `Caso de prueba: ${input.title}`,
    `Paso: ${input.phase}`,
    `Resultado esperado: ${input.expectedResult}`,
    `Resultado obtenido: ${input.observedResult}`,
    `Tipo de fallo Playwright: ${input.classification}`,
    `Proyecto: ${input.project}`,
    `Rol: ${input.role}`,
    `Navegador: ${input.browser}`,
    `URL: ${input.finalUrl}`,
    `Error Playwright: ${input.errorMessage}`,
    `Expected: ${input.expected}`,
    `Received: ${input.received}`,
    `Resultado observado: ${input.observedResult}`,
    `Timeout: ${input.timeout}`,
    `Spec: ${input.specFile}`,
    `Origen: ${input.errorOrigin}`,
    `Fecha: ${input.executedAt}`,
  ].join('\n');
}

function buildShortDescription(title: string, errorText: string, observedResult: string, phase: string, view: string): string {
  const functionalContext = title.replace(/@\S+/g, '').replace(CASE_ID_PATTERN, '').replace(/\s+/g, ' ').trim();
  const missingOption = extractMissingOption(errorText);

  if (missingOption) {
    const shortOption = shortenMissingOptionForTitle(missingOption);
    const viewContext = view !== 'N/D' ? view : extractViewFromTitle(functionalContext);
    return truncate(`No se encuentra la opcion ${shortOption}${viewContext ? ` en ${viewContext}` : ''}`, 120);
  }

  if (isTimeoutFailure(errorText, observedResult)) {
    if (/abrir|navigation|load|naveg/i.test(phase) && view !== 'N/D') {
      return truncate(`Timeout al abrir la vista de ${view}`, 120);
    }

    if (phase !== 'N/D') {
      return truncate(`Timeout en ${phase}`, 120);
    }
  }

  if (observedResult !== 'N/D') {
    return truncate(observedResult, 120);
  }

  return truncate(functionalContext || summarizeMessage(errorText), 120);
}

function buildBugTitle(caseId: string, description: string): string {
  return truncate(`[QA-AUTO][${caseId}] ${description}`, 120);
}

function isTimeoutFailure(errorText: string, observedResult: string): boolean {
  return /Timeout\s+\d+ms|timeout[:=]?\s*\d+\s*ms|tiempo maximo/i.test(`${errorText}\n${observedResult}`);
}

function extractViewFromTitle(value: string): string {
  const match = value.match(/\b(?:en|de)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ\s]+)$/);
  return match?.[1]?.trim() ?? '';
}

function shortenMissingOptionForTitle(value: string): string {
  return value.replace(/\s+en el menu de acciones$/i, '').trim();
}

function actionForDecision(decision: IncidentDecision): IncidentAction {
  switch (decision) {
    case 'BUG_AUTO':
      return 'CANDIDATO A BUG';
    case 'BUG_REVIEW':
      return 'CANDIDATO A BUG - REVISION';
    case 'AUTOMATION_ISSUE':
      return 'REVISION MANUAL';
    default:
      return 'NO CANDIDATO';
  }
}

function inferCaseId(test: TestCase): string {
  const metadata = test.annotations.find((annotation) => /case.?id/i.test(annotation.type))?.description;
  const identity = [metadata, test.title, ...test.titlePath(), test.location.file].filter(Boolean).join('\n');
  const match = identity.match(CASE_ID_PATTERN);
  return match ? match[1].toUpperCase() : 'N/D';
}

function inferBlock(specFile: string): string {
  const match = normalizePath(specFile).match(/tests\/e2e\/([^/]+)/i);

  if (!match) {
    return 'N/D';
  }

  return match[1];
}

function collectEvidence(result: TestResult): IncidentEvidence {
  const evidence: IncidentEvidence = {
    screenshot: [],
    video: [],
    trace: [],
    htmlReport: ['playwright-report/index.html'],
    logs: [],
  };

  for (const attachment of result.attachments) {
    if (!attachment.path) {
      continue;
    }

    const attachmentPath = normalizePath(attachment.path);
    const name = attachment.name.toLowerCase();
    const contentType = attachment.contentType.toLowerCase();

    if (name.includes('screenshot') || contentType.includes('image/png')) {
      evidence.screenshot.push(attachmentPath);
    } else if (name.includes('video') || contentType.includes('video')) {
      evidence.video.push(attachmentPath);
    } else if (name.includes('trace') || attachmentPath.endsWith('/trace.zip')) {
      evidence.trace.push(attachmentPath);
    } else if (name.includes('html') || contentType.includes('text/html')) {
      evidence.htmlReport.push(attachmentPath);
    } else {
      evidence.logs.push(attachmentPath);
    }
  }

  return evidence;
}

function buildDiagnosticSourceText(errorText: string, result: TestResult): string {
  const attachmentText = result.attachments
    .filter((attachment) => attachment.path && /error-context|log/i.test(attachment.name))
    .map((attachment) => readTextFile(attachment.path!))
    .filter(Boolean)
    .join('\n');

  return [errorText, attachmentText].filter(Boolean).join('\n');
}

function buildTechnicalDiagnostic(input: {
  caseId: string;
  classification: FailureCause;
  diagnosticText: string;
  errorText: string;
  fallbackPhase: string;
  fallbackMessage: string;
  fallbackRole: string;
  fallbackProject: string;
  specFile: string;
  errorOrigin: string;
  finalUrl: string;
}): TechnicalDiagnostic {
  const expectedRole = extractDiagnosticValue(input.diagnosticText, DIAGNOSTIC_EXPECTED_ROLE_PATTERN);
  const expectedProject = extractDiagnosticValue(input.diagnosticText, DIAGNOSTIC_EXPECTED_PROJECT_PATTERN);
  const usedProject = extractDiagnosticValue(input.diagnosticText, DIAGNOSTIC_USED_PROJECT_PATTERN);
  const diagnosticMessage = extractDiagnosticValue(input.diagnosticText, DIAGNOSTIC_MESSAGE_PATTERN);
  const diagnosticView = extractDiagnosticValue(input.diagnosticText, DIAGNOSTIC_VIEW_PATTERN);

  return {
    error: buildTechnicalError(input.classification, input.errorText),
    caseId: input.caseId,
    phase: firstAvailable([input.fallbackPhase, extractDiagnosticValue(input.diagnosticText, DIAGNOSTIC_PHASE_PATTERN)]),
    probableCause: input.classification,
    message: firstAvailable([extractAssertionMessage(input.errorText), diagnosticMessage, input.fallbackMessage]),
    expectedRole: firstAvailable([expectedRole, input.fallbackRole]),
    expectedProject: firstAvailable([expectedProject, input.fallbackProject]),
    usedProject: firstAvailable([usedProject, input.fallbackProject]),
    file: inferDiagnosticFile(input.errorOrigin, input.specFile),
    technicalOrigin: input.errorOrigin,
    view: firstAvailable([diagnosticView, inferViewFromUrl(input.finalUrl)]),
  };
}

function alignDiagnosticWithFinalDecision(
  diagnostic: TechnicalDiagnostic,
  decision: ReturnType<typeof decideIncident>,
  input: { phase: string; errorText: string; finalUrl: string },
): TechnicalDiagnostic {
  return {
    ...diagnostic,
    phase: firstAvailable([input.phase, diagnostic.phase]),
    probableCause: decision.probableCause,
    message: firstAvailable([extractAssertionMessage(input.errorText), diagnostic.message]),
    view: firstAvailable([diagnostic.view, inferViewFromUrl(input.finalUrl)]),
  };
}

function buildTechnicalError(classification: FailureCause, errorText: string): string {
  if (/element\(s\) not found/i.test(errorText)) {
    return 'ELEMENT_NOT_FOUND';
  }

  if (/Timeout\s+\d+ms|timeout[:=]?\s*\d+\s*ms/i.test(errorText)) {
    return 'TIMEOUT';
  }

  return classification;
}

function inferDiagnosticFile(errorOrigin: string, specFile: string): string {
  if (errorOrigin !== 'N/D') {
    return errorOrigin.replace(/:\d+(?::\d+)?$/, '');
  }

  return specFile;
}

function extractAssertionMessage(errorText: string): string {
  const message = Array.from(errorText.matchAll(/^Error:\s*([^\n]+)$/gim))
    .map((match) => match[1])
    .find((value) => value && !/^DIAGNOSTICO$/i.test(value.trim()));
  return message ? cleanLine(message) : 'N/D';
}

function inferFunctionalPhase(errorText: string, stackText: string): string {
  const source = `${errorText}\n${stackText}`;

  if (
    /Debe existir la opcion\s+Eliminar\s+en el menu de acciones/i.test(source) ||
    /(?:am|gf|gt)-delete-record\.ts/i.test(source) ||
    /\bopenDeleteAction\b/i.test(source)
  ) {
    return 'Ejecutar accion Eliminar desde la tabla';
  }

  return '';
}

function inferViewFromUrl(url: string): string {
  if (url === 'N/D') {
    return 'N/D';
  }

  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    return lastSegment ? titleFromSlug(lastSegment) : 'N/D';
  } catch {
    return 'N/D';
  }
}

function titleFromSlug(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function firstAvailable(values: string[]): string {
  return values.find((value) => value && value !== 'N/D') ?? 'N/D';
}

function extractFinalUrl(errorText: string, result: TestResult): string {
  const diagnosticUrl = extractDiagnosticValue(errorText, DIAGNOSTIC_URL_PATTERN);
  if (diagnosticUrl !== 'N/D') {
    return diagnosticUrl;
  }

  for (const attachment of result.attachments) {
    if (!attachment.path || !/error-context|log/i.test(attachment.name)) {
      continue;
    }

    const attachmentText = readTextFile(attachment.path);
    const attachmentUrl = extractDiagnosticValue(attachmentText, DIAGNOSTIC_URL_PATTERN);
    if (attachmentUrl !== 'N/D') {
      return attachmentUrl;
    }
  }

  return 'N/D';
}

function extractFailedStep(result: TestResult): string {
  const steps = (result as unknown as { steps?: StepLike[] }).steps ?? [];
  const failedStep = findDeepestFailedFunctionalStep(steps);
  return failedStep?.title ? cleanStepTitle(failedStep.title) : '';
}

function findDeepestFailedFunctionalStep(steps: StepLike[]): StepLike | undefined {
  for (const step of steps) {
    const child = findDeepestFailedFunctionalStep(step.steps ?? []);
    if (child) {
      return child;
    }

    if (step.error && isFunctionalStep(step)) {
      return step;
    }
  }

  return undefined;
}

function isFunctionalStep(step: StepLike): boolean {
  const title = step.title ?? '';
  const category = step.category ?? '';

  if (!title.trim()) {
    return false;
  }

  if (category && category !== 'test.step') {
    return false;
  }

  return !/^(Before Hooks|After Hooks|expect\.|locator\.|page\.|browser\.|context\.)/i.test(title);
}

function cleanStepTitle(value: string): string {
  return cleanLine(value.replace(/^test\.step[:\s-]*/i, ''));
}

function inferSpecFile(test: TestCase, _caseId: string): string {
  const titlePathSpec = test.titlePath().find((part) => /\.spec\.ts$/i.test(part));
  if (titlePathSpec) {
    return normalizePath(path.isAbsolute(titlePathSpec) ? titlePathSpec : path.join(process.cwd(), 'tests', 'e2e', titlePathSpec));
  }

  return normalizePath(test.location.file);
}

function inferErrorOrigin(stack: string | undefined): string {
  if (!stack) {
    return 'N/D';
  }

  const cleanStack = stripAnsi(stack);
  const linePattern = /(?:\(([^()]+\.ts):(\d+):(\d+)\)|at\s+([^()\n]+\.ts):(\d+):(\d+))/gi;
  let match: RegExpExecArray | null;

  while ((match = linePattern.exec(cleanStack))) {
    const file = match[1] ?? match[4];
    const line = match[2] ?? match[5];

    if (/node_modules|diagnostic-error|base\.fixture/i.test(file)) {
      continue;
    }

    return `${normalizePath(file)}:${line}`;
  }

  return 'N/D';
}

function formatEvidence(evidence: IncidentEvidence): string {
  return [
    field('Screenshot', evidence.screenshot.length ? evidence.screenshot.map(formatValue).join(', ') : 'N/D'),
    field('Video', evidence.video.length ? evidence.video.map(formatValue).join(', ') : 'N/D'),
    field('Trace', evidence.trace.length ? evidence.trace.map(formatValue).join(', ') : 'N/D'),
    field('HTML report', evidence.htmlReport.length ? evidence.htmlReport.map(formatValue).join(', ') : 'N/D'),
    field('Logs', evidence.logs.length ? evidence.logs.map(formatValue).join(', ') : 'N/D'),
  ].join('\n\n');
}

function field(label: string, value: unknown): string {
  return `${label}:\n${formatValue(value)}`;
}

function extractClassification(errorText: string): FailureCause | undefined {
  const match = errorText.match(DIAGNOSTIC_CAUSE_PATTERN);
  const value = match?.[1] as FailureCause | undefined;
  const valid: FailureCause[] = [
    'AUTH_FAILURE',
    'NAV_FAILURE',
    'PERMISSION_FAILURE',
    'DATA_FAILURE',
    'PROCESSING_TIMEOUT',
    'ASSERTION_FAILURE',
    'ENV_FAILURE',
  ];

  return value && valid.includes(value) ? value : undefined;
}

function extractDiagnosticValue(errorText: string, pattern: RegExp): string {
  const match = errorText.match(pattern);
  const value = match?.[1]?.trim();
  return value && !/no disponible|no inferido/i.test(value) ? value : 'N/D';
}

function extractExpected(errorText: string): string {
  return extractMultilineValue(errorText, /Expected(?: value)?:\s*([\s\S]*?)(?:\n\s*(?:Received|Call log|Timeout|Error|Stack|Actual)|$)/i);
}

function extractReceived(errorText: string): string {
  return extractMultilineValue(errorText, /Received(?: value)?:\s*([\s\S]*?)(?:\n\s*(?:Expected|Call log|Timeout|Error|Stack|Actual)|$)/i);
}

function buildExpectedResult(errorText: string, expected: string): string {
  const missingOption = extractMissingOption(errorText);

  if (missingOption && /^visible$/i.test(expected)) {
    return `La opcion ${missingOption} debe estar visible.`;
  }

  if (expected !== 'N/D') {
    return expected;
  }

  const assertionMessage = errorText.match(/^Error:\s*([^\n]+)$/im)?.[1];
  return assertionMessage ? cleanLine(assertionMessage) : 'N/D';
}

function buildObservedResult(errorText: string): string {
  const missingOption = extractMissingOption(errorText);
  const timeout = extractTimeout(errorText);

  if (missingOption && /element\(s\) not found/i.test(errorText)) {
    return timeout === 'N/D'
      ? `No se encontro la opcion ${missingOption}.`
      : `No se encontro la opcion ${missingOption} dentro del tiempo maximo de ${timeout}.`;
  }

  const notFound = errorText.match(/Error:\s*(element\(s\) not found)/i)?.[1];
  if (notFound) {
    return notFound;
  }

  const received = extractReceived(errorText);
  if (received !== 'N/D') {
    return received;
  }

  const callLogWait = errorText.match(/waiting for ([^\n]+)/i)?.[1];
  if (callLogWait) {
    return truncate(`No se encontro ${cleanLocatorForText(callLogWait)}${timeout !== 'N/D' ? ` dentro del tiempo maximo de ${timeout}` : ''}.`, 300);
  }

  return summarizeMessage(errorText);
}

function extractMissingOption(errorText: string): string | undefined {
  const explicitMessage = errorText.match(/Debe existir la opcion\s+([^.\n]+)\./i)?.[1];
  if (explicitMessage) {
    return cleanLine(explicitMessage);
  }

  const roleOption = errorText.match(/getByRole\('option',\s*\{\s*name:\s*\/\^([^$/]+)\$\//i)?.[1];
  if (roleOption) {
    return cleanLine(roleOption);
  }

  return undefined;
}

function extractTimeout(errorText: string): string {
  const match = errorText.match(/Timeout\s+(\d+)ms|timeout[:=]?\s*(\d+)\s*ms/i);
  const value = match?.[1] ?? match?.[2];
  return value ? `${value} ms` : 'N/D';
}

function extractMultilineValue(errorText: string, pattern: RegExp): string {
  const value = errorText.match(pattern)?.[1]?.trim();
  return value ? truncate(cleanLine(value), 300) : 'N/D';
}

function summarizeMessage(errorText: string): string {
  const lines = errorText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^DIAGN|Caso:|Fase:|Causa probable:|Mensaje:|Rol esperado:|Proyecto esperado:|Proyecto usado:|URL final:|Archivo:|Vista:/i.test(line));

  return truncate(cleanLine(lines[0] ?? errorText), 500) || 'N/D';
}

function cleanLocatorForText(value: string): string {
  const option = extractMissingOption(value);
  if (option) {
    return `la opcion ${option}`;
  }

  return value.replace(/\.first\(\)$/i, '').replace(/\s+/g, ' ').trim();
}

function summarizeStack(stack: string | undefined): string {
  if (!stack) {
    return 'N/D';
  }

  return stripAnsi(stack)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/node_modules|diagnostic-error|base\.fixture/i.test(line))
    .slice(0, 6)
    .join('\n') || 'N/D';
}

function formatError(error: TestResult['error']): string {
  if (!error) {
    return 'N/D';
  }

  const message = error.message ? String(error.message) : '';
  const stack = error.stack ? String(error.stack) : '';
  const value = error.value ? String(error.value) : '';
  const normalizedMessage = normalizeForComparison(stripAnsi(message));
  const normalizedStack = normalizeForComparison(stripAnsi(stack));
  const parts = normalizedMessage && normalizedStack.includes(normalizedMessage) ? [stack] : [message, stack];

  if (value && value !== message && value !== stack) {
    parts.push(value);
  }

  return stripAnsi(parts.filter(Boolean).join('\n'));
}

function collectErrors(result: TestResult): NonNullable<TestResult['error']>[] {
  if (result.errors.length > 0) {
    return result.errors;
  }

  return result.error ? [result.error] : [];
}

function formatErrors(errors: NonNullable<TestResult['error']>[]): string {
  const formatted = errors.map((error) => formatError(error)).filter((value) => value && value !== 'N/D');
  return formatted.length ? Array.from(new Set(formatted)).join('\n\n') : 'N/D';
}

function collectOriginalError(result: TestResult, fallbackErrorText: string): string {
  const sections = collectErrorSources(result, fallbackErrorText)
    .map((section) => extractOriginalPlaywrightError(section))
    .map(formatOriginalErrorForConsole);
  const uniqueSections = dedupeExactSections(sections);

  return uniqueSections.length ? uniqueSections.join('\n\n') : 'N/D';
}

function collectErrorSources(result: TestResult, fallbackErrorText: string): string[] {
  const sources: string[] = [];
  const seen = new Set<string>();

  if (result.error) {
    addErrorSource(sources, seen, result.error);
  }

  for (const error of result.errors) {
    addErrorSource(sources, seen, error);
  }

  if (sources.length === 0) {
    sources.push(fallbackErrorText);
  }

  return sources;
}

function addErrorSource(sources: string[], seen: Set<string>, error: NonNullable<TestResult['error']>) {
  const formatted = formatError(error);
  const signature = errorSignature(error, formatted);

  if (!formatted || formatted === 'N/D' || seen.has(signature)) {
    return;
  }

  seen.add(signature);
  sources.push(formatted);
}

function errorSignature(error: NonNullable<TestResult['error']>, formatted: string): string {
  const location = error.location ? `${error.location.file}:${error.location.line}:${error.location.column}` : '';
  const original = extractOriginalPlaywrightError(formatted);
  const significantLines = normalizeForComparison(original)
    .split('\n')
    .filter((line) => line.trim())
    .slice(0, 20)
    .join('\n');

  return normalizeForComparison([error.message ?? '', location, significantLines].filter(Boolean).join('\n'));
}

function dedupeExactSections(sections: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const section of sections) {
    const cleanSection = section.trim();
    const comparisonKey = normalizeForComparison(cleanSection);
    if (!cleanSection || cleanSection === 'N/D' || seen.has(comparisonKey)) {
      continue;
    }

    seen.add(comparisonKey);
    unique.push(cleanSection);
  }

  return unique;
}

function extractOriginalPlaywrightError(value: string): string {
  const text = stripAnsi(value).trim();
  const marker = text.match(/(?:^|\n)ERROR ORIGINAL:?\s*\n/i);

  if (!marker || marker.index === undefined) {
    return compactOriginalError(removeDiagnosticBlock(text));
  }

  const original = text.slice(marker.index + marker[0].length).trim();
  const stackParts = original.split(/\nSTACK ORIGINAL:?\s*\n/i);
  const mainError = stackParts[0]?.trim() ?? '';
  const originalStack = stackParts.slice(1).join('\nSTACK ORIGINAL\n').trim();

  if (!originalStack || hasStackFrame(mainError)) {
    return compactOriginalError(mainError);
  }

  return compactOriginalError([mainError, originalStack].filter(Boolean).join('\n'));
}

function removeDiagnosticBlock(value: string): string {
  if (!/^(Error:\s*)?DIAGN/i.test(value)) {
    return value;
  }

  const lines = value.split('\n');
  const firstErrorIndex = lines.findIndex((line, index) => index > 0 && /^Error:\s+/i.test(line) && !/^Error:\s*DIAGN/i.test(line));
  return firstErrorIndex > -1 ? lines.slice(firstErrorIndex).join('\n').trim() : '';
}

function hasStackFrame(value: string): boolean {
  return /\n\s*at\s+.+:\d+:\d+/i.test(value);
}

function normalizeForComparison(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function compactOriginalError(value: string): string {
  const blocks = splitRepeatedPlaywrightBlocks(value).map(dedupeStackFrames);
  const uniqueBlocks = dedupeEquivalentErrorBlocks(blocks);

  return uniqueBlocks.join('\n\n');
}

function splitRepeatedPlaywrightBlocks(value: string): string[] {
  return value
    .split(/\n{2,}(?=(?:Error|TimeoutError):\s+[^\n]+(?:\n\n(?:expect|Locator)|\n={3,}|\nCall log:))/i)
    .map((block) => block.trim())
    .filter(Boolean);
}

function dedupeStackFrames(value: string): string {
  const seenFrames = new Set<string>();

  return value
    .split('\n')
    .filter((line) => {
      const frame = line.trim();
      if (!/^at\s+/i.test(frame)) {
        return true;
      }

      if (seenFrames.has(frame)) {
        return false;
      }

      seenFrames.add(frame);
      return true;
    })
    .join('\n')
    .trim();
}

function dedupeEquivalentErrorBlocks(blocks: string[]): string[] {
  const bySignature = new Map<string, string>();

  for (const block of blocks) {
    const signature = normalizeForComparison(block.replace(/^\s*at\s+.+$/gim, ''));
    const current = bySignature.get(signature);

    if (!current || scoreOriginalErrorBlock(block) > scoreOriginalErrorBlock(current)) {
      bySignature.set(signature, block);
    }
  }

  return Array.from(bySignature.values());
}

function scoreOriginalErrorBlock(value: string): number {
  return (hasStackFrame(value) ? 1000 : 0) + value.length;
}

function formatOriginalErrorForConsole(value: string): string {
  return redactSecrets(stripAnsi(value).replace(/^ERROR ORIGINAL$/gim, 'ERROR ORIGINAL:'));
}

function redactSecrets(value: string): string {
  return value
    .replace(/\b(AZURE_DEVOPS_PAT|PAT|password|secret|access_token|refresh_token)(\s*[:=]\s*)([^\s&]+)/gi, '$1$2[REDACTED]')
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]');
}

function inferBrowser(projectName: string, browserName: unknown): string {
  if (typeof browserName === 'string' && browserName.trim()) {
    return browserName;
  }

  if (/chromium/i.test(projectName)) return 'chromium';
  if (/firefox/i.test(projectName)) return 'firefox';
  if (/webkit/i.test(projectName)) return 'webkit';
  return 'N/D';
}

function sanitizeTitle(value: string): string {
  return value.replace(/@\S+/g, '').replace(CASE_ID_PATTERN, '').replace(/\s+/g, ' ').trim() || 'N/D';
}

function cleanLine(value: string): string {
  return stripAnsi(value).replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const limit = maxLength - 3;
  const cut = value.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  const safeCut = lastSpace > 20 ? cut.slice(0, lastSpace) : cut;

  return `${safeCut.trimEnd()}...`;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return 'N/D';
  }

  const text = String(value).trim();
  return text && !/^(undefined|null|unknown|n\/a)$/i.test(text) ? text : 'N/D';
}

function formatDuration(value: unknown): string {
  const duration = formatValue(value);
  return duration === 'N/D' ? duration : `${duration} ms`;
}

function normalizePath(value: string): string {
  return path.relative(process.cwd(), value).replace(/\\/g, '/');
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

function readTextFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}
