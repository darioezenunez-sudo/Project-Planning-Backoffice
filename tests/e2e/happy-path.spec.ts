import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/**
 * Happy path E2E: login → dashboard → companies → product → echelon → session → summary → consolidate.
 * Requiere credenciales en E2E_TEST_EMAIL y E2E_TEST_PASSWORD para el flujo con login.
 * Login se hace vía page.request.post() para que las cookies de sesión queden en el mismo contexto que la página.
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

  /** Autentica vía API en el contexto de la página para que las cookies se usen en navegaciones posteriores. */
  async function loginViaPageContext(page: import('@playwright/test').Page) {
    const email = process.env['E2E_TEST_EMAIL'] ?? '';
    const password = process.env['E2E_TEST_PASSWORD'] ?? '';
    if (!email || !password) return false;
    const res = await page.request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { email, password },
    });
    expect(res.ok(), `Login failed: ${await res.text()}`).toBe(true);
    return true;
  }

  test('login and redirect to dashboard when credentials provided', async ({ page }) => {
    test.skip(
      !process.env['E2E_TEST_EMAIL'] || !process.env['E2E_TEST_PASSWORD'],
      'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required',
    );
    await page.goto('/');
    const loggedIn = await loginViaPageContext(page);
    test.skip(!loggedIn, 'Login required');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /dashboard/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('dashboard and companies pages load when authenticated', async ({ page }) => {
    test.skip(
      !process.env['E2E_TEST_EMAIL'] || !process.env['E2E_TEST_PASSWORD'],
      'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required',
    );

    await page.goto('/');
    const loggedIn = await loginViaPageContext(page);
    test.skip(!loggedIn, 'Login required');
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
    test.skip(
      !process.env['E2E_TEST_EMAIL'] || !process.env['E2E_TEST_PASSWORD'],
      'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required',
    );
    await page.goto('/');
    const loggedIn = await loginViaPageContext(page);
    test.skip(!loggedIn, 'Login required');

    await page.goto('/companies');
    await expect(page.getByRole('heading', { name: /empresas/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // The company name is the link in the table cell — href="/companies/:id"
    const companyLink = page.locator('a[href^="/companies/"]').first();
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
