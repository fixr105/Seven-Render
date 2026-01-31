/**
 * Auth types preserved for RBAC and services after login flow removal.
 * Re-add auth implementation when rebuilding.
 */

import { UserRole } from '../config/constants.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string | null;
  clientId?: string | null;
  kamId?: string | null;
  nbfcId?: string | null;
  creditTeamId?: string | null;
}
