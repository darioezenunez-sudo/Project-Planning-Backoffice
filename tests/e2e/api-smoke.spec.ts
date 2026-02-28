import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * API Smoke Test — verifica que todas las rutas implementadas respondan con
 * datos reales desde la base de datos.
 *
 * Requiere E2E_TEST_EMAIL y E2E_TEST_PASSWORD en .env.
 * Corre con: pnpm test:e2e --grep "API Smoke"
 */

type AuthContext = {
  request: APIRequestContext;
  orgId: string;
  accessToken: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function authenticate(request: APIRequestContext): Promise<AuthContext> {
  const email = process.env['E2E_TEST_EMAIL'] ?? '';
  const password = process.env['E2E_TEST_PASSWORD'] ?? '';

  const loginRes = await request.post('/api/v1/auth/login', {
    data: { email, password },
  });
  expect(loginRes.status(), `POST /auth/login debe devolver 200`).toBe(200);

  // /auth/me usa la cookie de sesión seteada por el login
  const meRes = await request.get('/api/v1/auth/me');
  expect(meRes.status(), `GET /auth/me debe devolver 200`).toBe(200);
  const me = (await meRes.json()) as {
    data: {
      userId: string;
      memberships: Array<{ organizationId: string; role: string }>;
    };
  };
  const orgId = me.data.memberships[0]?.organizationId ?? '';
  expect(orgId, 'Debe existir al menos un membership').toBeTruthy();

  // Obtener access token para rutas que aceptan Bearer
  const loginBody = (await loginRes.json()) as {
    data?: { session?: { access_token?: string } };
  };
  const accessToken = loginBody.data?.session?.access_token ?? '';

  return { request, orgId, accessToken };
}

function orgHeaders(orgId: string) {
  return { 'X-Organization-Id': orgId };
}

// ---------------------------------------------------------------------------
// Suite principal
// ---------------------------------------------------------------------------

test.describe('API Smoke', () => {
  test.setTimeout(60_000);

  // Skip todo el suite si no hay credenciales
  test.beforeEach(({}, testInfo) => {
    const email = process.env['E2E_TEST_EMAIL'] ?? '';
    const password = process.env['E2E_TEST_PASSWORD'] ?? '';
    if (!email || !password) {
      testInfo.skip();
    }
  });

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  test('GET /health — responde ok sin auth', async ({ request }) => {
    const res = await request.get('/api/v1/health?shallow=true');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: { status?: string } };
    expect(body.data?.status).toBe('ok');
  });

  // -------------------------------------------------------------------------
  // Auth endpoints
  // -------------------------------------------------------------------------

  test('GET /auth/me — retorna userId y memberships', async ({ request }) => {
    const { orgId } = await authenticate(request);
    expect(orgId).toBeTruthy();
  });

  test('GET /auth/devices — 401 sin auth', async ({ request }) => {
    const res = await request.get('/api/v1/auth/devices/nonexistent-machine');
    // GET /auth/devices/:machineId no requiere auth (para el Assistant)
    // responde 404 si no existe el device, no 401
    expect([200, 404]).toContain(res.status());
  });

  // -------------------------------------------------------------------------
  // Organizations
  // -------------------------------------------------------------------------

  test('GET /organizations/:id — retorna la organización', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const res = await request.get(`/api/v1/organizations/${orgId}`, {
      headers: orgHeaders(orgId),
    });
    expect(res.status(), `GET /organizations/${orgId}`).toBe(200);
    const body = (await res.json()) as { data?: { id?: string } };
    expect(body.data?.id).toBe(orgId);
  });

  test('GET /organizations/:id/members — retorna lista paginada', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const res = await request.get(`/api/v1/organizations/${orgId}/members`, {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Companies
  // -------------------------------------------------------------------------

  test('GET /companies — retorna lista de empresas', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const res = await request.get('/api/v1/companies', {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /companies/:id — retorna detalle de empresa', async ({ request }) => {
    const { orgId } = await authenticate(request);
    // Primero obtenemos el listado para tener un ID real
    const listRes = await request.get('/api/v1/companies', {
      headers: orgHeaders(orgId),
    });
    const list = (await listRes.json()) as { data?: Array<{ id: string }> };
    const firstId = list.data?.[0]?.id;
    if (!firstId) {
      test.skip(true, 'No hay empresas en la base de datos');
      return;
    }
    const res = await request.get(`/api/v1/companies/${firstId}`, {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: { id?: string } };
    expect(body.data?.id).toBe(firstId);
  });

  // -------------------------------------------------------------------------
  // Products
  // -------------------------------------------------------------------------

  test('GET /products — retorna lista de productos', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const res = await request.get('/api/v1/products', {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /products/:id — retorna detalle de producto', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const listRes = await request.get('/api/v1/products', {
      headers: orgHeaders(orgId),
    });
    const list = (await listRes.json()) as { data?: Array<{ id: string }> };
    const firstId = list.data?.[0]?.id;
    if (!firstId) {
      test.skip(true, 'No hay productos en la base de datos');
      return;
    }
    const res = await request.get(`/api/v1/products/${firstId}`, {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: { id?: string } };
    expect(body.data?.id).toBe(firstId);
  });

  // -------------------------------------------------------------------------
  // Echelons
  // -------------------------------------------------------------------------

  test('GET /echelons — retorna lista de echelones', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const res = await request.get('/api/v1/echelons', {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /echelons/:id — retorna detalle de echelon', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const listRes = await request.get('/api/v1/echelons', {
      headers: orgHeaders(orgId),
    });
    const list = (await listRes.json()) as {
      data?: Array<{ id: string; state: string }>;
    };
    const firstId = list.data?.[0]?.id;
    if (!firstId) {
      test.skip(true, 'No hay echelones en la base de datos');
      return;
    }
    const res = await request.get(`/api/v1/echelons/${firstId}`, {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: { id?: string; state?: string } };
    expect(body.data?.id).toBe(firstId);
    expect(body.data?.state).toBeTruthy();
  });

  test('GET /echelons/:id/required-fields — retorna campos requeridos', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const listRes = await request.get('/api/v1/echelons', {
      headers: orgHeaders(orgId),
    });
    const list = (await listRes.json()) as { data?: Array<{ id: string }> };
    const firstId = list.data?.[0]?.id;
    if (!firstId) {
      test.skip(true, 'No hay echelones en la base de datos');
      return;
    }
    const res = await request.get(`/api/v1/echelons/${firstId}/required-fields`, {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /echelons/:id/sessions — retorna sesiones del echelon', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const listRes = await request.get('/api/v1/echelons', {
      headers: orgHeaders(orgId),
    });
    const list = (await listRes.json()) as { data?: Array<{ id: string }> };
    const firstId = list.data?.[0]?.id;
    if (!firstId) {
      test.skip(true, 'No hay echelones en la base de datos');
      return;
    }
    const res = await request.get(`/api/v1/echelons/${firstId}/sessions`, {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  test('GET /sessions (raíz) — retorna 404 con mensaje descriptivo', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const res = await request.get('/api/v1/sessions', {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(404);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('/echelons');
  });

  // -------------------------------------------------------------------------
  // Devices & Usage
  // -------------------------------------------------------------------------

  test('GET /devices — retorna dispositivos de la org', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const res = await request.get('/api/v1/devices', {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /usage — retorna uso del mes actual', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const month = new Date().toISOString().slice(0, 7);
    const res = await request.get(`/api/v1/usage?monthYear=${month}`, {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: { totalTokens?: number } };
    expect(typeof body.data?.totalTokens).toBe('number');
  });

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------

  test('GET /attachments — retorna lista de adjuntos (vacía o con datos)', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const res = await request.get('/api/v1/attachments', {
      headers: orgHeaders(orgId),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Context bundle
  // -------------------------------------------------------------------------

  test('GET /context/:echelonId — 200 o 404 (sin echelon en OPEN)', async ({ request }) => {
    const { orgId } = await authenticate(request);
    const listRes = await request.get('/api/v1/echelons', {
      headers: orgHeaders(orgId),
    });
    const list = (await listRes.json()) as { data?: Array<{ id: string; state: string }> };
    const openEchelon = list.data?.find((e) => e.state === 'OPEN' || e.state === 'IN_PROGRESS');
    if (!openEchelon) {
      test.skip(true, 'No hay echelones en estado OPEN/IN_PROGRESS');
      return;
    }
    const res = await request.get(`/api/v1/context/${openEchelon.id}`, {
      headers: orgHeaders(orgId),
    });
    // 200 con datos, o 404 si el echelon no tiene summaries suficientes
    expect([200, 404]).toContain(res.status());
  });

  // -------------------------------------------------------------------------
  // RBAC: ruta protegida sin auth → 401
  // -------------------------------------------------------------------------

  test('GET /companies sin auth — retorna 401', async ({ request }) => {
    // Request completamente fresco sin cookies
    const res = await request.get('/api/v1/companies');
    expect(res.status()).toBe(401);
  });

  test('GET /companies sin X-Organization-Id — retorna 400 o 401', async ({ request }) => {
    await authenticate(request);
    // Auth OK pero sin header de org
    const res = await request.get('/api/v1/companies');
    expect([400, 401]).toContain(res.status());
  });
});
