import { uniqueUser } from '../../../src/apps/realworld/data/realworld-data';
import { expect, test } from '../../../src/apps/realworld/fixtures/realworld.fixture';

test('@smoke @auth [RW-AUTH-001] valid login shows the generated user', async ({ user, loginPage, navigationPage }) => {
  const caseId = 'RW-AUTH-001';
  test.info().annotations.push({ type: 'caseId', description: caseId });

  await test.step('Given an execution-scoped user opens sign in', async () => {
    await loginPage.goto();
  });
  await test.step('When the user submits valid generated credentials', async () => {
    await loginPage.submit(user.email, user.password);
  });
  await test.step('Then the primary navigation identifies the authenticated user', async () => {
    await navigationPage.expectSignedIn(user.username);
  });
});

test('@smoke @auth [RW-AUTH-002] invalid login displays a useful error', async ({ loginPage }) => {
  const caseId = 'RW-AUTH-002';
  test.info().annotations.push({ type: 'caseId', description: caseId });
  const invalidUser = uniqueUser();

  await test.step('Given the sign in page is open', async () => {
    await loginPage.goto();
  });
  await test.step('When unique credentials that were never registered are submitted', async () => {
    await loginPage.submit(invalidUser.email, invalidUser.password);
  });
  await test.step('Then authentication is rejected with a visible message', async () => {
    await expect(loginPage.invalidCredentialsMessage(), 'Debe explicar que las credenciales no son válidas').toBeVisible();
  });
});
