/**
 * n8n Webhook Client
 * Handles GET and POST requests to n8n webhooks
 */

import fetch from 'node-fetch';
import { n8nConfig } from '../../config/airtable.js';
import { N8nGetResponse, UserAccount } from '../../types/entities.js';

export class N8nClient {
  /**
   * GET all data from Airtable via n8n
   */
  async getAllData(): Promise<N8nGetResponse> {
    try {
      const response = await fetch(n8nConfig.getWebhookUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`n8n GET webhook failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle case where response might be an array (e.g., User Accounts, Notifications, etc.)
      // or an object with table names as keys
      if (Array.isArray(data)) {
        if (data.length === 0) {
          // Empty array, return empty object
          return {} as N8nGetResponse;
        }

        // The GET webhook returns a mixed array with records from all tables
        // We need to group them by table type based on field detection
        const grouped: any = {
          'User Accounts': [],
          'Notifications': [],
          'Loan Applications': [],
          'Clients': [],
          'KAM Users': [],
          'Credit Team Users': [],
          'NBFC Partners': [],
          'Loan Products': [],
          'Form Categories': [],
          'Form Fields': [],
          'File Audit Log': [],
          'Admin Activity log': [],
          'COMISSIONLEDGER': [],
          'Daily Summary Reports': [],
          'Client Form Mapping': [],
        };

        // Process each record and categorize it
        for (const record of data) {
          const item = record as any;
          
          // Skip records with only id and createdTime (empty records)
          const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'createdTime');
          if (keys.length === 0) {
            continue; // Skip empty records
          }

          // Detect table type based on unique identifier fields (check in priority order)
          if (item.Username !== undefined) {
            grouped['User Accounts'].push(item);
          } else if (item['Notification ID'] !== undefined || item['Recipient User'] !== undefined) {
            grouped['Notifications'].push(item);
          } else if (item['File ID'] !== undefined || item['Client'] !== undefined) {
            grouped['Loan Applications'].push(item);
          } else if (item['Client ID'] !== undefined || item['Client Name'] !== undefined) {
            grouped['Clients'].push(item);
          } else if (item['KAM ID'] !== undefined || (item.Email !== undefined && item.Name !== undefined && (item.Role === 'KAM' || item.Role === 'kam'))) {
            grouped['KAM Users'].push(item);
          } else if (item['Credit User ID'] !== undefined || (item.Email !== undefined && item.Name !== undefined && (item.Role === 'Credit' || item.Role === 'credit_team'))) {
            grouped['Credit Team Users'].push(item);
          } else if (item['Lender ID'] !== undefined || item['Lender Name'] !== undefined) {
            grouped['NBFC Partners'].push(item);
          } else if (item['Product ID'] !== undefined || item['Product Name'] !== undefined) {
            grouped['Loan Products'].push(item);
          } else if (item['Category ID'] !== undefined || item['Category Name'] !== undefined) {
            grouped['Form Categories'].push(item);
          } else if (item['Field ID'] !== undefined || item['Field Label'] !== undefined) {
            grouped['Form Fields'].push(item);
          } else if (item['Log Entry ID'] !== undefined || item['Action/Event Type'] !== undefined) {
            grouped['File Audit Log'].push(item);
          } else if (item['Activity ID'] !== undefined || item['Performed By'] !== undefined) {
            grouped['Admin Activity log'].push(item);
          } else if (item['Entry ID'] !== undefined || item['Transaction Type'] !== undefined || item['Ledger Entry ID'] !== undefined) {
            grouped['COMISSIONLEDGER'].push(item);
          } else if (item['Report Date'] !== undefined || item['Summary Content'] !== undefined) {
            grouped['Daily Summary Reports'].push(item);
          } else if (item['Mapping ID'] !== undefined) {
            grouped['Client Form Mapping'].push(item);
          }
          // If no match, skip the record (might be an unknown table or incomplete record)
        }

        // Remove empty arrays to clean up the response
        const cleaned: any = {};
        for (const [key, value] of Object.entries(grouped)) {
          if (Array.isArray(value) && value.length > 0) {
            cleaned[key] = value;
          }
        }

        console.log(`✅ Grouped ${data.length} records into ${Object.keys(cleaned).length} tables: ${Object.keys(cleaned).join(', ')}`);
        return cleaned as N8nGetResponse;
      }
      
      // If the response is an object, check if it has the expected structure
      if (typeof data === 'object' && !Array.isArray(data)) {
        // Check if it already has table keys (expected format)
        const hasTableKeys = Object.keys(data).some(key => 
          Array.isArray(data[key as keyof typeof data])
        );
        
        if (hasTableKeys) {
          // Already in expected format
          return data as N8nGetResponse;
        }
        
        // Check if any key contains table-like data
        const keys = Object.keys(data);
        for (const key of keys) {
          if (Array.isArray(data[key as keyof typeof data]) && (data[key as keyof typeof data] as any[]).length > 0) {
            const firstItem = (data[key as keyof typeof data] as any[])[0];
            // Try to detect and normalize table names
            if (firstItem && firstItem.Username !== undefined && key !== 'User Accounts') {
              data['User Accounts'] = data[key as keyof typeof data];
            }
          }
        }
      }
      
      return data as N8nGetResponse;
    } catch (error) {
      console.error('Error fetching data from n8n:', error);
      throw error;
    }
  }

  /**
   * GET User Accounts directly
   * This is a fallback method if User Accounts are not in the main GET response
   * The GET webhook returns different tables on different requests, so we retry multiple times
   */
  async getUserAccounts(): Promise<UserAccount[]> {
    try {
      // Try the main GET webhook first
      const allData = await this.getAllData();
      if (allData['User Accounts'] && Array.isArray(allData['User Accounts'])) {
        return allData['User Accounts'];
      }

      // If not found, the GET webhook might return User Accounts on a different request
      // Retry multiple times to see if we get User Accounts
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const retryResponse = await fetch(n8nConfig.getUserAccountsUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            
            // Check if it's an array of User Accounts
            if (Array.isArray(retryData) && retryData.length > 0 && retryData[0].Username) {
              console.log(`✅ Found User Accounts on retry attempt ${attempt}`);
              return retryData as UserAccount[];
            }
            
            // Check if it has User Accounts key
            if (retryData['User Accounts'] && Array.isArray(retryData['User Accounts'])) {
              console.log(`✅ Found User Accounts in object on retry attempt ${attempt}`);
              return retryData['User Accounts'];
            }
            
            // Check if getAllData() would detect it as User Accounts
            const detectedData = await this.getAllData();
            if (detectedData['User Accounts'] && Array.isArray(detectedData['User Accounts'])) {
              console.log(`✅ Found User Accounts after detection on retry attempt ${attempt}`);
              return detectedData['User Accounts'];
            }
          }
        } catch (retryError) {
          console.warn(`Retry attempt ${attempt} failed:`, retryError);
        }
        
        // Small delay between retries (except on last attempt)
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.warn('User Accounts not found after multiple retry attempts. The GET webhook may need to be updated to return all tables.');
      return [];
    } catch (error) {
      console.error('Error fetching User Accounts:', error);
      return [];
    }
  }

  /**
   * POST data to n8n webhook
   */
  async postData(webhookUrl: string, data: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`n8n POST webhook failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }

      const responseText = await response.text();
      
      // Handle empty response
      if (responseText.trim() === '') {
        return { success: true, message: 'Data posted successfully' };
      }

      // Try to parse JSON response
      try {
        return JSON.parse(responseText);
      } catch {
        return { message: responseText, status: response.status };
      }
    } catch (error) {
      console.error('Error posting data to n8n:', error);
      throw error;
    }
  }

