import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KycDocumentsStep } from '../../applications/KycDocumentsStep';

const calls: Array<{ url: string; body?: FormData | string }> = [];

function installFetch() {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body as FormData | string | undefined });
      if (url.includes('/engine/urllink')) {
        return new Response(JSON.stringify({ ok: true, url: 'https://files.test/a.jpg' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/engine/airtable_get')) {
        return new Response(JSON.stringify({ ok: true, count: 0, records: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/engine/airtable_write')) {
        return new Response(JSON.stringify({ ok: true, id: 'recBASE000000001', fields: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: false }), { status: 404 });
    })
  );
}

function Harness({ initial }: { initial?: Record<string, unknown> }) {
  const [formData, setFormData] = useState<Record<string, unknown>>({
    'borrower.customerName': 'Govind Pandey',
    'borrower.mobile': '9687599179',
    'coApplicant.name': 'Rita Sharma',
    '_meta.supportPersonType': 'co_applicant',
    ...initial,
  });
  return (
    <>
      <KycDocumentsStep
        formData={formData}
        formConfig={[]}
        recordId="recBASE000000001"
        fileId="SFBASE1"
        onFormDataChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
      />
      <pre data-testid="owner-form-json">{JSON.stringify(formData)}</pre>
    </>
  );
}

function dropOn(element: HTMLElement, files: File[]) {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  element.dispatchEvent(event);
}

describe('upload row', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the applicant and co-applicant names, updates them, and keeps them out of Documents', async () => {
    installFetch();
    const base = {
      'borrower.customerName': 'Govind Pandey',
      'borrower.mobile': '9687599179',
      'coApplicant.name': 'Rita Sharma',
      '_meta.supportPersonType': 'co_applicant',
    };
    render(<Harness initial={base} />);
    expect(screen.getByTestId('kyc-doc-pan_card')).toHaveTextContent('GOVIND PANDEY · Applicant');
    expect(screen.getByTestId('kyc-doc-co_applicant_pan')).toHaveTextContent('RITA SHARMA · Co-applicant');
    expect(screen.getByLabelText('PAN Card for GOVIND PANDEY, applicant')).toBeInTheDocument();

    cleanup();
    render(
      <Harness
        initial={{
          ...base,
          'borrower.customerName': 'Asha Rao',
          'coApplicant.name': 'Dev Rao',
        }}
      />
    );
    expect(screen.getByTestId('kyc-doc-pan_card')).toHaveTextContent('ASHA RAO · Applicant');
    expect(screen.getByTestId('kyc-doc-co_applicant_pan')).toHaveTextContent('DEV RAO · Co-applicant');

    const input = screen.getByTestId('kyc-doc-input-pan_card') as HTMLInputElement;
    await userEvent.upload(input, new File([new Uint8Array(32)], 'pan.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(screen.getByText('pan.jpg')).toBeInTheDocument());

    const write = calls.find((call) => call.url.includes('/engine/airtable_write'));
    const body = JSON.parse(String(write?.body)) as { fields: { Documents: string; 'Form Data': string } };
    expect(body.fields.Documents).not.toMatch(/ASHA|DEV|Applicant|Co-applicant/);
    expect(body.fields['Form Data']).not.toMatch(/· Applicant/);
    expect(screen.getByTestId('owner-form-json').textContent || '').not.toMatch(/· Applicant/);
  });

  it('uploads a drop on an empty row and replaces a drop on a filled row through the same upload call', async () => {
    installFetch();
    render(<Harness initial={{ '_meta.supportPersonType': 'none', 'coApplicant.name': '' }} />);
    const row = await screen.findByTestId('kyc-doc-pan_card');
    dropOn(row, [new File([new Uint8Array(32)], 'first.jpg', { type: 'image/jpeg' })]);
    await waitFor(() => expect(screen.getByText('first.jpg')).toBeInTheDocument());
    dropOn(screen.getByTestId('kyc-doc-pan_card'), [
      new File([new Uint8Array(32)], 'second.jpg', { type: 'image/jpeg' }),
    ]);
    await waitFor(() => expect(screen.getByText('second.jpg')).toBeInTheDocument());
    const uploads = calls.filter((call) => call.url.includes('/engine/urllink'));
    expect(uploads).toHaveLength(2);
    expect(uploads.every((call) => call.body instanceof FormData && call.body.has('data'))).toBe(true);
  });

  it('rejects a dropped exe and sends nothing', async () => {
    installFetch();
    render(<Harness initial={{ '_meta.supportPersonType': 'none', 'coApplicant.name': '' }} />);
    const row = await screen.findByTestId('kyc-doc-pan_card');
    const before = calls.filter((call) => call.url.includes('/engine/urllink')).length;
    dropOn(row, [new File([new Uint8Array(32)], 'virus.exe', { type: 'application/octet-stream' })]);
    expect(await screen.findByText('This file type is not allowed')).toBeInTheDocument();
    expect(calls.filter((call) => call.url.includes('/engine/urllink')).length).toBe(before);
  });

  it('does not navigate when a file is dropped outside a row', async () => {
    installFetch();
    render(<Harness initial={{ '_meta.supportPersonType': 'none', 'coApplicant.name': '' }} />);
    await screen.findByTestId('kyc-documents-step');
    const event = new Event('drop', { bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(window.location.pathname).not.toMatch(/\.exe|download/i);
    expect(calls.some((call) => call.url.includes('/engine/urllink'))).toBe(false);
  });

  it('opens Take photo and Choose file on a coarse pointer', async () => {
    installFetch();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: String(query).includes('coarse'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    render(<Harness initial={{ '_meta.supportPersonType': 'none', 'coApplicant.name': '' }} />);
    await userEvent.click(await screen.findByTestId('kyc-doc-pan_card'));
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeInTheDocument();
    const camera = document.querySelector('input[capture="environment"]');
    expect(camera).not.toBeNull();
    expect(camera).toHaveAttribute('accept', 'image/*');
  });
});
