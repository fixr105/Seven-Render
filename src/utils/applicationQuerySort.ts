export type QueryCountMap = Record<string, { unresolved: number; lastActivity: string | null }>;

function parseTime(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Sort applications so unresolved-query files appear first (Credit/KAM default list order).
 * Tie-breakers: unresolved count desc → last query activity desc → updated_at desc.
 */
export function sortApplicationsByUnresolvedQueries<T>(
  apps: T[],
  queryCounts: QueryCountMap,
  getAppId: (app: T) => string,
  getUpdatedAt: (app: T) => string
): T[] {
  return [...apps].sort((a, b) => {
    const aId = getAppId(a);
    const bId = getAppId(b);
    const aData = queryCounts[aId] ?? { unresolved: 0, lastActivity: null };
    const bData = queryCounts[bId] ?? { unresolved: 0, lastActivity: null };

    const aHasUnresolved = aData.unresolved > 0;
    const bHasUnresolved = bData.unresolved > 0;
    if (aHasUnresolved !== bHasUnresolved) {
      return aHasUnresolved ? -1 : 1;
    }

    if (aHasUnresolved && bHasUnresolved) {
      if (aData.unresolved !== bData.unresolved) {
        return bData.unresolved - aData.unresolved;
      }
      const activityDiff =
        parseTime(bData.lastActivity) - parseTime(aData.lastActivity);
      if (activityDiff !== 0) return activityDiff;
    }

    return parseTime(getUpdatedAt(b)) - parseTime(getUpdatedAt(a));
  });
}
