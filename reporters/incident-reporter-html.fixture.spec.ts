import { expect, test } from '@playwright/test';

test('TECH-AZURE-CREATED falla para validar summary en HTML', async () => {
  expect(false, 'mock failure for CREATED Azure summary').toBe(true);
});

test('TECH-AZURE-DUPLICATE falla para validar summary duplicate en HTML', async () => {
  expect(false, 'mock failure for DUPLICATE Azure summary').toBe(true);
});
