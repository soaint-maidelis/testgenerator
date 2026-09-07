import fs from 'fs';
import path from 'path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import {
  loadIncidentRuntimeConfig,
  validateAzurePreviewConfig,
} from '../azure-devops/azure-devops.client';
import { processAzureIncident } from '../azure-devops/azure-devops.service';
import { formatAzureDevOpsSummary } from '../integrations/incidents/azure-devops-summary';
import { formatIncidentProviderSummary } from '../integrations/incidents/incident-provider-summary';
import { debugIncident, sourceFile } from '../integrations/incidents/incident-debug';
import { buildIncidentCandidate, formatIncidentPreview, formatVisibleDiagnosticError } from '../integrations/incidents/incident-builder';
import { debug, error as logError, info, sanitizeIncidentLogValue, warn } from '../integrations/incidents/incident-logger';
import type { AzureIncidentResult, IncidentRuntimeConfig } from '../integrations/incidents/incident.types';
import { processIncidentWithProvider } from '../integrations/incidents/providers/incident-provider.service';
import type { IncidentProviderResult } from '../integrations/incidents/providers/incident-provider.types';

type IncidentReporterDependencies = {
  processAzureIncident?: typeof processAzureIncident;
  processIncidentProvider?: typeof processIncidentWithProvider;
  html?: false | Record<string, unknown>;
};

type PendingIncidentTask = Promise<{ status: 'fulfilled' | 'rejected' }>;
type HtmlReporterLike = {
  onConfigure(config: FullConfig): void;
  onBegin(suite: Suite): void;
  onEnd(result: FullResult): Promise<void>;
  onExit?(): Promise<void>;
  onError?(error: Error, workerInfo?: unknown): void;
};
type HtmlReporterConstructor = new (options: Record<string, unknown>) => HtmlReporterLike;

const HtmlReporter = require('playwright/lib/runner').html.default as HtmlReporterConstructor;

export class IncidentReporter implements Reporter {
  private runtimeConfig: IncidentRuntimeConfig = {
    autoCreateIncidents: false,
    mode: 'preview',
    provider: 'azure',
    azureOrganization: '',
    azureProject: '',
    hasAzurePat: false,
    azureValidateOnly: false,
    azureAttachEvidence: false,
    azureAttachVideo: false,
    azureMaxVideoMb: 50,
    attachEvidence: false,
    attachVideo: false,
    maxVideoMb: 50,
    requestTimeoutMs: 15_000,
    jiraBaseUrl: '',
    jiraProjectKey: '',
    jiraEmail: '',
    hasJiraApiToken: false,
    jiraIssueType: 'Bug',
    jiraValidateOnly: true,
    trelloBoardId: '',
    trelloListId: '',
    hasTrelloApiKey: false,
    hasTrelloToken: false,
    trelloValidateOnly: true,
  };
  private outputDir = path.resolve(process.cwd(), 'test-results');
  private pendingTasks = new Set<PendingIncidentTask>();
  private htmlReporter?: HtmlReporterLike;
  private readonly htmlOptions: false | Record<string, unknown>;

  constructor(private readonly dependencies: IncidentReporterDependencies = {}) {
    this.htmlOptions = dependencies.html ?? false;
  }

  printsToStdio() {
    return true;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.runtimeConfig = loadIncidentRuntimeConfig();
    this.outputDir = resolveIncidentOutputDir(config);
    this.configureHtmlReporter(config, suite);
    debugIncident('reporter:onBegin', {
      reporterFile: sourceFile(__filename),
      provider: this.runtimeConfig.provider,
      mode: this.runtimeConfig.mode,
      autoCreateIncidents: this.runtimeConfig.autoCreateIncidents,
    });

    const validationErrors = validateAzurePreviewConfig(this.runtimeConfig);
    if (validationErrors.length > 0) {
      warn('[INCIDENT PREVIEW]', { status: 'CONFIGURACION INCOMPLETA' });
      for (const error of validationErrors) {
        warn('[INCIDENT PREVIEW]', { message: error });
      }
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== 'failed' && result.status !== 'timedOut') {
      return;
    }

    const candidate = buildIncidentCandidate(test, result);
    alignVisibleDiagnosticError(result, candidate);
    logIncidentSummary(candidate);
    logIncidentReporter('onTestEnd', { caseId: candidate.caseId });
    const task = this.createIncidentTask(test, result, candidate);
    logIncidentReporter('provider-task-created');
    this.pendingTasks.add(task);
    logIncidentReporter('provider-task-registered', { pendingCount: this.pendingTasks.size });

    task.then(({ status }) => {
      this.pendingTasks.delete(task);
      logIncidentReporter('provider-task-finished', { status, pendingCount: this.pendingTasks.size });
    });

    return task.then(() => undefined);
  }

