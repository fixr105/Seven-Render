import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { ClientController } from '../client.controller.js';
import { n8nClient } from '../../services/airtable/n8nClient.js';

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
    getUserAccounts: jest.fn(async () => []),
  },
}));
const mockN8nClientInstance = n8nClient as any;

describe('ClientController.getLinkPool', () => {
  let controller: ClientController;
  let mockResponse: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    controller = new ClientController();
    jest.clearAllMocks();
    mockResponse = {} as any;
    mockResponse.status = jest.fn().mockReturnValue(mockResponse);
    mockResponse.json = jest.fn().mockReturnValue(mockResponse);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns link pool rows with status metadata', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify([
          { Links: 'https://drive.google.com/drive/folders/used-1', Status: 'YES' },
          { Links: 'https://drive.google.com/drive/folders/available-1', Status: '' },
        ]),
    } as unknown as globalThis.Response)) as unknown as typeof fetch;

    await controller.getLinkPool({} as Request, mockResponse as Response);

    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: [
        { link: 'https://drive.google.com/drive/folders/used-1', status: 'YES' },
        { link: 'https://drive.google.com/drive/folders/available-1', status: '' },
      ],
    });
  });

  it('polls getLinkPool when webhook initially returns workflow started ack', async () => {
    let fetchCalls = 0;
    global.fetch = jest.fn(async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return {
          ok: true,
          text: async () => JSON.stringify({ message: 'Workflow was started' }),
        } as unknown as globalThis.Response;
      }
      return {
        ok: true,
        text: async () =>
          JSON.stringify([{ Links: 'https://drive.google.com/drive/folders/available-1', Status: '' }]),
      } as unknown as globalThis.Response;
    }) as unknown as typeof fetch;

    await controller.getLinkPool({} as Request, mockResponse as Response);

    expect(fetchCalls).toBeGreaterThan(1);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: [{ link: 'https://drive.google.com/drive/folders/available-1', status: '' }],
    });
  });
});

describe('ClientController.consumeLink', () => {
  let controller: ClientController;
  let mockRequest: any;
  let mockResponse: any;
  const originalFetch = global.fetch;

  beforeEach(() => {
    controller = new ClientController();
    jest.clearAllMocks();
    mockRequest = { body: { link: 'https://drive.google.com/drive/folders/available-1' } };
    mockResponse = {} as any;
    mockResponse.status = jest.fn().mockReturnValue(mockResponse);
    mockResponse.json = jest.fn().mockReturnValue(mockResponse);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts YES status to webhook and returns marked link', async () => {
    global.fetch = jest.fn(async (_url, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        status: 'YES',
        link: 'https://drive.google.com/drive/folders/available-1',
      });
      return {
        ok: true,
        text: async () => JSON.stringify({ success: true }),
      } as unknown as globalThis.Response;
    }) as unknown as typeof fetch;

    await controller.consumeLink(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: {
        link: 'https://drive.google.com/drive/folders/available-1',
        marked: true,
      },
    });
  });

  it('returns 502 when webhook response is not ok', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal error',
    } as unknown as globalThis.Response)) as unknown as typeof fetch;

    await controller.consumeLink(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(502);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal error',
    });
  });

  it('returns 502 when webhook JSON reports success false', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ success: false, error: 'Row not found' }),
    } as unknown as globalThis.Response)) as unknown as typeof fetch;

    await controller.consumeLink(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(502);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Row not found',
    });
  });
});

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

  it('returns CLIENT_NOT_LINKED when client account cannot be resolved', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'unknown@example.com',
        clientId: null,
      } as any,
    };
    (mockN8nClientInstance.fetchTable as jest.Mock).mockResolvedValue([] as never);

    await controller.getConfiguredProducts(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'CLIENT_NOT_LINKED',
      })
    );
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
      code: 'PRODUCT_NOT_ASSIGNED',
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

  it('matches vehicles when Product ID contains multiple product IDs', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      } as any,
      query: { productId: 'LP015' },
    };
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Clients') {
        return [
          {
            id: 'recClient',
            'Client ID': 'CL001',
            'Assigned Products': 'LP014,LP015',
            'Contact Email/Phone': 'client@example.com',
          },
        ];
      }
      if (tableName === 'Vehicles') {
        return [
          {
            id: 'veh-1',
            'Vehicle ID': 'VEH015',
            Make: 'Ashok Leyland',
            Model: 'Dost',
            'Requested Loan Amount': '650000',
            'Product ID': 'LP014, LP015',
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
          vehicleId: 'VEH015',
          make: 'Ashok Leyland',
          model: 'Dost',
          requestedLoanAmount: '650000',
        },
      ],
    });
  });

  it('matches vehicles when Allowed Products is returned as a linked-record array', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      } as any,
      query: { productId: 'LP015' },
    };
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Clients') {
        return [
          {
            id: 'recClient',
            'Client ID': 'CL001',
            'Assigned Products': 'LP014,LP015',
            'Contact Email/Phone': 'client@example.com',
          },
        ];
      }
      if (tableName === 'Vehicles') {
        return [
          {
            id: 'veh-1',
            'Vehicle ID': 'VEH015',
            Make: 'Ashok Leyland',
            Model: 'Dost',
            'Requested Loan Amount': '650000',
            'Allowed Products': ['LP014', 'LP015'],
            'Allowed Clients': ['CL999', 'CL001'],
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
          vehicleId: 'VEH015',
          make: 'Ashok Leyland',
          model: 'Dost',
          requestedLoanAmount: '650000',
        },
      ],
    });
  });

  it('matches vehicle Products names to the selected product ID via Loan Products', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      } as any,
      query: { productId: 'LP015' },
    };
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Clients') {
        return [
          {
            id: 'recClient',
            'Client ID': 'CL001',
            'Assigned Products': 'LP015',
            'Contact Email/Phone': 'client@example.com',
          },
        ];
      }
      if (tableName === 'Loan Products') {
        return [
          {
            id: 'recProduct',
            'Product ID': 'LP015',
            'Product Name': 'B2C EV',
          },
        ];
      }
      if (tableName === 'Vehicles') {
        return [
          {
            id: 'recVehicle',
            'Vehicle ID': 'VH001',
            Make: 'Quantum Energy',
            Model: 'Go',
            'Funding Amount': 58450,
            Products: ['B2C EV', 'B2B EV', 'RBF (EV)', 'Flipkart B2B', 'Flipkart B2C'],
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
          vehicleId: 'VH001',
          make: 'Quantum Energy',
          model: 'Go',
          requestedLoanAmount: '58450',
        },
      ],
    });
  });

  it('returns an empty JSON vehicle list when no mapped vehicles exist', async () => {
    mockRequest = {
      user: {
        role: 'client',
        email: 'client@example.com',
        clientId: 'CL001',
      } as any,
      query: { productId: 'LP015' },
    };
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Clients') {
        return [
          {
            id: 'recClient',
            'Client ID': 'CL001',
            'Assigned Products': 'LP015',
            'Contact Email/Phone': 'client@example.com',
          },
        ];
      }
      if (tableName === 'Vehicles') return [];
      return [];
    });

    await controller.getVehicles(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).not.toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: [],
    });
  });

  it('returns a JSON auth error when the vehicle route is unauthenticated', async () => {
    mockRequest = {
      query: { productId: 'LP015' },
    };

    await controller.getVehicles(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required.',
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
