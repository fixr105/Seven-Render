#!/usr/bin/env tsx
/**
 * Login Test Script
 *
 * Tests the full login flow:
 * 1. POST /api/auth/login with { email, password }
 * 2. Check response: 200 + user payload, or 401/429/500 + error
 * 3. If 200, verify Set-Cookie: auth_token=...
 * 4. Call GET /api/auth/me with cookie to verify session
 *
 * Usage:
 *   cd backend && npx tsx scripts/test-login.ts
 *   API_BASE_URL=https://seven-dash.fly.dev/api npx tsx scripts/test-login.ts
 *   E2E_CLIENT_USERNAME=sagar@sevenfincorp.email E2E_CLIENT_PASSWORD=pass@123 npx tsx scripts/test-login.ts
 *
 * Tip: Set SKIP_AUTH_RATE_LIMIT=true when testing locally to bypass rate limits.
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3001/api').replace(/\/?$/, '');
const EMAIL = process.env.E2E_CLIENT_USERNAME || process.env.TEST_LOGIN_EMAIL || 'sagar@sevenfincorp.email';
const PASSWORD = process.env.E2E_CLIENT_PASSWORD || process.env.TEST_LOGIN_PASSWORD || 'pass@123';

interface TestResult {
  step: string;
  passed: boolean;
  detail?: string;
  error?: string;
}

const results: TestResult[] = [];

function ok(step: string, detail?: string) {
  results.push({ step, passed: true, detail });
  console.log(`✅ ${step}${detail ? ` ${detail}` : ''}`);
}

function fail(step: string, error: string, detail?: string) {
  results.push({ step, passed: false, error, detail });
  console.log(`❌ ${step}: ${error}${detail ? ` ${detail}` : ''}`);
}

async function main() {
  console.log('\n=== Login Test Script ===\n');
  console.log(`API_BASE_URL: ${API_BASE_URL}`);
  console.log(`Email: ${EMAIL}`);
  console.log(`Password: ****\n`);

  let cookies: string[] = [];

  // 1. POST /api/auth/login
  try {
    const loginUrl = `${API_BASE_URL}/auth/login`;
    const r = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });

    const text = await r.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      fail('POST /auth/login', 'Response is not JSON', text.slice(0, 200));
    }

    if (!r.ok) {
      const errMsg = (data.error as string) || text.slice(0, 100);
      if (r.status === 429) {
        fail('POST /auth/login', errMsg, 'Tip: Set SKIP_AUTH_RATE_LIMIT=true or wait 15 minutes');
      } else if (r.status === 401) {
        fail('POST /auth/login', errMsg, 'Check: User exists in Airtable, Password is bcrypt hash, Account Status is Active');
      } else {
        fail('POST /auth/login', `HTTP ${r.status}: ${errMsg}`);
      }
    } else {
      const userData = data.data as Record<string, unknown> | undefined;
      const user = userData?.user as Record<string, unknown> | undefined;
      if (!user) {
        fail('POST /auth/login', 'Missing data.user in response');
      } else {
        ok('POST /auth/login', `HTTP 200, user: ${user.email} (${user.role})`);
      }

      // Capture Set-Cookie for /me request (node-fetch raw or standard getSetCookie)
      const headers = r.headers as unknown as { raw?: () => Record<string, string[]>; getSetCookie?: () => string[] };
      const setCookie =
        headers.getSetCookie?.() ??
        headers.raw?.()?.['set-cookie'] ??
        (r.headers.get('set-cookie') ? [r.headers.get('set-cookie')!] : null);
      if (setCookie) {
        const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
        cookies = arr.filter(Boolean);
        if (cookies.some((c) => c.includes('auth_token'))) {
          ok('Set-Cookie', 'auth_token cookie present');
        } else {
          fail('Set-Cookie', 'auth_token cookie not found');
        }
      } else {
        fail('Set-Cookie', 'No Set-Cookie header in response');
      }
    }
  } catch (e: unknown) {
    const err = e as Error;
    fail('POST /auth/login', err?.message || String(e), 'Is the backend running?');
  }

  // 2. GET /api/auth/me with cookie (only if login succeeded)
  if (cookies.length > 0) {
    try {
      const cookieHeader = cookies.join('; ');
      const r = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: { Cookie: cookieHeader },
      });

      const text = await r.text();
      let data: Record<string, unknown> = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        fail('GET /auth/me', 'Response is not JSON', text.slice(0, 200));
      }

      if (!r.ok) {
        fail('GET /auth/me', `HTTP ${r.status} ${(data.error as string) || text.slice(0, 100)}`);
      } else {
        const userData = data.data as Record<string, unknown> | undefined;
        if (!userData || !userData.email) {
          fail('GET /auth/me', 'Missing data in response');
        } else {
          ok('GET /auth/me', `HTTP 200, session valid for ${userData.email}`);
        }
      }
    } catch (e: unknown) {
      const err = e as Error;
      fail('GET /auth/me', err?.message || String(e));
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`\n--- ${passed}/${total} checks passed ---\n`);
  process.exit(passed === total ? 0 : 1);
}

main();
