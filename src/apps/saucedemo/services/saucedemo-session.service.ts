import type { BrowserContext } from '@playwright/test';

export class SauceDemoSessionService {
  constructor(private readonly context: BrowserContext) {}

  async reset(): Promise<void> {
    await this.context.clearCookies();
    await this.context.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  }
}
