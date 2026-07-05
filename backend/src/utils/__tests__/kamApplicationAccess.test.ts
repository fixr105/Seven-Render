/**
 * Unit tests for KAM application access helpers
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { UserRole, LoanStatus } from '../../config/constants.js';
import type { AuthUser } from '../../types/auth.js';
import {
  assertKAMCanMutateApplication,
  assertValidStatusTransition,
  KamAccessError,
} from '../kamApplicationAccess.js';

const mockFilterLoanApplications = jest.fn(
  async (_applications: unknown[], _user: unknown) => [] as unknown[]
);

jest.mock('../../services/rbac/rbacFilter.service.js', () => ({
  rbacFilterService: {
    filterLoanApplications: (applications: unknown[], user: unknown) =>
      mockFilterLoanApplications(applications, user),
  },
}));

describe('kamApplicationAccess', () => {
  const kamUser: AuthUser = {
    id: 'u1',
    email: 'kam@test.com',
    role: UserRole.KAM,
    kamId: 'KAM001',
  };

  const application = {
    id: 'rec1',
    'File ID': 'SF001',
    Client: 'CLIENT001',
    Status: LoanStatus.UNDER_KAM_REVIEW,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('assertKAMCanMutateApplication', () => {
    it('passes when RBAC filter includes application', async () => {
      mockFilterLoanApplications.mockResolvedValue([application]);
      await expect(assertKAMCanMutateApplication(kamUser, application)).resolves.toBeUndefined();
    });

    it('throws KamAccessError when RBAC filter excludes application', async () => {
      mockFilterLoanApplications.mockResolvedValue([]);
      await expect(assertKAMCanMutateApplication(kamUser, application)).rejects.toThrow(KamAccessError);
    });
  });

  describe('assertValidStatusTransition', () => {
    it('allows KAM under_kam_review → query_with_client', () => {
      const result = assertValidStatusTransition(
        LoanStatus.UNDER_KAM_REVIEW,
        LoanStatus.QUERY_WITH_CLIENT,
        UserRole.KAM
      );
      expect(result.to).toBe(LoanStatus.QUERY_WITH_CLIENT);
    });

    it('allows KAM query_with_client → pending_credit_review', () => {
      const result = assertValidStatusTransition(
        LoanStatus.QUERY_WITH_CLIENT,
        LoanStatus.PENDING_CREDIT_REVIEW,
        UserRole.KAM
      );
      expect(result.to).toBe(LoanStatus.PENDING_CREDIT_REVIEW);
    });

    it('rejects KAM under_kam_review → approved', () => {
      expect(() =>
        assertValidStatusTransition(LoanStatus.UNDER_KAM_REVIEW, LoanStatus.APPROVED, UserRole.KAM)
      ).toThrow(KamAccessError);
    });
  });
});
