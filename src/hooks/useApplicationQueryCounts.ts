import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import type { LoanApplication } from './useApplications';
import type { QueryCountMap } from '../utils/applicationQuerySort';

const CONCURRENCY_LIMIT = 8;

function countUnresolvedFromThreads(threads: unknown[]): {
  unresolved: number;
  lastActivity: string | null;
} {
  const unresolved = threads.filter(
    (thread: unknown) =>
      (thread as { isResolved?: boolean }).isResolved === false ||
      (thread as { isResolved?: boolean }).isResolved === undefined
  ).length;

  let lastActivity: string | null = null;
  threads.forEach((thread: unknown) => {
    const t = thread as {
      rootQuery?: { timestamp?: string };
      replies?: Array<{ timestamp?: string }>;
    };
    const rootTime = t.rootQuery?.timestamp;
    const replyTimes = (t.replies || []).map((r) => r.timestamp).filter(Boolean) as string[];
    const allTimes = [rootTime, ...replyTimes].filter(Boolean) as string[];
    if (allTimes.length > 0) {
      const maxTime = allTimes.reduce((max, time) => {
        try {
          return new Date(time) > new Date(max) ? time : max;
        } catch {
          return max;
        }
      });
      if (!lastActivity || new Date(maxTime) > new Date(lastActivity)) {
        lastActivity = maxTime;
      }
    }
  });

  return { unresolved, lastActivity };
}

async function fetchCountsForApps(
  apps: LoanApplication[],
  signal: { aborted: boolean }
): Promise<QueryCountMap> {
  const counts: QueryCountMap = {};
  let index = 0;

  async function worker(): Promise<void> {
    while (index < apps.length) {
      if (signal.aborted) return;
      const current = index;
      index += 1;
      const app = apps[current];
      try {
        const response = await apiService.getQueries(app.id);
        if (signal.aborted) return;
        if (response.success && response.data && Array.isArray(response.data)) {
          counts[app.id] = countUnresolvedFromThreads(response.data);
        } else {
          counts[app.id] = { unresolved: 0, lastActivity: null };
        }
      } catch {
        counts[app.id] = { unresolved: 0, lastActivity: null };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY_LIMIT, Math.max(apps.length, 1)) },
    () => worker()
  );
  await Promise.all(workers);
  return counts;
}

export interface UseApplicationQueryCountsOptions {
  enabled: boolean;
}

export function useApplicationQueryCounts(
  applications: LoanApplication[],
  options: UseApplicationQueryCountsOptions
) {
  const { enabled } = options;
  const [queryCounts, setQueryCounts] = useState<QueryCountMap>({});
  const [loadingQueryCounts, setLoadingQueryCounts] = useState(false);
  const appIdsKey = applications.map((a) => a.id).join(',');
  const appsRef = useRef(applications);
  appsRef.current = applications;

  const refetchQueryCounts = useCallback(async () => {
    const apps = appsRef.current;
    if (!enabled || apps.length === 0) {
      setQueryCounts({});
      setLoadingQueryCounts(false);
      return;
    }
    setLoadingQueryCounts(true);
    const signal = { aborted: false };
    try {
      const counts = await fetchCountsForApps(apps, signal);
      if (!signal.aborted) setQueryCounts(counts);
    } catch (error) {
      console.error('Error fetching query counts:', error);
    } finally {
      if (!signal.aborted) setLoadingQueryCounts(false);
    }
  }, [enabled]);

  useEffect(() => {
    const signal = { aborted: false };
    const apps = appsRef.current;
    if (!enabled || apps.length === 0) {
      setQueryCounts({});
      setLoadingQueryCounts(false);
      return;
    }
    setLoadingQueryCounts(true);
    void (async () => {
      try {
        const counts = await fetchCountsForApps(apps, signal);
        if (!signal.aborted) setQueryCounts(counts);
      } catch (error) {
        if (!signal.aborted) console.error('Error fetching query counts:', error);
      } finally {
        if (!signal.aborted) setLoadingQueryCounts(false);
      }
    })();
    return () => {
      signal.aborted = true;
    };
  }, [enabled, appIdsKey]);

  useEffect(() => {
    if (!enabled) return;
    const handleRefresh = () => {
      void refetchQueryCounts();
    };
    window.addEventListener('dashboard:refresh', handleRefresh);
    return () => window.removeEventListener('dashboard:refresh', handleRefresh);
  }, [enabled, refetchQueryCounts]);

  return { queryCounts, loadingQueryCounts, refetchQueryCounts };
}
