/**
 * Commission Ledger POST Handler
 * POSTs commission ledger data to n8n webhook for Commission Ledger table
 * 
 * Fields (from Airtable schema):
 * - id (for matching)
 * - Ledger Entry ID
 * - Client
 * - Loan File
 * - Date
 * - Disbursed Amount
 * - Commission Rate
 * - Payout Amount
 * - Description
 * - Dispute Status
 * - Payout Request
 */

const COMMISSION_LEDGER_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/COMISSIONLEDGER';

export interface CommissionLedgerData {
  id?: string;
  'Ledger Entry ID'?: string;
  'Client'?: string;
  'Loan File'?: string;
  'Date'?: string;
  'Disbursed Amount'?: string | number;
  'Commission Rate'?: string | number;
  'Payout Amount'?: string | number;
  'Description'?: string;
  'Dispute Status'?: string;
  'Payout Request'?: string | boolean;
}

export interface CommissionLedgerResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * POSTs commission ledger data to n8n webhook
 */
export const postCommissionLedger = async (
  ledgerData: CommissionLedgerData
): Promise<CommissionLedgerResponse> => {
  try {
    console.log('📤 POSTing commission ledger to webhook:', COMMISSION_LEDGER_WEBHOOK_URL);
    console.log('📋 Ledger data:', JSON.stringify(ledgerData, null, 2));
    
    // Ensure we have an id for matching (use Ledger Entry ID if id not provided)
    // The id field is required for n8n to match/upsert records
    if (!ledgerData.id) {
      if (ledgerData['Ledger Entry ID']) {
        ledgerData.id = ledgerData['Ledger Entry ID'];
      } else {
        // Generate a unique ID if neither is provided
        ledgerData.id = `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Also set Ledger Entry ID to the same value
        if (!ledgerData['Ledger Entry ID']) {
          ledgerData['Ledger Entry ID'] = ledgerData.id;
        }
      }
    } else if (!ledgerData['Ledger Entry ID']) {
      // If id is provided but Ledger Entry ID is not, use id for Ledger Entry ID
      ledgerData['Ledger Entry ID'] = ledgerData.id;
    }
    
    // Set date if not provided
    if (!ledgerData['Date']) {
      ledgerData['Date'] = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    
    // Convert boolean to string if needed
    if (typeof ledgerData['Payout Request'] === 'boolean') {
      ledgerData['Payout Request'] = ledgerData['Payout Request'] ? 'True' : 'False';
    }
    
    // Ensure all required fields are present (even if empty)
    // This helps n8n map the fields correctly
    const completeData: CommissionLedgerData = {
      id: ledgerData.id,
      'Ledger Entry ID': ledgerData['Ledger Entry ID'] || ledgerData.id,
      'Client': ledgerData['Client'] || '',
      'Loan File': ledgerData['Loan File'] || '',
      'Date': ledgerData['Date'] || new Date().toISOString().split('T')[0],
      'Disbursed Amount': ledgerData['Disbursed Amount'] || '',
      'Commission Rate': ledgerData['Commission Rate'] || '',
      'Payout Amount': ledgerData['Payout Amount'] || '',
      'Description': ledgerData['Description'] || '',
      'Dispute Status': ledgerData['Dispute Status'] || 'None',
      'Payout Request': ledgerData['Payout Request'] || 'False',
    };

    const response = await fetch(COMMISSION_LEDGER_WEBHOOK_URL, {
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
        message: 'Commission ledger entry posted successfully (empty response from n8n)', 
        status: response.status 
      };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { 
          message: responseText || 'Commission ledger entry posted successfully', 
          status: response.status 
        };
      }
    }
    
    console.log('✅ Commission ledger entry posted successfully. Response:', result);
    
    return {
      success: true,
      message: 'Commission ledger entry posted successfully',
      data: result,
    };
  } catch (error: any) {
    console.error('❌ Error posting commission ledger:', error);
    return {
      success: false,
      message: error.message || 'Failed to post commission ledger entry',
      error: error,
    };
  }
};

/**
 * Helper function to create commission ledger entry
 */
export const logCommissionLedger = async (options: {
  ledgerEntryId?: string;
  client?: string;
  loanFile?: string;
  date?: string;
  disbursedAmount?: string | number;
  commissionRate?: string | number;
  payoutAmount?: string | number;
  description?: string;
  disputeStatus?: string;
  payoutRequest?: string | boolean;
}): Promise<CommissionLedgerResponse> => {
  const ledgerData: CommissionLedgerData = {
    'Ledger Entry ID': options.ledgerEntryId,
    'Client': options.client || '',
    'Loan File': options.loanFile || '',
    'Date': options.date || new Date().toISOString().split('T')[0],
    'Disbursed Amount': options.disbursedAmount || '',
    'Commission Rate': options.commissionRate || '',
    'Payout Amount': options.payoutAmount || '',
    'Description': options.description || '',
    'Dispute Status': options.disputeStatus || 'None',
    'Payout Request': options.payoutRequest || false,
  };

  return await postCommissionLedger(ledgerData);
};

