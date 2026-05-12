import { AuthUser } from '../../types/auth.js';
import { n8nClient } from '../airtable/n8nClient.js';

export class ClientProductEntitlementError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ClientProductEntitlementError';
    this.statusCode = statusCode;
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

export async function resolveClientAssignedProducts(user: AuthUser): Promise<{
  clientId: string;
  assignedProductIds: string[];
}> {
  if (!user || user.role !== 'client') {
    throw new ClientProductEntitlementError('Authentication required.', 401);
  }

  const clients = await n8nClient.fetchTable('Clients');
  const userEmail = (user.email || '').trim().toLowerCase();

  let authClientId: string | null = user.clientId ? user.clientId.toString().trim() : null;
  let matchingClient = authClientId
    ? clients.find(
        (c: any) =>
          (c.id && c.id.toString().trim() === authClientId) ||
          (c['Client ID'] && c['Client ID'].toString().trim() === authClientId) ||
          (c.clientId && c.clientId.toString().trim() === authClientId)
      )
    : null;

  if (!matchingClient && userEmail) {
    matchingClient = clients.find((c: any) => {
      const contact = (
        c['Contact Email / Phone'] ||
        c['Contact Email/Phone'] ||
        c.contactEmailPhone ||
        ''
      )
        .toString()
        .toLowerCase();
      return contact && contact.includes(userEmail);
    });
    if (matchingClient) {
      authClientId = (matchingClient['Client ID'] || matchingClient.clientId || matchingClient.id || null)
        ?.toString()
        .trim() ?? null;
    }
  }

  if (!authClientId) {
    throw new ClientProductEntitlementError(
      'Client account not linked. Your login email must match the Contact Email/Phone on a Clients record, or you need to re-login after your account is linked.',
      401
    );
  }

  // Prefer explicit assignment columns, then fall back to legacy products field.
  const assignedProductIds = parseAssignedProducts(
    matchingClient?.['Assigned Products'] ??
      matchingClient?.assignedProducts ??
      matchingClient?.products
  );
  return { clientId: authClientId, assignedProductIds };
}

export async function assertClientProductAssigned(user: AuthUser, productId: string): Promise<void> {
  const pid = String(productId || '').trim();
  if (!pid) {
    throw new ClientProductEntitlementError('Product ID is required.', 400);
  }
  const { assignedProductIds } = await resolveClientAssignedProducts(user);
  if (assignedProductIds.length === 0) {
    throw new ClientProductEntitlementError(
      'No loan products are assigned to your account. Please contact your KAM to allocate products.',
      403
    );
  }

  const allowed = new Set(assignedProductIds.map((id) => normalizeProductId(id)));
  if (!allowed.has(normalizeProductId(pid))) {
    throw new ClientProductEntitlementError(
      'This product is not assigned to your account. Please contact your KAM to allocate products.',
      403
    );
  }
}

