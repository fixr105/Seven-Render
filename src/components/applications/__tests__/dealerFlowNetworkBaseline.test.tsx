/**
 * Regression gate: URL, method, body-key set, and order.
 * Values are not compared. Re-run after UI work; any diff means stop.
 */
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KycDocumentsStep } from '../KycDocumentsStep';
import { PostSubmitEngineFlow } from '../PostSubmitEngineFlow';
import { renderWithProviders } from '../../../test/helpers';

type Call = {
  method: string;
  path: string;
  keys: string[];
  table?: string;
};

const calls: Call[] = [];

function bodyKeys(init?: RequestInit): { keys: string[]; table?: string } {
  const body = init?.body;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return { keys: Array.from(body.keys()).sort() };
  }
  if (typeof body !== 'string' || !body) return { keys: [] };
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const keys = Object.keys(parsed).sort();
    const fields = parsed.fields;
    if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
      for (const key of Object.keys(fields as Record<string, unknown>).sort()) {
        keys.push(`fields.${key}`);
      }
    }
    const table = typeof parsed.table === 'string' ? parsed.table : undefined;
    return { keys, table };
  } catch {
    return { keys: ['<non-json>'] };
  }
}

function installFetch() {
  calls.length = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = String(input);
    const url = new URL(raw, 'http://baseline.local');
    const shape = bodyKeys(init);
    calls.push({
      method: (init?.method || 'GET').toUpperCase(),
      path: url.pathname,
      keys: shape.keys,
      table: shape.table,
    });
    return jsonFor(url.pathname, shape.table, init);
  });
  vi.stubGlobal('fetch', fetchMock);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonFor(path: string, table: string | undefined, init?: RequestInit) {
  if (path === '/engine/urllink') {
    return jsonResponse({ ok: true, url: 'https://files.test/a.jpg' });
  }
  if (path === '/engine/qualify') {
    return jsonResponse({
      ok: true,
      pass: true,
      is_ntc: false,
      kill_code: null,
      failed: [],
      missing: [],
      bureau_ref: 'AL-BASE',
      applicant: { name: 'GOVIND PANDEY', pan: 'ABCDE1234F', mobile: '9687599179' },
    });
  }
  if (path === '/engine/airtable_get') {
    if (table === 'VKYC Links') {
      return jsonResponse({ ok: true, count: 0, records: [] });
    }
    if (table === 'Loan Applications') {
      return jsonResponse({ ok: true, count: 1, records: [{ id: 'recBASE000000001' }] });
    }
    if (table === 'Lenders') {
      return jsonResponse({
        ok: true,
        count: 1,
        records: [
          {
            id: 'recLENDER1',
            name: 'Fintree',
            status: 'active',
            min_ticket: 50000,
            max_ticket: 300000,
            tenure_months: '12,18',
          },
        ],
      });
    }
    if (table === 'Bureau Cache') {
      return jsonResponse({
        ok: true,
        count: 1,
        records: [{ id: 'recCACHE1', pan: 'ABCDE1234F', result_json: { score: 750 } }],
      });
    }
    if (table === 'Lender BRE') {
      return jsonResponse({
        ok: true,
        count: 1,
        records: [
          {
            id: 'recBRE1',
            'Rule ID': 7,
            'NBFC Partner': 'Fintree',
            'Min CIBIL': 700,
            'Max CIBIL': 900,
            Eligible: true,
            ROI: 28,
            PF: 6.75,
            Active: true,
            'Loan Product': '',
          },
        ],
      });
    }
    return jsonResponse({ ok: true, count: 0, records: [] });
  }
  if (path === '/engine/airtable_write') {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    return jsonResponse({ ok: true, id: body.record_id || 'recBASE000000001', fields: {} });
  }
  if (path.startsWith('/tools/')) {
    return jsonResponse({ ok: true, event_id: 'evt-base' });
  }
  return jsonResponse({ ok: false, error: `unmocked ${path}` }, 404);
}

function fingerprint(list: Call[]) {
  return list.map((call) => ({
    method: call.method,
    path: call.path,
    table: call.table ?? null,
    keys: call.keys,
  }));
}

function KycHarness() {
  const [formData, setFormData] = useState<Record<string, unknown>>({
    'borrower.customerName': 'GOVIND PANDEY',
    'borrower.mobile': '9687599179',
    '_meta.fileId': 'SFBASE1',
  });
  return (
    <KycDocumentsStep
      formData={formData}
      formConfig={[]}
      recordId="recBASE000000001"
      fileId="SFBASE1"
      onFormDataChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
    />
  );
}

const STEP6_BASELINE = [
  {
    method: 'POST',
    path: '/engine/airtable_get',
    table: 'VKYC Links',
    keys: ['base_id', 'filter_formula', 'max', 'table'],
  },
];

