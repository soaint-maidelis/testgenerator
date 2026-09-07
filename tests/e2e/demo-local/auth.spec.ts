import { demoUser, expect, test } from '../../../src/apps/demo-local/fixtures/demo-local.fixture';

test('@smoke @auth [DL-AUTH-001] valid login identifies the local demo user', async ({ service, loginPage, itemsPage }) => {
  test.info().annotations.push({ type: 'caseId', description: 'DL-AUTH-001' });
  const user = demoUser();
  await test.step('Given the deterministic local login is open', async () => { await loginPage.goto(); });
  await test.step('When the valid demo credentials are submitted', async () => {
    expect(await loginPage.submit(user.email, user.password), 'Debe aceptar las credenciales locales').toBe(200);
  });
  await test.step('Then the portal identifies the signed-in user', async () => { await itemsPage.expectSignedIn(user.name); });
});

test('@smoke @auth [DL-AUTH-002] invalid login displays a useful error', async ({ service, loginPage }) => {
  test.info().annotations.push({ type: 'caseId', description: 'DL-AUTH-002' });
  await test.step('Given the deterministic local login is open', async () => { await loginPage.goto(); });
  await test.step('When invalid credentials are submitted', async () => {
    expect(await loginPage.submit('invalid@example.invalid', 'wrong-password'), 'Debe rechazar credenciales inválidas').toBe(401);
  });
  await test.step('Then a useful error is visible', async () => {
    await expect(loginPage.errorMessage(), 'Debe explicar el rechazo').toHaveText('Invalid credentials');
  });
});
