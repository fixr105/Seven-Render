import { parseLenderBreRecord, PRICING_UNAVAILABLE_MESSAGE, type LenderBreRow } from './lenderBrePricing';
import { parseLenderRecord, pickActiveLender } from './postSubmitEngine/offers';
import { apiService } from '../services/api';
import { airtableGet } from '../services/engineClient';

export type CalculatorProduct = {
  id: string;
  name: string;
};

export type CalculatorQuoteContext = {
  lenderName: string | null;
  rows: LenderBreRow[];
  products: CalculatorProduct[];
  error: string | null;
};

function mapProducts(
  data: Array<{ productId?: string; id?: string; productName?: string; name?: string }>
): CalculatorProduct[] {
  return data
    .map((product) => ({
      id: String(product.productId || product.id || '').trim(),
      name: String(product.productName || product.name || product.productId || product.id || 'Product').trim(),
    }))
    .filter((product) => product.id.length > 0);
}

export async function loadCalculatorQuoteContext(): Promise<CalculatorQuoteContext> {
  try {
    const lendersRes = await airtableGet({
      table: 'Lenders',
      filter_formula: "{status} = 'active'",
      max: 50,
    });
    const lenders = (lendersRes.records || [])
      .map((row) => parseLenderRecord(row as Record<string, unknown>))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    let defaultLenderName: string | null = null;
    if (lenders.length > 1) {
      try {
        const cfg = await airtableGet({
          table: 'Config',
          filter_formula: "{key} = 'default_lender'",
          max: 1,
        });
        defaultLenderName = String(cfg.records?.[0]?.value ?? '').trim() || null;
      } catch {
        defaultLenderName = null;
      }
    }

    const picked = pickActiveLender(lenders, defaultLenderName);
    if (!picked.ok) {
      return { lenderName: null, rows: [], products: [], error: picked.reason };
    }

    const breRes = await airtableGet({
      table: 'Lender BRE',
      filter_formula: '',
      max: 200,
    });
    const rows = (breRes.records || [])
      .map((record) => parseLenderBreRecord(record))
      .filter((row): row is LenderBreRow => Boolean(row));

    let products: CalculatorProduct[] = [];
    try {
      const productsRes = await apiService.listLoanProducts(true);
      if (productsRes.success && Array.isArray(productsRes.data)) {
        products = mapProducts(productsRes.data);
      }
    } catch {
      products = [];
    }

    return { lenderName: picked.lender.name, rows, products, error: null };
  } catch {
    return { lenderName: null, rows: [], products: [], error: PRICING_UNAVAILABLE_MESSAGE };
  }
}
