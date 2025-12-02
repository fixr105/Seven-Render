/**
 * Client Form Mapping POST Handler
 * POSTs client form mapping data to n8n webhook for Client Form Mapping table
 * 
 * Fields:
 * - id (for matching)
 * - Mapping ID
 * - Client
 * - Category
 * - Is Required
 * - Display Order
 */

const CLIENT_FORM_MAPPING_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/POSTCLIENTFORMMAPPING';

export interface ClientFormMappingData {
  id?: string;
  'Mapping ID'?: string;
  'Client'?: string;
  'Category'?: string;
  'Is Required'?: string | boolean;
  'Display Order'?: string | number;
}

export interface ClientFormMappingResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * POSTs client form mapping data to n8n webhook
 */
export const postClientFormMapping = async (
  mappingData: ClientFormMappingData
): Promise<ClientFormMappingResponse> => {
  try {
    console.log('📤 POSTing client form mapping to webhook:', CLIENT_FORM_MAPPING_WEBHOOK_URL);
    console.log('📋 Mapping data:', JSON.stringify(mappingData, null, 2));
    
    // Ensure we have an id for matching (use Mapping ID if id not provided)
    // The id field is required for n8n to match/upsert records
    if (!mappingData.id) {
      if (mappingData['Mapping ID']) {
        mappingData.id = mappingData['Mapping ID'];
      } else {
        // Generate a unique ID if neither is provided
        mappingData.id = `MAP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Also set Mapping ID to the same value
        if (!mappingData['Mapping ID']) {
          mappingData['Mapping ID'] = mappingData.id;
        }
      }
    } else if (!mappingData['Mapping ID']) {
      // If id is provided but Mapping ID is not, use id for Mapping ID
      mappingData['Mapping ID'] = mappingData.id;
    }
    
    // Convert boolean to string if needed
    if (typeof mappingData['Is Required'] === 'boolean') {
      mappingData['Is Required'] = mappingData['Is Required'] ? 'True' : 'False';
    }
    
    // Convert Display Order to string if it's a number
    if (typeof mappingData['Display Order'] === 'number') {
      mappingData['Display Order'] = mappingData['Display Order'].toString();
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: ClientFormMappingData = {
      id: mappingData.id,
      'Mapping ID': mappingData['Mapping ID'] || mappingData.id,
      'Client': mappingData['Client'] || '',
      'Category': mappingData['Category'] || '',
      'Is Required': mappingData['Is Required'] || 'False',
      'Display Order': mappingData['Display Order'] || '0',
    };

    const response = await fetch(CLIENT_FORM_MAPPING_WEBHOOK_URL, {
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
        message: 'Client form mapping posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { 
          message: responseText || 'Client form mapping posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ Client form mapping posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'Client form mapping posted successfully',
      data: result,
    };
  } catch (error: any) {
    console.error('❌ Error posting client form mapping:', error);
    return {
      success: false,
      message: error.message || 'Failed to post client form mapping',
      error: error,
    };
  }
};

/**
 * Helper function to create client form mapping entry
 */
export const logClientFormMapping = async (options: {
  mappingId?: string;
  client?: string;
  category?: string;
  isRequired?: string | boolean;
  displayOrder?: string | number;
}): Promise<ClientFormMappingResponse> => {
  const mappingData: ClientFormMappingData = {
    'Mapping ID': options.mappingId,
    'Client': options.client || '',
    'Category': options.category || '',
    'Is Required': options.isRequired || false,
    'Display Order': options.displayOrder || 0,
  };

  return await postClientFormMapping(mappingData);
};

