/**
 * Unit tests for normalizeStatus and status utilities (display names and badge colors).
 */

import { describe, it, expect } from 'vitest';
import { normalizeStatus, getStatusDisplayName, getStatusColor } from '../statusUtils';

describe('normalizeStatus', () => {
  describe('alias mapping', () => {
    it('maps forwarded_to_credit → pending_credit_review', () => {
      expect(normalizeStatus('forwarded_to_credit')).toBe('pending_credit_review');
    });

    it('maps credit_query_raised → credit_query_with_kam', () => {
      expect(normalizeStatus('credit_query_raised')).toBe('credit_query_with_kam');
    });

    it('maps pending_kam_review → under_kam_review', () => {
      expect(normalizeStatus('pending_kam_review')).toBe('under_kam_review');
    });

    it('maps kam_query_raised → query_with_client', () => {
      expect(normalizeStatus('kam_query_raised')).toBe('query_with_client');
    });
  });

  describe('pass-through for canonical values', () => {
    it('passes through draft', () => {
      expect(normalizeStatus('draft')).toBe('draft');
    });

    it('passes through approved', () => {
      expect(normalizeStatus('approved')).toBe('approved');
    });

    it('passes through under_kam_review', () => {
      expect(normalizeStatus('under_kam_review')).toBe('under_kam_review');
    });

    it('passes through pending_credit_review', () => {
      expect(normalizeStatus('pending_credit_review')).toBe('pending_credit_review');
    });

    it('passes through withdrawn', () => {
      expect(normalizeStatus('withdrawn')).toBe('withdrawn');
    });

    it('passes through disbursed', () => {
      expect(normalizeStatus('disbursed')).toBe('disbursed');
    });
  });

  describe('empty/null/whitespace', () => {
    it('returns draft for empty string', () => {
      expect(normalizeStatus('')).toBe('draft');
    });

    it('returns draft for null', () => {
      expect(normalizeStatus(null as unknown as string)).toBe('draft');
    });

    it('returns draft for undefined', () => {
      expect(normalizeStatus(undefined as unknown as string)).toBe('draft');
    });

    it('returns draft for whitespace-only', () => {
      expect(normalizeStatus('   ')).toBe('draft');
    });
  });

  describe('case-insensitive matching', () => {
    it('handles FORWARDED_TO_CREDIT', () => {
      expect(normalizeStatus('FORWARDED_TO_CREDIT')).toBe('pending_credit_review');
    });

    it('handles Draft', () => {
      expect(normalizeStatus('Draft')).toBe('draft');
    });

    it('handles PENDING_KAM_REVIEW', () => {
      expect(normalizeStatus('PENDING_KAM_REVIEW')).toBe('under_kam_review');
    });
  });
});

describe('getStatusDisplayName', () => {
  it('returns display name for draft', () => {
    expect(getStatusDisplayName('draft')).toBe('Draft');
  });
  it('returns display name for under_kam_review', () => {
    expect(getStatusDisplayName('under_kam_review')).toBe('Under KAM Review');
  });
  it('returns display name for approved', () => {
    expect(getStatusDisplayName('approved')).toBe('Approved');
  });
  it('returns display name for rejected', () => {
    expect(getStatusDisplayName('rejected')).toBe('Rejected');
  });
  it('returns display name for disbursed', () => {
    expect(getStatusDisplayName('disbursed')).toBe('Disbursed');
  });
  it('returns raw status for unknown', () => {
    expect(getStatusDisplayName('unknown_status')).toBe('unknown_status');
  });
});

describe('getStatusColor', () => {
  it('returns neutral for draft', () => {
    expect(getStatusColor('draft')).toBe('neutral');
  });
  it('returns success for approved and disbursed', () => {
    expect(getStatusColor('approved')).toBe('success');
    expect(getStatusColor('disbursed')).toBe('success');
  });
  it('returns error for rejected', () => {
    expect(getStatusColor('rejected')).toBe('error');
  });
  it('returns warning for query_with_client and credit_query_with_kam', () => {
    expect(getStatusColor('query_with_client')).toBe('warning');
    expect(getStatusColor('credit_query_with_kam')).toBe('warning');
  });
  it('returns info for under_kam_review and pending_credit_review', () => {
    expect(getStatusColor('under_kam_review')).toBe('info');
    expect(getStatusColor('pending_credit_review')).toBe('info');
  });
  it('returns neutral for unknown', () => {
    expect(getStatusColor('unknown')).toBe('neutral');
  });
});
