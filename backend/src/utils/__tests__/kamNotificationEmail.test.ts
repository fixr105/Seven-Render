import { describe, expect, it } from '@jest/globals';
import { resolveKamNotificationEmail } from '../kamNotificationEmail.js';

describe('resolveKamNotificationEmail', () => {
  const users = [
    { id: 'recKAM1', 'KAM ID': 'KAM-1', Email: 'jishali@nidhiev.example' },
  ];

  it('uses the KAM email when Assigned KAM is an alternate id', () => {
    expect(resolveKamNotificationEmail(users, 'KAM-1')).toBe('jishali@nidhiev.example');
  });

  it('uses a stored email when no user row matches', () => {
    expect(resolveKamNotificationEmail([], 'jishali@nidhiev.example')).toBe(
      'jishali@nidhiev.example'
    );
  });

  it('does not invent a client address when the KAM cannot be resolved', () => {
    expect(resolveKamNotificationEmail(users, 'USER-unknown')).toBe('');
  });
});