  async onEnd(result?: FullResult) {
    logIncidentReporter('onEnd', { pendingCount: this.pendingTasks.size });

    while (this.pendingTasks.size > 0) {
      logIncidentReporter('await-pending-start');
      await Promise.all([...this.pendingTasks]);
      logIncidentReporter('await-pending-end', { pendingCount: this.pendingTasks.size });
    }

    if (this.htmlReporter && result) {
      await this.htmlReporter.onEnd(result);
    }
  }

  async onExit() {
    await this.htmlReporter?.onExit?.();
  }

  onError(error: Error, workerInfo?: unknown) {
    this.htmlReporter?.onError?.(error, workerInfo);
  }

  getPendingTaskCount() {
    return this.pendingTasks.size;
  }

  private createIncidentTask(test: TestCase, result: TestResult, candidate: ReturnType<typeof buildIncidentCandidate>): PendingIncidentTask {
    const task = this.processIncident(test, result, candidate);

    return task.then(
      () => ({ status: 'fulfilled' as const }),
      (error) => {
        logError('[PROVIDER ERROR]', {
          operation: 'reporter',
          statusCode: 'N/D',
          message: error instanceof Error ? error.message : String(error),
        });
        return { status: 'rejected' as const };
      },
    );
  }

  private async processIncident(test: TestCase, result: TestResult, candidate: ReturnType<typeof buildIncidentCandidate>) {
    const previousRuntimeContext = process.env.AZURE_DEVOPS_RUNTIME_CONTEXT;
    process.env.AZURE_DEVOPS_RUNTIME_CONTEXT = previousRuntimeContext || 'reporter';
    let providerResult: IncidentProviderResult;
    try {
      providerResult = await this.processProvider(candidate);
    } finally {
      restoreRuntimeContext(previousRuntimeContext);
    }
    logProviderResultSummary(providerResult);
    const preview = formatIncidentPreview(candidate, this.runtimeConfig.mode, providerResult as AzureIncidentResult);
    const previewPath = writeIncidentPreviewFile(this.outputDir, test, result, candidate.caseId, preview);
    attachIncidentPreview(result, previewPath, providerResult.provider);
    attachIncidentProviderSummary(result, providerResult, toReportRelativePath(previewPath));

    debugIncident('reporter:onTestEnd', {
      reporterFile: sourceFile(__filename),
      caseId: candidate.caseId,
      testTitle: test.title,
      testTitlePath: test.titlePath(),
      testLocationFile: sourceFile(test.location.file),
      resolvedSpecFile: candidate.specFile,
      evidenceScreenshots: candidate.evidence.screenshot.join(', ') || 'N/D',
      decision: candidate.incidentDecision.decision,
      confidence: candidate.incidentDecision.confidence,
    });

    debug('[INCIDENT PREVIEW DEBUG]', { preview });
    info('[INCIDENT PREVIEW]', { path: toReportRelativePath(previewPath) });
  }

  private async processProvider(candidate: ReturnType<typeof buildIncidentCandidate>): Promise<IncidentProviderResult> {
    if (this.dependencies.processIncidentProvider) {
      return this.dependencies.processIncidentProvider(candidate, this.runtimeConfig);
    }

    if (this.dependencies.processAzureIncident) {
      const azureResult = await this.dependencies.processAzureIncident(candidate, this.runtimeConfig);
      return mapLegacyAzureResultForReporter(azureResult);
    }

    return processIncidentWithProvider(candidate, this.runtimeConfig);
  }