  // Specific POST methods for each webhook
  async postAdminActivityLog(data: Record<string, any>) {
    return this.postData(n8nConfig.postLogUrl, data);
  }

  async postClientFormMapping(data: Record<string, any>) {
    return this.postData(n8nConfig.postClientFormMappingUrl, data);
  }

  async postCommissionLedger(data: Record<string, any>) {
    return this.postData(n8nConfig.postCommissionLedgerUrl, data);
  }

  async postCreditTeamUser(data: Record<string, any>) {
    // Ensure exact fields are sent to CREDITTEAMUSERS webhook
    const creditUserData = {
      id: data.id, // for matching
      'Credit User ID': data['Credit User ID'] || data.id,
      'Name': data['Name'] || data.Name || '',
      'Email': data['Email'] || data.Email || '',
      'Phone': data['Phone'] || data.Phone || '',
      'Role': data['Role'] || data.Role || 'credit_team',
      'Status': data['Status'] || data.Status || 'Active',
    };
    return this.postData(n8nConfig.postCreditTeamUsersUrl, creditUserData);
  }

  async postDailySummary(data: Record<string, any>) {
    // Ensure only exact fields are sent to DAILYSUMMARY webhook
    // Only send: id, Report Date, Summary Content, Generated Timestamp, Delivered To
    let deliveredTo = data['Delivered To'] || data.deliveredTo || '';
    
    // Convert array to comma-separated string if needed
    if (Array.isArray(deliveredTo)) {
      deliveredTo = deliveredTo.join(', ');
    }
    
    const dailySummaryData = {
      id: data.id, // for matching
      'Report Date': data['Report Date'] || data.reportDate || '',
      'Summary Content': data['Summary Content'] || data.summaryContent || '',
      'Generated Timestamp': data['Generated Timestamp'] || data.generatedTimestamp || new Date().toISOString(),
      'Delivered To': deliveredTo,
    };
    return this.postData(n8nConfig.postDailySummaryUrl, dailySummaryData);
  }

