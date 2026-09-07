export type JiraAdfTextNode = {
  type: 'text';
  text: string;
};

export type JiraAdfParagraphNode = {
  type: 'paragraph';
  content?: JiraAdfTextNode[];
};

export type JiraAdfDocument = {
  type: 'doc';
  version: 1;
  content: JiraAdfParagraphNode[];
};

export function textToAdf(text: string): JiraAdfDocument {
  return linesToAdf(text.split(/\r?\n/));
}

export function linesToAdf(lines: string[]): JiraAdfDocument {
  const safeLines = lines.length > 0 ? lines : [''];
  return {
    type: 'doc',
    version: 1,
    content: safeLines.map((line) => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : { content: [] }),
    })),
  };
}

export function extractTextFromAdf(description: unknown): string {
  if (description === null || description === undefined) {
    return '';
  }

  if (typeof description === 'string') {
    return description;
  }

  if (!isRecord(description)) {
    return '';
  }

  const content = Array.isArray(description.content) ? description.content : [];
  return content.map(extractTextFromNode).join('\n');
}

function extractTextFromNode(node: unknown): string {
  if (typeof node === 'string') {
    return node;
  }

  if (!isRecord(node)) {
    return '';
  }

  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }

  const content = Array.isArray(node.content) ? node.content : [];
  return content.map(extractTextFromNode).join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
