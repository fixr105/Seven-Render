/**
 * Tests for transformApplicationFromApi (API → UI client and weird-but-valid shapes).
 * Locks in that app.client as string, object, or null/undefined is handled. See docs/ID_AND_RBAC_CONTRACT.md.
 */

import { describe, it, expect } from 'vitest';
import { transformApplicationFromApi } from '../useApplications';

function minimalApp(overrides: Record<string, unknown> = {}) {
  return { id: 'rec1', ...overrides };
}

describe('transformApplicationFromApi', () => {
  describe('client: string', () => {
    it('client: "Acme" → client: { company_name: "Acme" }', () => {
      const got = transformApplicationFromApi(minimalApp({ client: 'Acme' }));
      expect(got.client).toEqual({ company_name: 'Acme' });
    });
  });

  describe('client: object', () => {
    it('client: { name: "Acme" } → client: { company_name: "Acme" }', () => {
      const got = transformApplicationFromApi(minimalApp({ client: { name: 'Acme' } }));
      expect(got.client).toEqual({ company_name: 'Acme' });
    });

    it('client: { "Client Name": "Acme" } → client: { company_name: "Acme" }', () => {
      const got = transformApplicationFromApi(minimalApp({ client: { 'Client Name': 'Acme' } }));
      expect(got.client).toEqual({ company_name: 'Acme' });
    });
  });

  describe('client: null or undefined', () => {
    it('client: undefined → client: undefined', () => {
      const got = transformApplicationFromApi(minimalApp({ client: undefined }));
      expect(got.client).toBeUndefined();
    });

    it('client: null → client: undefined', () => {
      const got = transformApplicationFromApi(minimalApp({ client: null }));
      expect(got.client).toBeUndefined();
    });
  });

  describe('loan_product from product/productId (backend listApplications shape)', () => {
    it('product and productId present, loanProduct absent → loan_product: { name, code }', () => {
      const got = transformApplicationFromApi(minimalApp({ product: 'Home Loan', productId: 'prod1' }));
      expect(got.loan_product).toEqual({ name: 'Home Loan', code: 'prod1' });
    });
  });

  describe('amounts: preserve 0, null for NaN/missing', () => {
    it('requestedAmount: 0 → requested_loan_amount: 0', () => {
      const got = transformApplicationFromApi(minimalApp({ requestedAmount: 0 }));
      expect(got.requested_loan_amount).toBe(0);
    });

    it('approvedAmount: 0 → approved_loan_amount: 0', () => {
      const got = transformApplicationFromApi(minimalApp({ approvedAmount: 0 }));
      expect(got.approved_loan_amount).toBe(0);
    });
  });
});
