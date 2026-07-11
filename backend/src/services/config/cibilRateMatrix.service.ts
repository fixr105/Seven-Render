/**
 * CIBIL Rate Matrix Service
 *
 * Fetches the CIBIL-score → (ROI%, PF%) band matrix from n8n (synced from
 * Airtable) and caches it in memory with a 24h TTL. Follows the lazy
 * timestamp-TTL cache pattern used by AuthService (background cron against n8n
 * is deliberately avoided in this codebase).
 *
 * The raw n8n response is Airtable's native record shape, so the actual values
 * live under `.fields`. One live record has an empty `fields: {}` (a bad
 * Airtable row) — dirty rows are filtered out. If the fetch fails or the matrix
 * is empty after filtering, a single hardcoded default band is returned so the
 * wizard always has usable values.
 */

import fetch from 'node-fetch';
import { n8nEndpoints } from '../airtable/n8nEndpoints.js';
import { defaultLogger } from '../../utils/logger.js';

/** Default rate constants (mirror src/lib/loanCalculator.ts INTEREST_RATE / PF_PCT). */
const DEFAULT_ROI_PCT = 35;
const DEFAULT_PF_PCT = 8; // PF_PCT (0.08) as whole-number percent

const CIBIL_RATE_MATRIX_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface CibilRateBand {
  start_cibil: number;
  end_cibil: number;
  pf_pct: number;
  roi_pct: number;
  band_label: string;
}

let matrixCache: { data: CibilRateBand[]; timestamp: number } | null = null;

function getDefaultMatrix(): CibilRateBand[] {
  return [
    {
      start_cibil: 0,
      end_cibil: 900,
      pf_pct: DEFAULT_PF_PCT,
      roi_pct: DEFAULT_ROI_PCT,
      band_label: 'Default',
    },
  ];
}

function isValidBand(fields: Record<string, unknown> | undefined | null): boolean {
  if (!fields) return false;
  return (
    fields.start_cibil !== undefined &&
    fields.end_cibil !== undefined &&
    fields.pf_pct !== undefined &&
    fields.roi_pct !== undefined
  );
}

function unwrapAndClean(records: unknown): CibilRateBand[] {
  if (!Array.isArray(records)) return [];
  return records
    .map((r) => (r && typeof r === 'object' ? (r as { fields?: Record<string, unknown> }).fields : undefined))
    .filter(isValidBand)
    .map((fields) => {
      const f = fields as Record<string, unknown>;
      return {
        start_cibil: Number(f.start_cibil),
        end_cibil: Number(f.end_cibil),
        pf_pct: Number(f.pf_pct),
        roi_pct: Number(f.roi_pct),
        band_label: f.band_label != null ? String(f.band_label) : '',
      };
    });
}

export class CibilRateMatrixService {
  static clearCache(): void {
    matrixCache = null;
  }

  private static getCached(): CibilRateBand[] | null {
    if (matrixCache && Date.now() - matrixCache.timestamp < CIBIL_RATE_MATRIX_CACHE_TTL) {
      return matrixCache.data;
    }
    return null;
  }

  private static setCached(data: CibilRateBand[]): void {
    matrixCache = { data, timestamp: Date.now() };
  }

  static async getMatrix(timeoutMs: number = 5000): Promise<CibilRateBand[]> {
    const cached = CibilRateMatrixService.getCached();
    if (cached) return cached;

    const url = n8nEndpoints.get.cibilRateMatrix;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`CIBIL rate matrix webhook failed: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      const trimmed = (text || '').trim();
      if (!trimmed) {
        defaultLogger.warn('CIBIL rate matrix: empty response body, using default matrix');
        return getDefaultMatrix();
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        defaultLogger.warn('CIBIL rate matrix: invalid JSON, using default matrix', {
          error: (e as Error).message,
        });
        return getDefaultMatrix();
      }

      const bands = unwrapAndClean(parsed);
      if (bands.length === 0) {
        defaultLogger.warn('CIBIL rate matrix: no valid bands after cleaning, using default matrix');
        return getDefaultMatrix();
      }

      CibilRateMatrixService.setCached(bands);
      return bands;
    } catch (error) {
      defaultLogger.warn('CIBIL rate matrix: fetch failed, using default matrix', {
        error: error instanceof Error ? error.message : String(error),
      });
      return getDefaultMatrix();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
