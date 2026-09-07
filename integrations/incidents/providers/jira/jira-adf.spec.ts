import { expect, test } from '@playwright/test';
import { extractTextFromAdf, linesToAdf, textToAdf } from './jira-adf';

test.describe('jira ADF helpers', () => {
  test('textToAdf creates a valid minimal document', () => {
    expect(textToAdf('Hola')).toEqual({
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hola' }],
        },
      ],
    });
  });

  test('empty text creates a controlled valid document', () => {
    expect(textToAdf('')).toEqual({
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [] }],
    });
  });

  test('multiple lines become separate paragraphs', () => {
    expect(linesToAdf(['Uno', '', 'Dos'])).toEqual({
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Uno' }] },
        { type: 'paragraph', content: [] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Dos' }] },
      ],
    });
  });

  test('extractTextFromAdf returns plain text from ADF', () => {
    expect(extractTextFromAdf(linesToAdf(['Caso: E37', 'QA-AUTO-SIGNATURE:', 'E37|CAUSE|VIEW']))).toBe(
      'Caso: E37\nQA-AUTO-SIGNATURE:\nE37|CAUSE|VIEW',
    );
  });

  test('extractTextFromAdf returns legacy string unchanged', () => {
    expect(extractTextFromAdf('QA-AUTO-SIGNATURE:\nE37|CAUSE|VIEW')).toBe('QA-AUTO-SIGNATURE:\nE37|CAUSE|VIEW');
  });

  test('extractTextFromAdf returns empty string for nullish values', () => {
    expect(extractTextFromAdf(null)).toBe('');
    expect(extractTextFromAdf(undefined)).toBe('');
  });
});
