import { describe, expect, it } from 'vitest';
import { getProfileCompletion, getRequiredProfileFields } from '../profileCompletion';
import { UserContext } from '../types';

const baseUser: UserContext = {
  id: 'u1',
  email: 'user@test.com',
  role: 'kam',
  name: 'Kam User',
  phone: '+919876543210',
};

describe('profileCompletion', () => {
  it('requires name and phone for non-client/nbfc roles', () => {
    expect(getRequiredProfileFields(baseUser)).toEqual(['name', 'phone']);
  });

  it('requires company for client and nbfc roles', () => {
    const clientUser: UserContext = { ...baseUser, role: 'client' };
    const nbfcUser: UserContext = { ...baseUser, role: 'nbfc' };
    expect(getRequiredProfileFields(clientUser)).toEqual(['name', 'phone', 'company']);
    expect(getRequiredProfileFields(nbfcUser)).toEqual(['name', 'phone', 'company']);
  });

  it('detects missing fields based on role', () => {
    const creditUser: UserContext = { ...baseUser, role: 'credit_team', phone: '' };
    const clientUser: UserContext = { ...baseUser, role: 'client', company: '' };
    expect(getProfileCompletion(creditUser)).toEqual({
      isComplete: false,
      missingFields: ['phone'],
    });
    expect(getProfileCompletion(clientUser)).toEqual({
      isComplete: false,
      missingFields: ['company'],
    });
  });
});
