import type { InputNormalizationContext, NormalizedTestCatalog } from './input-normalization.types';

export interface InputDocument {
  readonly fileName: string;
  readonly content: string | Buffer;
  readonly applicationId?: string;
}

export interface InputAdapter<TParsed = unknown> {
  readonly id: string;
  readonly displayName: string;
  readonly supportedExtensions: readonly string[];
  canHandle(document: InputDocument): boolean;
  parse(document: InputDocument): TParsed;
  normalize(parsed: TParsed, context: InputNormalizationContext): NormalizedTestCatalog;
}
