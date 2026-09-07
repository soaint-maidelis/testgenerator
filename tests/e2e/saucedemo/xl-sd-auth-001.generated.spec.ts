import { standardUser } from '../../../src/apps/saucedemo/data/saucedemo.data';
import { test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test("@smoke @auth [XL-SD-AUTH-001] valid standard user login", async ({ session, loginPage }) => {
  test.info().annotations.push({ type: 'caseId', description: "XL-SD-AUTH-001" });
  await test.step('Given the SauceDemo login is open', async () => { await loginPage.goto(); });
  await test.step('When the standard user submits public credentials', async () => { await loginPage.login(standardUser.username, standardUser.password); });
  await test.step('Then the inventory is displayed', async () => { await loginPage.expectAccepted(); });
});
