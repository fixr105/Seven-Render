/**
 * Form Category POST Handler (File Audit Log - Webhook7)
 * POSTs file audit log data to n8n webhook for File Auditing Log table
 * 
 * Fields (from n8n schema):
 * - id (for matching)
 * - Log Entry ID
 * - File
 * - Timestamp
 * - Actor
 * - Action/Event Type
 * - Details/Message
 * - Target User/Role
 * - Resolved
 */

const FORM_CATEGORY_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/FormCategory';

export interface FormCategoryData {
  id?: string;
  'Log Entry ID'?: string;
  'File'?: string;
  'Timestamp'?: string;
  'Actor'?: string;
  'Action/Event Type'?: string;
  'Details/Message'?: string;
  'Target User/Role'?: string;
  'Resolved'?: string | boolean;
}

export interface FormCategoryResponse {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

/**
 * POSTs form category data to n8n webhook
 */
export const postFormCategory = async (
  categoryData: FormCategoryData
): Promise<FormCategoryResponse> => {
  try {
    console.log('📤 POSTing form category to webhook:', FORM_CATEGORY_WEBHOOK_URL);
    console.log('📋 Category data:', JSON.stringify(categoryData, null, 2));
    
    // Ensure we have an id for matching (use Log Entry ID if id not provided)
    // The id field is required for n8n to match/upsert records
    if (!categoryData.id) {
      if (categoryData['Log Entry ID']) {
        categoryData.id = categoryData['Log Entry ID'];
      } else {
        // Generate a unique ID if neither is provided
        categoryData.id = `CATEGORY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Also set Log Entry ID to the same value
        if (!categoryData['Log Entry ID']) {
          categoryData['Log Entry ID'] = categoryData.id;
        }
      }
    } else if (!categoryData['Log Entry ID']) {
      // If id is provided but Log Entry ID is not, use id for Log Entry ID
      categoryData['Log Entry ID'] = categoryData.id;
    }
    
    // Set timestamp if not provided
    if (!categoryData['Timestamp']) {
      categoryData['Timestamp'] = new Date().toISOString();
    }
    
    // Convert boolean to string if needed
    if (typeof categoryData['Resolved'] === 'boolean') {
      categoryData['Resolved'] = categoryData['Resolved'] ? 'True' : 'False';
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: FormCategoryData = {
      id: categoryData.id,
      'Log Entry ID': categoryData['Log Entry ID'] || categoryData.id,
      'File': categoryData['File'] || '',
      'Timestamp': categoryData['Timestamp'] || new Date().toISOString(),
      'Actor': categoryData['Actor'] || '',
      'Action/Event Type': categoryData['Action/Event Type'] || '',
      'Details/Message': categoryData['Details/Message'] || '',
      'Target User/Role': categoryData['Target User/Role'] || '',
      'Resolved': categoryData['Resolved'] || 'False',
    };

    const response = await fetch(FORM_CATEGORY_WEBHOOK_URL, {
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
        message: 'Form category posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (_e) {
        result = { 
          message: responseText || 'Form category posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ Form category posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'Form category posted successfully',
      data: result,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to post form category';
    console.error('❌ Error posting form category:', error);
    return { success: false, message, error: String(error) };
  }
};

/**
 * Helper function to create form category entry
 */
export const logFormCategory = async (options: {
  logEntryId?: string;
  file?: string;
  timestamp?: string;
  actor?: string;
  actionType?: string;
  detailsMessage?: string;
  targetUserRole?: string;
  resolved?: string | boolean;
}): Promise<FormCategoryResponse> => {
  const categoryData: FormCategoryData = {
    'Log Entry ID': options.logEntryId,
    'File': options.file || '',
    'Timestamp': options.timestamp || new Date().toISOString(),
    'Actor': options.actor || '',
    'Action/Event Type': options.actionType || '',
    'Details/Message': options.detailsMessage || '',
    'Target User/Role': options.targetUserRole || '',
    'Resolved': options.resolved || false,
  };

  return await postFormCategory(categoryData);
};

