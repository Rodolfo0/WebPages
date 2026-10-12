import { expect, test } from '@playwright/test';

const confirmedEmail = process.env.SUPABASE_E2E_EMAIL;
const confirmedPassword = process.env.SUPABASE_E2E_PASSWORD;

test('login validates the server session and logout clears it', async ({ page }) => {
  if (!confirmedEmail || !confirmedPassword) {
    throw new Error(
      'Set SUPABASE_E2E_EMAIL and SUPABASE_E2E_PASSWORD for a confirmed test account.',
    );
  }

  await page.goto('/');
  await expect(page.getByText('Sin sesión')).toBeVisible();
  await page.getByLabel('Correo electrónico').fill(confirmedEmail);
  await page.getByLabel('Contraseña').fill(confirmedPassword);
  expect(await page.locator('form').evaluate((form) => (form as HTMLFormElement).checkValidity())).toBe(true);
  const loginResponsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/auth/login',
    { timeout: 8_000 },
  );
  await page.locator('form').getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status()).toBe(200);
  expect(await loginResponse.json()).toMatchObject({ authenticated: true });

  await expect(page.getByText('Sesión válida en el servidor')).toBeVisible();
  await expect(page.getByText(confirmedEmail)).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  await expect(page.getByText('Sin sesión')).toBeVisible();
  const sessionResponse = await page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    return { status: response.status, body: await response.json() };
  });
  expect(sessionResponse.status).toBe(401);
  expect(sessionResponse.body).toMatchObject({ authenticated: false });
});
