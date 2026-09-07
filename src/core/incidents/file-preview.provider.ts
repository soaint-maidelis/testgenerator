import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { safeArtifactSegment, sanitizeSensitiveText } from '../security/sanitize';
import type { IncidentArtifact, IncidentModel, IncidentProvider } from './incident.types';

export class FilePreviewProvider implements IncidentProvider {
  readonly id = 'file';
  readonly #outputDirectory: string;

  constructor(outputDirectory = 'artifacts/incidents') {
    const workspace = path.resolve(process.cwd());
    const resolved = path.resolve(workspace, outputDirectory);
    if (resolved !== workspace && !resolved.startsWith(`${workspace}${path.sep}`)) {
      throw new Error('Incident preview output must remain inside the current workspace');
    }
    this.#outputDirectory = resolved;
  }

  async writePreview(incident: IncidentModel): Promise<IncidentArtifact> {
    if (!incident.simulated) {
      throw new Error('FilePreviewProvider accepts simulated incidents only');
    }

    await mkdir(this.#outputDirectory, { recursive: true });
    const createdAt = new Date().toISOString();
    const fileName = `${safeArtifactSegment(incident.applicationId)}-${safeArtifactSegment(incident.caseId)}.json`;
    const outputPath = path.join(this.#outputDirectory, fileName);
    const safeIncident = {
      ...incident,
      title: sanitizeSensitiveText(incident.title),
      error: sanitizeSensitiveText(incident.error),
      classification: {
        ...incident.classification,
        reason: sanitizeSensitiveText(incident.classification.reason),
      },
      ...(incident.context === undefined ? {} : {
        context: Object.fromEntries(
          Object.entries(incident.context).map(([key, value]) => [key, sanitizeSensitiveText(value)]),
        ),
      }),
    };
    await writeFile(outputPath, `${JSON.stringify(safeIncident, null, 2)}\n`, 'utf8');

    return { providerId: this.id, path: path.relative(process.cwd(), outputPath), createdAt };
  }
}