  private configureHtmlReporter(config: FullConfig, suite: Suite): void {
    if (!this.htmlOptions) {
      return;
    }

    const configDir = 'configFile' in config && config.configFile ? path.dirname(config.configFile) : process.cwd();
    this.htmlReporter = new HtmlReporter({
      configDir,
      _mode: 'test',
      ...this.htmlOptions,
    });
    this.htmlReporter.onConfigure(config);
    this.htmlReporter.onBegin(suite);
  }
}

export default IncidentReporter;

function restoreRuntimeContext(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.AZURE_DEVOPS_RUNTIME_CONTEXT;
    return;
  }

  process.env.AZURE_DEVOPS_RUNTIME_CONTEXT = value;
}

function resolveIncidentOutputDir(config: FullConfig): string {
  const firstProjectOutputDir = config.projects[0]?.outputDir;
  return path.resolve(firstProjectOutputDir || path.join(process.cwd(), 'test-results'), 'incident-previews');
}

function writeIncidentPreviewFile(
  outputDir: string,
  test: TestCase,
  result: TestResult,
  caseId: string,
  preview: string,
): string {
  fs.mkdirSync(outputDir, { recursive: true });

  const fileName = `${sanitizeFileName(caseId)}-${sanitizeFileName(test.parent.project()?.name ?? 'project')}-retry-${result.retry}.txt`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, `${preview}\n`, 'utf8');

  return filePath;
}

function attachIncidentPreview(result: TestResult, previewPath: string, provider: IncidentProviderResult['provider']) {
  result.attachments.push({
    name: 'incident-preview',
    contentType: 'text/plain',
    path: previewPath,
  });

  if (provider === 'azure') {
    result.attachments.push({
      name: 'azure-devops-incident-preview',
      contentType: 'text/plain',
      path: previewPath,
    });
  }
}

function attachIncidentProviderSummary(result: TestResult, providerResult: IncidentProviderResult, previewPath: string) {
  result.attachments.push({
    name: 'incident-provider-summary',
    contentType: 'text/plain',
    body: Buffer.from(formatIncidentProviderSummary(providerResult, previewPath), 'utf8'),
  });

  if (providerResult.provider !== 'azure') {
    return;
  }

  result.attachments.push({
    name: 'azure-devops-summary',
    contentType: 'text/plain',
    body: Buffer.from(formatAzureDevOpsSummary(mapProviderResultToLegacyAzureResult(providerResult), previewPath), 'utf8'),
  });
}

function alignVisibleDiagnosticError(result: TestResult, candidate: ReturnType<typeof buildIncidentCandidate>): void {
  const errors = (result.errors ?? []) as Array<NonNullable<TestResult['error']>>;
  const hasDiagnosticError = errors.some(isDiagnosticError) || (result.error ? isDiagnosticError(result.error) : false);

  if (!hasDiagnosticError) {
    alignDiagnosticStepErrors(result, candidate);
    return;
  }

  const finalDiagnostic = makeVisibleDiagnosticError(candidate);
  const nonDiagnosticErrors = errors.filter((error) => !isDiagnosticError(error));
  result.errors.splice(0, result.errors.length, ...nonDiagnosticErrors, finalDiagnostic);

  if (result.error && isDiagnosticError(result.error)) {
    result.error = finalDiagnostic;
  }

  alignDiagnosticStepErrors(result, candidate, finalDiagnostic);
}

function makeVisibleDiagnosticError(candidate: ReturnType<typeof buildIncidentCandidate>): NonNullable<TestResult['error']> {
  const message = formatVisibleDiagnosticError(candidate);
  return {
    message,
    stack: message,
  };
}

function isDiagnosticError(error: NonNullable<TestResult['error']>): boolean {
  return /^DIAGNOSTICO\b|^Error:\s*DIAGNOSTICO\b/im.test(String(error.message ?? ''));
}

