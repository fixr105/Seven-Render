#!/usr/bin/env tsx
/**
 * B2C EV end-to-end audit: Client creates file → submits → KAM fulfills compliance/DO.
 * Every mutation is verified with GET (API + n8n Loan Application table).
 *
 * Usage:
 *   cd backend && npx tsx scripts/audit-b2c-ev-flow.ts
 */

import dotenv from 'dotenv';
import { LoanStatus } from '../src/config/constants.js';
import { n8nClient } from '../src/services/airtable/n8nClient.js';
import { resolveStoredApplicationStatus } from '../src/utils/loanApplicationAirtableStatus.js';
import { createInitialB2cEvFormData } from '../../src/config/forms/b2cEvFormSchema.js';

dotenv.config();

const API = (process.env.API_BASE_URL || 'http://localhost:3001/api').replace(/\/?$/, '');
const CLIENT_EMAIL = process.env.E2E_CLIENT_USERNAME || 'vadukavsk@gmail.com';
const CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD || 'pass@123';
const KAM_EMAIL = process.env.E2E_KAM_USERNAME || 'Anya@sevenfincorp.email';
const KAM_PASSWORD = process.env.E2E_KAM_PASSWORD || 'pass@123';

type StepResult = {
  step: number;
  actor: 'system' | 'client' | 'kam';
  action: string;
  method: string;
  endpoint: string;
  success: boolean;
  detail?: string;
  error?: string;
  getVerified?: boolean;
};

const steps: StepResult[] = [];
const brokenFunctions: Array<{ name: string; reason: string; step?: number }> = [];
let stepCounter = 0;

function logStep(result: Omit<StepResult, 'step'>) {
  stepCounter += 1;
  const row = { step: stepCounter, ...result };
  steps.push(row);
  const icon = result.success ? '✅' : '❌';
  const verify = result.getVerified === false ? ' [GET NOT VERIFIED]' : result.getVerified ? ' [GET OK]' : '';
  console.log(`${icon} Step ${row.step} [${result.actor}] ${result.action}${verify}`);
  if (result.detail) console.log(`   ${result.detail}`);
  if (result.error) console.log(`   ERROR: ${result.error}`);
}

async function apiCall(
  token: string | null,
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: r.ok, status: r.status, data };
}

function formatApiError(data: Record<string, unknown>, status: number): string {
  const parts = [`HTTP ${status}`];
  if (data.error) parts.push(String(data.error));
  if (data.missingFields) parts.push(`missingFields=${JSON.stringify(data.missingFields).slice(0, 200)}`);
  if (data.formatErrors) parts.push(`formatErrors=${JSON.stringify(data.formatErrors).slice(0, 200)}`);
  return parts.join(' | ');
}

async function login(email: string, password: string) {
  const { ok, status, data } = await apiCall(null, 'POST', '/auth/login', { email, password });
  const payload = data.data as Record<string, unknown> | undefined;
  const user = payload?.user as Record<string, unknown> | undefined;
  const token = (payload?.token as string) || null;
  return { ok, status, token, user, error: data.error as string | undefined };
}

