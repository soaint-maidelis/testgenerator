import { test as base } from '@playwright/test';

import { CartPage } from '../pages/cart.page';
import { CheckoutPage } from '../pages/checkout.page';
import { InventoryPage } from '../pages/inventory.page';
import { LoginPage } from '../pages/login.page';
import { SauceDemoSessionService } from '../services/saucedemo-session.service';

interface SauceDemoFixtures {
  readonly session: SauceDemoSessionService;
  readonly loginPage: LoginPage;
  readonly inventoryPage: InventoryPage;
  readonly cartPage: CartPage;
  readonly checkoutPage: CheckoutPage;
}

export const test = base.extend<SauceDemoFixtures>({
  session: async ({ context }, use) => {
    const session = new SauceDemoSessionService(context);
    await session.reset();
    await use(session);
  },
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  inventoryPage: async ({ page }, use) => { await use(new InventoryPage(page)); },
  cartPage: async ({ page }, use) => { await use(new CartPage(page)); },
  checkoutPage: async ({ page }, use) => { await use(new CheckoutPage(page)); },
});

export { expect } from '@playwright/test';
