/**
 * Auth types for frontend (stub; rebuild auth as needed).
 */

export type UserRole = 'client' | 'kam' | 'credit_team' | 'nbfc' | 'admin';

export interface UserContext {
  id: string;
  email: string;
  role: UserRole;
  name?: string | null;
  clientId?: string | null;
  kamId?: string | null;
  nbfcId?: string | null;
  creditTeamId?: string | null;
}
