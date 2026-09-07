import { checkoutCustomer, selectedProduct, standardUser } from '../../../src/apps/saucedemo/data/saucedemo.data';
import { test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test("@checkout [XL-SD-CHECKOUT-001] complete checkout", async ({ session, loginPage, inventoryPage, cartPage, checkoutPage }) => {
  test.info().annotations.push({ type: 'caseId', description: "XL-SD-CHECKOUT-001" });
  await test.step('Given an authenticated user has a product in the cart', async () => { await loginPage.goto(); await loginPage.login(standardUser.username, standardUser.password); await loginPage.expectAccepted(); await inventoryPage.addProduct(selectedProduct); await inventoryPage.openCart(); await cartPage.expectProduct(selectedProduct); });
  await test.step('When valid checkout information is completed', async () => { await cartPage.checkout(); await checkoutPage.completeInformation(checkoutCustomer()); });
  await test.step('Then the order is completed successfully', async () => { await checkoutPage.finish(); });
});
