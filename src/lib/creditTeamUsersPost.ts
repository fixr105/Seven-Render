/**
 * Credit Team Users POST Handler
 * POSTs credit team user data to n8n webhook for Credit Team Users table
 * 
 * Fields (from Airtable schema):
 * - id (for matching)
 * - Credit User ID
 * - Name
 * - Email
 * - Phone
 * - Role
 * - Status
 */

const CREDIT_TEAM_USERS_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/CREDITTEAMUSERS';

export interface CreditTeamUserData {
  id?: string;
  'Credit User ID'?: string;
  'Name'?: string;
  'Email'?: string;
  'Phone'?: string;
  'Role'?: string;
  'Status'?: string;
}

export interface CreditTeamUserResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * POSTs credit team user data to n8n webhook
 */
export const postCreditTeamUser = async (
  userData: CreditTeamUserData
): Promise<CreditTeamUserResponse> => {
  try {
    console.log('📤 POSTing credit team user to webhook:', CREDIT_TEAM_USERS_WEBHOOK_URL);
    console.log('📋 User data:', JSON.stringify(userData, null, 2));
    
    // Ensure we have an id for matching (use Credit User ID if id not provided)
    // The id field is required for n8n to match/upsert records
    if (!userData.id) {
      if (userData['Credit User ID']) {
        userData.id = userData['Credit User ID'];
      } else {
        // Generate a unique ID if neither is provided
        userData.id = `CREDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Also set Credit User ID to the same value
        if (!userData['Credit User ID']) {
          userData['Credit User ID'] = userData.id;
        }
      }
    } else if (!userData['Credit User ID']) {
      // If id is provided but Credit User ID is not, use id for Credit User ID
      userData['Credit User ID'] = userData.id;
    }
    
    // Ensure Role is set to 'credit_team' if not provided
    if (!userData['Role']) {
      userData['Role'] = 'credit_team';
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: CreditTeamUserData = {
      id: userData.id,
      'Credit User ID': userData['Credit User ID'] || userData.id,
      'Name': userData['Name'] || '',
      'Email': userData['Email'] || '',
      'Phone': userData['Phone'] || '',
      'Role': userData['Role'] || 'credit_team',
      'Status': userData['Status'] || 'Active',
    };

    const response = await fetch(CREDIT_TEAM_USERS_WEBHOOK_URL, {
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
        message: 'Credit team user posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { 
          message: responseText || 'Credit team user posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ Credit team user posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'Credit team user posted successfully',
      data: result,
    };
  } catch (error: any) {
    console.error('❌ Error posting credit team user:', error);
    return {
      success: false,
      message: error.message || 'Failed to post credit team user',
      error: error,
    };
  }
};

/**
 * Helper function to create/update credit team user entry
 */
export const logCreditTeamUser = async (options: {
  creditUserId?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
}): Promise<CreditTeamUserResponse> => {
  const userData: CreditTeamUserData = {
    'Credit User ID': options.creditUserId,
    'Name': options.name || '',
    'Email': options.email || '',
    'Phone': options.phone || '',
    'Role': options.role || 'credit_team',
    'Status': options.status || 'Active',
  };

  return await postCreditTeamUser(userData);
};

