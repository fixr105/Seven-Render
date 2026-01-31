#!/usr/bin/env tsx
/**
 * Login Flow Verification Script
 *
 * Runs the minimal verification checklist from the Login Failure Diagnostic Plan:
 * 1. Backend health (GET /health at root)
 * 2. n8n POST /webhook/useraccount (200 + single user record or { status: "unmatched" })
 * 3. POST /auth/validate (username + passcode) -> 200 + token + user
 *
 * Usage:
 *   cd backend && npx tsx scripts/verify-login-flow.ts
 *   API_BASE_URL=http://localhost:3001/api N8N_BASE_URL=... npx tsx scripts/verify-login-flow.ts
 *
 * Credentials: Sagar@gmail.com / pass@123 (override via E2E_CLIENT_USERNAME, E2E_CLIENT_PASSWORD)
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3001/api').replace(/\/?$/, '');
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';
const USERNAME = process.env.E2E_CLIENT_USERNAME || 'Sagar@gmail.com';
const PASSWORD = process.env.E2E_CLIENT_PASSWORD || 'pass@123';

const USERACCOUNT_URL = `${N8N_BASE_URL.replace(/\/?$/, '')}/webhook/useraccount`;

// Root health is at /health (server.ts). /api/health is routed elsewhere and may require auth.
const HEALTH_URL = API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:3001';

interface Step {
  name: string;
  passed: boolean;
  detail?: string;
  error?: string;
}

const steps: Step[] = [];

function ok(name: string, detail?: string) {
  steps.push({ name, passed: true, detail });
  console.log(`✅ ${name}${detail ? ` ${detail}` : ''}`);
}

function fail(name: string, error: string, detail?: string) {
  steps.push({ name, passed: false, error, detail });
  console.log(`❌ ${name}: ${error}${detail ? ` ${detail}` : ''}`);
}

async function main() {
  console.log('\n=== Login Flow Verification ===\n');
  console.log(`API_BASE_URL: ${API_BASE_URL}`);
  console.log(`N8N useraccount: ${USERACCOUNT_URL}`);
  console.log(`Credentials: ${USERNAME} / ****\n`);

  // 1. Backend health (root /health, not /api/health)
  try {
    const r = await fetch(`${HEALTH_URL}/health`);
    const okStatus = r.ok;
    const text = await r.text();
    if (!okStatus) {
      fail('Backend health', `HTTP ${r.status}`, text.slice(0, 200));
    } else {
      ok('Backend health', `HTTP ${r.status}`);
    }
  } catch (e: any) {
    fail('Backend health', e?.message || String(e), 'Is the backend running on PORT?');
  }

  // 2. POST /webhook/useraccount with credentials (single user or unmatched)
  try {
    const r = await fetch(USERACCOUNT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Username: USERNAME, Password: PASSWORD }),
    });
    const text = await r.text();
    if (!r.ok) {
      fail('POST /webhook/useraccount', `HTTP ${r.status}`, text.slice(0, 200));
    } else {
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : undefined;
      } catch {
        fail('POST /webhook/useraccount', 'Response is not JSON', text.slice(0, 200));
      }
      if (data !== undefined && data !== null && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (obj.status === 'unmatched') {
          ok('POST /webhook/useraccount', 'HTTP 200, status: unmatched (no user match)');
        } else if (typeof obj.id === 'string' && (obj.fields || obj.Username)) {
          ok('POST /webhook/useraccount', 'HTTP 200, single user record');
        } else {
          fail('POST /webhook/useraccount', 'Response is neither single user record nor { status: "unmatched" }', typeof data);
        }
      } else {
        fail('POST /webhook/useraccount', 'Empty or invalid response');
      }
    }
  } catch (e: any) {
    fail('POST /webhook/useraccount', e?.message || String(e), 'Check n8n POST workflow active, path useraccount');
  }

  // 3. POST /auth/validate
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 55_000);
    let r: Awaited<ReturnType<typeof fetch>>;
    try {
      r = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, passcode: PASSWORD }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(to);
    }
    const text = await r!.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      fail('POST /auth/validate', 'Response is not JSON', text.slice(0, 200));
      data = {};
    }
    if (!r.ok) {
      const hint =
        r.status === 401 && (data?.error || '').toLowerCase().includes('invalid')
          ? ' Ensure test user (e.g. Sagar@gmail.com) exists in Airtable User Accounts with Account Status Active and matching password.'
          : '';
      fail(
        'POST /auth/validate',
        `HTTP ${r.status} ${data?.error || text.slice(0, 100)}`,
        hint || undefined
      );
    } else {
      const d = data?.data ?? data;
      const hasToken = d && typeof d.token === 'string';
      const hasUser = d && d.user && typeof d.user === 'object';
      if (!hasToken || !hasUser) {
        fail('POST /auth/validate', 'Missing data.token or data.user', JSON.stringify(d).slice(0, 200));
      } else {
        ok('POST /auth/validate', `HTTP 200, token + user (${(d.user as any).role})`);
      }
    }
  } catch (e: any) {
    fail('POST /auth/validate', e?.message || String(e), 'Check backend, useraccount webhook, Airtable user');
  }

  const passed = steps.filter((s) => s.passed).length;
  const total = steps.length;
  console.log(`\n--- ${passed}/${total} checks passed ---\n`);
  process.exit(passed === total ? 0 : 1);
}

main();
