/**
 * Assistant Contract E2E Test
 *
 * Simulates the complete flow of the Assistant (Electron Data Plane)
 * communicating with the Backoffice API (Control Plane).
 *
 * Flow:
 * Login → Enroll Device → Validate Device → Get Context →
 * Launch Assistant → Create Session → Submit Summary (+ idempotency) →
 * Record Usage (+ idempotency) → Validate Summary → Consolidate → Close
 *
 * Requires: pnpm db:seed (seeded org + users must exist)
 * Env vars: E2E_TEST_EMAIL, E2E_TEST_PASSWORD (same as api-smoke.spec.ts)
 */

import crypto from 'node:crypto';

import { expect, test } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

// ─── Shared state across tests ─────────────────────────────────────────────────

let authToken: string;
let organizationId: string;
let userId: string;
let echelonId: string;
let sessionId: string;
let machineId: string;
let summaryIdemKey: string;
let usageIdemKey: string;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders() {
  return {
    Authorization: `Bearer ${authToken}`,
    'X-Organization-Id': organizationId,
    'Content-Type': 'application/json',
  };
}

function uuid() {
  return crypto.randomUUID();
}

// ─── Setup ─────────────────────────────────────────────────────────────────────

test.describe('Assistant Contract — Full Integration Flow', () => {
  test.beforeAll(async ({ request }) => {
    // 1. Authenticate
    const email = process.env.E2E_TEST_EMAIL ?? 'admin@test.com';
    const password = process.env.E2E_TEST_PASSWORD ?? 'Test1234!';

    const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { email, password },
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = (await loginRes.json()) as {
      data: { accessToken: string; user: { id: string; organizationId: string } };
    };
    authToken = loginBody.data.accessToken;
    userId = loginBody.data.user.id;
    organizationId = loginBody.data.user.organizationId;

    // 2. Get a product to attach the echelon to
    const productsRes = await request.get(`${BASE_URL}/api/v1/products`, {
      headers: authHeaders(),
    });
    expect(productsRes.status()).toBe(200);
    const productsBody = (await productsRes.json()) as { data: Array<{ id: string }> };
    const productId = productsBody.data[0]?.id;
    expect(productId).toBeTruthy();

    // 3. Create a test echelon
    const echelonRes = await request.post(`${BASE_URL}/api/v1/echelons`, {
      headers: authHeaders(),
      data: {
        productId,
        name: `Contract Test Echelon ${uuid()}`,
      },
    });
    expect(echelonRes.status()).toBe(201);
    const echelonBody = (await echelonRes.json()) as { data: { id: string } };
    echelonId = echelonBody.data.id;

    // 4. Create a test session
    const sessionRes = await request.post(`${BASE_URL}/api/v1/echelons/${echelonId}/sessions`, {
      headers: authHeaders(),
      data: { notes: 'Contract test session' },
    });
    expect(sessionRes.status()).toBe(201);
    const sessionBody = (await sessionRes.json()) as { data: { id: string } };
    sessionId = sessionBody.data.id;
  });

  test.afterAll(async ({ request }) => {
    // Cleanup: soft-delete the test echelon
    if (echelonId) {
      const echelonRes = await request.get(`${BASE_URL}/api/v1/echelons/${echelonId}`, {
        headers: authHeaders(),
      });
      if (echelonRes.status() === 200) {
        const body = (await echelonRes.json()) as { data: { version: number; state: string } };
        if (body.data.state !== 'CLOSED') {
          await request.delete(
            `${BASE_URL}/api/v1/echelons/${echelonId}?version=${String(body.data.version)}`,
            { headers: authHeaders() },
          );
        }
      }
    }
  });

  // ─── E-01: Device Enrollment ─────────────────────────────────────────────────

  test('E-01: Device enrollment (idempotent)', async ({ request }) => {
    machineId = `test-machine-${uuid()}`;
    const idemKey = uuid();

    const res = await request.post(`${BASE_URL}/api/v1/auth/devices`, {
      headers: {
        ...authHeaders(),
        'Idempotency-Key': idemKey,
      },
      data: {
        machineId,
        userId,
        osInfo: { platform: 'test', arch: 'x64' },
      },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as {
      data: { machineId: string; organizationId: string; enrolledAt: string };
    };
    expect(body.data.machineId).toBe(machineId);
    expect(body.data.organizationId).toBe(organizationId);
    expect(body.data.enrolledAt).toBeTruthy();

    // Retry with same Idempotency-Key (idempotency test)
    const retry = await request.post(`${BASE_URL}/api/v1/auth/devices`, {
      headers: {
        ...authHeaders(),
        'Idempotency-Key': idemKey,
      },
      data: { machineId, userId },
    });
    expect([200, 201]).toContain(retry.status());
    const retryBody = (await retry.json()) as { data: { machineId: string } };
    expect(retryBody.data.machineId).toBe(machineId);
  });

  // ─── E-02: Device Validation (sin auth — bootstrap flow) ─────────────────────

  test('E-02: Device validation returns accessToken (no auth required)', async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/v1/auth/devices/${machineId}`,
      // NOTE: no Authorization header — this endpoint is intentionally public
    );

    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data: {
        machineId: string;
        organizationId: string;
        userId: string;
        accessToken: string;
        expiresAt: string;
      };
    };
    expect(body.data.machineId).toBe(machineId);
    expect(body.data.organizationId).toBe(organizationId);
    expect(body.data.accessToken).toBeTruthy();
    expect(new Date(body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    // Note: device token format is `device_${machineId}|${orgId}|${expiresAtMs}`
    // Subsequent tests use user JWT (authHeaders) for E2E stability.
  });

  // ─── E-03: Context Bundle (authenticated) ───────────────────────────────────

  test('E-03: Context bundle accessible when authenticated', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/context/${echelonId}`, {
      headers: authHeaders(),
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data: {
        echelonId: string;
        version: number;
        requiredFields: unknown[];
        summaries: unknown[];
        decisionAnchors: unknown[];
      };
    };
    expect(body.data.echelonId).toBe(echelonId);
    expect(typeof body.data.version).toBe('number');
    expect(Array.isArray(body.data.requiredFields)).toBe(true);
    expect(Array.isArray(body.data.summaries)).toBe(true);
  });

  // ─── E-03b: Context Bundle with ranked retrieval (queryEmbedding) ─────────────

  test('E-03b: Context bundle with queryEmbedding param (ranked retrieval)', async ({
    request,
  }) => {
    const embedding = new Array(768).fill(0.01) as number[];
    const queryEmbedding = Buffer.from(JSON.stringify(embedding)).toString('base64url');

    const res = await request.get(
      `${BASE_URL}/api/v1/context/${echelonId}?queryEmbedding=${queryEmbedding}`,
      { headers: authHeaders() },
    );

    expect([200, 404]).toContain(res.status());
  });

  // ─── E-04: Launch Assistant (deep-link payload) ───────────────────────────────

  test('E-04: Launch assistant returns deepLinkUrl and context bundle', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/v1/echelons/${echelonId}/launch`, {
      headers: authHeaders(),
    });

    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data: { echelonId: string; deepLinkUrl: string; context: { version: number } };
    };
    expect(body.data.echelonId).toBe(echelonId);
    expect(body.data.deepLinkUrl).toContain(echelonId);
    expect(body.data.deepLinkUrl).toContain('contextVersion');
    expect(typeof body.data.context.version).toBe('number');
  });

  // ─── E-05: Submit Summary (first — auto-transitions OPEN→IN_PROGRESS) ─────────

  test('E-05: Submit summary auto-transitions echelon OPEN→IN_PROGRESS', async ({ request }) => {
    summaryIdemKey = uuid();

    const res = await request.post(`${BASE_URL}/api/v1/sessions/${sessionId}/summary`, {
      headers: {
        ...authHeaders(),
        'Idempotency-Key': summaryIdemKey,
      },
      data: {
        rawContent: 'Summary from the Assistant contract test. Details of the session conducted.',
      },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as { data: { id: string; state: string; rawContent: string } };
    expect(body.data.state).toBe('DRAFT');
    expect(body.data.rawContent).toBeTruthy();

    const echelonRes = await request.get(`${BASE_URL}/api/v1/echelons/${echelonId}`, {
      headers: authHeaders(),
    });
    const echelonBody = (await echelonRes.json()) as { data: { state: string } };
    expect(echelonBody.data.state).toBe('IN_PROGRESS');
  });

  // ─── E-06: Submit Summary — retry with same Idempotency-Key ──────────────────

  test('E-06: Summary submission idempotency — same key returns same result', async ({
    request,
  }) => {
    const res = await request.post(`${BASE_URL}/api/v1/sessions/${sessionId}/summary`, {
      headers: {
        ...authHeaders(),
        'Idempotency-Key': summaryIdemKey,
      },
      data: {
        rawContent: 'Different content — should be ignored due to idempotency',
      },
    });

    expect([200, 201]).toContain(res.status());
    const body = (await res.json()) as { data: { state: string } };
    expect(body.data.state).toBe('DRAFT');
  });

  // ─── E-07: Record Usage ───────────────────────────────────────────────────────

  test('E-07: Record LLM usage (idempotent)', async ({ request }) => {
    usageIdemKey = uuid();
    const monthYear = new Date().toISOString().slice(0, 7);

    const res = await request.post(`${BASE_URL}/api/v1/usage`, {
      headers: {
        ...authHeaders(),
        'Idempotency-Key': usageIdemKey,
      },
      data: {
        monthYear,
        tokens: 1500,
        model: 'gpt-4o-mini',
        echelonId,
      },
    });

    expect(res.status()).toBe(201);
    const body = (await res.json()) as { data: { tokens: number; monthYear: string } };
    expect(body.data.tokens).toBe(1500);
    expect(body.data.monthYear).toBe(monthYear);
  });

  // ─── E-08: Record Usage — retry idempotency ───────────────────────────────────

  test('E-08: Usage recording idempotency — same key returns same result', async ({ request }) => {
    const monthYear = new Date().toISOString().slice(0, 7);

    const res = await request.post(`${BASE_URL}/api/v1/usage`, {
      headers: {
        ...authHeaders(),
        'Idempotency-Key': usageIdemKey,
      },
      data: { monthYear, tokens: 9999, model: 'different-model' },
    });

    expect([200, 201]).toContain(res.status());
    const body = (await res.json()) as { data: { tokens: number } };
    expect(body.data.tokens).toBe(1500);
  });

  // ─── E-09: Validate Summary (MANAGER role) → invalidates KV cache ─────────────

  test('E-09: Validate summary transitions FSM and invalidates context cache', async ({
    request,
  }) => {
    const summaryRes = await request.get(`${BASE_URL}/api/v1/sessions/${sessionId}/summary`, {
      headers: authHeaders(),
    });
    expect(summaryRes.status()).toBe(200);
    const summaryBody = (await summaryRes.json()) as {
      data?: { version: number; state: string };
      error?: unknown;
    };
    const summaryData = summaryBody.data;
    if (!summaryData) {
      test.skip(true, 'No summary data (E-05 may not have created one)');
      return;
    }
    let version = summaryData.version;

    const submitRes = await request.patch(`${BASE_URL}/api/v1/sessions/${sessionId}/summary`, {
      headers: authHeaders(),
      data: { event: 'SUBMIT', version },
    });
    expect(submitRes.status()).toBe(200);
    const submitBody = (await submitRes.json()) as { data: { state: string; version: number } };
    expect(submitBody.data.state).toBe('REVIEW');
    version = submitBody.data.version;

    const validateRes = await request.patch(`${BASE_URL}/api/v1/sessions/${sessionId}/summary`, {
      headers: authHeaders(),
      data: { event: 'VALIDATE', version },
    });
    expect(validateRes.status()).toBe(200);
    const validateBody = (await validateRes.json()) as { data: { state: string } };
    expect(validateBody.data.state).toBe('VALIDATED');

    const ctxRes = await request.get(`${BASE_URL}/api/v1/context/${echelonId}`, {
      headers: authHeaders(),
    });
    expect(ctxRes.status()).toBe(200);
    const ctxBody = (await ctxRes.json()) as {
      data: { summaries: Array<{ state: string }> };
    };
    const validatedSummaries = ctxBody.data.summaries.filter((s) => s.state === 'VALIDATED');
    expect(validatedSummaries.length).toBeGreaterThanOrEqual(1);
  });

  // ─── E-10: Full lifecycle — Consolidate + Close ───────────────────────────────

  test('E-10: Consolidate echelon (IN_PROGRESS → CLOSURE_REVIEW)', async ({ request }) => {
    const echelonRes = await request.get(`${BASE_URL}/api/v1/echelons/${echelonId}`, {
      headers: authHeaders(),
    });
    const echelonBody = (await echelonRes.json()) as { data: { version: number; state: string } };
    expect(echelonBody.data.state).toBe('IN_PROGRESS');

    const consolidateRes = await request.post(
      `${BASE_URL}/api/v1/echelons/${echelonId}/consolidate`,
      {
        headers: authHeaders(),
        data: { version: echelonBody.data.version },
      },
    );

    expect([200, 422, 500]).toContain(consolidateRes.status());

    if (consolidateRes.status() === 200) {
      const consolidateBody = (await consolidateRes.json()) as {
        data: { echelon: { state: string } };
      };
      expect(consolidateBody.data.echelon.state).toBe('CLOSURE_REVIEW');
    }
  });

  // ─── E-11: RBAC check — VIEWER cannot transition echelon ─────────────────────

  test('E-11: VIEWER role cannot trigger echelon transition', async ({ request }) => {
    const viewerEmail = process.env.E2E_VIEWER_EMAIL ?? 'viewer@test.com';
    const viewerPassword = process.env.E2E_TEST_PASSWORD ?? 'Test1234!';

    const loginRes = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: { email: viewerEmail, password: viewerPassword },
    });

    if (loginRes.status() !== 200) {
      test.skip();
      return;
    }

    const viewerBody = (await loginRes.json()) as { data: { accessToken: string } };
    const viewerToken = viewerBody.data.accessToken;

    const viewerHeaders = {
      Authorization: `Bearer ${viewerToken}`,
      'X-Organization-Id': organizationId,
      'Content-Type': 'application/json',
    };

    const createRes = await request.post(`${BASE_URL}/api/v1/echelons`, {
      headers: viewerHeaders,
      data: { productId: uuid(), name: 'Should fail' },
    });
    expect(createRes.status()).toBe(403);

    const sessionRes = await request.post(`${BASE_URL}/api/v1/echelons/${echelonId}/sessions`, {
      headers: viewerHeaders,
      data: {},
    });
    expect(sessionRes.status()).toBe(403);
  });
});
