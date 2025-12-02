/**
 * Admin Activity Log POST Handler
 * POSTs admin activity data to n8n webhook for Admin Activity Log table
 * 
 * Fields:
 * - id (for matching)
 * - Activity ID
 * - Timestamp
 * - Performed By
 * - Action Type
 * - Description/Details
 * - Target Entity
 */

const POST_LOG_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/POSTLOG';

export interface AdminActivityLogData {
  id?: string;
  'Activity ID'?: string;
  'Timestamp'?: string;
  'Performed By'?: string;
  'Action Type'?: string;
  'Description/Details'?: string;
  'Target Entity'?: string;
}

export interface AdminActivityLogResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * POSTs admin activity data to n8n webhook
 */
export const postAdminActivityLog = async (
  activityData: AdminActivityLogData
): Promise<AdminActivityLogResponse> => {
  try {
    console.log('📤 POSTing admin activity to log webhook:', POST_LOG_WEBHOOK_URL);
    console.log('📋 Activity data:', JSON.stringify(activityData, null, 2));
    
    // Validate required fields
    if (!activityData['Action Type']) {
      throw new Error('Action Type is required for admin activity log');
    }
    
    // Ensure we have an id for matching (use Activity ID if id not provided)
    // The id field is required for n8n to match/upsert records
    if (!activityData.id) {
      if (activityData['Activity ID']) {
        activityData.id = activityData['Activity ID'];
      } else {
        // Generate a unique ID if neither is provided
        activityData.id = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Also set Activity ID to the same value
        if (!activityData['Activity ID']) {
          activityData['Activity ID'] = activityData.id;
        }
      }
    } else if (!activityData['Activity ID']) {
      // If id is provided but Activity ID is not, use id for Activity ID
      activityData['Activity ID'] = activityData.id;
    }
    
    // Set timestamp if not provided
    if (!activityData['Timestamp']) {
      activityData['Timestamp'] = new Date().toISOString();
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: AdminActivityLogData = {
      id: activityData.id,
      'Activity ID': activityData['Activity ID'] || activityData.id,
      'Timestamp': activityData['Timestamp'] || new Date().toISOString(),
      'Performed By': activityData['Performed By'] || '',
      'Action Type': activityData['Action Type'] || '',
      'Description/Details': activityData['Description/Details'] || '',
      'Target Entity': activityData['Target Entity'] || '',
    };

    const response = await fetch(POST_LOG_WEBHOOK_URL, {
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
        message: 'Admin activity logged successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { 
          message: responseText || 'Admin activity logged successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ Admin activity logged successfully. Response:', result);
    
    return {
      success: true,
      message: 'Admin activity logged successfully',
      data: result,
    };
  } catch (error: any) {
    console.error('❌ Error posting admin activity log:', error);
    return {
      success: false,
      message: error.message || 'Failed to post admin activity log',
      error: error,
    };
  }
};

/**
 * Helper function to create admin activity log entry
 */
export const logAdminActivity = async (options: {
  actionType: string;
  performedBy?: string;
  description?: string;
  targetEntity?: string;
  activityId?: string;
  timestamp?: string;
}): Promise<AdminActivityLogResponse> => {
  const activityData: AdminActivityLogData = {
    'Action Type': options.actionType,
    'Performed By': options.performedBy || 'System',
    'Description/Details': options.description || '',
    'Target Entity': options.targetEntity || '',
    'Activity ID': options.activityId,
    'Timestamp': options.timestamp || new Date().toISOString(),
  };

  return await postAdminActivityLog(activityData);
};

