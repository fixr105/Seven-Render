/**
 * File Audit Log POST Handler
 * POSTs file audit log data to n8n webhook for File Audit Log table
 * 
 * Fields:
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

const FILE_AUDIT_LOG_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/FILEAUDITLOGGING';

export interface FileAuditLogData {
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

export interface FileAuditLogResponse {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

/**
 * POSTs file audit log data to n8n webhook
 */
export const postFileAuditLog = async (
  auditLogData: FileAuditLogData
): Promise<FileAuditLogResponse> => {
  try {
    console.log('📤 POSTing file audit log to webhook:', FILE_AUDIT_LOG_WEBHOOK_URL);
    console.log('📋 Audit log data:', JSON.stringify(auditLogData, null, 2));
    
    // Ensure we have an id for matching (use Log Entry ID if id not provided)
    // The id field is required for n8n to match/upsert records
    if (!auditLogData.id) {
      if (auditLogData['Log Entry ID']) {
        auditLogData.id = auditLogData['Log Entry ID'];
      } else {
        // Generate a unique ID if neither is provided
        auditLogData.id = `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Also set Log Entry ID to the same value
        if (!auditLogData['Log Entry ID']) {
          auditLogData['Log Entry ID'] = auditLogData.id;
        }
      }
    } else if (!auditLogData['Log Entry ID']) {
      // If id is provided but Log Entry ID is not, use id for Log Entry ID
      auditLogData['Log Entry ID'] = auditLogData.id;
    }
    
    // Set timestamp if not provided
    if (!auditLogData['Timestamp']) {
      auditLogData['Timestamp'] = new Date().toISOString();
    }
    
    // Convert boolean to string if needed
    if (typeof auditLogData['Resolved'] === 'boolean') {
      auditLogData['Resolved'] = auditLogData['Resolved'] ? 'True' : 'False';
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: FileAuditLogData = {
      id: auditLogData.id,
      'Log Entry ID': auditLogData['Log Entry ID'] || auditLogData.id,
      'File': auditLogData['File'] || '',
      'Timestamp': auditLogData['Timestamp'] || new Date().toISOString(),
      'Actor': auditLogData['Actor'] || '',
      'Action/Event Type': auditLogData['Action/Event Type'] || '',
      'Details/Message': auditLogData['Details/Message'] || '',
      'Target User/Role': auditLogData['Target User/Role'] || '',
      'Resolved': auditLogData['Resolved'] || 'False',
    };

    const response = await fetch(FILE_AUDIT_LOG_WEBHOOK_URL, {
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
        message: 'File audit log posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (_e) {
        result = { 
          message: responseText || 'File audit log posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ File audit log posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'File audit log posted successfully',
      data: result,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to post file audit log';
    console.error('❌ Error posting file audit log:', error);
    return { success: false, message, error: String(error) };
  }
};

/**
 * Helper function to create file audit log entry
 */
export const logFileAudit = async (options: {
  logEntryId?: string;
  file?: string;
  timestamp?: string;
  actor?: string;
  actionType?: string;
  detailsMessage?: string;
  targetUserRole?: string;
  resolved?: string | boolean;
}): Promise<FileAuditLogResponse> => {
  const auditLogData: FileAuditLogData = {
    'Log Entry ID': options.logEntryId,
    'File': options.file || '',
    'Timestamp': options.timestamp || new Date().toISOString(),
    'Actor': options.actor || '',
    'Action/Event Type': options.actionType || '',
    'Details/Message': options.detailsMessage || '',
    'Target User/Role': options.targetUserRole || '',
    'Resolved': options.resolved || false,
  };

  return await postFileAuditLog(auditLogData);
};

