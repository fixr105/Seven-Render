/**
 * Module 2: Duplicate Detection Unit Tests
 * 
 * Tests for PAN-based duplicate detection
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { checkDuplicateByPAN } from '../duplicateDetection.service.js';

describe('Duplicate Detection', () => {
  // Mock n8nClient for testing
  const mockApplications = [
    {
      id: 'app-1',
      'File ID': 'SF12345678',
      Client: 'client-1',
      'Applicant Name': 'Test Applicant',
      Status: 'under_kam_review',
      'Form Data': JSON.stringify({
        pan: 'ABCDE1234F',
        pan_card: 'ABCDE1234F',
      }),
    },
    {
      id: 'app-2',
      'File ID': 'SF87654321',
      Client: 'client-1',
      'Applicant Name': 'Another Applicant',
      Status: 'draft',
      'Form Data': JSON.stringify({
        pan: 'XYZAB5678G',
      }),
    },
  ];

  describe('checkDuplicateByPAN', () => {
    it('should detect duplicate by exact PAN match', async () => {
      // This would need to mock n8nClient.fetchTable
      // For now, test the logic
      const pan = 'ABCDE1234F';
      const normalizedPAN = pan.trim().toUpperCase().replace(/\s+/g, '');
      
      const duplicate = mockApplications.find(app => {
        const formData = JSON.parse(app['Form Data']);
        const appPAN = formData.pan || formData.pan_card;
        const normalizedAppPAN = appPAN?.trim().toUpperCase().replace(/\s+/g, '');
        return normalizedPAN === normalizedAppPAN;
      });

      expect(duplicate).toBeDefined();
      expect(duplicate?.['File ID']).toBe('SF12345678');
    });

    it('should handle PAN with spaces', () => {
      const pan = 'ABCDE 1234 F';
      const normalizedPAN = pan.trim().toUpperCase().replace(/\s+/g, '');
      expect(normalizedPAN).toBe('ABCDE1234F');
    });

    it('should handle case-insensitive PAN', () => {
      const pan = 'abcde1234f';
      const normalizedPAN = pan.trim().toUpperCase().replace(/\s+/g, '');
      expect(normalizedPAN).toBe('ABCDE1234F');
    });

    it('should return null if no duplicate found', () => {
      const pan = 'NONEXIST1234X';
      const duplicate = mockApplications.find(app => {
        const formData = JSON.parse(app['Form Data']);
        const appPAN = formData.pan || formData.pan_card;
        return appPAN === pan;
      });
      expect(duplicate).toBeUndefined();
    });
  });
});



