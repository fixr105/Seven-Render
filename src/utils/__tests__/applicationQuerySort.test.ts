import { describe, expect, it } from 'vitest';
import { sortApplicationsByUnresolvedQueries, type QueryCountMap } from '../applicationQuerySort';

type App = { id: string; updated_at: string };

describe('sortApplicationsByUnresolvedQueries', () => {
  const apps: App[] = [
    { id: 'a', updated_at: '2026-07-06T10:00:00Z' },
    { id: 'b', updated_at: '2026-07-06T12:00:00Z' },
    { id: 'c', updated_at: '2026-07-06T11:00:00Z' },
    { id: 'd', updated_at: '2026-07-06T09:00:00Z' },
  ];

  it('returns copy unchanged when no query counts', () => {
    const sorted = sortApplicationsByUnresolvedQueries(
      apps,
      {},
      (app) => app.id,
      (app) => app.updated_at
    );
    expect(sorted.map((a) => a.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('puts unresolved applications first', () => {
    const queryCounts: QueryCountMap = {
      c: { unresolved: 1, lastActivity: '2026-07-06T08:00:00Z' },
      d: { unresolved: 2, lastActivity: '2026-07-06T07:00:00Z' },
    };
    const sorted = sortApplicationsByUnresolvedQueries(
      apps,
      queryCounts,
      (app) => app.id,
      (app) => app.updated_at
    );
    expect(sorted.slice(0, 2).map((a) => a.id)).toEqual(['d', 'c']);
    expect(sorted.slice(2).map((a) => a.id)).toEqual(['b', 'a']);
  });

  it('sorts unresolved group by count then last activity', () => {
    const queryCounts: QueryCountMap = {
      a: { unresolved: 1, lastActivity: '2026-07-06T09:00:00Z' },
      b: { unresolved: 2, lastActivity: '2026-07-06T06:00:00Z' },
      c: { unresolved: 2, lastActivity: '2026-07-06T10:00:00Z' },
    };
    const sorted = sortApplicationsByUnresolvedQueries(
      apps,
      queryCounts,
      (app) => app.id,
      (app) => app.updated_at
    );
    expect(sorted.map((a) => a.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});
