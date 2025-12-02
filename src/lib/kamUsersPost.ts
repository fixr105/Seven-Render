/**
 * KAM Users POST Handler
 * POSTs KAM user data to n8n webhook for KAM Users table
 * 
 * Fields:
 * - id (for matching)
 * - KAM ID
 * - Name
 * - Email
 * - Phone
 * - Managed Clients
 * - Role
 * - Status
 */

const KAM_USERS_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/KAMusers';

export interface KAMUserData {
  id?: string;
  'KAM ID'?: string;
  'Name'?: string;
  'Email'?: string;
  'Phone'?: string;
  'Managed Clients'?: string;
  'Role'?: string;
  'Status'?: string;
}

export interface KAMUserResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * POSTs KAM user data to n8n webhook
 */
export const postKAMUser = async (
  userData: KAMUserData
): Promise<KAMUserResponse> => {
  try {
    console.log('📤 POSTing KAM user to webhook:', KAM_USERS_WEBHOOK_URL);
    console.log('📋 User data:', JSON.stringify(userData, null, 2));
    
    // Ensure we have an id for matching (use KAM ID if id not provided)
    // The id field is required for n8n to match/upsert records
    if (!userData.id) {
      if (userData['KAM ID']) {
        userData.id = userData['KAM ID'];
      } else {
        // Generate a unique ID if neither is provided
        userData.id = `KAM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Also set KAM ID to the same value
        if (!userData['KAM ID']) {
          userData['KAM ID'] = userData.id;
        }
      }
    } else if (!userData['KAM ID']) {
      // If id is provided but KAM ID is not, use id for KAM ID
      userData['KAM ID'] = userData.id;
    }
    
    // Ensure Role is set to 'kam' if not provided
    if (!userData['Role']) {
      userData['Role'] = 'kam';
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: KAMUserData = {
      id: userData.id,
      'KAM ID': userData['KAM ID'] || userData.id,
      'Name': userData['Name'] || '',
      'Email': userData['Email'] || '',
      'Phone': userData['Phone'] || '',
      'Managed Clients': userData['Managed Clients'] || '',
      'Role': userData['Role'] || 'kam',
      'Status': userData['Status'] || 'Active',
    };

    const response = await fetch(KAM_USERS_WEBHOOK_URL, {
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
        message: 'KAM user posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { 
          message: responseText || 'KAM user posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ KAM user posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'KAM user posted successfully',
      data: result,
    };
  } catch (error: any) {
    console.error('❌ Error posting KAM user:', error);
    return {
      success: false,
      message: error.message || 'Failed to post KAM user',
      error: error,
    };
  }
};

/**
 * Helper function to create/update KAM user entry
 */
export const logKAMUser = async (options: {
  kamId?: string;
  name?: string;
  email?: string;
  phone?: string;
  managedClients?: string;
  role?: string;
  status?: string;
}): Promise<KAMUserResponse> => {
  const userData: KAMUserData = {
    'KAM ID': options.kamId,
    'Name': options.name || '',
    'Email': options.email || '',
    'Phone': options.phone || '',
    'Managed Clients': options.managedClients || '',
    'Role': options.role || 'kam',
    'Status': options.status || 'Active',
  };

  return await postKAMUser(userData);
};

