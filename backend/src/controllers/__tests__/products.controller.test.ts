import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { ProductsController } from '../products.controller.js';
import { n8nClient } from '../../services/airtable/n8nClient.js';

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
  },
}));

const mockN8nClientInstance = n8nClient as any;

describe('ProductsController.listLoanProducts entitlement', () => {
  let controller: ProductsController;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    controller = new ProductsController();
    jest.clearAllMocks();
    mockResponse = {} as any;
    mockResponse.status = jest.fn().mockReturnValue(mockResponse);
    mockResponse.json = jest.fn().mockReturnValue(mockResponse);
  });

  it('returns only assigned products for client role', async () => {
    mockRequest = {
      query: { activeOnly: 'true' },
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      },
      url: '/loan-products',
      path: '/loan-products',
      method: 'GET',
    };

    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Loan Products') {
        return [
          { id: 'rec1', 'Product ID': 'LP010', 'Product Name': 'Allowed One', Active: 'True' },
          { id: 'rec2', 'Product ID': 'LP012', 'Product Name': 'Allowed Two', Active: true },
          { id: 'rec3', 'Product ID': 'LP999', 'Product Name': 'Not Allowed', Active: 'True' },
        ];
      }
      if (tableName === 'Clients') {
        return [{ id: 'recClient', 'Client ID': 'CL001', products: 'LP010, LP012' }];
      }
      if (tableName === 'KAM Users') {
        return [];
      }
      return [];
    });

    await controller.listLoanProducts(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.json).toHaveBeenCalled();
    const payload: any = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.map((p: any) => p.productId)).toEqual(['LP010', 'LP012']);
  });

  it('respects Assigned Products field variant for entitlement', async () => {
    mockRequest = {
      query: { activeOnly: 'true' },
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL002',
      },
      url: '/loan-products',
      path: '/loan-products',
      method: 'GET',
    };

    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Loan Products') {
        return [
          { id: 'rec1', 'Product ID': 'LP101', 'Product Name': 'Assigned', Active: 'True' },
          { id: 'rec2', 'Product ID': 'LP202', 'Product Name': 'Not Assigned', Active: 'True' },
        ];
      }
      if (tableName === 'Clients') {
        return [{ id: 'recClient', 'Client ID': 'CL002', 'Assigned Products': 'LP101' }];
      }
      if (tableName === 'KAM Users') {
        return [];
      }
      return [];
    });

    await controller.listLoanProducts(mockRequest as Request, mockResponse as Response);

    const payload: any = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.map((p: any) => p.productId)).toEqual(['LP101']);
  });

  it('prefers Assigned Products over legacy products when both exist', async () => {
    mockRequest = {
      query: { activeOnly: 'true' },
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL003',
      },
      url: '/loan-products',
      path: '/loan-products',
      method: 'GET',
    };

    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Loan Products') {
        return [
          { id: 'rec1', 'Product ID': 'LP111', 'Product Name': 'Assigned', Active: 'True' },
          { id: 'rec2', 'Product ID': 'LP999', 'Product Name': 'Legacy Only', Active: 'True' },
        ];
      }
      if (tableName === 'Clients') {
        return [
          {
            id: 'recClient',
            'Client ID': 'CL003',
            'Assigned Products': 'LP111',
            products: 'LP111,LP999',
          },
        ];
      }
      if (tableName === 'KAM Users') {
        return [];
      }
      return [];
    });

    await controller.listLoanProducts(mockRequest as Request, mockResponse as Response);

    const payload: any = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.map((p: any) => p.productId)).toEqual(['LP111']);
  });

  it('parses Applicable Statuses JSON from Loan Products', async () => {
    mockRequest = {
      query: {},
      user: { role: 'admin', email: 'admin@example.com' },
      url: '/loan-products',
      path: '/loan-products',
      method: 'GET',
    };

    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Loan Products') {
        return [
          {
            id: 'rec1',
            'Product ID': 'LP010',
            'Product Name': 'Working Capital',
            Active: 'True',
            'Applicable Statuses': JSON.stringify([
              { key: 'under_kam_review', label: 'Submitted', order: 10 },
              { key: 'pending_credit_review', label: 'Ready for Credit', order: 20 },
            ]),
          },
        ];
      }
      if (tableName === 'Clients' || tableName === 'KAM Users') return [];
      return [];
    });

    await controller.listLoanProducts(mockRequest as Request, mockResponse as Response);

    const payload: any = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data[0].applicableStatuses).toEqual([
      { key: 'under_kam_review', label: 'Submitted', order: 10 },
      { key: 'pending_credit_review', label: 'Ready for Credit', order: 20 },
    ]);
  });

  it('falls back to canonical statuses when Applicable Statuses is invalid JSON', async () => {
    mockRequest = {
      query: {},
      user: { role: 'admin', email: 'admin@example.com' },
      url: '/loan-products',
      path: '/loan-products',
      method: 'GET',
    };

    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Loan Products') {
        return [
          {
            id: 'rec1',
            'Product ID': 'LP010',
            'Product Name': 'Working Capital',
            Active: 'True',
            'Applicable Statuses': 'not-json',
          },
        ];
      }
      if (tableName === 'Clients' || tableName === 'KAM Users') return [];
      return [];
    });

    await controller.listLoanProducts(mockRequest as Request, mockResponse as Response);

    const payload: any = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.data[0].applicableStatuses)).toBe(true);
    expect(payload.data[0].applicableStatuses.length).toBeGreaterThan(0);
    expect(payload.data[0].applicableStatuses.some((s: any) => s.key === 'under_kam_review')).toBe(true);
  });
});

