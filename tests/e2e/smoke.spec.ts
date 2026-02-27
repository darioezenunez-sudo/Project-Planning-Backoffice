import { test, expect } from '@playwright/test';

test('login page loads and shows app title', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Project Planning Backoffice/i })).toBeVisible();
});

test('health API returns ok', async ({ request }) => {
  const res = await request.get('/api/v1/health?shallow=true');
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.data?.status).toBe('ok');
});
