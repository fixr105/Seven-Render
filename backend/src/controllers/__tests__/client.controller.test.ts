import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { ClientController } from '../client.controller.js';
import { n8nClient } from '../../services/airtable/n8nClient.js';

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
  },
}));
const mockN8nClientInstance = n8nClient as any;

describe('ClientController.getConfiguredProducts', () => {
  let controller: ClientController;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    controller = new ClientController();
    jest.clearAllMocks();
    mockResponse = {} as any;
    mockResponse.status = jest.fn().mockReturnValue(mockResponse);
    mockResponse.json = jest.fn().mockReturnValue(mockResponse);
  });

  it('returns only product IDs from Clients.products', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      } as any,
    };
    (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue([
      {
        id: 'recClient',
        'Client ID': 'CL001',
        products: 'LP001 LP002',
      },
    ] as never);

    await controller.getConfiguredProducts(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: ['LP001', 'LP002'],
    });
  });

  it('returns error asking KAM allocation when products is empty', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      } as any,
    };
    (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue([
      {
        id: 'recClient',
        'Client ID': 'CL001',
        products: '',
      },
    ] as never);

    await controller.getConfiguredProducts(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'No loan products are assigned to your account. Please contact your KAM to allocate products.',
    });
  });

  it('does not use fallback product sources when products is empty', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      } as any,
    };
    (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue([
      {
        id: 'recClient',
        'Client ID': 'CL001',
        products: '',
      },
    ] as never);

    await controller.getConfiguredProducts(mockRequest as Request, mockResponse as Response);

    expect(mockN8nClientInstance.fetchTable).toHaveBeenCalledTimes(1);
    expect(mockN8nClientInstance.fetchTable).toHaveBeenCalledWith('Clients');
  });

  it('rejects getFormConfig when client requests unassigned product', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      } as any,
      query: {
        productId: 'LP999',
      },
    };

    (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue([
      {
        id: 'recClient',
        'Client ID': 'CL001',
        products: 'LP010 LP012',
      },
    ] as never);

    await controller.getFormConfig(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'This product is not assigned to your account. Please contact your KAM to allocate products.',
    });
  });
});

describe('ClientController.getVehicles', () => {
  let controller: ClientController;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    controller = new ClientController();
    jest.clearAllMocks();
    mockResponse = {} as any;
    mockResponse.status = jest.fn().mockReturnValue(mockResponse);
    mockResponse.json = jest.fn().mockReturnValue(mockResponse);
  });

  it('returns only product/client-entitled vehicles', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      } as any,
      query: { productId: 'LP001' },
    };
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Clients') {
        return [
          {
            id: 'recClient',
            'Client ID': 'CL001',
            'Assigned Products': 'LP001,LP002',
            'Contact Email/Phone': 'client@example.com',
          },
        ];
      }
      if (tableName === 'Vehicles') {
        return [
          {
            id: 'veh-1',
            'Vehicle ID': 'VEH001',
            Make: 'Tata',
            Model: 'Ace Gold',
            'Requested Loan Amount': '550000',
            'Product ID': 'LP001',
            'Allowed Clients': 'CL001',
          },
          {
            id: 'veh-2',
            'Vehicle ID': 'VEH002',
            Make: 'Mahindra',
            Model: 'Jeeto',
            'Requested Loan Amount': '400000',
            'Product ID': 'LP001',
            'Allowed Clients': 'CL999',
          },
        ];
      }
      return [];
    });

    await controller.getVehicles(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: [
        {
          vehicleId: 'VEH001',
          make: 'Tata',
          model: 'Ace Gold',
          requestedLoanAmount: '550000',
        },
      ],
    });
  });

  it('rejects when productId is missing', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      } as any,
      query: {},
    };

    await controller.getVehicles(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'productId is required',
    });
  });
});
