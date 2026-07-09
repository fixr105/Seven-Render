import { describe, it, expect } from 'vitest';
import {
  buildComplianceKamRequestMessage,
  COMPLIANCE_ITEMS,
  isComplianceChecked,
  isComplianceItemRequested,
  areAllComplianceItemsApproved,
  validateComplianceForSubmit,
} from '../b2cEvCompliance';

describe('b2cEvCompliance', () => {
  it('validates all compliance items for submit', () => {
    const errors = validateComplianceForSubmit({});
    expect(Object.keys(errors)).toHaveLength(COMPLIANCE_ITEMS.length);
  });

  it('passes when all compliance checkboxes are checked', () => {
    const formData = {
      'compliance.vkycDone': true,
      'compliance.loanAgreementSigned': 'true',
      'compliance.enachDone': true,
    };
    expect(validateComplianceForSubmit(formData)).toEqual({});
    for (const item of COMPLIANCE_ITEMS) {
      expect(isComplianceChecked(formData, item.checkboxKey)).toBe(true);
    }
  });

  it('tracks KAM request timestamps', () => {
    const formData = {
      '_meta.kamRequests.vkyc.requestedAt': '2026-01-01T00:00:00.000Z',
    };
    expect(isComplianceItemRequested(formData, 'vkyc')).toBe(true);
    expect(isComplianceItemRequested(formData, 'enach')).toBe(false);
  });

  it('requires all three compliance items to be approved for DO gating', () => {
    expect(areAllComplianceItemsApproved({})).toBe(false);
    expect(
      areAllComplianceItemsApproved({
        'compliance.vkycDone': true,
        'compliance.loanAgreementSigned': 'true',
        'compliance.enachDone': true,
      })
    ).toBe(true);
  });

  it('builds structured KAM request messages', () => {
    const message = buildComplianceKamRequestMessage(COMPLIANCE_ITEMS[0], {
      applicantName: 'Rahul Sharma',
      applicationId: 'APP123',
    });
    expect(message).toContain('VKYC');
    expect(message).toContain('Rahul Sharma');
    expect(message).toContain('APP123');
  });
});
