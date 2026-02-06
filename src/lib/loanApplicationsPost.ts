/**
 * Loan Applications POST Handler
 * POSTs loan application data to n8n webhook for Loan Applications table
 * 
 * Fields:
 * - id (for matching)
 * - File ID
 * - Client
 * - Applicant Name
 * - Loan Product
 * - Requested Loan Amount
 * - Documents
 * - Status
 * - Assigned Credit Analyst
 * - Assigned NBFC
 * - Lender Decision Status
 * - Lender Decision Date
 * - Lender Decision Remarks
 * - Approved Loan Amount
 * - AI File Summary
 * - Form Data
 * - Creation Date
 * - Submitted Date
 * - Last Updated
 */

const LOAN_APPLICATIONS_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/applications';

export interface LoanApplicationData {
  id?: string;
  'File ID'?: string;
  'Client'?: string;
  'Applicant Name'?: string;
  'Loan Product'?: string;
  'Requested Loan Amount'?: string | number;
  'Documents'?: string;
  'Status'?: string;
  'Assigned Credit Analyst'?: string;
  'Assigned NBFC'?: string;
  'Lender Decision Status'?: string;
  'Lender Decision Date'?: string;
  'Lender Decision Remarks'?: string;
  'Approved Loan Amount'?: string | number;
  'AI File Summary'?: string;
  'Form Data'?: string | object;
  'Creation Date'?: string;
  'Submitted Date'?: string;
  'Last Updated'?: string;
}

export interface LoanApplicationResponse {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

/**
 * POSTs loan application data to n8n webhook
 */
export const postLoanApplication = async (
  applicationData: LoanApplicationData
): Promise<LoanApplicationResponse> => {
  try {
    console.log('📤 POSTing loan application to webhook:', LOAN_APPLICATIONS_WEBHOOK_URL);
    console.log('📋 Application data:', JSON.stringify(applicationData, null, 2));
    
    // Ensure we have an id for matching (use File ID if id not provided)
    // The id field is required for n8n to match/upsert records
    if (!applicationData.id) {
      if (applicationData['File ID']) {
        applicationData.id = applicationData['File ID'];
      } else {
        // Generate a unique ID if neither is provided
        applicationData.id = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Also set File ID to the same value
        if (!applicationData['File ID']) {
          applicationData['File ID'] = applicationData.id;
        }
      }
    } else if (!applicationData['File ID']) {
      // If id is provided but File ID is not, use id for File ID
      applicationData['File ID'] = applicationData.id;
    }
    
    // Convert Form Data object to string if needed
    if (applicationData['Form Data'] && typeof applicationData['Form Data'] === 'object') {
      applicationData['Form Data'] = JSON.stringify(applicationData['Form Data']);
    }
    
    // Set dates if not provided
    const now = new Date().toISOString();
    if (!applicationData['Creation Date']) {
      applicationData['Creation Date'] = now.split('T')[0]; // YYYY-MM-DD format
    }
    if (!applicationData['Last Updated']) {
      applicationData['Last Updated'] = now;
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: LoanApplicationData = {
      id: applicationData.id,
      'File ID': applicationData['File ID'] || applicationData.id,
      'Client': applicationData['Client'] || '',
      'Applicant Name': applicationData['Applicant Name'] || '',
      'Loan Product': applicationData['Loan Product'] || '',
      'Requested Loan Amount': applicationData['Requested Loan Amount'] || '',
      'Documents': applicationData['Documents'] || '',
      'Status': applicationData['Status'] || 'draft',
      'Assigned Credit Analyst': applicationData['Assigned Credit Analyst'] || '',
      'Assigned NBFC': applicationData['Assigned NBFC'] || '',
      'Lender Decision Status': applicationData['Lender Decision Status'] || '',
      'Lender Decision Date': applicationData['Lender Decision Date'] || '',
      'Lender Decision Remarks': applicationData['Lender Decision Remarks'] || '',
      'Approved Loan Amount': applicationData['Approved Loan Amount'] || '',
      'AI File Summary': applicationData['AI File Summary'] || '',
      'Form Data': applicationData['Form Data'] || '',
      'Creation Date': applicationData['Creation Date'] || now.split('T')[0],
      'Submitted Date': applicationData['Submitted Date'] || '',
      'Last Updated': applicationData['Last Updated'] || now,
    };

    const response = await fetch(LOAN_APPLICATIONS_WEBHOOK_URL, {
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
        message: 'Loan application posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (_e) {
        result = { 
          message: responseText || 'Loan application posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ Loan application posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'Loan application posted successfully',
      data: result,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to post loan application';
    console.error('❌ Error posting loan application:', error);
    return {
      success: false,
      message,
      error: String(error),
    };
  }
};

/**
 * Helper function to create loan application entry
 */
export const logLoanApplication = async (options: {
  fileId?: string;
  client?: string;
  applicantName?: string;
  loanProduct?: string;
  requestedLoanAmount?: string | number;
  documents?: string;
  status?: string;
  assignedCreditAnalyst?: string;
  assignedNBFC?: string;
  lenderDecisionStatus?: string;
  lenderDecisionDate?: string;
  lenderDecisionRemarks?: string;
  approvedLoanAmount?: string | number;
  aiFileSummary?: string;
  formData?: string | object;
  creationDate?: string;
  submittedDate?: string;
  lastUpdated?: string;
}): Promise<LoanApplicationResponse> => {
  const applicationData: LoanApplicationData = {
    'File ID': options.fileId,
    'Client': options.client || '',
    'Applicant Name': options.applicantName || '',
    'Loan Product': options.loanProduct || '',
    'Requested Loan Amount': options.requestedLoanAmount || '',
    'Documents': options.documents || '',
    'Status': options.status || 'draft',
    'Assigned Credit Analyst': options.assignedCreditAnalyst || '',
    'Assigned NBFC': options.assignedNBFC || '',
    'Lender Decision Status': options.lenderDecisionStatus || '',
    'Lender Decision Date': options.lenderDecisionDate || '',
    'Lender Decision Remarks': options.lenderDecisionRemarks || '',
    'Approved Loan Amount': options.approvedLoanAmount || '',
    'AI File Summary': options.aiFileSummary || '',
    'Form Data': options.formData || '',
    'Creation Date': options.creationDate || new Date().toISOString().split('T')[0],
    'Submitted Date': options.submittedDate || '',
    'Last Updated': options.lastUpdated || new Date().toISOString(),
  };

  return await postLoanApplication(applicationData);
};

