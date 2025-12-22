/**
 * Client (DSA) Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';
import { LoanStatus } from '../config/constants.js';

export class ClientController {
  /**
   * GET /client/dashboard
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      // Fetch only the tables we need
      const [applications, ledgerEntries, auditLogs] = await Promise.all([
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('Commission Ledger'),
        n8nClient.fetchTable('File Auditing Log'),
      ]);

      // Filter by client
      const clientApplications = applications.filter(
        (app) => app.Client === req.user!.clientId
      );
      const clientLedger = ledgerEntries.filter(
        (entry) => entry.Client === req.user!.clientId
      );

      // Calculate ledger summary
      const totalEarned = clientLedger
        .filter((e) => parseFloat(e['Payout Amount']) > 0)
        .reduce((sum, e) => sum + parseFloat(e['Payout Amount'] || '0'), 0);

      const paid = clientLedger
        .filter((e) => e['Payout Request'] === 'Paid' || e['Payout Request'] === 'True')
        .reduce((sum, e) => sum + Math.abs(parseFloat(e['Payout Amount'] || '0')), 0);

      const pending = totalEarned - paid;
      const balance = totalEarned;

      // Get pending queries
      const pendingQueries = auditLogs
        .filter(
          (log) =>
            log.File &&
            clientApplications.some((app) => app['File ID'] === log.File) &&
            log.Resolved === 'False'
        )
        .map((log) => ({
          id: log.id,
          fileId: log.File,
          message: log['Details/Message'],
          raisedBy: log.Actor,
          timestamp: log.Timestamp,
        }));

      // Get payout requests
      const payoutRequests = clientLedger
        .filter((e) => e['Payout Request'] && e['Payout Request'] !== 'False')
        .map((e) => ({
          id: e.id,
          amount: parseFloat(e['Payout Amount'] || '0'),
          status: e['Payout Request'],
          requestedDate: e.Date,
        }));

      res.json({
        success: true,
        data: {
          activeApplications: clientApplications
            .filter((app) => app.Status !== LoanStatus.CLOSED && app.Status !== LoanStatus.REJECTED)
            .map((app) => ({
              id: app.id,
              fileId: app['File ID'],
              status: app.Status,
              applicantName: app['Applicant Name'],
              requestedAmount: app['Requested Loan Amount'],
            })),
          ledgerSummary: {
            totalEarned,
            pending,
            paid,
            balance,
          },
          pendingQueries,
          payoutRequests,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch dashboard',
      });
    }
  }

  /**
   * GET /client/form-config
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Client Form Mapping') → /webhook/clientformmapping → Airtable: Client Form Mapping
   * - GET → n8nClient.fetchTable('Form Categories') → /webhook/formcategories → Airtable: Form Categories
   * - GET → n8nClient.fetchTable('Form Fields') → /webhook/formfields → Airtable: Form Fields
   * 
   * Frontend: src/pages/NewApplication.tsx (line 100)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async getFormConfig(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.clientId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required. Client ID not found.',
        });
        return;
      }

      // productId is optional - form config can be linked to specific product
      // applicationId is optional - if provided, use form config version from that application (for versioning)
      const { productId, applicationId } = req.query;

      // Fetch only the tables we need
      let mappings, categories, fields, applications;
      try {
        [mappings, categories] = await Promise.all([
          n8nClient.fetchTable('Client Form Mapping'),
          n8nClient.fetchTable('Form Categories'),
        ]);
        // Fetch only Form Fields table
        fields = await n8nClient.fetchTable('Form Fields');
        
        // Module 1: Versioning - if applicationId provided, fetch application to get its form config version
        if (applicationId) {
          applications = await n8nClient.fetchTable('Loan Application');
        }
      } catch (fetchError: any) {
        console.error('[getFormConfig] Error fetching tables:', fetchError);
        res.status(500).json({
          success: false,
          error: `Failed to fetch form data: ${fetchError.message || 'Unknown error'}`,
        });
        return;
      }

      // Module 1: Versioning - determine which version of form config to use
      let formConfigVersion: string | null = null;
      if (applicationId && applications) {
        const application = applications.find((app: any) => app.id === applicationId);
        if (application && application.Client === req.user!.clientId) {
          // Use the form config version stored in the application (if exists)
          // This ensures submitted files use the frozen form config
          formConfigVersion = application['Form Config Version'] || null;
          console.log(`[getFormConfig] Using form config version from application: ${formConfigVersion || 'latest'}`);
        }
      }

      // Get mappings for this client
      // Try multiple ID formats to match client
      const clientId = req.user!.clientId;
      console.log(`[getFormConfig] Client ID from user: ${clientId}`);
      console.log(`[getFormConfig] Total mappings: ${mappings.length}`);
      
      // Fetch client record to get Enabled Modules and Form Categories
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => 
        (c.id === clientId || c['Client ID'] === clientId || 
         c.id === clientId?.toString() || c['Client ID'] === clientId?.toString())
      );
      
      // Extract Enabled Modules and Form Categories from client record
      const enabledModules = client?.['Enabled Modules'] 
        ? client['Enabled Modules'].split(',').map((m: string) => m.trim()).filter(Boolean)
        : [];
      const formCategoriesFromClient = client?.['Form Categories']
        ? client['Form Categories'].split(',').map((c: string) => c.trim()).filter(Boolean)
        : [];
      
      console.log(`[getFormConfig] Client Enabled Modules:`, enabledModules);
      console.log(`[getFormConfig] Client Form Categories:`, formCategoriesFromClient);
      
      // Module 1: Filter mappings by version if specified, otherwise use latest
      let clientMappings = mappings.filter((m) => {
        const mappingClientId = m.Client || m.client || m['Client ID'];
        const matches = mappingClientId === clientId || 
                       mappingClientId === clientId?.toString() ||
                       clientId === mappingClientId?.toString();
        return matches;
      });

      // If formConfigVersion is specified, filter to that version
      // Otherwise, use the latest version (most recent timestamp)
      if (formConfigVersion) {
        clientMappings = clientMappings.filter((m) => {
          const mappingVersion = m.Version || m.version;
          return mappingVersion === formConfigVersion;
        });
        console.log(`[getFormConfig] Filtered to version ${formConfigVersion}: ${clientMappings.length} mappings`);
      } else {
        // Use latest version - get most recent version timestamp
        const versions = clientMappings
          .map((m) => m.Version || m.version)
          .filter(Boolean)
          .sort()
          .reverse();
        const latestVersion = versions[0];
        if (latestVersion) {
          clientMappings = clientMappings.filter((m) => {
            const mappingVersion = m.Version || m.version;
            return mappingVersion === latestVersion;
          });
          console.log(`[getFormConfig] Using latest version ${latestVersion}: ${clientMappings.length} mappings`);
        }
      }

      // Filter by productId if specified
      if (productId) {
        clientMappings = clientMappings.filter((m) => {
          const mappingProductId = m['Product ID'] || m.productId;
          return !mappingProductId || mappingProductId === productId || mappingProductId === productId?.toString();
        });
        console.log(`[getFormConfig] Filtered by productId ${productId}: ${clientMappings.length} mappings`);
      }

      console.log(`[getFormConfig] Client mappings found: ${clientMappings.length}`);

      // Get category IDs that have mappings for this client
      const mappedCategoryIds = new Set(
        clientMappings.map((m) => m.Category || m.category).filter(Boolean)
      );
      
      console.log(`[getFormConfig] Mapped category IDs:`, Array.from(mappedCategoryIds));

      // Build form config - filter by:
      // 1. Categories that have mappings for this client
      // 2. Categories that match client's Enabled Modules (if specified)
      // 3. Categories that match client's Form Categories (if specified)
      // 4. Only active categories
      const config = categories
        .filter((cat) => {
          const categoryId = cat['Category ID'] || cat.id || cat.categoryId;
          const categoryName = cat['Category Name'] || cat.categoryName || cat.name || '';
          const isActive = cat.Active === 'True' || cat.active === true;
          const hasMapping = mappedCategoryIds.has(categoryId);
          
          // Filter by Enabled Modules if specified
          // Enabled Modules are module IDs like "personal_kyc", "company_kyc", etc.
          // Map module IDs to category name patterns
          const moduleToCategoryMap: Record<string, string[]> = {
            'personal_kyc': ['Personal KYC', 'Personal KYC (All Applicants/Co-Applicants)'],
            'company_kyc': ['Company KYC', 'Company/Business KYC', 'Business KYC'],
            'income_banking': ['Income & Banking', 'Income & Banking Documents'],
            'asset_details': ['Asset Details', 'Asset Details (HL/LAP Specific)'],
            'invoice_financial': ['Invoice', 'Financial Requirement', 'Credit Line', 'Business Loan'],
            'security_documents': ['Security Documents'],
            'additional_requirements': ['Additional Requirements', 'Common Across All Products'],
            'universal_checklist': ['Universal Checklist', 'Checklist'],
          };
          
          let matchesEnabledModules = true;
          if (enabledModules.length > 0) {
            matchesEnabledModules = enabledModules.some((module: string) => {
              const moduleKey = module.toLowerCase().trim();
              const categoryPatterns = moduleToCategoryMap[moduleKey] || [module];
              return categoryPatterns.some((pattern: string) =>
                categoryName.toLowerCase().includes(pattern.toLowerCase()) ||
                pattern.toLowerCase().includes(categoryName.toLowerCase())
              );
            });
          }
          
          // Filter by Form Categories if specified
          // Form Categories can be category IDs or category names
          let matchesFormCategories = true;
          if (formCategoriesFromClient.length > 0) {
            matchesFormCategories = formCategoriesFromClient.some((fc: string) => {
              const fcTrimmed = fc.trim();
              return categoryId === fcTrimmed || 
                     categoryName === fcTrimmed ||
                     categoryName.toLowerCase() === fcTrimmed.toLowerCase() ||
                     categoryName.toLowerCase().includes(fcTrimmed.toLowerCase()) ||
                     fcTrimmed.toLowerCase().includes(categoryName.toLowerCase());
            });
          }
          
          // Include if: active AND has mapping AND (matches enabled modules OR no modules specified) AND (matches form categories OR no categories specified)
          const shouldInclude = isActive && hasMapping && matchesEnabledModules && matchesFormCategories;
          
          if (shouldInclude) {
            console.log(`[getFormConfig] Including category: ${categoryName} (ID: ${categoryId})`);
          } else {
            console.log(`[getFormConfig] Excluding category: ${categoryName} (ID: ${categoryId}) - Active: ${isActive}, HasMapping: ${hasMapping}, MatchesModules: ${matchesEnabledModules}, MatchesCategories: ${matchesFormCategories}`);
          }
          return shouldInclude;
        })
        .map((cat) => {
          const categoryId = cat['Category ID'] || cat.id || cat.categoryId;
          
          // Find all fields for this category
          const allFieldsForCategory = fields.filter((f) => {
            const fieldCategory = f.Category || f.category;
            return fieldCategory === categoryId;
          });
          console.log(`[getFormConfig] Category "${cat['Category Name'] || cat.categoryName}" has ${allFieldsForCategory.length} total fields in database`);
          
          const categoryFields = allFieldsForCategory
            .filter((f) => {
              const fieldActive = f.Active === 'True' || f.active === true;
              if (!fieldActive) {
                console.log(`[getFormConfig] Field "${f['Field Label'] || f.fieldLabel}" is not active`);
              }
              return fieldActive;
            })
            .map((f) => {
              const mapping = clientMappings.find(
                (m) => (m.Category || m.category) === categoryId && 
                       ((m.Client || m.client) === clientId || (m.Client || m.client) === clientId?.toString())
              );
              const fieldData = {
                fieldId: f['Field ID'] || f.fieldId || f.id,
                label: f['Field Label'] || f.fieldLabel || f.label,
                type: f['Field Type'] || f.fieldType || f.type,
                placeholder: f['Field Placeholder'] || f.fieldPlaceholder || f.placeholder,
                options: f['Field Options'] || f.fieldOptions || f.options,
                isRequired: mapping?.['Is Required'] === 'True' || mapping?.isRequired === true || f['Is Mandatory'] === 'True' || f.isMandatory === true,
                displayOrder: parseInt(mapping?.['Display Order'] || mapping?.displayOrder || f['Display Order'] || f.displayOrder || '0'),
              };
              console.log(`[getFormConfig]   - Field: "${fieldData.label}" (Type: ${fieldData.type}, Required: ${fieldData.isRequired})`);
              return fieldData;
            })
            .sort((a, b) => a.displayOrder - b.displayOrder);

          console.log(`[getFormConfig] Category "${cat['Category Name'] || cat.categoryName}" has ${categoryFields.length} active fields`);

          // Get display order from mapping if available, otherwise use category's display order
          const mappingForCategory = clientMappings.find(
            (m) => (m.Category || m.category) === categoryId
          );
          const categoryDisplayOrder = mappingForCategory
            ? parseInt(mappingForCategory['Display Order'] || mappingForCategory.displayOrder || '0')
            : parseInt(cat['Display Order'] || cat.displayOrder || '0');

          return {
            categoryId: categoryId,
            categoryName: cat['Category Name'] || cat.categoryName || cat.name,
            description: cat.Description || cat.description,
            displayOrder: categoryDisplayOrder,
            fields: categoryFields,
          };
        })
        .sort((a, b) => {
          // Sort by Display Order from mapping first
          if (a.displayOrder !== b.displayOrder) {
            return a.displayOrder - b.displayOrder;
          }
          // If display orders are equal, sort by category name
          return (a.categoryName || '').localeCompare(b.categoryName || '');
        });

      console.log(`[getFormConfig] Returning ${config.length} categories with form configuration`);
      
      // Ensure we always send a valid JSON response
      const response = { success: true, data: config };
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[getFormConfig] Unexpected error:', error);
      // Ensure error response is always valid JSON
      const errorResponse = {
        success: false,
        error: error.message || 'Failed to fetch form config',
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * POST /loan-applications/:id/queries/:queryId/reply
   * Respond to query (CLIENT only)
   */
  async respondToQuery(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id, queryId } = req.params;
      const { message, newDocs, answers } = req.body;
      // Fetch only the tables we need
      const [applications, auditLogs] = await Promise.all([
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('File Auditing Log'),
      ]);

      const application = applications.find((app) => app.id === id);
      if (!application || application.Client !== req.user.clientId) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const query = auditLogs.find((log) => log.id === queryId);
      if (!query || query.File !== application['File ID']) {
        res.status(404).json({ success: false, error: 'Query not found' });
        return;
      }

      // Update form data if answers provided
      if (answers) {
        const currentFormData = application['Form Data']
          ? JSON.parse(application['Form Data'])
          : {};
        const updatedFormData = { ...currentFormData, ...answers };

        await n8nClient.postLoanApplication({
          ...application,
          'Form Data': JSON.stringify(updatedFormData),
          'Last Updated': new Date().toISOString(),
        });
      }

      // Update documents if new docs provided
      if (newDocs && newDocs.length > 0) {
        const documents = application.Documents
          ? application.Documents.split(',').filter(Boolean)
          : [];
        newDocs.forEach((doc: any) => {
          documents.push(`${doc.fieldId}:${doc.fileUrl}`);
        });

        await n8nClient.postLoanApplication({
          ...application,
          Documents: documents.join(','),
          'Last Updated': new Date().toISOString(),
        });
      }

      // Use query service to create reply
      const { queryService } = await import('../services/queries/query.service.js');
      const replyMessage = [
        message,
        answers ? `Answers provided: ${Object.keys(answers).join(', ')}` : '',
        newDocs?.length ? `New documents uploaded: ${newDocs.length}` : '',
      ]
        .filter(Boolean)
        .join('. ');

      await queryService.createQueryReply(
        queryId,
        application['File ID'],
        application.Client,
        req.user.email,
        'client',
        replyMessage,
        query['Target User/Role'] || query.Actor || 'kam'
      );

      // If status was QUERY_WITH_CLIENT, it can transition back to UNDER_KAM_REVIEW
      // (KAM will need to acknowledge)
      if (application.Status === 'query_with_client') {
        await n8nClient.postLoanApplication({
          ...application,
          Status: 'under_kam_review',
          'Last Updated': new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        message: 'Query response submitted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to respond to query',
      });
    }
  }
}

export const clientController = new ClientController();