  async postFileAuditLog(data: Record<string, any>) {
    // Ensure only exact fields are sent to Fileauditinglog webhook
    // Only send: id, Log Entry ID, File, Timestamp, Actor, Action/Event Type, Details/Message, Target User/Role, Resolved
    const fileAuditLogData = {
      id: data.id, // for matching
      'Log Entry ID': data['Log Entry ID'] || data.logEntryId || data.id,
      'File': data['File'] || data.file || '',
      'Timestamp': data['Timestamp'] || data.timestamp || new Date().toISOString(),
      'Actor': data['Actor'] || data.actor || '',
      'Action/Event Type': data['Action/Event Type'] || data.actionEventType || '',
      'Details/Message': data['Details/Message'] || data.detailsMessage || '',
      'Target User/Role': data['Target User/Role'] || data.targetUserRole || '',
      'Resolved': data['Resolved'] || data.resolved || 'False',
    };
    return this.postData(n8nConfig.postFileAuditLogUrl, fileAuditLogData);
  }

  async postFormCategory(data: Record<string, any>) {
    // Ensure only exact fields are sent to FormCategory webhook
    // Only send: id, Category ID, Category Name, Description, Display Order, Active
    const formCategoryData = {
      id: data.id, // for matching
      'Category ID': data['Category ID'] || data.categoryId || data.id,
      'Category Name': data['Category Name'] || data.categoryName || '',
      'Description': data['Description'] || data.description || '',
      'Display Order': data['Display Order'] || data.displayOrder || '0',
      'Active': data['Active'] || data.active || 'True',
    };
    return this.postData(n8nConfig.postFormCategoryUrl, formCategoryData);
  }

