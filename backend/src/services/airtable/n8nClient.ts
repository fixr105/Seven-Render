/**
 * n8n Webhook Client
 * Handles GET and POST requests to n8n webhooks
 */

import fetch from 'node-fetch';
import { n8nConfig } from '../../config/airtable.js';
import { N8nGetResponse } from '../../types/entities.js';

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
      return data as N8nGetResponse;
    } catch (error) {
      console.error('Error fetching data from n8n:', error);
      throw error;
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