describe('dealer flow network baseline', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('step 6 mount reads VKYC and does not write', async () => {
    installFetch();
    render(<KycHarness />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fingerprint(calls)).toEqual(STEP6_BASELINE);
  });

  it('step 6 upload then replace keeps the same call shape', async () => {
    installFetch();
    render(<KycHarness />);
    await waitFor(() => expect(calls.some((c) => c.table === 'VKYC Links')).toBe(true));
    const input = (await screen.findByTestId('kyc-doc-input-pan_card')) as HTMLInputElement;
    const file = new File([new Uint8Array(128)], 'pan.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);
    await waitFor(() => expect(screen.getByText('Replace')).toBeInTheDocument());
    const replaceInput = screen
      .getByTestId('kyc-doc-pan_card')
      .querySelector('input[type="file"]') as HTMLInputElement;
    const next = new File([new Uint8Array(128)], 'pan2.jpg', { type: 'image/jpeg' });
    await userEvent.upload(replaceInput, next);
    await waitFor(() => expect(screen.getByText('pan2.jpg')).toBeInTheDocument());

    const uploads = calls.filter((c) => c.path === '/engine/urllink');
    const writes = calls.filter((c) => c.path === '/engine/airtable_write');
    expect(uploads).toHaveLength(2);
    expect(writes).toHaveLength(2);
    expect(uploads.every((c) => c.method === 'POST' && c.keys.includes('data'))).toBe(true);
    expect(
      writes.every(
        (c) =>
          c.table === 'Loan Applications' &&
          c.keys.includes('fields.Documents') &&
          c.keys.includes('fields.Form Data') &&
          c.keys.includes('record_id')
      )
    ).toBe(true);
  });

  it('post-submit qualify through offer keeps call order', async () => {
    installFetch();
    renderWithProviders(
      <PostSubmitEngineFlow
        session={{
          fileId: 'SFBASE1',
          recordId: 'recBASE000000001',
          formData: {
            'borrower.customerName': 'GOVIND PANDEY',
            'borrower.firstName': 'GOVIND',
            'borrower.lastName': 'PANDEY',
            'borrower.pan': 'ABCDE1234F',
            'borrower.mobile': '9687599179',
            'borrower.email': 'govind@example.com',
            'loan.amount': '100000',
            'loan.tenureMonths': '12',
            productId: 'LP012',
            '_meta.kycDocuments.documentsString': 'pan_card:https://files.test/a.jpg|pan.jpg',
            '_meta.kycDocuments.uploads': {
              pan_card: { url: 'https://files.test/a.jpg', filename: 'pan.jpg' },
              aadhaar_front: { url: 'https://files.test/a.jpg', filename: 'af.jpg' },
              aadhaar_back: { url: 'https://files.test/a.jpg', filename: 'ab.jpg' },
              passport_photo: { url: 'https://files.test/a.jpg', filename: 'photo.jpg' },
            },
          },
        }}
      />
    );

    await waitFor(() => expect(screen.getByText('Select your offer')).toBeInTheDocument(), {
      timeout: 8000,
    });

    const dealerCalls = calls.filter(
      (c) => c.path.startsWith('/engine/') || c.path.startsWith('/tools/')
    );
    const summary = fingerprint(dealerCalls).map(
      (c) => `${c.method} ${c.path}${c.table ? ` ${c.table}` : ''}`
    );
    expect(summary).toEqual([
      'POST /engine/qualify',
      'POST /engine/airtable_write Loan Applications',
      'POST /engine/airtable_write Loan Applications',
      'POST /engine/airtable_get Lenders',
      'POST /engine/airtable_get Bureau Cache',
      'POST /engine/airtable_get Lender BRE',
    ]);

    const qualify = calls.find((c) => c.path === '/engine/qualify');
    expect(qualify?.keys).toEqual(
      expect.arrayContaining([
        'Full_Name',
        'Mobile_Number',
        'PAN_Number',
        'application_id',
        'base_id',
        'consent_bureau',
        'consent_bureau_at',
        'email',
        'mobile',
        'name',
        'pan',
        'product_code',
        'requested_amount',
      ])
    );

    const writes = calls.filter((c) => c.path === '/engine/airtable_write');
    expect(writes[0]?.keys).toEqual(
      expect.arrayContaining(['fields.Status', 'fields.Form Data', 'fields.Last Updated', 'record_id', 'table'])
    );
    expect(writes[0]?.table).toBe('Loan Applications');
    expect(writes[1]?.keys).toEqual(expect.arrayContaining(['fields.Documents']));

    const tables = calls.filter((c) => c.path === '/engine/airtable_get').map((c) => c.table);
    expect(tables).toEqual(['Lenders', 'Bureau Cache', 'Lender BRE']);
  });
});
