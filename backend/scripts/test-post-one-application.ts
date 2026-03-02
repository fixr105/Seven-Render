#!/usr/bin/env tsx
/**
 * POST one new loan application and verify Form Data is stored.
 *
 * Usage:
 *   cd backend && npm run test:post-one-application
 *
 * Env:
 *   API_BASE_URL          - e.g. http://localhost:3001/api or https://seven-dash.fly.dev/api
 *   TEST_CLIENT_EMAIL     - client user email (for login)
 *   TEST_CLIENT_PASSWORD  - client user password (for login)
 *   Or: TEST_CLIENT_USERNAME, TEST_CLIENT_PASSCODE (for /auth/validate)
 *   TEST_PRODUCT_ID       - optional; if unset, script GETs loan-products and uses first product id
 */

import fetch from 'node-fetch';

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3001/api').replace(/\/?$/, '');

async function getToken(): Promise<string | null> {
  const email = process.env.TEST_CLIENT_EMAIL;
  const password = process.env.TEST_CLIENT_PASSWORD;
  const username = process.env.TEST_CLIENT_USERNAME;
  const passcode = process.env.TEST_CLIENT_PASSCODE;

  if (email && password) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      console.error('Login failed:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.data?.token ?? data?.token ?? null;
  }

  if (username && passcode) {
    const res = await fetch(`${API_BASE_URL}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, passcode }),
    });
    if (!res.ok) {
      console.error('Validate failed:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.token ?? data?.data?.token ?? null;
  }

  console.error('Set TEST_CLIENT_EMAIL and TEST_CLIENT_PASSWORD, or TEST_CLIENT_USERNAME and TEST_CLIENT_PASSCODE');
  return null;
}

async function getFirstProductId(token: string): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/loan-products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const list = data?.data ?? data?.products ?? data;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  return first?.id ?? first?.['Product ID'] ?? first?.productId ?? null;
}

async function main(): Promise<void> {
  console.log('API_BASE_URL:', API_BASE_URL);

  const token = await getToken();
  if (!token) {
    console.error('Could not obtain token.');
    process.exit(1);
  }
  console.log('Got token.');

  let productId = process.env.TEST_PRODUCT_ID?.trim();
  if (!productId) {
    productId = await getFirstProductId(token);
    if (!productId) {
      console.error('No TEST_PRODUCT_ID set and no products returned from GET /loan-products.');
      process.exit(1);
    }
    console.log('Using productId from first product:', productId);
  }

  const body = {
    productId,
    applicantName: 'Test Applicant POST',
    requestedLoanAmount: '500000',
    formData: {
      'field-1': 'Sample text',
      'field-2': '9876543210',
      'field-3': 'test@example.com',
      'PAN - Documents': 'Yes, Added to Folder',
      Notes: 'E2E test application',
    },
    saveAsDraft: true,
  };

  const createRes = await fetch(`${API_BASE_URL}/loan-applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    console.error('POST /loan-applications failed:', createRes.status, await createRes.text());
    process.exit(1);
  }

  const createData = await createRes.json();
  const applicationId = createData?.data?.loanApplicationId ?? createData?.loanApplicationId;
  if (!applicationId) {
    console.error('Response missing loanApplicationId:', JSON.stringify(createData));
    process.exit(1);
  }
  console.log('Created application id:', applicationId);

  const getRes = await fetch(`${API_BASE_URL}/loan-applications/${applicationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!getRes.ok) {
    console.error('GET /loan-applications/:id failed:', getRes.status, await getRes.text());
    process.exit(1);
  }

  const app = await getRes.json();
  const data = app?.data ?? app;
  const formData = data?.formData ?? data?.form_data ?? data?.['Form Data'];
  let parsed: Record<string, unknown> = {};
  if (typeof formData === 'string') {
    try {
      parsed = JSON.parse(formData);
    } catch {
      parsed = {};
    }
  } else if (typeof formData === 'object' && formData !== null) {
    parsed = formData as Record<string, unknown>;
  }

  const keys = Object.keys(parsed);
  if (keys.length === 0) {
    console.error('Form Data is empty. Expected submitted keys to be stored.');
    process.exit(1);
  }

  const expectedKeys = ['applicantName', 'requestedLoanAmount', 'field-1', 'Notes'];
  const found = expectedKeys.filter((k) => k in parsed);
  if (found.length < 2) {
    console.error('Form Data missing expected keys. Got keys:', keys);
    process.exit(1);
  }

  console.log('Form Data keys stored:', keys.length, keys.slice(0, 10).join(', '), keys.length > 10 ? '...' : '');
  console.log('OK: Form Data is stored with submitted fields.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
