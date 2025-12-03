// Supabase is deprecated - use backend API instead
// This file is kept for backward compatibility during migration
// It no longer throws errors if Supabase env vars are missing

let supabaseClient: any = null;

// Check if we should use API auth (default: true)
const useApiAuth = import.meta.env.VITE_USE_API_AUTH !== 'false';

if (!useApiAuth) {
  // Only try to initialize Supabase if explicitly disabled API auth
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      // Only import Supabase if env vars are present
      const { createClient } = require('@supabase/supabase-js');
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    } else {
      // Create a mock client that doesn't throw errors
      console.warn('Supabase environment variables not set. Using backend API instead.');
      supabaseClient = createMockSupabase();
    }
  } catch (error) {
    // Supabase package not installed or error loading
    console.warn('Supabase not available. Using backend API instead.');
    supabaseClient = createMockSupabase();
  }
} else {
  // Default to mock client when using API auth
  supabaseClient = createMockSupabase();
}

function createMockSupabase() {
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ error: { message: 'Use backend API for authentication' } }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      resetPasswordForEmail: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
        }),
        order: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      insert: () => Promise.resolve({ data: null, error: { message: 'Use backend API' } }),
      update: () => Promise.resolve({ data: null, error: { message: 'Use backend API' } }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: () => ({
          unsubscribe: () => {},
        }),
      }),
    }),
  };
}

export const supabase = supabaseClient;

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