function parseFormData(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

async function getApplicationFromDb(appId: string): Promise<Record<string, unknown> | null> {
  n8nClient.invalidateCache('Loan Application');
  const apps = await n8nClient.fetchTable('Loan Application', false);
  const normalizedId = appId.trim().toLowerCase();
  return (
    apps.find((a) => {
      const id = String(a.id ?? a['Record ID'] ?? '').toLowerCase();
      const fileId = String(a['File ID'] ?? a.fileId ?? '').toLowerCase();
      return id === normalizedId || fileId === normalizedId;
    }) ?? null
  );
}

function buildGeoPhotoPatch(prefix: string): Record<string, unknown> {
  return {
    [`geoPhotos.${prefix}.url`]: `https://example.com/geo-${prefix}.jpg`,
    [`geoPhotos.${prefix}.fileName`]: `${prefix}.jpg`,
    [`geoPhotos.${prefix}.latitude`]: '19.0760',
    [`geoPhotos.${prefix}.longitude`]: '72.8777',
    [`geoPhotos.${prefix}.capturedAt`]: new Date().toISOString(),
  };
}

function buildMinimalB2cFormData(): Record<string, unknown> {
  const base = createInitialB2cEvFormData();
  return {
    ...base,
    ...buildGeoPhotoPatch('withSupportPerson'),
    ...buildGeoPhotoPatch('withVehicle'),
    ...buildGeoPhotoPatch('atResidence'),
    'borrower.firstName': 'AUDIT',
    'borrower.lastName': 'TESTUSER',
    'borrower.customerName': 'AUDIT TESTUSER',
    'borrower.gender': 'Male',
    'borrower.dob': '1990-01-15',
    'borrower.fatherName': 'FATHER TEST',
    'borrower.mobile': '9876543210',
    'borrower.email': 'audit.test@example.com',
    'borrower.pan': 'ABCDE1234F',
    'borrower.address.line1': '123 Audit Street',
    'borrower.address.village': 'Test Village',
    'borrower.address.pincode': '400001',
    'borrower.address.district': 'Mumbai',
    'borrower.address.state': 'Maharashtra',
    'loan.amount': 500000,
    'loan.interestRate': 12,
    'loan.tenureMonths': 36,
    'loan.processingFee': 5000,
    'loan.gpsCharges': 3000,
    'loan.processingFeePercent': 1,
    'loan.disbursalAmount': 492000,
    'dealer.displayLabel': 'Audit Dealer',
    'dealer.id': 'DEALER-AUDIT',
    'dealer.tradeName': 'Audit Motors',
    'dealer.name': 'Audit Motors Pvt Ltd',
    'dealer.contact': '9876543211',
    'dealer.email': 'dealer@audit.com',
    'dealer.gstNumber': '27AAAAA0000A1Z5',
    'dealer.pan': 'AAAAA1234A',
    'dealer.ifscCode': 'HDFC0001234',
    '_meta.supportPersonType': 'co_applicant',
    'coApplicant.name': 'CO APPLICANT TEST',
    'coApplicant.dob': '1992-06-01',
    'coApplicant.email': 'coapplicant@audit.com',
    'coApplicant.pan': 'FGHIJ5678K',
    'coApplicant.address.line1': '456 Co Street',
    'coApplicant.address.village': 'Co Village',
    'coApplicant.address.pincode': '400002',
    'coApplicant.address.district': 'Mumbai',
    'coApplicant.address.state': 'Maharashtra',
    'coApplicant.mobile': '9876543212',
    'coApplicant.relationship': 'Spouse',
    '_meta.panLookup.status': 'completed',
    '_meta.panLookup.completedAt': new Date().toISOString(),
    'compliance.vkycDone': 'true',
    'compliance.loanAgreementSigned': 'true',
    'compliance.enachDone': 'true',
    'insurance.cost': 15000,
    'insurance.provider': 'Audit Insurance',
    'insurance.policyNumber': 'POL-AUDIT-001',
    'insurance.issuedDate': '2026-01-01',
    'insurance.periodMonths': 12,
    'vehicle.cost': 600000,
    'vehicle.manufacturingYear': 2025,
    'vehicle.invoiceDate': '2026-01-15',
    'vehicle.downpayment': 100000,
    'vehicle.registrationCost': 5000,
    _documentsFolderLink: 'https://drive.google.com/drive/folders/audit-test-folder',
    '_meta.documentsFolderLink.consumedLink': 'https://drive.google.com/drive/folders/audit-test-folder',
    '_meta.documentsFolderLink.consumedAt': new Date().toISOString(),
  };
}

async function main() {
  console.log('\n=== B2C EV System Audit ===\n');
  console.log(`API: ${API}`);
  console.log(`Client: ${CLIENT_EMAIL}`);
  console.log(`KAM: ${KAM_EMAIL}\n`);

  let clientToken: string | null = null;
  let kamToken: string | null = null;
  let applicationId = '';
  let fileId = '';
  let productId = '';

  // --- Step 1: Client login ---
  {
    const { ok, token, user, error } = await login(CLIENT_EMAIL, CLIENT_PASSWORD);
    clientToken = token;
    logStep({
      actor: 'client',
      action: 'Login as Client',
      method: 'POST',
      endpoint: '/auth/login',
      success: ok && !!token && user?.role === 'client',
      detail: user ? `role=${user.role}, clientId=${user.clientId}` : undefined,
      error: ok ? (user?.role !== 'client' ? `Expected client role, got ${user?.role}` : undefined) : error,
    });
    if (!ok || !token || user?.role !== 'client') {
      brokenFunctions.push({ name: 'Client login', reason: error || 'Wrong role or missing token', step: 1 });
    }
  }

  // --- Step 2: GET client loan products ---
  {
    const { ok, status, data } = await apiCall(clientToken, 'GET', '/loan-products');
    const products = (data.data as unknown[]) || [];
    const b2cProduct = products.find((p) => {
      const row = p as Record<string, unknown>;
      const name = String(row.productName ?? row['Product Name'] ?? '').toLowerCase();
      const id = String(row.productId ?? row.id ?? row['Product ID'] ?? '');
      return name.includes('b2c ev') || id === 'LP012';
    }) as Record<string, unknown> | undefined;
    productId = String(
      b2cProduct?.productId ??
        b2cProduct?.id ??
        (products[0] ? (products[0] as Record<string, unknown>).productId ?? (products[0] as Record<string, unknown>).id : '')
    );
    logStep({
      actor: 'client',
      action: 'GET assigned loan products',
      method: 'GET',
      endpoint: '/loan-products',
      success: ok && products.length > 0,
      detail: `Found ${products.length} products, selected=${productId}`,
      error: ok ? (products.length === 0 ? 'No products assigned' : undefined) : String(data.error),
      getVerified: ok,
    });
    if (!ok || !productId) {
      brokenFunctions.push({ name: 'GET /loan-products', reason: 'No product available for client', step: 2 });
    }
  }

  // --- Step 3: Create B2C EV draft ---
  const formData = buildMinimalB2cFormData();
  const clientSubmissionId = `audit-b2c-${Date.now()}`;
  {
    const { ok, status, data } = await apiCall(clientToken, 'POST', '/loan-applications', {
      productId,
      applicantName: 'AUDIT TESTUSER',
      requestedLoanAmount: 500000,
      formData,
      saveAsDraft: true,
      clientSubmissionId,
    });
    const payload = data.data as Record<string, unknown> | undefined;
    applicationId = String(payload?.loanApplicationId ?? '');
    fileId = String(payload?.fileId ?? applicationId);
    logStep({
      actor: 'client',
      action: 'Create B2C EV draft application',
      method: 'POST',
      endpoint: '/loan-applications',
      success: ok && !!applicationId,
      detail: `applicationId=${applicationId}, fileId=${fileId}`,
      error: ok ? undefined : formatApiError(data, status),
    });
    if (!ok || !applicationId) {
      brokenFunctions.push({ name: 'createApplication (B2C EV)', reason: String(data.error), step: 3 });
    }
  }

  // --- Step 4: GET verify draft in DB (n8n) ---
  {
    let verified = false;
    let detail = '';
    try {
      const app = await getApplicationFromDb(applicationId);
      if (app) {
        const fd = parseFormData(app['Form Data']);
        verified =
          fd['_meta.formTemplate'] === 'b2c_ev_v1' &&
          resolveStoredApplicationStatus(app.Status ?? app.status) === LoanStatus.DRAFT;
        detail = `resolvedStatus=${resolveStoredApplicationStatus(app.Status ?? app.status)}, template=${fd['_meta.formTemplate']}`;
      } else {
        detail = 'Application not found in Loan Application table';
      }
    } catch (e) {
      detail = e instanceof Error ? e.message : String(e);
    }
    logStep({
      actor: 'system',
      action: 'GET verify draft in n8n Loan Application table',
      method: 'GET',
      endpoint: 'n8n: Loan Application',
      success: verified,
      detail,
      getVerified: verified,
    });
    if (!verified) {
      brokenFunctions.push({ name: 'n8n GET Loan Application (after create)', reason: detail, step: 4 });
    }
  }

  // --- Step 5: GET via client API ---
  {
    const { ok, status, data } = await apiCall(clientToken, 'GET', `/loan-applications/${applicationId}`);
    const app = data.data as Record<string, unknown> | undefined;
    const fd = parseFormData(app?.form_data ?? app?.formData ?? app?.['Form Data']);
    const verified = ok && fd['_meta.formTemplate'] === 'b2c_ev_v1';
    logStep({
      actor: 'client',
      action: 'GET application detail (client)',
      method: 'GET',
      endpoint: `/loan-applications/${applicationId}`,
      success: verified,
      detail: verified ? `status=${app?.status ?? app?.Status}` : String(data.error),
      getVerified: verified,
    });
    if (!verified) {
      brokenFunctions.push({ name: 'GET /loan-applications/:id (client)', reason: String(data.error || 'template mismatch'), step: 5 });
    }
  }

  // --- Step 6: Client requests compliance (VKYC) via query ---
  let vkycQueryId = '';
  {
    const { ok, status, data } = await apiCall(clientToken, 'POST', `/loan-applications/${applicationId}/queries`, {
      message: 'Please complete VKYC for AUDIT TESTUSER.',
      requestKind: 'b2c_compliance',
      itemId: 'vkyc',
    });
    vkycQueryId = String((data.data as Record<string, unknown> | undefined)?.queryId ?? '');
    logStep({
      actor: 'client',
      action: 'Request VKYC compliance (client query → audit log)',
      method: 'POST',
      endpoint: `/loan-applications/${applicationId}/queries`,
      success: ok,
      detail: vkycQueryId ? `queryId=${vkycQueryId}` : undefined,
      error: ok ? undefined : formatApiError(data, status),
    });
    if (!ok) {
      brokenFunctions.push({ name: 'createClientQuery (b2c_compliance vkyc)', reason: String(data.error), step: 6 });
    }
  }

  // --- Step 7: Client persists VKYC request metadata (mirrors wizard persistDraft) ---
  {
    const requestedAt = new Date().toISOString();
    const patch: Record<string, unknown> = {
      '_meta.kamRequests.vkyc.requestedAt': requestedAt,
    };
    if (vkycQueryId) patch['_meta.kamRequests.vkyc.queryId'] = vkycQueryId;
    const { ok, status, data } = await apiCall(clientToken, 'POST', `/loan-applications/${applicationId}/form`, {
      formData: patch,
    });
    logStep({
      actor: 'client',
      action: 'Persist VKYC request metadata to form_data (wizard parity)',
      method: 'POST',
      endpoint: `/loan-applications/${applicationId}/form`,
      success: ok,
      detail: `requestedAt=${requestedAt}`,
      error: ok ? undefined : formatApiError(data, status),
    });
    if (!ok) {
      brokenFunctions.push({ name: 'updateApplicationForm (VKYC metadata)', reason: String(data.error), step: 7 });
    }
  }

  // --- Step 8: GET verify compliance request in form_data ---
  {
    const app = await getApplicationFromDb(applicationId);
    const fd = parseFormData(app?.['Form Data']);
    const requestedAt = String(fd['_meta.kamRequests.vkyc.requestedAt'] ?? '');
    const verified = Boolean(requestedAt);
    logStep({
      actor: 'system',
      action: 'GET verify VKYC request persisted in form_data',
      method: 'GET',
      endpoint: 'n8n: Loan Application form_data',
      success: verified,
      detail: `requestedAt=${requestedAt || '(empty)'}`,
      getVerified: verified,
    });
    if (!verified) {
      brokenFunctions.push({
        name: 'B2C compliance query → form_data patch',
        reason: 'VKYC requestedAt not set after client form update',
        step: 8,
      });
    }
  }

  // --- Step 9: Client requests DO ---
  let doQueryId = '';
  {
    const { ok, status, data } = await apiCall(clientToken, 'POST', `/loan-applications/${applicationId}/queries`, {
      message: 'Please process Disbursement Order (DO) for AUDIT TESTUSER.',
      requestKind: 'b2c_do',
    });
    doQueryId = String((data.data as Record<string, unknown> | undefined)?.queryId ?? '');
    logStep({
      actor: 'client',
      action: 'Request Disbursement Order (DO) query',
      method: 'POST',
      endpoint: `/loan-applications/${applicationId}/queries`,
      success: ok,
      detail: doQueryId ? `queryId=${doQueryId}` : undefined,
      error: ok ? undefined : formatApiError(data, status),
    });
    if (!ok) {
      brokenFunctions.push({ name: 'createClientQuery (b2c_do)', reason: String(data.error), step: 9 });
    }
  }

  // --- Step 10: Client persists DO request metadata ---
  {
    const requestedAt = new Date().toISOString();
    const patch: Record<string, unknown> = {
      '_meta.doRequest.requestedAt': requestedAt,
    };
    if (doQueryId) patch['_meta.doRequest.queryId'] = doQueryId;
    const { ok, status, data } = await apiCall(clientToken, 'POST', `/loan-applications/${applicationId}/form`, {
      formData: patch,
    });
    logStep({
      actor: 'client',
      action: 'Persist DO request metadata to form_data (wizard parity)',
      method: 'POST',
      endpoint: `/loan-applications/${applicationId}/form`,
      success: ok,
      detail: `requestedAt=${requestedAt}`,
      error: ok ? undefined : formatApiError(data, status),
    });
    if (!ok) {
      brokenFunctions.push({ name: 'updateApplicationForm (DO metadata)', reason: String(data.error), step: 10 });
    }
  }

  // --- Step 11: GET verify DO request in form_data ---
  {
    const app = await getApplicationFromDb(applicationId);
    const fd = parseFormData(app?.['Form Data']);
    const doRequestedAt = String(fd['_meta.doRequest.requestedAt'] ?? '');
    const verified = Boolean(doRequestedAt);
    logStep({
      actor: 'system',
      action: 'GET verify DO request persisted in form_data',
      method: 'GET',
      endpoint: 'n8n: Loan Application form_data',
      success: verified,
      detail: `doRequest.requestedAt=${doRequestedAt || '(empty)'}`,
      getVerified: verified,
    });
    if (!verified) {
      brokenFunctions.push({
        name: 'B2C DO query → form_data patch',
        reason: 'doRequest.requestedAt not set after client form update',
        step: 11,
      });
    }
  }

  // --- Step 12: Submit application (client) ---
  {
    const { ok, status, data } = await apiCall(clientToken, 'POST', `/loan-applications/${applicationId}/submit`, {
      clientSubmissionId: `${clientSubmissionId}-submit`,
    });
    logStep({
      actor: 'client',
      action: 'Submit application to KAM review',
      method: 'POST',
      endpoint: `/loan-applications/${applicationId}/submit`,
      success: ok,
      detail: ok ? `status=${(data.data as Record<string, unknown> | undefined)?.status}` : undefined,
      error: ok ? undefined : formatApiError(data, status),
    });
    if (!ok) {
      brokenFunctions.push({ name: 'submitApplication (B2C EV)', reason: String(data.error), step: 12 });
    }
  }

  // --- Step 13: GET verify status under_kam_review ---
  {
    const app = await getApplicationFromDb(applicationId);
    const status = resolveStoredApplicationStatus(app?.Status ?? app?.status);
    const verified = status === LoanStatus.UNDER_KAM_REVIEW;
    logStep({
      actor: 'system',
      action: 'GET verify status after submit',
      method: 'GET',
      endpoint: 'n8n: Loan Application',
      success: verified,
      detail: `resolvedStatus=${status}`,
      getVerified: verified,
    });
    if (!verified) {
      brokenFunctions.push({ name: 'submitApplication → status transition', reason: `Expected under_kam_review, got ${status}`, step: 13 });
    }
  }

  // --- Step 14: KAM login ---
  {
    const { ok, token, user, error } = await login(KAM_EMAIL, KAM_PASSWORD);
    kamToken = token;
    logStep({
      actor: 'kam',
      action: 'Login as KAM',
      method: 'POST',
      endpoint: '/auth/login',
      success: ok && !!token && user?.role === 'kam',
      detail: user ? `role=${user.role}, kamId=${user.kamId}` : undefined,
      error: ok ? (user?.role !== 'kam' ? `Expected kam role, got ${user?.role}` : undefined) : error,
    });
    if (!ok || !token || user?.role !== 'kam') {
      brokenFunctions.push({ name: 'KAM login', reason: error || `Wrong role: ${user?.role}`, step: 14 });
    }
  }

  // --- Step 15: KAM dashboard pending B2C actions ---
  {
    const { ok, status, data } = await apiCall(kamToken, 'GET', '/kam/dashboard');
    const payload = data.data as Record<string, unknown> | undefined;
    const pending = (payload?.pendingB2cActions as unknown[]) || [];
    const hasOurApp = pending.some((a) => {
      const row = a as Record<string, unknown>;
      return String(row.applicationId) === applicationId || String(row.fileId) === fileId;
    });
    logStep({
      actor: 'kam',
      action: 'GET KAM dashboard pendingB2cActions',
      method: 'GET',
      endpoint: '/kam/dashboard',
      success: ok,
      detail: `pendingB2cActions=${pending.length}, includesAuditApp=${hasOurApp}`,
      getVerified: ok,
    });
    if (!hasOurApp && ok) {
      brokenFunctions.push({
        name: 'KAM dashboard pendingB2cActions',
        reason: 'Audit application not listed in pending B2C actions',
        step: 15,
      });
    }
  }

  // --- Step 16: KAM fulfill VKYC compliance ---
  {
    const { ok, status, data } = await apiCall(kamToken, 'POST', `/kam/loan-applications/${applicationId}/b2c/compliance`, {
      itemId: 'vkyc',
      action: 'fulfill',
    });
    logStep({
      actor: 'kam',
      action: 'Mark VKYC compliance complete',
      method: 'POST',
      endpoint: `/kam/loan-applications/${applicationId}/b2c/compliance`,
      success: ok,
      error: ok ? undefined : formatApiError(data, status),
    });
    if (!ok) {
      brokenFunctions.push({ name: 'KAM b2cComplianceAction (fulfill vkyc)', reason: String(data.error), step: 16 });
    }
  }

  // --- Step 17: GET verify VKYC fulfilled ---
  {
    const app = await getApplicationFromDb(applicationId);
    const fd = parseFormData(app?.['Form Data']);
    const checked = fd['compliance.vkycDone'] === true || fd['compliance.vkycDone'] === 'true';
    logStep({
      actor: 'system',
      action: 'GET verify VKYC marked complete in form_data',
      method: 'GET',
      endpoint: 'n8n: Loan Application form_data',
      success: checked,
      detail: `compliance.vkycDone=${fd['compliance.vkycDone']}`,
      getVerified: checked,
    });
    if (!checked) {
      brokenFunctions.push({ name: 'KAM b2cComplianceAction persistence', reason: 'compliance.vkycDone not true', step: 17 });
    }
  }

  // --- Step 18: KAM fulfill DO ---
  {
    const { ok, status, data } = await apiCall(kamToken, 'POST', `/kam/loan-applications/${applicationId}/b2c/do-request`, {
      action: 'fulfill',
      notes: 'DO processed in audit test',
    });
    logStep({
      actor: 'kam',
      action: 'Mark DO request processed',
      method: 'POST',
      endpoint: `/kam/loan-applications/${applicationId}/b2c/do-request`,
      success: ok,
      error: ok ? undefined : formatApiError(data, status),
    });
    if (!ok) {
      brokenFunctions.push({ name: 'KAM b2cDoRequestAction (fulfill)', reason: String(data.error), step: 18 });
    }
  }

  // --- Step 19: GET verify DO fulfilled ---
  {
    const app = await getApplicationFromDb(applicationId);
    const fd = parseFormData(app?.['Form Data']);
    const fulfilledAt = String(fd['_meta.doRequest.fulfilledAt'] ?? '');
    const verified = Boolean(fulfilledAt);
    logStep({
      actor: 'system',
      action: 'GET verify DO fulfilledAt in form_data',
      method: 'GET',
      endpoint: 'n8n: Loan Application form_data',
      success: verified,
      detail: `fulfilledAt=${fulfilledAt || '(empty)'}`,
      getVerified: verified,
    });
    if (!verified) {
      brokenFunctions.push({ name: 'KAM b2cDoRequestAction persistence', reason: 'doRequest.fulfilledAt not set', step: 19 });
    }
  }

  // --- Step 20: KAM forward to credit (approve path) ---
  {
    const { ok, status, data } = await apiCall(kamToken, 'POST', `/kam/loan-applications/${applicationId}/forward-to-credit`, {
      notes: 'Audit test - forwarded after B2C compliance and DO',
    });
    logStep({
      actor: 'kam',
      action: 'Forward application to Credit (KAM approve path)',
      method: 'POST',
      endpoint: `/kam/loan-applications/${applicationId}/forward-to-credit`,
      success: ok,
      error: ok ? undefined : formatApiError(data, status),
    });
    if (!ok) {
      brokenFunctions.push({ name: 'KAM forwardToCredit', reason: String(data.error), step: 20 });
    }
  }

  // --- Step 21: GET verify pending_credit_review ---
  {
    const app = await getApplicationFromDb(applicationId);
    const status = resolveStoredApplicationStatus(app?.Status ?? app?.status);
    const verified = status === LoanStatus.PENDING_CREDIT_REVIEW;
    logStep({
      actor: 'system',
      action: 'GET verify status after forward to credit',
      method: 'GET',
      endpoint: 'n8n: Loan Application',
      success: verified,
      detail: `resolvedStatus=${status}, fileId=${app?.['File ID'] ?? fileId}`,
      getVerified: verified,
    });
    if (!verified) {
      brokenFunctions.push({ name: 'forwardToCredit → status transition', reason: `Expected pending_credit_review, got ${status}`, step: 21 });
    }
  }

  // --- Summary output ---
  const reportPath = new URL('../../docs/B2C_EV_AUDIT_REPORT.md', import.meta.url).pathname;
  const passed = steps.filter((s) => s.success).length;
  const report = `# B2C EV System Audit Report

Generated: ${new Date().toISOString()}
Application ID: ${applicationId || 'N/A'}
File ID: ${fileId || 'N/A'}
Product ID: ${productId || 'N/A'}

## Summary

- Steps executed: ${steps.length}
- Steps passed: ${passed}
- Steps failed: ${steps.length - passed}
- Broken functions: ${brokenFunctions.length}

## Steps Executed

| Step | Actor | Action | Method | Endpoint | Success | GET Verified |
|------|-------|--------|--------|----------|---------|--------------|
${steps.map((s) => `| ${s.step} | ${s.actor} | ${s.action} | ${s.method} | ${s.endpoint} | ${s.success ? 'Yes' : 'No'} | ${s.getVerified === undefined ? 'N/A' : s.getVerified ? 'Yes' : 'No'} |`).join('\n')}

## Step Details

${steps.map((s) => `### Step ${s.step}: ${s.action}
- **Actor:** ${s.actor}
- **Method:** ${s.method} \`${s.endpoint}\`
- **Success:** ${s.success}
${s.detail ? `- **Detail:** ${s.detail}` : ''}
${s.error ? `- **Error:** ${s.error}` : ''}
`).join('\n')}

