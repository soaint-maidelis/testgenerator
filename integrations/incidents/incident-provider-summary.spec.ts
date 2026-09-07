import { expect, test } from '@playwright/test';
import { formatIncidentProviderSummary } from './incident-provider-summary';

test.describe('incident provider summary', () => {
  test('FILE_TOO_LARGE evidence is shown as known size limit', () => {
    const summary = formatIncidentProviderSummary({
      provider: 'trello',
      status: 'CREATED',
      incidentId: 'card-1',
      attachments: [
        { type: 'trace', status: 'SKIPPED', reason: 'FILE_TOO_LARGE', fileName: 'trace.zip', maxMb: 10 },
      ],
    }, 'test-results/incident-previews/preview.txt');

    expect(summary).toContain('Trace:\nNO ADJUNTADO - ARCHIVO MAYOR A 10 MB');
    expect(summary).not.toContain('Trace:\nERROR AL SUBIR');
  });
});
