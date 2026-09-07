import { selectedProduct, standardUser } from '../../../src/apps/saucedemo/data/saucedemo.data';
import { test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test("@user-story @cart [US-SD-CART-REMOVE-001-AC-2] eliminar producto del carrito - criterion 2", async ({ session, loginPage, inventoryPage, cartPage }) => {
  test.info().annotations.push({ type: 'caseId', description: "US-SD-CART-REMOVE-001-AC-2" });
  await test.step('Given the standard user is authenticated', async () => { await loginPage.goto(); await loginPage.login(standardUser.username, standardUser.password); await loginPage.expectAccepted(); });
  await test.step('When a product is added and the cart is opened', async () => { await inventoryPage.addProduct(selectedProduct); await inventoryPage.openCart(); });
  await test.step('Then the selected product is present', async () => { await cartPage.expectProduct(selectedProduct); });
});