function alignDiagnosticStepErrors(
  result: TestResult,
  candidate: ReturnType<typeof buildIncidentCandidate>,
  finalDiagnostic = makeVisibleDiagnosticError(candidate),
): void {
  const steps = (result as unknown as { steps?: Array<Record<string, unknown>> }).steps ?? [];
  for (const step of steps) {
    alignDiagnosticStepError(step, finalDiagnostic);
  }
}

function alignDiagnosticStepError(step: Record<string, unknown>, finalDiagnostic: NonNullable<TestResult['error']>): void {
  const error = step.error;
  if (isDiagnosticStepError(error)) {
    step.error = `Error: ${finalDiagnostic.message}`;
  }

  const steps = Array.isArray(step.steps) ? step.steps : [];
  for (const child of steps) {
    if (child && typeof child === 'object') {
      alignDiagnosticStepError(child as Record<string, unknown>, finalDiagnostic);
    }
  }
}

function isDiagnosticStepError(error: unknown): boolean {
  if (typeof error === 'string') {
    return /^DIAGNOSTICO\b|^Error:\s*DIAGNOSTICO\b/im.test(error);
  }

  if (error && typeof error === 'object') {
    return isDiagnosticError(error as NonNullable<TestResult['error']>);
  }

  return false;
}

function logIncidentReporter(step: string, details: Record<string, unknown> = {}) {
  debug('[INCIDENT REPORTER]', { step, ...details });
}

function logIncidentSummary(candidate: ReturnType<typeof buildIncidentCandidate>): void {
  info('[INCIDENT]', {
    caseId: candidate.caseId,
    classification: candidate.incidentDecision.classification,
    decision: candidate.incidentDecision.decision,
  });
}

function logProviderResultSummary(result: IncidentProviderResult): void {
  const incidentId = result.incidentId ? ` ${result.provider === 'azure' ? '#' : ''}${result.incidentId}` : '';
  info(`[PROVIDER:${result.provider.toUpperCase()}]`);
  console.log(sanitizeIncidentLogValue(`${result.status}${incidentId}`));
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'incident-preview';
}

function toReportRelativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

function mapLegacyAzureResultForReporter(result: AzureIncidentResult): IncidentProviderResult {
  const workItemId = 'workItemId' in result ? result.workItemId : undefined;
  return {
    provider: 'azure',
    status: result.status,
    incidentId: workItemId ? String(workItemId) : undefined,
    incidentUrl: 'url' in result ? result.url : undefined,
    attachments: result.attachments,
    message: 'message' in result ? result.message : 'reason' in result ? result.reason : undefined,
    statusCode: 'statusCode' in result ? result.statusCode : undefined,
    operation: 'operation' in result ? result.operation : undefined,
    duplicateSignature: result.duplicateSignature,
    legacy: workItemId ? { workItemId } : undefined,
  };
}

function mapProviderResultToLegacyAzureResult(result: IncidentProviderResult): AzureIncidentResult {
  const workItemId = Number(result.incidentId);
  if (result.status === 'CREATED') {
    return { status: 'CREATED', workItemId, url: result.incidentUrl, attachments: result.attachments, duplicateSignature: result.duplicateSignature };
  }
  if (result.status === 'DUPLICATE') {
    return { status: 'DUPLICATE', workItemId, url: result.incidentUrl, attachments: result.attachments, duplicateSignature: result.duplicateSignature };
  }
  if (result.status === 'ERROR') {
    return { status: 'ERROR', message: result.message ?? 'ERROR', statusCode: result.statusCode, operation: result.operation, attachments: result.attachments, duplicateSignature: result.duplicateSignature };
  }
  if (result.status === 'VALIDATED') {
    return { status: 'VALIDATED', message: result.message, attachments: result.attachments, duplicateSignature: result.duplicateSignature };
  }
  return { status: 'SKIPPED', reason: result.message ?? 'SKIPPED', attachments: result.attachments, duplicateSignature: result.duplicateSignature };
}
