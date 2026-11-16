import { parseLenderBreRecord, PRICING_UNAVAILABLE_MESSAGE, type LenderBreRow } from './lenderBrePricing';
import {
  parseLenderRecord,
  parseTenureList,
  pickActiveLender,
  type LenderRow,
} from './postSubmitEngine/offers';
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
  /** Active lender `Lenders.tenure_months`, in listed order. */
  tenureMonths: number[];
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

export async function loadActiveLender(): Promise<
  { ok: true; lender: LenderRow } | { ok: false; reason: string }
> {
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

    return pickActiveLender(lenders, defaultLenderName);
  } catch {
    return { ok: false, reason: PRICING_UNAVAILABLE_MESSAGE };
  }
}

export async function loadActiveLenderTenureMonths(): Promise<number[]> {
  const picked = await loadActiveLender();
  if (!picked.ok) return [];
  return parseTenureList(picked.lender.tenure_months);
}

export async function loadCalculatorQuoteContext(): Promise<CalculatorQuoteContext> {
  const picked = await loadActiveLender();
  if (!picked.ok) {
    return { lenderName: null, rows: [], products: [], tenureMonths: [], error: picked.reason };
  }
  const tenureMonths = parseTenureList(picked.lender.tenure_months);

  try {
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

    return { lenderName: picked.lender.name, rows, products, tenureMonths, error: null };
  } catch {
    return {
      lenderName: picked.lender.name,
      rows: [],
      products: [],
      tenureMonths,
      error: PRICING_UNAVAILABLE_MESSAGE,
    };
  }
}
