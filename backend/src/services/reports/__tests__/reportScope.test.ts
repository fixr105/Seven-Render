/**
 * Report scope: KAM sees only managed clients. Credit and admin are unscoped.
 * A failed lookup or a KAM with no kamId is scoped to nobody.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserRole } from '../../../config/constants.js';
import type { AuthUser } from '../../../types/auth.js';

const mockGetKAMManagedClientIds = jest.fn<(kamId: string) => Promise<string[]>>();

jest.mock('../../rbac/rbacFilter.service.js', () => ({
  rbacFilterService: {
    getKAMManagedClientIds: (kamId: string) => mockGetKAMManagedClientIds(kamId),
  },
}));

import { filterLedgerEntries, resolveReportScope } from '../reportScope.js';

function user(partial: Partial<AuthUser> & Pick<AuthUser, 'role'>): AuthUser {
  return {
    id: 'user-1',
    email: 'person@test.local',
    ...partial,
  };
}

describe('resolveReportScope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads managed client ids for a KAM', async () => {
    mockGetKAMManagedClientIds.mockResolvedValue(['recClient1', 'CLIENT-1']);
    const scope = await resolveReportScope(
      user({ role: UserRole.KAM, kamId: 'recKAM', email: 'kam@test.local' })
    );
    expect(mockGetKAMManagedClientIds).toHaveBeenCalledWith('recKAM');
    expect(scope.unscoped).toBe(false);
    expect(scope.clientIds).toEqual(['recClient1', 'CLIENT-1']);
  });

  it('leaves credit and admin unscoped without looking up clients', async () => {
    const credit = await resolveReportScope(user({ role: UserRole.CREDIT }));
    const admin = await resolveReportScope(user({ role: UserRole.ADMIN }));
    expect(credit.unscoped).toBe(true);
    expect(admin.unscoped).toBe(true);
    expect(credit.clientIds).toEqual([]);
    expect(mockGetKAMManagedClientIds).not.toHaveBeenCalled();
  });

  it('scopes a KAM with no kamId to zero clients', async () => {
    const scope = await resolveReportScope(user({ role: UserRole.KAM, kamId: null }));
    expect(scope.unscoped).toBe(false);
    expect(scope.clientIds).toEqual([]);
    expect(mockGetKAMManagedClientIds).not.toHaveBeenCalled();
  });

  it('scopes to zero clients when the lookup throws', async () => {
    mockGetKAMManagedClientIds.mockRejectedValue(new Error('webhook down'));
    const scope = await resolveReportScope(user({ role: UserRole.KAM, kamId: 'recKAM' }));
    expect(scope.unscoped).toBe(false);
    expect(scope.clientIds).toEqual([]);
  });
});

describe('filterLedgerEntries', () => {
  const rows = [
    { Client: 'recClient1', 'Payout Amount': '100' },
    { Client: 'CLIENT-OTHER', 'Payout Amount': '50' },
    { client: 'client-1', 'Payout Amount': '-10' },
  ];

  it('keeps every row when unscoped and no clientId is requested', () => {
    const filtered = filterLedgerEntries(rows, { unscoped: true, clientIds: [] });
    expect(filtered).toHaveLength(3);
  });

  it('matches a requested client id case-insensitively when unscoped', () => {
    const filtered = filterLedgerEntries(rows, { unscoped: true, clientIds: [] }, 'client-1');
    expect(filtered).toEqual([{ client: 'client-1', 'Payout Amount': '-10' }]);
  });

  it('returns only the KAM rows, matching record id and business id', () => {
    const filtered = filterLedgerEntries(rows, {
      unscoped: false,
      clientIds: ['recClient1', 'CLIENT-1'],
    });
    expect(filtered).toEqual([
      { Client: 'recClient1', 'Payout Amount': '100' },
      { client: 'client-1', 'Payout Amount': '-10' },
    ]);
  });

  it('returns an empty list for a client id outside the KAM set', () => {
    const filtered = filterLedgerEntries(
      rows,
      { unscoped: false, clientIds: ['recClient1'] },
      'CLIENT-OTHER'
    );
    expect(filtered).toEqual([]);
  });

  it('returns nothing when the KAM manages nobody', () => {
    const filtered = filterLedgerEntries(rows, { unscoped: false, clientIds: [] });
    expect(filtered).toEqual([]);
  });
});
