/**
 * Daily Summary Reports POST Handler
 * POSTs daily summary report data to n8n webhook for Daily Summary Reports table
 * 
 * Fields (from Airtable schema):
 * - id (for matching)
 * - Report Date
 * - Summary Content
 * - Generated Timestamp
 * - Delivered To
 */

const DAILY_SUMMARY_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/DAILYSUMMARY';

export interface DailySummaryData {
  id?: string;
  'Report Date'?: string;
  'Summary Content'?: string;
  'Generated Timestamp'?: string;
  'Delivered To'?: string | string[];
}

export interface DailySummaryResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * POSTs daily summary report data to n8n webhook
 */
export const postDailySummary = async (
  summaryData: DailySummaryData
): Promise<DailySummaryResponse> => {
  try {
    console.log('📤 POSTing daily summary to webhook:', DAILY_SUMMARY_WEBHOOK_URL);
    console.log('📋 Summary data:', JSON.stringify(summaryData, null, 2));
    
    // Ensure we have an id for matching
    // The id field is required for n8n to match/upsert records
    if (!summaryData.id) {
      // Generate a unique ID based on report date or timestamp
      const reportDate = summaryData['Report Date'] || new Date().toISOString().split('T')[0];
      summaryData.id = `SUMMARY-${reportDate.replace(/-/g, '')}-${Date.now()}`;
    }
    
    // Set report date if not provided (default to today)
    if (!summaryData['Report Date']) {
      summaryData['Report Date'] = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    
    // Set generated timestamp if not provided
    if (!summaryData['Generated Timestamp']) {
      summaryData['Generated Timestamp'] = new Date().toISOString();
    }
    
    // Convert Delivered To array to string if needed (n8n might expect string or array)
    let deliveredTo = summaryData['Delivered To'];
    if (Array.isArray(deliveredTo)) {
      // Keep as array for JSON, but ensure it's properly formatted
      deliveredTo = deliveredTo.length > 0 ? deliveredTo : ['Dashboard'];
    } else if (!deliveredTo) {
      deliveredTo = 'Dashboard';
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: DailySummaryData = {
      id: summaryData.id,
      'Report Date': summaryData['Report Date'] || new Date().toISOString().split('T')[0],
      'Summary Content': summaryData['Summary Content'] || '',
      'Generated Timestamp': summaryData['Generated Timestamp'] || new Date().toISOString(),
      'Delivered To': deliveredTo,
    };

    const response = await fetch(DAILY_SUMMARY_WEBHOOK_URL, {
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
        message: 'Daily summary posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { 
          message: responseText || 'Daily summary posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ Daily summary posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'Daily summary posted successfully',
      data: result,
    };
  } catch (error: any) {
    console.error('❌ Error posting daily summary:', error);
    return {
      success: false,
      message: error.message || 'Failed to post daily summary',
      error: error,
    };
  }
};

/**
 * Helper function to create daily summary report entry
 */
export const logDailySummary = async (options: {
  reportDate?: string;
  summaryContent?: string;
  generatedTimestamp?: string;
  deliveredTo?: string | string[];
}): Promise<DailySummaryResponse> => {
  const summaryData: DailySummaryData = {
    'Report Date': options.reportDate || new Date().toISOString().split('T')[0],
    'Summary Content': options.summaryContent || '',
    'Generated Timestamp': options.generatedTimestamp || new Date().toISOString(),
    'Delivered To': options.deliveredTo || ['Dashboard'],
  };

  return await postDailySummary(summaryData);
};

