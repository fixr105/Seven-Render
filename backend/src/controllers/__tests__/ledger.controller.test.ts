/**
 * P0 Tests: Commission Ledger Listing and Payout Request/Approval
 * Tests M1-BE-001, M1-BE-002, M1-BE-003
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { LedgerController } from '../ledger.controller.js';
import { CreditController } from '../credit.controller.js';
import { UserRole } from '../../config/constants.js';
import { AuthUser } from '../../types/auth.js';
import { createMockN8nClient, mockCommissionLedger, mockClients } from '../../__tests__/helpers/mockN8nClient.js';
import * as n8nClientModule from '../../services/airtable/n8nClient.js';

// Mock the n8nClient module
const mockN8nClientInstance = createMockN8nClient();
jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: mockN8nClientInstance,
}));

// Mock notification service
jest.mock('../../services/notifications/notification.service.js', () => ({
  notificationService: {
    notifyQueryCreated: jest.fn().mockResolvedValue(undefined),
    notifyPayoutApproved: jest.fn().mockResolvedValue(undefined),
    notifyPayoutRejected: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('LedgerController - P0 Tests', () => {
  let ledgerController: LedgerController;
  let creditController: CreditController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    ledgerController = new LedgerController();
    creditController = new CreditController();
    mockN8nClientInstance.clearPostedData();
    jest.clearAllMocks();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('M1-BE-001: CLIENT View Commission Ledger', () => {
    it('should return ledger entries with running balance for CLIENT', async () => {
      const clientUser: AuthUser = {
        id: 'user-1',
        email: 'Sagar@gmail.com',
        role: UserRole.CLIENT,
        clientId: 'CLIENT001',
      };

      mockRequest = {
        user: clientUser,
      };

      (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue(mockCommissionLedger);

      await ledgerController.getClientLedger(mockRequest as Request, mockResponse as Response);

      expect(mockN8nClientInstance.fetchTable).toHaveBeenCalledWith('Commission Ledger');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.success).toBe(true);
      expect(responseCall.data.entries).toBeDefined();
      expect(responseCall.data.currentBalance).toBeDefined();
      
      // Verify only CLIENT001 entries
      const entries = responseCall.data.entries;
      entries.forEach((entry: any) => {
        expect(entry.Client).toBe('CLIENT001');
      });
      
      // Verify balance calculation (7500 + 15000 = 22500)
      expect(responseCall.data.currentBalance).toBe(22500);
    });

    it('should return 403 for non-CLIENT role', async () => {
      const kamUser: AuthUser = {
        id: 'user-2',
        email: 'Sagar@gmail.com',
        role: UserRole.KAM,
        kamId: 'KAM001',
      };

      mockRequest = {
        user: kamUser,
      };

      await ledgerController.getClientLedger(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('M1-BE-002: CREDIT View Commission Ledger with Filters', () => {
    it('should return all entries for CREDIT without filters', async () => {
      const creditUser: AuthUser = {
        id: 'user-3',
        email: 'Sagar@gmail.com',
        role: UserRole.CREDIT,
      };

      mockRequest = {
        user: creditUser,
        query: {},
      };

      (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue(mockCommissionLedger);

      await ledgerController.getCreditLedger(mockRequest as Request, mockResponse as Response);

      expect(mockN8nClientInstance.fetchTable).toHaveBeenCalledWith('Commission Ledger');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.success).toBe(true);
      expect(responseCall.data.entries).toBeDefined();
      
      // CREDIT should see all entries
      const entries = responseCall.data.entries;
      expect(entries.length).toBeGreaterThan(0);
    });

    it('should filter by clientId when provided', async () => {
      const creditUser: AuthUser = {
        id: 'user-3',
        email: 'Sagar@gmail.com',
        role: UserRole.CREDIT,
      };

      mockRequest = {
        user: creditUser,
        query: { clientId: 'CLIENT001' },
      };

      await ledgerController.getCreditLedger(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      
      // Should only return CLIENT001 entries
      const entries = responseCall.data.entries;
      entries.forEach((entry: any) => {
        expect(entry.Client).toBe('CLIENT001');
      });
    });

    it('should filter by dateFrom and dateTo when provided', async () => {
      const creditUser: AuthUser = {
        id: 'user-3',
        email: 'Sagar@gmail.com',
        role: UserRole.CREDIT,
      };

      mockRequest = {
        user: creditUser,
        query: { dateFrom: '2025-01-02', dateTo: '2025-01-03' },
      };

      (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue(mockCommissionLedger);

      await ledgerController.getCreditLedger(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.success).toBe(true);
      expect(responseCall.data.entries).toBeDefined();
    });
  });

  describe('M1-BE-003: CLIENT Request Payout', () => {
    it('should create payout request with valid amount', async () => {
      const clientUser: AuthUser = {
        id: 'user-1',
        email: 'Sagar@gmail.com',
        role: UserRole.CLIENT,
        clientId: 'CLIENT001',
      };

      // Mock ledger with positive balance
      (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue(
        mockCommissionLedger.filter((entry: any) => entry.Client === 'CLIENT001')
      );

      mockRequest = {
        user: clientUser,
        body: {
          amount: 10000,
        },
      };

      await ledgerController.createPayoutRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.success).toBe(true);
      
      // Verify payout entry was created
      expect(mockN8nClientInstance.postCommissionLedger).toHaveBeenCalled();
      const postedData = mockN8nClientInstance.getPostedData('Commission Ledger');
      expect(postedData.length).toBeGreaterThan(0);
      expect(postedData[0]['Payout Request']).toBe('Requested');
    });

    it('should reject payout request when amount exceeds balance', async () => {
      const clientUser: AuthUser = {
        id: 'user-1',
        email: 'Sagar@gmail.com',
        role: UserRole.CLIENT,
        clientId: 'CLIENT001',
      };

      (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue(
        mockCommissionLedger.filter((entry: any) => entry.Client === 'CLIENT001')
      );

      mockRequest = {
        user: clientUser,
        body: {
          amount: 100000, // Exceeds balance of 22500
        },
      };

      await ledgerController.createPayoutRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.success).toBe(false);
      expect(responseCall.error).toContain('balance');
    });

    it('should create full payout request with full: true flag', async () => {
      const clientUser: AuthUser = {
        id: 'user-1',
        email: 'Sagar@gmail.com',
        role: UserRole.CLIENT,
        clientId: 'CLIENT001',
      };

      (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue(
        mockCommissionLedger.filter((entry: any) => entry.Client === 'CLIENT001')
      );

      mockRequest = {
        user: clientUser,
        body: {
          full: true,
        },
      };

      await ledgerController.createPayoutRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      const postedData = mockN8nClientInstance.getPostedData('Commission Ledger');
      expect(postedData[0]['Payout Amount']).toBe('22500'); // Full balance
    });
  });

  describe('M1-BE-003: CREDIT Approve/Reject Payout', () => {
    it('should approve payout request and create negative entry', async () => {
      const creditUser: AuthUser = {
        id: 'user-3',
        email: 'Sagar@gmail.com',
        role: UserRole.CREDIT,
      };

      // Mock ledger with payout request
      const payoutEntry = {
        ...mockCommissionLedger[1], // Entry with Payout Request = 'Requested'
        id: 'ledger2',
      };

      mockRequest = {
        user: creditUser,
        params: { id: 'ledger2' },
        body: {
          approvedAmount: 15000,
          note: 'Payout approved',
        },
      };

      // Mock Clients table for notification
      (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
        if (tableName === 'Commission Ledger') {
          return [payoutEntry];
        }
        if (tableName === 'Clients') {
          return mockClients;
        }
        return [];
      });

      await creditController.approvePayout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      
      // Verify original entry updated to 'Paid'
      const postedData = mockN8nClientInstance.getPostedData('Commission Ledger');
      const paidEntry = postedData.find((entry: any) => entry.id === 'ledger2');
      expect(paidEntry['Payout Request']).toBe('Paid');
      
      // Verify negative entry created
      const negativeEntry = postedData.find((entry: any) => 
        parseFloat(entry['Payout Amount'] || '0') < 0
      );
      expect(negativeEntry).toBeDefined();
    });

    it('should reject payout request', async () => {
      const creditUser: AuthUser = {
        id: 'user-3',
        email: 'Sagar@gmail.com',
        role: UserRole.CREDIT,
      };

      const payoutEntry = {
        ...mockCommissionLedger[1],
        id: 'ledger2',
      };

      (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
        if (tableName === 'Commission Ledger') {
          return [payoutEntry];
        }
        if (tableName === 'Clients') {
          return mockClients;
        }
        return [];
      });

      mockRequest = {
        user: creditUser,
        params: { id: 'ledger2' },
        body: {
          reason: 'Insufficient documentation',
        },
      };

      await creditController.rejectPayout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      
      const postedData = mockN8nClientInstance.getPostedData('Commission Ledger');
      const rejectedEntry = postedData.find((entry: any) => entry.id === 'ledger2');
      expect(rejectedEntry['Payout Request']).toBe('Rejected');
    });
  });
});

