import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'client' | 'kam' | 'credit_team' | 'nbfc';

export type LoanStatus =
  | 'draft'
  | 'pending_kam_review'
  | 'kam_query_raised'
  | 'forwarded_to_credit'
  | 'credit_query_raised'
  | 'in_negotiation'
  | 'sent_to_nbfc'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'closed'
  | 'archived';

export type LenderDecisionStatus = 'Pending' | 'Approved' | 'Rejected' | 'Needs Clarification';
export type DisputeStatus = 'None' | 'Under Query' | 'Resolved';
export type AccountStatus = 'Active' | 'Locked' | 'Disabled';

export interface Database {
  public: {
    Tables: {
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          last_login: string | null;
          account_status: AccountStatus;
          created_at: string;
        };
      };
    };
  };
}
