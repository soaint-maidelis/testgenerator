import path from 'path';
import { IncidentReporter } from './incident-reporter';

export default class IncidentReporterDiagnosticHtmlMock extends IncidentReporter {
  constructor() {
    super({
      processIncidentProvider: async () => ({
        provider: 'jira',
        status: 'DUPLICATE',
        incidentId: 'SCRUM-3',
        incidentUrl: 'https://jira.example.test/browse/SCRUM-3',
      }),
      html: {
        outputFolder: path.join(process.cwd(), 'test-results', 'incident-diagnostic-html-report', 'playwright-report'),
        open: 'never',
      },
    });
  }
}