  async postFormField(data: Record<string, any>) {
    // Ensure only exact fields are sent to FormFields webhook
    // Only send: id, Field ID, Category, Field Label, Field Type, Field Placeholder, Field Options, Is Mandatory, Display Order, Active
    const formFieldData = {
      id: data.id, // for matching
      'Field ID': data['Field ID'] || data.fieldId || data.id,
      'Category': data['Category'] || data.category || '',
      'Field Label': data['Field Label'] || data.fieldLabel || '',
      'Field Type': data['Field Type'] || data.fieldType || '',
      'Field Placeholder': data['Field Placeholder'] || data.fieldPlaceholder || '',
      'Field Options': data['Field Options'] || data.fieldOptions || '',
      'Is Mandatory': data['Is Mandatory'] || data.isMandatory || 'False',
      'Display Order': data['Display Order'] || data.displayOrder || '0',
      'Active': data['Active'] || data.active || 'True',
    };
    return this.postData(n8nConfig.postFormFieldsUrl, formFieldData);
  }

  async postKamUser(data: Record<string, any>) {
    return this.postData(n8nConfig.postKamUsersUrl, data);
  }

  async postLoanApplication(data: Record<string, any>) {
    // Ensure only exact fields are sent to applications webhook
    // Only send: id, File ID, Client, Applicant Name, Loan Product, Requested Loan Amount,
    // Documents, Status, Assigned Credit Analyst, Assigned NBFC, Lender Decision Status,
    // Lender Decision Date, Lender Decision Remarks, Approved Loan Amount, AI File Summary,
    // Form Data, Creation Date, Submitted Date, Last Updated
    
    // Handle Form Data - stringify if it's an object
    let formData = data['Form Data'] || data.formData || '';
    if (typeof formData === 'object' && formData !== null) {
      formData = JSON.stringify(formData);
    }
    
    const loanApplicationData = {
      id: data.id, // for matching
      'File ID': data['File ID'] || data.fileId || '',
      'Client': data['Client'] || data.client || '',
      'Applicant Name': data['Applicant Name'] || data.applicantName || '',
      'Loan Product': data['Loan Product'] || data.loanProduct || '',
      'Requested Loan Amount': data['Requested Loan Amount'] || data.requestedLoanAmount || '',
      'Documents': data['Documents'] || data.documents || '',
      'Status': data['Status'] || data.status || '',
      'Assigned Credit Analyst': data['Assigned Credit Analyst'] || data.assignedCreditAnalyst || '',
      'Assigned NBFC': data['Assigned NBFC'] || data.assignedNBFC || '',
      'Lender Decision Status': data['Lender Decision Status'] || data.lenderDecisionStatus || '',
      'Lender Decision Date': data['Lender Decision Date'] || data.lenderDecisionDate || '',
      'Lender Decision Remarks': data['Lender Decision Remarks'] || data.lenderDecisionRemarks || '',
      'Approved Loan Amount': data['Approved Loan Amount'] || data.approvedLoanAmount || '',
      'AI File Summary': data['AI File Summary'] || data.aiFileSummary || '',
      'Form Data': formData,
      'Creation Date': data['Creation Date'] || data.creationDate || '',
      'Submitted Date': data['Submitted Date'] || data.submittedDate || '',
      'Last Updated': data['Last Updated'] || data.lastUpdated || '',
    };
    return this.postData(n8nConfig.postApplicationsUrl, loanApplicationData);
  }

  async postLoanProduct(data: Record<string, any>) {
    // Ensure only exact fields are sent to loanproducts webhook
    // Only send: id, Product ID, Product Name, Description, Active, Required Documents/Fields
    const loanProductData = {
      id: data.id, // for matching
      'Product ID': data['Product ID'] || data.productId || data.id,
      'Product Name': data['Product Name'] || data.productName || '',
      'Description': data['Description'] || data.description || '',
      'Active': data['Active'] || data.active || 'True',
      'Required Documents/Fields': data['Required Documents/Fields'] || data.requiredDocumentsFields || '',
    };
    return this.postData(n8nConfig.postLoanProductsUrl, loanProductData);
  }

