import { describe, expect, it } from 'vitest';
import {
  DO_APPROVAL_CHECKLIST,
  DO_LENDER_NAME,
  buildDoWebhookPayload,
  defaultDoChecklistTicks,
  doColumnHref,
  readDashboardDoUrl,
  readDoPdfFromJson,
} from '../doApproval';

const formData = {
  'borrower.customerName': 'Ajay Kumar',
  'coApplicant.name': 'Neha Kumar',
  'borrower.pan': 'ABCDE1234F',
  'borrower.mobile': '9876543210',
  'loan.amount': '500000',
  'loan.tenureMonths': '36',
  'loan.interestRate': '12',
  'loan.emiAmount': '15000',
  'loan.processingFee': '1000',
  'loan.disbursalAmount': '490000',
  productId: 'EV-1',
  'enach.accountNumber': '1234567890',
  'enach.ifscCode': 'HDFC0001',
};

describe('doApproval', () => {
  it('builds the webhook body from form data', () => {
    expect(DO_APPROVAL_CHECKLIST).toHaveLength(5);
    expect(
      buildDoWebhookPayload({
        formData,
        fileId: 'SF001',
        applicationId: 'recAPP',
        approvedBy: 'kam@test.local',
        approvedAt: '2026-11-17T10:00:00.000Z',
      })
    ).toEqual({
      file_id: 'SF001',
      application_id: 'recAPP',
      applicant_name: 'Ajay Kumar',
      co_applicant_name: 'Neha Kumar',
      pan: 'ABCDE1234F',
      mobile: '9876543210',
      loan_amount: '500000',
      tenure_months: '36',
      interest_rate: '12',
      emi: '15000',
      processing_fee: '1000',
      disbursal_amount: '490000',
      product_id: 'EV-1',
      lender: DO_LENDER_NAME,
      enach_account: '1234567890',
      enach_ifsc: 'HDFC0001',
      approved_by: 'kam@test.local',
      approved_at: '2026-11-17T10:00:00.000Z',
    });
  });

  it('prefers loan.productId over the top-level product id', () => {
    const payload = buildDoWebhookPayload({
      formData: { ...formData, 'loan.productId': 'EV-2' },
      fileId: 'SF001',
      applicationId: 'recAPP',
      approvedBy: 'kam@test.local',
      approvedAt: '2026-11-17T10:00:00.000Z',
    });
    expect(payload.product_id).toBe('EV-2');
  });

  it.each([
    [{ url: 'https://files.example/do.pdf' }, 'https://files.example/do.pdf'],
    [{ pdf_url: 'https://files.example/pdf.pdf' }, 'https://files.example/pdf.pdf'],
    [{ document_url: 'https://files.example/doc.pdf' }, 'https://files.example/doc.pdf'],
    [{ link: 'https://files.example/link.pdf' }, 'https://files.example/link.pdf'],
    [{ data: { url: 'https://files.example/nested.pdf' } }, 'https://files.example/nested.pdf'],
  ])('reads a PDF url from %j', (body, url) => {
    expect(readDoPdfFromJson(body)).toMatchObject({ ok: true, url });
  });

  it('keeps an explicit failure on the checklist', () => {
    expect(readDoPdfFromJson({ ok: false, error: 'template missing' })).toEqual({
      ok: false,
      error: 'template missing',
    });
  });

  it('pre-checks Aadhaar, PAN, credit, and eNACH when those confirmations exist', () => {
    const ticks = defaultDoChecklistTicks({
      '_meta.compliance.ekyc': { status: 'done' },
      '_meta.compliance.enach': { status: 'done' },
      '_meta.qualifyResult': { pass: true },
    });
    expect(ticks).toEqual([true, true, true, true, false]);
    expect(defaultDoChecklistTicks({})).toEqual([false, false, false, false, false]);
  });

  it('reads the dashboard link from the row, then form data', () => {
    expect(
      readDashboardDoUrl({
        DO: 'https://files.example/column.pdf',
        form_data: { '_meta.doApproval': { doUrl: 'https://files.example/meta.pdf' } },
      })
    ).toBe('https://files.example/column.pdf');
    expect(
      readDashboardDoUrl({
        form_data: {
          '_meta.doApproval': { doUrl: 'https://files.example/meta.pdf', checklist: ['eNACH done'] },
        },
      })
    ).toBe('https://files.example/meta.pdf');
    expect(doColumnHref('https://files.example/meta.pdf')).toBe('https://files.example/meta.pdf');
    expect(doColumnHref('')).toBeNull();
    expect(doColumnHref('not-a-url')).toBeNull();
  });
});
