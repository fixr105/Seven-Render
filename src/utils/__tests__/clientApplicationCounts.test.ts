import { describe, expect, it } from 'vitest';
import { resolveClientApplicationCount } from '../clientApplicationCounts';

describe('resolveClientApplicationCount', () => {
  it('prefers backend-provided application counts over fallback counts', () => {
    expect(
      resolveClientApplicationCount({
        client: {
          applicationsCount: 3,
          _count: { applications: 0 },
        },
        fallbackCount: 9,
      })
    ).toBe(3);
  });

  it('uses _count.applications when applicationsCount is absent', () => {
    expect(
      resolveClientApplicationCount({
        client: {
          _count: { applications: 4 },
        },
        fallbackCount: 9,
      })
    ).toBe(4);
  });

  it('falls back to the computed count for older API payloads', () => {
    expect(
      resolveClientApplicationCount({
        client: {},
        fallbackCount: 2,
      })
    ).toBe(2);
  });
});
