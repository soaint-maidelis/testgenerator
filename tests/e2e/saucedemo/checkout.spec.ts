import { checkoutCustomer, selectedProduct, standardUser } from '../../../src/apps/saucedemo/data/saucedemo.data';
import { test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test('@smoke @checkout [SD-CHECKOUT-001] checkout completes successfully', async ({ session, loginPage, inventoryPage, cartPage, checkoutPage }) => {
  test.info().annotations.push({ type: 'caseId', description: 'SD-CHECKOUT-001' });
  await test.step('Given an authenticated user has a product in the cart', async () => { await loginPage.goto(); await loginPage.login(standardUser.username, standardUser.password); await loginPage.expectAccepted(); await inventoryPage.addProduct(selectedProduct); await inventoryPage.openCart(); await cartPage.expectProduct(selectedProduct); });
  await test.step('When valid checkout information is completed', async () => { await cartPage.checkout(); await checkoutPage.completeInformation(checkoutCustomer()); });
  await test.step('Then the order is completed successfully', async () => { await checkoutPage.finish(); });
});