  async postNBFCPartner(data: Record<string, any>) {
    // Ensure only exact fields are sent to NBFC webhook
    // Only send: id, Lender ID, Lender Name, Contact Person, Contact Email/Phone, Address/Region, Active
    const nbfcPartnerData = {
      id: data.id, // for matching
      'Lender ID': data['Lender ID'] || data.lenderId || data.id,
      'Lender Name': data['Lender Name'] || data.lenderName || '',
      'Contact Person': data['Contact Person'] || data.contactPerson || '',
      'Contact Email/Phone': data['Contact Email/Phone'] || data.contactEmailPhone || '',
      'Address/Region': data['Address/Region'] || data.addressRegion || '',
      'Active': data['Active'] || data.active || 'True',
    };
    return this.postData(n8nConfig.postNBFCPartnersUrl, nbfcPartnerData);
  }

  async postUserAccount(data: Record<string, any>) {
    // Ensure only exact fields are sent to adduser webhook
    // Only send: id, Username, Password, Role, Associated Profile, Last Login, Account Status
    // Note: Password should be hashed before calling this method
    const userAccountData = {
      id: data.id, // for matching
      'Username': data['Username'] || data.username || data.email || '',
      'Password': data['Password'] || data.password || '', // Should be hashed before calling
      'Role': data['Role'] || data.role || '',
      'Associated Profile': data['Associated Profile'] || data.associatedProfile || '',
      'Last Login': data['Last Login'] || data.lastLogin || '',
      'Account Status': data['Account Status'] || data.accountStatus || 'Active',
    };
    return this.postData(n8nConfig.postAddUserUrl, userAccountData);
  }

  async postClient(data: Record<string, any>) {
    // Ensure only exact fields are sent to Client webhook
    // Only send: id, Client ID, Client Name, Primary Contact Name, Contact Email / Phone, Assigned KAM, Enabled Modules, Commission Rate, Status, Form Categories
    const clientData = {
      id: data.id, // for matching
      'Client ID': data['Client ID'] || data.clientId || data.id,
      'Client Name': data['Client Name'] || data.clientName || '',
      'Primary Contact Name': data['Primary Contact Name'] || data.primaryContactName || '',
      'Contact Email / Phone': data['Contact Email / Phone'] || data.contactEmailPhone || '',
      'Assigned KAM': data['Assigned KAM'] || data.assignedKAM || '',
      'Enabled Modules': data['Enabled Modules'] || data.enabledModules || '',
      'Commission Rate': data['Commission Rate'] || data.commissionRate || '',
      'Status': data['Status'] || data.status || 'Active',
      'Form Categories': data['Form Categories'] || data.formCategories || '',
    };
    return this.postData(n8nConfig.postClientUrl, clientData);
  }

  async postNotification(data: Record<string, any>) {
    // Ensure only exact fields are sent to notification webhook
    // Only send: id, Notification ID, Recipient User, Recipient Role, Related File,
    // Related Client, Related Ledger Entry, Notification Type, Title, Message,
    // Channel, Is Read, Created At, Read At, Action Link
    const notificationData = {
      id: data.id, // for matching
      'Notification ID': data['Notification ID'] || data.notificationId || data.id,
      'Recipient User': data['Recipient User'] || data.recipientUser || '',
      'Recipient Role': data['Recipient Role'] || data.recipientRole || '',
      'Related File': data['Related File'] || data.relatedFile || '',
      'Related Client': data['Related Client'] || data.relatedClient || '',
      'Related Ledger Entry': data['Related Ledger Entry'] || data.relatedLedgerEntry || '',
      'Notification Type': data['Notification Type'] || data.notificationType || '',
      'Title': data['Title'] || data.title || '',
      'Message': data['Message'] || data.message || '',
      'Channel': data['Channel'] || data.channel || 'in_app',
      'Is Read': data['Is Read'] || data.isRead || 'False',
      'Created At': data['Created At'] || data.createdAt || new Date().toISOString(),
      'Read At': data['Read At'] || data.readAt || '',
      'Action Link': data['Action Link'] || data.actionLink || '',
    };
    return this.postData(n8nConfig.postNotificationUrl, notificationData);
  }
}

export const n8nClient = new N8nClient();

