/**
 * User Accounts POST Handler
 * POSTs user account data to n8n webhook for User Accounts table
 * 
 * Fields:
 * - id (for matching)
 * - Username
 * - Password
 * - Role
 * - Associated Profile
 * - Last Login
 * - Account Status
 */

const USER_ACCOUNTS_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/adduser';

export interface UserAccountData {
  id?: string;
  'Username'?: string;
  'Password'?: string;
  'Role'?: string;
  'Associated Profile'?: string;
  'Last Login'?: string;
  'Account Status'?: string;
}

export interface UserAccountResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * POSTs user account data to n8n webhook
 */
export const postUserAccount = async (
  accountData: UserAccountData
): Promise<UserAccountResponse> => {
  try {
    console.log('📤 POSTing user account to webhook:', USER_ACCOUNTS_WEBHOOK_URL);
    console.log('📋 Account data:', JSON.stringify(accountData, null, 2));
    
    // Ensure we have an id for matching
    // The id field is required for n8n to match/upsert records
    if (!accountData.id) {
      // Generate a unique ID if not provided
      accountData.id = `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Set Last Login if not provided (can be empty)
    // Set Account Status default if not provided
    if (!accountData['Account Status']) {
      accountData['Account Status'] = 'Active';
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: UserAccountData = {
      id: accountData.id,
      'Username': accountData['Username'] || '',
      'Password': accountData['Password'] || '',
      'Role': accountData['Role'] || '',
      'Associated Profile': accountData['Associated Profile'] || '',
      'Last Login': accountData['Last Login'] || '',
      'Account Status': accountData['Account Status'] || 'Active',
    };

    const response = await fetch(USER_ACCOUNTS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(completeData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`POST webhook returned status ${response.status}: ${response.statusText}. Response: ${errorText}`);
    }

    // Handle response
    const responseText = await response.text();
    let result;
    
    if (responseText.trim() === '') {
      result = { 
        success: true,
        message: 'User account posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { 
          message: responseText || 'User account posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ User account posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'User account posted successfully',
      data: result,
    };
  } catch (error: any) {
    console.error('❌ Error posting user account:', error);
    return {
      success: false,
      message: error.message || 'Failed to post user account',
      error: error,
    };
  }
};

/**
 * Helper function to create user account entry
 */
export const logUserAccount = async (options: {
  username?: string;
  password?: string;
  role?: string;
  associatedProfile?: string;
  lastLogin?: string;
  accountStatus?: string;
}): Promise<UserAccountResponse> => {
  const accountData: UserAccountData = {
    'Username': options.username || '',
    'Password': options.password || '',
    'Role': options.role || '',
    'Associated Profile': options.associatedProfile || '',
    'Last Login': options.lastLogin || '',
    'Account Status': options.accountStatus || 'Active',
  };

  return await postUserAccount(accountData);
};

