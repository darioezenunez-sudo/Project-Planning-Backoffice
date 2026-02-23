import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Project Planning Backoffice/i })).toBeVisible();
});

test('health API returns ok', async ({ request }) => {
  const res = await request.get('/api/v1/health?shallow=true');
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.data?.status).toBe('ok');
});