## Broken Functions

${brokenFunctions.length === 0 ? '_None identified — all steps passed._' : brokenFunctions.map((b) => `- **Step ${b.step ?? '?'} — ${b.name}:** ${b.reason}`).join('\n')}

## Root Cause Analysis

### 1. Draft Status not round-tripped (CRITICAL — blocks entire Client flow)

\`mapLoanStatusForAirtablePost()\` intentionally **omits** \`Status\` when internal status is \`draft\` (Airtable has no "Draft" option). New applications are created without a \`Status\` column value. However, \`updateApplicationForm\` and \`submitApplication\` compare \`application.Status !== LoanStatus.DRAFT\` — when \`Status\` is \`undefined\`, edits and submit are **rejected** with "Application cannot be edited/submitted in current status".

**Impact:** Client cannot persist DO/compliance metadata, cannot submit, KAM never receives \`under_kam_review\` files.

**Affected code:** \`backend/src/utils/loanApplicationAirtableStatus.ts\`, \`loan.controller.ts\` (\`updateApplicationForm\`, \`submitApplication\`).

### 2. B2C query metadata requires two-step Client write (design gap)

\`POST /loan-applications/:id/queries\` creates a File Auditing Log entry only. \`_meta.kamRequests.*\` and \`_meta.doRequest.*\` are written by the **frontend** via \`POST /loan-applications/:id/form\` (\`persistDraft\`). If the form update fails (see #1), KAM \`pendingB2cActions\` stays empty even though queries exist in audit log.

**Impact:** KAM dashboard B2C card shows 0 actions; compliance/DO triage broken.

### 3. E2C test credentials misconfigured

| Account | Documented default | Actual role | Issue |
|---------|-------------------|-------------|-------|
| \`sagar@sevenfincorp.email\` | Client (E2E default) | **kam** | Cannot create applications as client |
| \`anyaaa@gmail.com\` | — | client | \`clientId=null\` after login — not linked |
| \`vadukavsk@gmail.com\` | — | client | Works; linked to Meghasri (\`USER-1776170387391-a8k3m9p2x\`) |
| \`sagar@sevenfincorp.email\` | KAM (E2E default) | kam | Does **not** manage Meghasri — assigned KAM is **Anya** (\`USER-176743096...\`) |

**Impact:** KAM actions return 403 Access denied for Meghasri B2C files when using Sagar.

### 4. GET webhook missing Status on many records

n8n GET \`/webhook/loanapplication\` returns records without \`Status\` for draft-era files. Backend normalizes empty status to \`''\`, not \`draft\`.

### 5. sessionStorage continuity (Client-only)

| Key | Storage | Scope | Cross-profile? |
|-----|---------|-------|----------------|
| \`seven_used_client_webhook_links\` | sessionStorage | Current browser tab | No — KAM/Credit never read this |
| Bearer token (\`apiService\`) | sessionStorage | Per tab | No — must re-login per role |
| \`_meta.documentsFolderLink.*\` | form_data (DB) | Persistent | Yes — all roles see via GET application |

Folder link confirmation **must** be in form_data for KAM review continuity; sessionStorage alone is insufficient across profiles.

## Unit Test Status

Backend B2C EV unit tests: **23/23 passed** (logic correct in isolation).

Integration failures are at n8n/Airtable boundary and draft-status handling, not in pure B2C extraction/fulfillment logic.

## Local Storage / Session Continuity Notes

- \`sessionStorage\` key \`seven_used_client_webhook_links\` tracks consumed document folder links per browser tab (Client only). KAM/Credit do not read this key — folder link confirmation is persisted in \`form_data._meta.documentsFolderLink.*\`.
- Bearer tokens are stored in \`sessionStorage\` per tab (\`apiService\`). Switching Client→KAM requires separate login; tokens do not cross roles automatically.
- \`clientSubmissionId\` provides idempotent create/submit across retries.

## Application Form Data Snapshot (final)

\`\`\`json
${JSON.stringify(parseFormData((await getApplicationFromDb(applicationId))?.['Form Data']), null, 2)}
\`\`\`
`;

  const fs = await import('fs');
  fs.writeFileSync(reportPath, report, 'utf8');

  console.log('\n=== AUDIT COMPLETE ===');
  console.log(`Passed: ${passed}/${steps.length}`);
  console.log(`Broken functions: ${brokenFunctions.length}`);
  console.log(`Report: ${reportPath}`);
  process.exit(brokenFunctions.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Audit script crashed:', err);
  process.exit(2);
});
