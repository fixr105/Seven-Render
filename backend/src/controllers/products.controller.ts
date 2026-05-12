/**
 * Products Controller
 * Handles loan products and NBFC partners
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { buildKAMNameMap, resolveKAMName } from '../utils/kamNameResolver.js';
import { resolveClientAssignedProducts } from '../services/entitlements/clientProducts.service.js';
import { LoanStatus } from '../config/constants.js';

function extractIconUrl(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = extractIconUrl(item);
      if (parsed) return parsed;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      extractIconUrl(record.url) ||
      extractIconUrl(record.URL) ||
      extractIconUrl(record.href) ||
      extractIconUrl(record.src)
    );
  }
  return undefined;
}

type ApplicableStatusEntry = {
  key: string;
  label: string;
  order: number;
};

const CANONICAL_STATUS_SET = new Set<string>(Object.values(LoanStatus));

function normalizeStatusKey(raw: unknown): string {
  const normalized = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');

  const aliasMap: Record<string, string> = {
    pending_kam_review: LoanStatus.UNDER_KAM_REVIEW,
    kam_query_raised: LoanStatus.QUERY_WITH_CLIENT,
    forwarded_to_credit: LoanStatus.PENDING_CREDIT_REVIEW,
    credit_query_raised: LoanStatus.CREDIT_QUERY_WITH_KAM,
  };
  return aliasMap[normalized] ?? normalized;
}

function parseApplicableStatuses(raw: unknown): ApplicableStatusEntry[] {
  if (raw == null || String(raw).trim() === '') {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const mapped = parsed
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const key = normalizeStatusKey(row.key);
      if (!key || !CANONICAL_STATUS_SET.has(key)) return null;
      const label = String(row.label ?? '').trim() || key;
      const maybeOrder = Number(row.order);
      const order = Number.isFinite(maybeOrder) ? maybeOrder : (index + 1) * 10;
      return { key, label, order };
    })
    .filter((entry): entry is ApplicableStatusEntry => entry !== null);

  if (mapped.length === 0) {
    return [];
  }

  return mapped.sort((a, b) => a.order - b.order);
}

export class ProductsController {
  /**
   * GET /loan-products
   * List all loan products. Calls webhook and remaps KAMs to products using Clients (Assigned KAM + Assigned Products).
   */
  async listLoanProducts(req: Request, res: Response): Promise<void> {
    // CRITICAL: Log immediately to verify controller is being called
    console.log(`🚨 [listLoanProducts] CONTROLLER CALLED - Request received at ${new Date().toISOString()}`);
    console.log(`🚨 [listLoanProducts] Request URL: ${req.url}`);
    console.log(`🚨 [listLoanProducts] Request path: ${req.path}`);
    console.log(`🚨 [listLoanProducts] Request method: ${req.method}`);
    console.log(`🚨 [listLoanProducts] User: ${req.user ? JSON.stringify(req.user) : 'NO USER'}`);
    try {
      // Re-enable webhook calls - the await fix should make this work now
      console.log(`[listLoanProducts] Fetching loan products...`);
      
      // n8n is fast (~1.08s), so use shorter timeout (5s should be plenty)
      const timeoutMs = 5000; // 5 seconds - n8n responds in ~1.08s
      
      console.log(`[listLoanProducts] Fetching loan products with ${timeoutMs}ms timeout`);
      console.log(`[listLoanProducts] N8N_BASE_URL: ${process.env.N8N_BASE_URL || 'NOT SET - using default'}`);
      
      // Fetch Loan Products and Clients in parallel (Clients for KAM→product remapping)
      console.log(`[listLoanProducts] Calling n8nClient.fetchTable('Loan Products') with cache DISABLED...`);
      const [products, clients, kamUsers] = await Promise.all([
        n8nClient.fetchTable('Loan Products', false, undefined, timeoutMs),
        n8nClient.fetchTable('Clients', false).catch(() => [] as any[]),
        n8nClient.fetchTable('KAM Users', false).catch(() => [] as any[]),
      ]);
      console.log(`[listLoanProducts] fetchTable returned ${products.length} products, ${clients.length} clients`);

      // Build productId -> Set<KAM ID> from Clients (Assigned Products + Assigned KAM)
      const productToKamIds = new Map<string, Set<string>>();
      for (const client of clients as any[]) {
        const assignedKam = (client['Assigned KAM'] || client.assignedKAM || '').toString().trim();
        const assignedProductsRaw = (client['Assigned Products'] || client.assignedProducts || '').toString().trim();
        const productIds = assignedProductsRaw
          ? assignedProductsRaw.split(/[,\s]+/).map((p: string) => p.trim()).filter(Boolean)
          : [];
        if (assignedKam && productIds.length > 0) {
          for (const pid of productIds) {
            const key = pid.toLowerCase();
            if (!productToKamIds.has(key)) productToKamIds.set(key, new Set());
            productToKamIds.get(key)!.add(assignedKam);
          }
        }
      }

      const kamNameMap = buildKAMNameMap(kamUsers as any[]);

      // Filter active products if requested
      const { activeOnly } = req.query;
      let filteredProducts = products;
      
      if (activeOnly === 'true') {
        filteredProducts = products.filter((p: any) => p.Active === 'True' || p.Active === true);
        console.log(`[listLoanProducts] Filtered to ${filteredProducts.length} active products`);
      }

      if (req.user?.role === 'client') {
        try {
          const { assignedProductIds } = await resolveClientAssignedProducts(req.user);
          const allowedIds = new Set(assignedProductIds.map((id) => id.toLowerCase()));
          filteredProducts = filteredProducts.filter((p: any) =>
            allowedIds.has(String(p['Product ID'] || p.productId || p.id || '').trim().toLowerCase())
          );
          console.log(`[listLoanProducts] Client scoped to ${filteredProducts.length} assigned products`);
        } catch (error) {
          console.warn('[listLoanProducts] Failed to resolve client product entitlement, returning empty set.', error);
          filteredProducts = [];
        }
      }

      res.json({
        success: true,
        data: filteredProducts.map((product: any) => {
          const productId = product['Product ID'] || product.productId || product.id || '';
          const lookupKey = productId.toLowerCase();
          const kamIds = productToKamIds.get(lookupKey)
            ? Array.from(productToKamIds.get(lookupKey)!)
            : [];
          const assignedKamIds = kamIds;
          const assignedKamNames = kamIds.map((kid) => resolveKAMName(kid, kamNameMap)).filter(Boolean);
          return {
            ...product,
            id: product.id,
            productId: product['Product ID'],
            productName: product['Product Name'],
            description: product['Description'],
            ICONS: product['ICONS'] ?? product.ICONS ?? product['Icons'] ?? product.icons,
            iconUrl: extractIconUrl(product['ICONS'] ?? product.ICONS ?? product['Icons'] ?? product.icons),
            active: product['Active'] === 'True' || product['Active'] === true,
            requiredDocumentsFields: product['Required Documents/Fields'],
            applicableStatuses: parseApplicableStatuses(product['Applicable Statuses'] ?? product.applicableStatuses),
            assignedKamIds,
            assignedKamNames,
          };
        }),
      });
    } catch (error: any) {
      console.error(`[listLoanProducts] ❌ FAILED to fetch loan products:`, error.message);
      console.error(`[listLoanProducts] Error stack:`, error.stack);
      console.error(`[listLoanProducts] Returning empty array to prevent frontend timeout`);
      // Return empty array instead of error to prevent frontend timeout
      // Frontend can handle empty array gracefully
      res.json({
        success: true,
        data: [],
      });
    }
  }

  /**
   * GET /loan-products/:id
   * Get single loan product with assigned KAMs remapped from Clients
   */
  async getLoanProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const lookup = String(id ?? '').trim().toLowerCase();
      const [products, clients, kamUsers] = await Promise.all([
        n8nClient.fetchTable('Loan Products'),
        n8nClient.fetchTable('Clients', false).catch(() => [] as any[]),
        n8nClient.fetchTable('KAM Users', false).catch(() => [] as any[]),
      ]);
      
      const product = products.find((p: any) => {
        const candidates = [
          p.id,
          p['Product ID'],
          p.productId,
          p['Product Name'],
          p.productName,
        ]
          .map((v) => String(v ?? '').trim().toLowerCase())
          .filter(Boolean);
        return candidates.includes(lookup);
      });

      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Loan product not found',
        });
        return;
      }

      const productId = product['Product ID'] || product.productId || product.id || '';
      const productToKamIds = new Map<string, Set<string>>();
      for (const client of clients as any[]) {
        const assignedKam = (client['Assigned KAM'] || client.assignedKAM || '').toString().trim();
        const assignedProductsRaw = (client['Assigned Products'] || client.assignedProducts || '').toString().trim();
        const pids = assignedProductsRaw
          ? assignedProductsRaw.split(/[,\s]+/).map((p: string) => p.trim().toLowerCase()).filter(Boolean)
          : [];
        if (assignedKam && pids.includes(productId.toLowerCase())) {
          const key = productId.toLowerCase();
          if (!productToKamIds.has(key)) productToKamIds.set(key, new Set());
          productToKamIds.get(key)!.add(assignedKam);
        }
      }
      const kamIds = productToKamIds.get(productId.toLowerCase()) ? Array.from(productToKamIds.get(productId.toLowerCase())!) : [];
      const kamNameMap = buildKAMNameMap(kamUsers as any[]);
      const assignedKamNames = kamIds.map((kid) => resolveKAMName(kid, kamNameMap)).filter(Boolean);
      res.json({
        success: true,
        data: {
          ...product,
          id: product.id,
          productId: product['Product ID'],
          productName: product['Product Name'],
          description: product['Description'],
          ICONS: product['ICONS'] ?? product.ICONS ?? product['Icons'] ?? product.icons,
          iconUrl: extractIconUrl(product['ICONS'] ?? product.ICONS ?? product['Icons'] ?? product.icons),
          active: product['Active'] === 'True',
          requiredDocumentsFields: product['Required Documents/Fields'],
          applicableStatuses: parseApplicableStatuses(product['Applicable Statuses'] ?? product.applicableStatuses),
          assignedKamIds: kamIds,
          assignedKamNames,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch loan product',
      });
    }
  }

  /**
   * GET /nbfc-partners
   * List all NBFC partners
   */
  async listNBFCPartners(req: Request, res: Response): Promise<void> {
    try {
      // Fetch only NBFC Partners table
      const partners = await n8nClient.fetchTable('NBFC Partners');

      // Filter active partners if requested
      const { activeOnly } = req.query;
      let filteredPartners = partners;
      
      if (activeOnly === 'true') {
        filteredPartners = partners.filter((p: any) => p.Active === 'True');
      }

      res.json({
        success: true,
        data: filteredPartners.map((partner: any) => ({
          id: partner.id,
          lenderId: partner['Lender ID'],
          lenderName: partner['Lender Name'],
          contactPerson: partner['Contact Person'],
          contactEmailPhone: partner['Contact Email/Phone'],
          addressRegion: partner['Address/Region'],
          active: partner['Active'] === 'True',
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch NBFC partners',
      });
    }
  }

  /**
   * GET /nbfc-partners/:id
   * Get single NBFC partner
   */
  async getNBFCPartner(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only NBFC Partners table
      const partners = await n8nClient.fetchTable('NBFC Partners');
      
      const partner = partners.find((p: any) => p.id === id || p['Lender ID'] === id);

      if (!partner) {
        res.status(404).json({
          success: false,
          error: 'NBFC partner not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: partner.id,
          lenderId: partner['Lender ID'],
          lenderName: partner['Lender Name'],
          contactPerson: partner['Contact Person'],
          contactEmailPhone: partner['Contact Email/Phone'],
          addressRegion: partner['Address/Region'],
          active: partner['Active'] === 'True',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch NBFC partner',
      });
    }
  }
}

export const productsController = new ProductsController();

