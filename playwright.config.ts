import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Explicit .env loading: Playwright auto-loads .env in the config process but
// TypeScript configs & workers may not inherit the vars reliably on all platforms.
// This runs before worker spawn so all child processes inherit the env.
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    const key = m?.[1];
    const val = m?.[2];
    if (key !== undefined && val !== undefined && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? 'github' : 'html',
  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000',
    // Keep browser locale as 'es' (app's defaultLocale) so JS Intl APIs
    // (dates, numbers) behave consistently with the Spanish UI.
    locale: 'es',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm run dev',
    // Health endpoint returns HTTP 200 without auth — root '/' returns 404
    // (no page at '/'; middleware redirects to '/login') and would cause timeout
    url: 'http://localhost:3000/api/v1/health?shallow=true',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
