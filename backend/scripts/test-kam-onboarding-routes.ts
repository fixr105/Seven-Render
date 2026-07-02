/**
 * Live KAM onboarding route smoke test.
 *
 * Usage:
 *   KAM_EMAIL=... KAM_PASSWORD=... API_BASE_URL=http://localhost:3001/api \
 *     npx tsx scripts/test-kam-onboarding-routes.ts
 *
 * Optional:
 *   PRODUCT_ID=LP012  (default LP012)
 */

const BASE = process.env.API_BASE_URL || 'http://localhost:3001/api';
const KAM_EMAIL = process.env.KAM_EMAIL || '';
const KAM_PASSWORD = process.env.KAM_PASSWORD || '';
const PRODUCT_ID = process.env.PRODUCT_ID || 'LP012';

type ApiResult = {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
};

async function api(
  method: string,
  path: string,
  token?: string,
  body?: Record<string, unknown>
): Promise<ApiResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, json };
}

function logStep(name: string, result: ApiResult, expectStatus?: number): boolean {
  const pass = expectStatus ? result.status === expectStatus : result.ok;
  const icon = pass ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${name} -> HTTP ${result.status}`);
  if (!pass) {
    console.log('       ', JSON.stringify(result.json).slice(0, 300));
  }
  return pass;
}

async function main(): Promise<void> {
  console.log(`API: ${BASE}`);
  const results: boolean[] = [];

  if (!KAM_EMAIL || !KAM_PASSWORD) {
    console.log('[SKIP] Live test requires KAM_EMAIL and KAM_PASSWORD env vars.');
    console.log('       Run mocked suite: npm test -- --testPathPattern=kam.onboarding.test.ts');
    process.exit(2);
  }

  const login = await api('POST', '/auth/login', undefined, {
    email: KAM_EMAIL,
    password: KAM_PASSWORD,
  });
  results.push(logStep('KAM login', login, 200));
  const kamToken = (login.json.data as { token?: string } | undefined)?.token;
  if (!kamToken) {
    console.log('Cannot continue without KAM token.');
    process.exit(1);
  }

  const unique = Date.now();
  const clientEmail = `onboard-live-${unique}@example.com`;
  const create = await api(
    'POST',
    '/kam/clients',
    kamToken,
    {
      name: `Live Onboard Co ${unique}`,
      contactPerson: 'Live Tester',
      email: clientEmail,
      phone: '9999999999',
      commissionRate: '1.0',
      enabledModules: ['M1', 'M2'],
    }
  );
  results.push(logStep('POST /kam/clients', create, 200));
  const clientId = (create.json.data as { clientId?: string } | undefined)?.clientId;
  if (!clientId) {
    console.log('Cannot continue without clientId.');
    process.exit(1);
  }

  const list = await api('GET', '/kam/clients', kamToken);
  const listed = Array.isArray((list.json.data as unknown[] | undefined))
    && (list.json.data as Array<{ id?: string; clientId?: string }>).some(
      (c) => c.id === clientId || c.clientId === clientId
    );
  results.push(listed && logStep('GET /kam/clients contains new client', { ok: listed, status: list.status, json: list.json }));

  const getOne = await api('GET', `/kam/clients/${clientId}`, kamToken);
  results.push(logStep('GET /kam/clients/:id', getOne, 200));

  const assign = await api('PUT', `/kam/clients/${clientId}/assigned-products`, kamToken, {
    productIds: [PRODUCT_ID],
  });
  results.push(logStep('PUT /kam/clients/:id/assigned-products', assign, 200));

  const assigned = await api('GET', `/kam/clients/${clientId}/assigned-products`, kamToken);
  results.push(logStep('GET /kam/clients/:id/assigned-products', assigned, 200));

  const clientLogin = await api('POST', '/auth/login', undefined, {
    email: clientEmail,
    password: 'TempPassword123!',
  });
  results.push(logStep('Client login (temp password)', clientLogin, 200));
  const clientToken = (clientLogin.json.data as { token?: string } | undefined)?.token;

  if (clientToken) {
    const me = await api('GET', '/auth/me', clientToken);
    results.push(logStep('GET /auth/me (clientId linked)', me, 200));
    const meData = me.json.data as { clientId?: string } | undefined;
    if (meData?.clientId) {
      console.log(`       clientId=${meData.clientId}`);
    } else {
      console.log('       WARNING: clientId missing on /auth/me');
      results.push(false);
    }

    const products = await api('GET', '/client/configured-products', clientToken);
    results.push(logStep('GET /client/configured-products', products, 200));

    const formConfig = await api('GET', `/client/form-config?productId=${PRODUCT_ID}`, clientToken);
    results.push(logStep('GET /client/form-config', formConfig, 200));
  }

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\nSummary: ${passed}/${total} steps passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
