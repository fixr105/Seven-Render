/**
 * Form Categories POST Handler
 * POSTs form category data to n8n webhook for Form Categories table
 * 
 * Fields (from n8n schema):
 * - id (for matching)
 * - Category ID
 * - Category Name
 * - Description
 * - Display Order
 * - Active
 */

const FORM_CATEGORIES_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/FormCategory';

export interface FormCategoryData {
  id?: string;
  'Category ID'?: string;
  'Category Name'?: string;
  'Description'?: string;
  'Display Order'?: string | number;
  'Active'?: string | boolean;
}

export interface FormCategoryResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * POSTs form category data to n8n webhook
 */
export const postFormCategory = async (
  categoryData: FormCategoryData
): Promise<FormCategoryResponse> => {
  try {
    console.log('📤 POSTing form category to webhook:', FORM_CATEGORIES_WEBHOOK_URL);
    console.log('📋 Category data:', JSON.stringify(categoryData, null, 2));
    
    // Ensure we have an id for matching (use Category ID if id not provided)
    if (!categoryData.id) {
      if (categoryData['Category ID']) {
        categoryData.id = categoryData['Category ID'];
      } else {
        categoryData.id = `CAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        if (!categoryData['Category ID']) {
          categoryData['Category ID'] = categoryData.id;
        }
      }
    } else if (!categoryData['Category ID']) {
      categoryData['Category ID'] = categoryData.id;
    }
    
    // Convert boolean to string if needed
    if (typeof categoryData['Active'] === 'boolean') {
      categoryData['Active'] = categoryData['Active'] ? 'True' : 'False';
    }
    
    // Convert Display Order to string if it's a number
    if (typeof categoryData['Display Order'] === 'number') {
      categoryData['Display Order'] = categoryData['Display Order'].toString();
    }
    
    // Send ONLY the fields defined in n8n schema
    const completeData: FormCategoryData = {
      id: categoryData.id,
      'Category ID': categoryData['Category ID'] || categoryData.id,
      'Category Name': categoryData['Category Name'] || '',
      'Description': categoryData['Description'] || '',
      'Display Order': categoryData['Display Order'] || '0',
      'Active': categoryData['Active'] || 'True',
    };

    const response = await fetch(FORM_CATEGORIES_WEBHOOK_URL, {
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
      } catch (e) {
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
  } catch (error: any) {
    console.error('❌ Error posting form category:', error);
    return {
      success: false,
      message: error.message || 'Failed to post form category',
      error: error,
    };
  }
};

