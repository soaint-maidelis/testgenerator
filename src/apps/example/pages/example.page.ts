import type { Page } from '@playwright/test';

/** Neutral Page Object seam; functional interactions belong to a future demo task. */
export class ExamplePage {
  constructor(readonly page: Page) {}
}
