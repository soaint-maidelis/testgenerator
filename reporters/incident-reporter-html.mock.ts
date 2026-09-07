import { IncidentReporter } from './incident-reporter';
import type { AzureIncidentResult } from '../integrations/incidents/incident.types';
import path from 'path';

let callCount = 0;

export default class IncidentReporterHtmlMock extends IncidentReporter {
  constructor() {
    super({
      processAzureIncident: async () => {
        await delay(100);
        return mockAzureResult();
      },
      html: {
        outputFolder: path.join(process.cwd(), 'test-results', 'incident-html-report', 'playwright-report'),
        open: 'never',
      },
    });
  }
}

function mockAzureResult(): AzureIncidentResult {
  callCount += 1;

  if (callCount === 2) {
    return {
      status: 'DUPLICATE',
      workItemId: 60724,
      attachments: [
        { type: 'screenshot', status: 'ALREADY_LINKED', fileName: 'screenshot.png' },
        { type: 'trace', status: 'ALREADY_LINKED', fileName: 'trace.zip' },
        { type: 'video', status: 'SKIPPED', reason: 'VIDEO_DISABLED', fileName: 'video.webm' },
      ],
    };
  }

  return {
    status: 'CREATED',
    workItemId: 60788,
    attachments: [
      { type: 'screenshot', status: 'LINKED', fileName: 'screenshot.png' },
      { type: 'trace', status: 'LINKED', fileName: 'trace.zip' },
      { type: 'video', status: 'LINKED', fileName: 'video.webm' },
    ],
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
