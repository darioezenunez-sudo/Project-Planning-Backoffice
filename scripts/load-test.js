/**
 * k6 load test for critical API endpoints.
 *
 * Prerequisites:
 *   - Install k6: https://k6.io/docs/getting-started/installation/
 *   - Obtain a valid JWT (e.g. login via POST /api/v1/auth/login) and set env vars.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 AUTH_TOKEN=<jwt> ORG_ID=<uuid> ECHELON_ID=<uuid> k6 run scripts/load-test.js
 *
 * Optional env:
 *   VUS=10          — virtual users (default 5)
 *   DURATION=30s    — test duration (default 30s)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const ORG_ID = __ENV.ORG_ID || '';
const ECHELON_ID = __ENV.ECHELON_ID || '';
const SESSION_ID = __ENV.SESSION_ID || '';
const MACHINE_ID = __ENV.MACHINE_ID || '';
const VUS = __ENV.VUS ? parseInt(__ENV.VUS, 10) : 5;
const DURATION = __ENV.DURATION || '30s';

const defaultHeaders = {
  'Content-Type': 'application/json',
  Authorization: AUTH_TOKEN ? `Bearer ${AUTH_TOKEN}` : '',
  'X-Organization-Id': ORG_ID,
};

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.1'],
    'http_req_duration{name:device-validate}': ['p(95)<500'],
    'http_req_duration{name:submit-summary}': ['p(95)<2000'],
    'http_req_duration{name:record-usage}': ['p(95)<1000'],
  },
};

export function setup() {
  if (!AUTH_TOKEN || !ORG_ID) {
    // eslint-disable-next-line no-console
    console.warn('AUTH_TOKEN and ORG_ID are required for protected endpoints. Some checks may fail.');
  }
  return { orgId: ORG_ID, echelonId: ECHELON_ID };
}

function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** GET /api/v1/companies — paginated list */
export function companies(data) {
  const res = http.get(`${BASE_URL}/api/v1/companies?limit=20`, {
    headers: defaultHeaders,
  });
  check(res, { 'companies status 200': (r) => r.status === 200 });
  sleep(0.5);
}

/** GET /api/v1/context/:echelonId — context bundle (heaviest endpoint) */
export function contextBundle(data) {
  if (!data.echelonId) {
    sleep(1);
    return;
  }
  const res = http.get(`${BASE_URL}/api/v1/context/${data.echelonId}`, {
    headers: defaultHeaders,
  });
  check(res, (r) => r.status === 200 || r.status === 404, { 'context 200 or 404': true });
  sleep(1);
}

/** POST /api/v1/echelons/:id/consolidate — AI consolidation (expensive) */
export function consolidate(data) {
  if (!data.echelonId) {
    sleep(1);
    return;
  }
  const res = http.post(
    `${BASE_URL}/api/v1/echelons/${data.echelonId}/consolidate`,
    JSON.stringify({}),
    { headers: defaultHeaders },
  );
  check(res, (r) => r.status === 200 || r.status === 400 || r.status === 409, {
    'consolidate 2xx/4xx': true,
  });
  sleep(2);
}

/** Scenario 4: Device Validation (Assistant bootstrap — no auth) */
export function deviceValidation() {
  if (!MACHINE_ID) {
    // eslint-disable-next-line no-console
    console.warn('MACHINE_ID not set, skipping device validation');
    return;
  }
  const res = http.get(`${BASE_URL}/api/v1/auth/devices/${MACHINE_ID}`, {
    tags: { name: 'device-validate' },
  });
  check(res, {
    'device validate status 200': (r) => r.status === 200,
    'device validate has accessToken': (r) => {
      try {
        return JSON.parse(r.body).data.accessToken !== undefined;
      } catch {
        return false;
      }
    },
  });
  sleep(0.5);
}

/** Scenario 5: Summary Submission (critical Assistant→Backoffice write) */
export function submitSummary() {
  if (!SESSION_ID) {
    // eslint-disable-next-line no-console
    console.warn('SESSION_ID not set, skipping summary submission');
    return;
  }
  const idempotencyKey = generateIdempotencyKey();
  const res = http.post(
    `${BASE_URL}/api/v1/sessions/${SESSION_ID}/summary`,
    JSON.stringify({
      rawContent: `Load test summary ${idempotencyKey} — generated during performance testing.`,
    }),
    {
      headers: {
        ...defaultHeaders,
        'Idempotency-Key': idempotencyKey,
      },
      tags: { name: 'submit-summary' },
    },
  );
  check(res, {
    'submit summary 201 or 200': (r) => r.status === 201 || r.status === 200,
  });
  sleep(1);
}

/** Scenario 6: Usage Recording (idempotent) */
export function recordUsage() {
  const idempotencyKey = generateIdempotencyKey();
  const monthYear = new Date().toISOString().slice(0, 7);
  const res = http.post(
    `${BASE_URL}/api/v1/usage`,
    JSON.stringify({
      monthYear,
      tokens: Math.floor(Math.random() * 2000) + 500,
      model: 'gpt-4o-mini',
    }),
    {
      headers: {
        ...defaultHeaders,
        'Idempotency-Key': idempotencyKey,
      },
      tags: { name: 'record-usage' },
    },
  );
  check(res, {
    'record usage 201 or 200': (r) => r.status === 201 || r.status === 200,
  });
  sleep(0.5);
}

export default function (data) {
  companies(data);
  contextBundle(data);
  // consolidate(data); // Solo si quieres testear IA bajo carga — caro
  deviceValidation();
  submitSummary();
  recordUsage();
}
