/**
 * Unit tests for normalizeStatus and status utilities
 */

import { describe, it, expect } from 'vitest';
import { normalizeStatus } from '../statusUtils';

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
