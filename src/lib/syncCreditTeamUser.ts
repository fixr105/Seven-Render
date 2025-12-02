/**
 * Utility to sync credit team user to Airtable when user_roles entry is created/updated
 * This should be called after creating or updating a user_roles entry with role='credit_team'
 */

import { supabase } from './supabase';
import { postCreditTeamUser } from './creditTeamUsersPost';

/**
 * Syncs a credit team user to Airtable
 * @param userRoleId - The id from user_roles table (not user_id)
 * @param authUserId - The user_id from auth.users (optional, for fetching email)
 */
export const syncCreditTeamUser = async (
  userRoleId: string,
  authUserId?: string
): Promise<void> => {
  try {
    // Fetch user role data
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('id', userRoleId)
      .eq('role', 'credit_team')
      .single();

    if (roleError || !userRole) {
      console.warn('Credit team user not found or not a credit_team role:', userRoleId);
      return;
    }

    // Fetch auth user data for email
    let email = '';
    let name = '';
    const userId = authUserId || userRole.user_id;

    if (userId) {
      try {
        // Try to get email from auth.users (requires admin access or RPC function)
        // For now, we'll use the userRole data and let the caller provide email if available
        const { data: authUser } = await supabase.auth.admin?.getUserById(userId);
        if (authUser?.user) {
          email = authUser.user.email || '';
          name = authUser.user.user_metadata?.name || authUser.user.user_metadata?.full_name || '';
        }
      } catch (e) {
        // If admin access not available, we'll proceed without email
        console.log('Could not fetch auth user data, proceeding without email');
      }
    }

    // POST to webhook
    await postCreditTeamUser({
      id: userRoleId,
      'Credit User ID': userRoleId,
      'Name': name || '',
      'Email': email || '',
      'Phone': '', // Phone not stored in user_roles, would need separate table
      'Role': 'credit_team',
      'Status': userRole.account_status || 'Active',
    });

    console.log('✅ Credit team user synced to Airtable:', userRoleId);
  } catch (error) {
    console.error('❌ Error syncing credit team user:', error);
    // Don't throw - this is a background sync operation
  }
};

/**
 * Syncs credit team user with provided data
 * Useful when you have all the data available
 */
export const syncCreditTeamUserWithData = async (data: {
  userRoleId: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
}): Promise<void> => {
  try {
    await postCreditTeamUser({
      id: data.userRoleId,
      'Credit User ID': data.userRoleId,
      'Name': data.name || '',
      'Email': data.email || '',
      'Phone': data.phone || '',
      'Role': 'credit_team',
      'Status': data.status || 'Active',
    });

    console.log('✅ Credit team user synced to Airtable:', data.userRoleId);
  } catch (error) {
    console.error('❌ Error syncing credit team user:', error);
  }
};

