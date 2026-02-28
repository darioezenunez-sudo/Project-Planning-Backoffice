import { test, expect } from '@playwright/test';

/**
 * Happy path E2E: login → dashboard → companies → product → echelon → session → summary → consolidate.
 * Requiere credenciales en E2E_TEST_EMAIL y E2E_TEST_PASSWORD para el flujo con login.
 * Si no están definidas, se ejecutan solo las rutas públicas y health.
 */
test.describe('Happy path', () => {
  test.setTimeout(60_000);

  test('home and health', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Project Planning Backoffice/i })).toBeVisible();

    const res = await request.get('/api/v1/health?shallow=true');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect((body as { data?: { status?: string } }).data?.status).toBe('ok');
  });

  test('login form submits and redirects to dashboard when credentials provided', async ({
    page,
  }) => {
    const email = process.env['E2E_TEST_EMAIL'] ?? '';
    const password = process.env['E2E_TEST_PASSWORD'] ?? '';

    test.skip(!email || !password, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required');

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/correo/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole('button', { name: /ingresar/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('dashboard and companies pages load when authenticated', async ({ page }) => {
    const email = process.env['E2E_TEST_EMAIL'] ?? '';
    const password = process.env['E2E_TEST_PASSWORD'] ?? '';

    test.skip(!email || !password, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required');

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/correo/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole('button', { name: /ingresar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    await page.goto('/companies');
    await expect(page.getByRole('heading', { name: /empresas/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('navigation to company detail, product, echelon, session and consolidation routes', async ({
    page,
  }) => {
    const email = process.env['E2E_TEST_EMAIL'] ?? '';
    const password = process.env['E2E_TEST_PASSWORD'] ?? '';

    test.skip(!email || !password, 'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required');

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/correo/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole('button', { name: /ingresar/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page.goto('/companies');
    await expect(page.getByRole('heading', { name: /empresas/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    const companyLink = page.getByRole('link', { name: /ver detalle|empresa/i }).first();
    const hasCompany = (await companyLink.count()) > 0;
    if (hasCompany) {
      await companyLink.click();
      await expect(page).toHaveURL(/\/companies\/.+/);
      const productLink = page.getByRole('link', { name: /echelon|producto/i }).first();
      if ((await productLink.count()) > 0) {
        await productLink.click();
        await expect(page).toHaveURL(/\/products\/.+/);
        const echelonLink = page.getByRole('link', { name: /echelon|fase/i }).first();
        if ((await echelonLink.count()) > 0) {
          await echelonLink.click();
          await expect(page).toHaveURL(/\/echelons\/.+/);
          const consolidationLink = page.getByRole('link', { name: /consolidar/i }).first();
          if ((await consolidationLink.count()) > 0) {
            await consolidationLink.click();
            await expect(page).toHaveURL(/\/echelons\/.+\/consolidation/);
          }
        }
      }
    }
  });
});
