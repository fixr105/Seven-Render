/**
 * NBFC Partners POST Handler
 * POSTs NBFC partner data to n8n webhook for NBFC Partners table
 * 
 * Fields:
 * - id (for matching)
 * - Lender ID
 * - Lender Name
 * - Contact Person
 * - Contact Email/Phone
 * - Address/Region
 * - Active
 */

const NBFC_PARTNERS_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/applications';

export interface NBFCPartnerData {
  id?: string;
  'Lender ID'?: string;
  'Lender Name'?: string;
  'Contact Person'?: string;
  'Contact Email/Phone'?: string;
  'Address/Region'?: string;
  'Active'?: string | boolean;
}

export interface NBFCPartnerResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * POSTs NBFC partner data to n8n webhook
 */
export const postNBFCPartner = async (
  partnerData: NBFCPartnerData
): Promise<NBFCPartnerResponse> => {
  try {
    console.log('📤 POSTing NBFC partner to webhook:', NBFC_PARTNERS_WEBHOOK_URL);
    console.log('📋 Partner data:', JSON.stringify(partnerData, null, 2));
    
    // Ensure we have an id for matching (use Lender ID if id not provided)
    // The id field is required for n8n to match/upsert records
    if (!partnerData.id) {
      if (partnerData['Lender ID']) {
        partnerData.id = partnerData['Lender ID'];
      } else {
        // Generate a unique ID if neither is provided
        partnerData.id = `NBFC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Also set Lender ID to the same value
        if (!partnerData['Lender ID']) {
          partnerData['Lender ID'] = partnerData.id;
        }
      }
    } else if (!partnerData['Lender ID']) {
      // If id is provided but Lender ID is not, use id for Lender ID
      partnerData['Lender ID'] = partnerData.id;
    }
    
    // Convert boolean to string if needed
    if (typeof partnerData['Active'] === 'boolean') {
      partnerData['Active'] = partnerData['Active'] ? 'True' : 'False';
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: NBFCPartnerData = {
      id: partnerData.id,
      'Lender ID': partnerData['Lender ID'] || partnerData.id,
      'Lender Name': partnerData['Lender Name'] || '',
      'Contact Person': partnerData['Contact Person'] || '',
      'Contact Email/Phone': partnerData['Contact Email/Phone'] || '',
      'Address/Region': partnerData['Address/Region'] || '',
      'Active': partnerData['Active'] || 'True',
    };

    const response = await fetch(NBFC_PARTNERS_WEBHOOK_URL, {
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
        message: 'NBFC partner posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { 
          message: responseText || 'NBFC partner posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ NBFC partner posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'NBFC partner posted successfully',
      data: result,
    };
  } catch (error: any) {
    console.error('❌ Error posting NBFC partner:', error);
    return {
      success: false,
      message: error.message || 'Failed to post NBFC partner',
      error: error,
    };
  }
};

/**
 * Helper function to create NBFC partner entry
 */
export const logNBFCPartner = async (options: {
  lenderId?: string;
  lenderName?: string;
  contactPerson?: string;
  contactEmailPhone?: string;
  addressRegion?: string;
  active?: string | boolean;
}): Promise<NBFCPartnerResponse> => {
  const partnerData: NBFCPartnerData = {
    'Lender ID': options.lenderId,
    'Lender Name': options.lenderName || '',
    'Contact Person': options.contactPerson || '',
    'Contact Email/Phone': options.contactEmailPhone || '',
    'Address/Region': options.addressRegion || '',
    'Active': options.active !== undefined ? options.active : true,
  };

  return await postNBFCPartner(partnerData);
};

