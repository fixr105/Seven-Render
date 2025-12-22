/**
 * Module 0: RBAC Guard Unit Tests
 * 
 * Tests for role-based access control guards
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { UserRole } from '../../config/constants.js';
import { AuthUser } from '../../services/auth/auth.service.js';
import {
  canPerformAction,
  requireActionPermission,
  canAccessResource,
} from '../rbac.middleware.js';

describe('RBAC Guards', () => {
  let clientUser: AuthUser;
  let kamUser: AuthUser;
  let creditUser: AuthUser;
  let nbfcUser: AuthUser;

  beforeEach(() => {
    clientUser = {
      id: 'user-1',
      email: 'client@test.com',
      role: UserRole.CLIENT,
      clientId: 'client-1',
    };

    kamUser = {
      id: 'user-2',
      email: 'kam@test.com',
      role: UserRole.KAM,
      kamId: 'kam-1',
    };

    creditUser = {
      id: 'user-3',
      email: 'credit@test.com',
      role: UserRole.CREDIT,
    };

    nbfcUser = {
      id: 'user-4',
      email: 'nbfc@test.com',
      role: UserRole.NBFC,
      nbfcId: 'nbfc-1',
    };
  });

  describe('canPerformAction', () => {
    it('should return true when user has required role', () => {
      expect(canPerformAction(clientUser, UserRole.CLIENT)).toBe(true);
      expect(canPerformAction(kamUser, UserRole.KAM)).toBe(true);
      expect(canPerformAction(creditUser, UserRole.CREDIT)).toBe(true);
      expect(canPerformAction(nbfcUser, UserRole.NBFC)).toBe(true);
    });

    it('should return false when user does not have required role', () => {
      expect(canPerformAction(clientUser, UserRole.KAM)).toBe(false);
      expect(canPerformAction(kamUser, UserRole.CLIENT)).toBe(false);
      expect(canPerformAction(creditUser, UserRole.NBFC)).toBe(false);
    });

    it('should return false when user is undefined', () => {
      expect(canPerformAction(undefined, UserRole.CLIENT)).toBe(false);
    });

    it('should return true when user has one of multiple allowed roles', () => {
      expect(canPerformAction(kamUser, UserRole.KAM, UserRole.CREDIT)).toBe(true);
      expect(canPerformAction(creditUser, UserRole.KAM, UserRole.CREDIT)).toBe(true);
      expect(canPerformAction(clientUser, UserRole.KAM, UserRole.CREDIT)).toBe(false);
    });
  });

  describe('requireActionPermission', () => {
    it('should not throw when user has required role', () => {
      expect(() => requireActionPermission(clientUser, UserRole.CLIENT)).not.toThrow();
      expect(() => requireActionPermission(kamUser, UserRole.KAM)).not.toThrow();
    });

    it('should throw when user does not have required role', () => {
      expect(() => requireActionPermission(clientUser, UserRole.KAM)).toThrow('Insufficient permissions');
      expect(() => requireActionPermission(kamUser, UserRole.CLIENT)).toThrow('Insufficient permissions');
    });

    it('should throw when user is undefined', () => {
      expect(() => requireActionPermission(undefined, UserRole.CLIENT)).toThrow('Authentication required');
    });
  });

  describe('canAccessResource', () => {
    it('should return true when CLIENT accesses their own resource', () => {
      expect(canAccessResource(clientUser, 'client-1')).toBe(true);
      expect(canAccessResource(clientUser, clientUser.clientId)).toBe(true);
    });

    it('should return false when CLIENT accesses another client\'s resource', () => {
      expect(canAccessResource(clientUser, 'client-2')).toBe(false);
    });

    it('should return true when resource owner is not specified', () => {
      expect(canAccessResource(clientUser, undefined)).toBe(true);
      expect(canAccessResource(kamUser, undefined)).toBe(true);
    });

    it('should return true for KAM accessing any resource (broader access)', () => {
      expect(canAccessResource(kamUser, 'client-1')).toBe(true);
      expect(canAccessResource(kamUser, 'client-2')).toBe(true);
    });

    it('should return true for CREDIT accessing any resource (broader access)', () => {
      expect(canAccessResource(creditUser, 'client-1')).toBe(true);
    });

    it('should return false when user is undefined', () => {
      expect(canAccessResource(undefined, 'client-1')).toBe(false);
    });

    it('should handle string/number ID comparison', () => {
      expect(canAccessResource(clientUser, 'client-1', 'clientId')).toBe(true);
      expect(canAccessResource(clientUser, 123, 'clientId')).toBe(false);
    });
  });
});


