import { lockedOutUser, standardUser } from '../../../src/apps/saucedemo/data/saucedemo.data';
import { test } from '../../../src/apps/saucedemo/fixtures/saucedemo.fixture';

test('@smoke @auth [SD-AUTH-001] standard user logs in successfully', async ({ session, loginPage }) => {
  test.info().annotations.push({ type: 'caseId', description: 'SD-AUTH-001' });
  await test.step('Given the SauceDemo login is open', async () => { await loginPage.goto(); });
  await test.step('When the standard user submits public credentials', async () => { await loginPage.login(standardUser.username, standardUser.password); });
  await test.step('Then the inventory is displayed', async () => { await loginPage.expectAccepted(); });
});

test('@auth [SD-AUTH-002] locked out user is rejected', async ({ session, loginPage }) => {
  test.info().annotations.push({ type: 'caseId', description: 'SD-AUTH-002' });
  await test.step('Given the SauceDemo login is open', async () => { await loginPage.goto(); });
  await test.step('When the locked user submits public credentials', async () => { await loginPage.login(lockedOutUser.username, lockedOutUser.password); });
  await test.step('Then login is rejected with a useful message', async () => { await loginPage.expectLockedOut(); });
});
