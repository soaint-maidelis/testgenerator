import { test as base } from '@playwright/test';

import { demoLocalProfile } from '../config/demo-local.profile';
import { demoUser } from '../data/demo-local.data';
import { ItemPage } from '../pages/item.page';
import { ItemsPage } from '../pages/items.page';
import { LoginPage } from '../pages/login.page';
import { DemoLocalService } from '../services/demo-local.service';

interface DemoLocalFixtures {
  readonly service: DemoLocalService;
  readonly loginPage: LoginPage;
  readonly itemsPage: ItemsPage;
  readonly itemPage: ItemPage;
}

export const test = base.extend<DemoLocalFixtures>({
  service: async ({ request }, use) => {
    const service = new DemoLocalService(request, demoLocalProfile.apiURL!);
    await service.reset();
    await use(service);
  },
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  itemsPage: async ({ page }, use) => { await use(new ItemsPage(page)); },
  itemPage: async ({ page }, use) => { await use(new ItemPage(page)); },
});

export { demoUser };
export { expect } from '@playwright/test';
