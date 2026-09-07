import { expect, Locator, Page } from '@playwright/test';

export class Toast {
  private readonly container: Locator;

  constructor(page: Page) {
    this.container = page.locator('[role="alert"], .Toastify, .MuiAlert-root').first();
  }

  async expectContains(text: string): Promise<void> {
    await expect(this.container).toContainText(text, { timeout: 10_000 });
  }
}
