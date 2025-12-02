/**
 * Form Fields POST Handler
 * POSTs form field data to n8n webhook for Form Fields table
 * 
 * Fields:
 * - id (for matching)
 * - Field ID
 * - Category
 * - Field Label
 * - Field Type
 * - Field Placeholder
 * - Field Options
 * - Is Mandatory
 * - Display Order
 * - Active
 */

const FORM_FIELDS_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/FormCategory';

export interface FormFieldData {
  id?: string;
  'Field ID'?: string;
  'Category'?: string;
  'Field Label'?: string;
  'Field Type'?: string;
  'Field Placeholder'?: string;
  'Field Options'?: string;
  'Is Mandatory'?: string | boolean;
  'Display Order'?: string | number;
  'Active'?: string | boolean;
}

export interface FormFieldResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * POSTs form field data to n8n webhook
 */
export const postFormField = async (
  fieldData: FormFieldData
): Promise<FormFieldResponse> => {
  try {
    console.log('📤 POSTing form field to webhook:', FORM_FIELDS_WEBHOOK_URL);
    console.log('📋 Field data:', JSON.stringify(fieldData, null, 2));
    
    // Ensure we have an id for matching (use Field ID if id not provided)
    // The id field is required for n8n to match/upsert records
    if (!fieldData.id) {
      if (fieldData['Field ID']) {
        fieldData.id = fieldData['Field ID'];
      } else {
        // Generate a unique ID if neither is provided
        fieldData.id = `FIELD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Also set Field ID to the same value
        if (!fieldData['Field ID']) {
          fieldData['Field ID'] = fieldData.id;
        }
      }
    } else if (!fieldData['Field ID']) {
      // If id is provided but Field ID is not, use id for Field ID
      fieldData['Field ID'] = fieldData.id;
    }
    
    // Convert boolean to string if needed
    if (typeof fieldData['Is Mandatory'] === 'boolean') {
      fieldData['Is Mandatory'] = fieldData['Is Mandatory'] ? 'True' : 'False';
    }
    
    if (typeof fieldData['Active'] === 'boolean') {
      fieldData['Active'] = fieldData['Active'] ? 'True' : 'False';
    }
    
    // Convert Display Order to string if it's a number
    if (typeof fieldData['Display Order'] === 'number') {
      fieldData['Display Order'] = fieldData['Display Order'].toString();
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: FormFieldData = {
      id: fieldData.id,
      'Field ID': fieldData['Field ID'] || fieldData.id,
      'Category': fieldData['Category'] || '',
      'Field Label': fieldData['Field Label'] || '',
      'Field Type': fieldData['Field Type'] || '',
      'Field Placeholder': fieldData['Field Placeholder'] || '',
      'Field Options': fieldData['Field Options'] || '',
      'Is Mandatory': fieldData['Is Mandatory'] || 'False',
      'Display Order': fieldData['Display Order'] || '0',
      'Active': fieldData['Active'] || 'True',
    };

    const response = await fetch(FORM_FIELDS_WEBHOOK_URL, {
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
        message: 'Form field posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { 
          message: responseText || 'Form field posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ Form field posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'Form field posted successfully',
      data: result,
    };
  } catch (error: any) {
    console.error('❌ Error posting form field:', error);
    return {
      success: false,
      message: error.message || 'Failed to post form field',
      error: error,
    };
  }
};

/**
 * Helper function to create form field entry
 */
export const logFormField = async (options: {
  fieldId?: string;
  category?: string;
  fieldLabel?: string;
  fieldType?: string;
  fieldPlaceholder?: string;
  fieldOptions?: string;
  isMandatory?: string | boolean;
  displayOrder?: string | number;
  active?: string | boolean;
}): Promise<FormFieldResponse> => {
  const fieldData: FormFieldData = {
    'Field ID': options.fieldId,
    'Category': options.category || '',
    'Field Label': options.fieldLabel || '',
    'Field Type': options.fieldType || '',
    'Field Placeholder': options.fieldPlaceholder || '',
    'Field Options': options.fieldOptions || '',
    'Is Mandatory': options.isMandatory || false,
    'Display Order': options.displayOrder || 0,
    'Active': options.active !== undefined ? options.active : true,
  };

  return await postFormField(fieldData);
};

