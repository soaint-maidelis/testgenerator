import path from 'node:path';

import type { InputAdapter, InputDocument } from '../../core/input/input-adapter.types';
import type { InputNormalizationContext, NormalizedCatalogCase, NormalizedTestCatalog } from '../../core/input/input-normalization.types';
import { validateNormalizedCatalog } from '../../core/input/input-validation';

interface ParsedStory {
  readonly sourceId?: string;
  readonly title?: string;
  readonly role?: string;
  readonly goal?: string;
  readonly benefit?: string;
  readonly criteria: readonly string[];
}

export class UserStoryInputAdapter implements InputAdapter<ParsedStory> {
  readonly id = 'user-story';
  readonly displayName = 'User Story';
  readonly supportedExtensions = ['.md', '.txt'];

  canHandle(document: InputDocument): boolean { return this.supportedExtensions.includes(path.extname(document.fileName).toLowerCase()); }

  parse(document: InputDocument): ParsedStory {
    const source = Buffer.isBuffer(document.content) ? document.content.toString('utf8') : document.content;
    const lines = source.split(/\r?\n/).map((line) => line.trim());
    const heading = lines.find((line) => /^#\s+/.test(line))?.match(/^#\s+([A-Za-z0-9._-]+)\s*[-–:]\s*(.+)$/);
    const criteriaHeading = lines.findIndex((line) => /^#{1,3}\s*(acceptance criteria|criterios de aceptaci[oó]n)\s*$/i.test(line) || /^(acceptance criteria|criterios de aceptaci[oó]n):?$/i.test(line));
    const criteria = criteriaHeading < 0 ? [] : lines.slice(criteriaHeading + 1).filter((line) => /^[-*]\s+/.test(line)).map((line) => line.replace(/^[-*]\s+/, '').trim()).filter(Boolean);
    return {
      sourceId: heading?.[1], title: heading?.[2],
      role: capture(lines, /^(?:as a|as an|como)\s+(.+)$/i),
      goal: capture(lines, /^(?:i want to|quiero)\s+(.+)$/i),
      benefit: capture(lines, /^(?:so that|para)\s+(.+)$/i),
      criteria,
    };
  }

  normalize(story: ParsedStory, context: InputNormalizationContext): NormalizedTestCatalog {
    const warnings: string[] = [];
    if (!story.sourceId) warnings.push('Story identifier is missing');
    if (!story.title) warnings.push('Story title is missing');
    if (!story.role || !story.goal || !story.benefit) warnings.push('Story narrative is incomplete');
    if (story.criteria.length === 0) warnings.push('Acceptance criteria are missing; no candidates were generated');
    const applicationId = context.applicationId;
    if (!applicationId) throw new Error('User Story input requires applicationId in import context');
    const cases: NormalizedCatalogCase[] = story.criteria.map((criterion, index) => ({
      caseId: `${story.sourceId ?? 'UNIDENTIFIED'}-AC-${index + 1}`,
      title: `${story.title ?? 'Untitled story'} - criterion ${index + 1}`,
      description: story.goal ?? criterion,
      preconditions: [],
      inputData: { ...(story.role ? { role: story.role } : {}), ...(story.benefit ? { benefit: story.benefit } : {}) },
      steps: [{ order: 1, action: criterion, expectedResult: criterion }],
      expectedResults: [criterion],
      priority: 'unreviewed', type: 'candidate', tags: ['user-story'], automationStatus: 'candidate',
      source: { type: 'USER_STORY', file: context.fileName, ...(story.sourceId ? { sourceId: story.sourceId } : {}) },
      sourceType: 'USER_STORY', reviewStatus: 'REQUIRES_QA_REVIEW',
    }));
    return validateNormalizedCatalog({ applicationId, cases, warnings });
  }
}

function capture(lines: readonly string[], pattern: RegExp): string | undefined {
  for (const line of lines) { const match = line.match(pattern); if (match?.[1]?.trim()) return match[1].trim(); }
  return undefined;
}
