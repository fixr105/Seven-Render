/**
 * Adversarial tests for matchIds.
 * Locks in exact + case-insensitive only (no contains/substring) to prevent
 * KAM1/KAM10, rec123/rec1234 false positives.
 */

import { describe, it, expect } from '@jest/globals';
import { matchIds } from '../idMatcher.js';

describe('matchIds', () => {
  describe('must NOT match (adversarial: prefix/suffix, no contains)', () => {
    it('KAM1 vs KAM10 → false', () => {
      expect(matchIds('KAM1', 'KAM10')).toBe(false);
      expect(matchIds('KAM10', 'KAM1')).toBe(false);
    });

    it('rec123 vs rec1234 → false', () => {
      expect(matchIds('rec123', 'rec1234')).toBe(false);
      expect(matchIds('rec1234', 'rec123')).toBe(false);
    });
  });

  describe('must match (exact and case-insensitive)', () => {
    it('KAM001 vs KAM001 → true', () => {
      expect(matchIds('KAM001', 'KAM001')).toBe(true);
    });

    it('recX vs recX → true', () => {
      expect(matchIds('recX', 'recX')).toBe(true);
    });

    it('KAM1 vs kam1 → true (case-insensitive)', () => {
      expect(matchIds('KAM1', 'kam1')).toBe(true);
      expect(matchIds('kam1', 'KAM1')).toBe(true);
    });
  });

  describe('falsy and empty', () => {
    it('null or empty string → false', () => {
      expect(matchIds(null, 'x')).toBe(false);
      expect(matchIds('x', null)).toBe(false);
      expect(matchIds(undefined, 'x')).toBe(false);
      expect(matchIds('x', undefined)).toBe(false);
      expect(matchIds('', 'x')).toBe(false);
      expect(matchIds('x', '')).toBe(false);
    });
  });

  describe('array (Airtable linked records)', () => {
    it('array containing match → true', () => {
      expect(matchIds(['recA', 'recB'], 'recA')).toBe(true);
      expect(matchIds('recA', ['recA', 'recB'])).toBe(true);
    });

    it('array with no match → false', () => {
      expect(matchIds(['recA'], 'recX')).toBe(false);
      expect(matchIds('recX', ['recA'])).toBe(false);
    });
  });
});
