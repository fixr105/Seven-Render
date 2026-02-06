/**
 * Auth types for frontend (stub; rebuild auth as needed).
 */

export type UserRole = 'client' | 'kam' | 'credit_team' | 'nbfc' | 'admin';

export interface UserContext {
  id: string;
  email: string;
  role: UserRole;
  name?: string | null;
  phone?: string | null;
  company?: string | null;
  clientId?: string | null;
  kamId?: string | null;
  nbfcId?: string | null;
  creditTeamId?: string | null;
  /** For client role: enabled modules (e.g. M1, M2) from Clients record. Used to hide Ledger when M1 is disabled. */
  enabledModules?: string[];
}
