import { describe, expect, it } from 'vitest';
import { resolveApplicationClientId } from './resolveApplicationClientId';

describe('resolveApplicationClientId', () => {
  it('returns clientId string when present', () => {
    expect(resolveApplicationClientId({ clientId: 'CLIENT001' })).toBe('CLIENT001');
  });

  it('returns first linked Client array entry', () => {
    expect(resolveApplicationClientId({ Client: ['recClient123'] })).toBe('recClient123');
  });

  it('reads id from enriched client display object instead of stringifying it', () => {
    expect(
      resolveApplicationClientId({
        client: { company_name: 'Acme Motors', id: 'CLIENT002' },
      })
    ).toBe('CLIENT002');
  });

  it('does not return [object Object] for display-only client objects', () => {
    expect(
      resolveApplicationClientId({
        client: { company_name: 'Acme Motors' },
      })
    ).toBe('');
  });
});
