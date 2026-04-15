import { useEffect, useState } from 'react';
import { apiService } from '../services/api';

export interface ApplicableStatusOption {
  key: string;
  label: string;
  order: number;
}

interface UseLoanProductApplicableStatusesResult {
  statuses: ApplicableStatusOption[];
  loading: boolean;
}

/**
 * Fetch and normalize loan-product applicable statuses for status dropdowns.
 */
export const useLoanProductApplicableStatuses = (
  productId: string
): UseLoanProductApplicableStatusesResult => {
  const [statuses, setStatuses] = useState<ApplicableStatusOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!productId) {
      setStatuses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    apiService
      .getLoanProduct(productId)
      .then((res) => {
        if (cancelled) return;
        const rawStatuses = res.data?.applicableStatuses;
        if (!res.success || !Array.isArray(rawStatuses)) {
          setStatuses([]);
          return;
        }
        const normalized = rawStatuses
          .map((statusEntry) => ({
            key: String(statusEntry.key || '').toLowerCase().trim(),
            label: String(statusEntry.label || '').trim(),
            order:
              typeof statusEntry.order === 'number'
                ? statusEntry.order
                : Number.MAX_SAFE_INTEGER,
          }))
          .filter((statusEntry) => statusEntry.key !== '')
          .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
        setStatuses(normalized);
      })
      .catch(() => {
        if (!cancelled) setStatuses([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  return { statuses, loading };
};
