import { AuthUser } from '../../types/auth.js';
import { n8nClient } from '../airtable/n8nClient.js';

export const ClientProductEntitlementCode = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  CLIENT_NOT_LINKED: 'CLIENT_NOT_LINKED',
  NO_PRODUCTS_ASSIGNED: 'NO_PRODUCTS_ASSIGNED',
  PRODUCT_NOT_ASSIGNED: 'PRODUCT_NOT_ASSIGNED',
  PRODUCT_ID_REQUIRED: 'PRODUCT_ID_REQUIRED',
} as const;

export type ClientProductEntitlementCodeValue =
  (typeof ClientProductEntitlementCode)[keyof typeof ClientProductEntitlementCode];

export class ClientProductEntitlementError extends Error {
  statusCode: number;
  code: ClientProductEntitlementCodeValue;

  constructor(message: string, statusCode: number, code: ClientProductEntitlementCodeValue) {
    super(message);
    this.name = 'ClientProductEntitlementError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function parseAssignedProducts(raw: unknown): string[] {
  const productsRaw = String(raw ?? '').trim();
  if (!productsRaw) return [];
  return [
    ...new Set(
      productsRaw
        .split(/[,\s]+/)
        .map((p) => p.trim())
        .filter(Boolean)
    ),
  ];
}

function normalizeProductId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function getClientContactField(client: Record<string, unknown>): string {
  return (
    client['Contact Email / Phone'] ||
    client['Contact Email/Phone'] ||
    client.contactEmailPhone ||
    ''
  )
    .toString()
    .toLowerCase();
}

function extractClientId(client: Record<string, unknown>): string | null {
  const resolved = (
    client['Client ID'] ||
    client.clientId ||
    client.id ||
    null
  )
    ?.toString()
    .trim();
  return resolved || null;
}

function matchClientByJwtId(clients: Record<string, unknown>[], jwtClientId: string): Record<string, unknown> | null {
  const normalizedId = jwtClientId.trim();
  if (!normalizedId) return null;
  return (
    clients.find(
      (c) =>
        (c.id && c.id.toString().trim() === normalizedId) ||
        (c['Client ID'] && c['Client ID'].toString().trim() === normalizedId) ||
        (c.clientId && c.clientId.toString().trim() === normalizedId)
    ) ?? null
  );
}

function matchClientByEmail(clients: Record<string, unknown>[], userEmail: string): Record<string, unknown> | null {
  if (!userEmail) return null;
  return (
    clients.find((c) => {
      const contact = getClientContactField(c);
      return contact && contact.includes(userEmail);
    }) ?? null
  );
}

function matchClientByAssociatedProfile(
  clients: Record<string, unknown>[],
  associatedProfile: string
): Record<string, unknown> | null {
  const normalizedProfile = associatedProfile.trim().toLowerCase();
  if (!normalizedProfile) return null;
  return (
    clients.find((c) => {
      const clientName = (c['Client Name'] || c.clientName || '').toString().trim().toLowerCase();
      return clientName === normalizedProfile;
    }) ?? null
  );
}

async function getAssociatedProfileForUser(user: AuthUser): Promise<string> {
  try {
    const accounts = await n8nClient.getUserAccounts(10000);
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    const account =
      accounts.find((row) => row.id?.toString().trim() === user.id.trim()) ??
      accounts.find(
        (row) => (row.Username || '').trim().toLowerCase() === normalizedEmail
      );
    return (account?.['Associated Profile'] || '').toString().trim();
  } catch {
    return '';
  }
}

export function entitlementErrorBody(error: ClientProductEntitlementError): {
  success: false;
  error: string;
  code: ClientProductEntitlementCodeValue;
} {
  return {
    success: false,
    error: error.message,
    code: error.code,
  };
}

export async function resolveClientRecord(user: AuthUser): Promise<{
  clientId: string;
  clientRecord: Record<string, unknown>;
}> {
  if (!user || user.role !== 'client') {
    throw new ClientProductEntitlementError(
      'Authentication required.',
      401,
      ClientProductEntitlementCode.AUTH_REQUIRED
    );
  }

  const clients = (await n8nClient.fetchTable('Clients')) as Record<string, unknown>[];
  const userEmail = (user.email || '').trim().toLowerCase();
  const jwtClientId = user.clientId ? user.clientId.toString().trim() : '';

  let matchingClient: Record<string, unknown> | null = null;

  if (jwtClientId) {
    matchingClient = matchClientByJwtId(clients, jwtClientId);
  }

  if (!matchingClient && userEmail) {
    matchingClient = matchClientByEmail(clients, userEmail);
  }

  if (!matchingClient) {
    const associatedProfile = await getAssociatedProfileForUser(user);
    if (associatedProfile) {
      matchingClient = matchClientByAssociatedProfile(clients, associatedProfile);
    }
  }

  const clientId = matchingClient ? extractClientId(matchingClient) : null;
  if (!matchingClient || !clientId) {
    throw new ClientProductEntitlementError(
      'Client account not linked. Your login email must match the Contact Email/Phone on a Clients record, or you need to re-login after your account is linked.',
      401,
      ClientProductEntitlementCode.CLIENT_NOT_LINKED
    );
  }

  return { clientId, clientRecord: matchingClient };
}

export async function resolveClientAssignedProducts(user: AuthUser): Promise<{
  clientId: string;
  assignedProductIds: string[];
}> {
  const { clientId, clientRecord } = await resolveClientRecord(user);

  const assignedProductIds = parseAssignedProducts(
    clientRecord['Assigned Products'] ?? clientRecord.assignedProducts ?? clientRecord.products
  );

  return { clientId, assignedProductIds };
}

export async function assertClientProductAssigned(user: AuthUser, productId: string): Promise<void> {
  const pid = String(productId || '').trim();
  if (!pid) {
    throw new ClientProductEntitlementError(
      'Product ID is required.',
      400,
      ClientProductEntitlementCode.PRODUCT_ID_REQUIRED
    );
  }
  const { assignedProductIds } = await resolveClientAssignedProducts(user);
  if (assignedProductIds.length === 0) {
    throw new ClientProductEntitlementError(
      'No loan products are assigned to your account. Please contact your KAM to allocate products.',
      403,
      ClientProductEntitlementCode.NO_PRODUCTS_ASSIGNED
    );
  }

  const allowed = new Set(assignedProductIds.map((id) => normalizeProductId(id)));
  if (!allowed.has(normalizeProductId(pid))) {
    throw new ClientProductEntitlementError(
      'This product is not assigned to your account. Please contact your KAM to allocate products.',
      403,
      ClientProductEntitlementCode.PRODUCT_NOT_ASSIGNED
    );
  }
}
