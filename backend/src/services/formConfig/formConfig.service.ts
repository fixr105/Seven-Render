/**
 * Form & Module Configuration Service
 * 
 * Handles dynamic form and module configuration for clients:
 * 1. KAM can configure which modules and form fields are enabled for a client
 * 2. Clients can retrieve their configured modules and form fields
 * 
 * This service queries ClientFormMapping table to return only the specific
 * modules enabled for a client ID.
 */

import { n8nClient } from '../airtable/n8nClient.js';
import { Module } from '../../config/constants.js';

/**
 * Module configuration for a client
 */
export interface ClientModuleConfig {
  moduleId: string;
  moduleName: string;
  description: string;
  enabled: boolean;
  categories: ClientCategoryConfig[];
}

/**
 * Category configuration for a client
 */
export interface ClientCategoryConfig {
  categoryId: string;
  categoryName: string;
  description?: string;
  isRequired: boolean;
  displayOrder: number;
  fields: ClientFieldConfig[];
}

/**
 * Field configuration for a client
 */
export interface ClientFieldConfig {
  fieldId: string;
  label: string;
  type: string;
  placeholder?: string;
  options?: string[];
  isRequired: boolean;
  isMandatory: boolean; // From Form Fields table
  displayOrder: number;
}

/**
 * Complete form configuration for a client
 */
export interface ClientFormConfiguration {
  clientId: string;
  clientName: string;
  enabledModules: string[]; // Module IDs (M1, M2, etc.)
  modules: ClientModuleConfig[];
  version?: string; // Form config version (for versioning)
  productId?: string; // Optional: linked to specific loan product
}

/**
 * Options for configuring client modules
 */
export interface ConfigureClientModulesOptions {
  clientId: string;
  enabledModules: string[]; // Array of module IDs: ['M1', 'M2', 'M3']
  categories?: Array<{
    categoryId: string;
    isRequired: boolean;
    displayOrder: number;
  }>;
  productId?: string; // Optional: link to specific loan product
}

/**
 * Form & Module Configuration Service
 */
export class FormConfigService {
  /**
   * Get client's dashboard configuration
   * 
   * Returns only the modules and form fields enabled for the specified client.
   * Filters based on:
   * 1. ClientFormMapping table entries for this client
   * 2. Client's Enabled Modules field
   * 3. Active categories and fields
   * 
   * @param clientId - Client ID
   * @param productId - Optional product ID to filter by
   * @param version - Optional form config version (for versioning)
   * @returns Complete form configuration for the client
   */
  async getClientDashboardConfig(
    clientId: string,
    productId?: string,
    version?: string
  ): Promise<ClientFormConfiguration> {
    // Fetch all required tables
    const [mappings, categories, fields, clients] = await Promise.all([
      n8nClient.fetchTable('Client Form Mapping'),
      n8nClient.fetchTable('Form Categories'),
      n8nClient.fetchTable('Form Fields'),
      n8nClient.fetchTable('Clients'),
    ]);

    // Find client record
    const client = clients.find((c: any) => 
      c.id === clientId || 
      c['Client ID'] === clientId ||
      c.id === clientId?.toString() ||
      c['Client ID'] === clientId?.toString()
    );

    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    const clientName = client['Client Name'] || client.clientName || '';
    
    // Get enabled modules from client record
    const enabledModulesStr = client['Enabled Modules'] || client.enabledModules || '';
    const enabledModules = enabledModulesStr
      ? enabledModulesStr.split(',').map((m: string) => m.trim()).filter(Boolean)
      : [];

    // Get form categories from client record (if specified)
    const formCategoriesStr = client['Form Categories'] || client.formCategories || '';
    const formCategories = formCategoriesStr
      ? formCategoriesStr.split(',').map((c: string) => c.trim()).filter(Boolean)
      : [];

    // Filter mappings for this client
    let clientMappings = mappings.filter((m: any) => {
      const mappingClientId = m.Client || m.client || m['Client ID'];
      return mappingClientId === clientId || 
             mappingClientId === clientId?.toString() ||
             clientId === mappingClientId?.toString();
    });

    // Filter by version if specified
    if (version) {
      clientMappings = clientMappings.filter((m: any) => {
        const mappingVersion = m.Version || m.version;
        return mappingVersion === version;
      });
    } else {
      // Use latest version (most recent timestamp)
      const versions = clientMappings
        .map((m: any) => m.Version || m.version)
        .filter(Boolean)
        .sort()
        .reverse();
      const latestVersion = versions[0];
      if (latestVersion) {
        clientMappings = clientMappings.filter((m: any) => {
          const mappingVersion = m.Version || m.version;
          return mappingVersion === latestVersion;
        });
      }
    }

    // Filter by productId if specified
    if (productId) {
      clientMappings = clientMappings.filter((m: any) => {
        const mappingProductId = m['Product ID'] || m.productId;
        return !mappingProductId || mappingProductId === productId || mappingProductId === productId?.toString();
      });
    }

    // Get category IDs that have mappings for this client
    const mappedCategoryIds = new Set(
      clientMappings.map((m: any) => m.Category || m.category).filter(Boolean)
    );

    // Build module configuration
    // Map module IDs to their configurations
    const moduleConfigs: Record<string, ClientModuleConfig> = {};

    // Process each category that has a mapping for this client
    categories
      .filter((cat: any) => {
        const categoryId = cat['Category ID'] || cat.id || cat.categoryId;
        const isActive = cat.Active === 'True' || cat.active === true;
        
        // Must have a mapping for this client
        if (!mappedCategoryIds.has(categoryId)) {
          return false;
        }

        // Must be active
        if (!isActive) {
          return false;
        }

        // If client has form categories specified, filter by those
        if (formCategories.length > 0) {
          const categoryName = cat['Category Name'] || cat.categoryName || cat.name || '';
          return formCategories.some((fc: string) => 
            categoryName.toLowerCase().includes(fc.toLowerCase()) ||
            categoryId === fc
          );
        }

        return true;
      })
      .forEach((cat: any) => {
        const categoryId = cat['Category ID'] || cat.id || cat.categoryId;
        const categoryName = cat['Category Name'] || cat.categoryName || cat.name || '';
        
        // Find mapping for this category
        const mapping = clientMappings.find((m: any) => 
          (m.Category || m.category) === categoryId
        );

        if (!mapping) {
          return; // Skip if no mapping found
        }

        // Determine which module this category belongs to
        // This can be based on category name patterns or a module field
        const moduleId = this.determineModuleFromCategory(categoryName, categoryId);
        
        // Initialize module config if not exists
        if (!moduleConfigs[moduleId]) {
          moduleConfigs[moduleId] = {
            moduleId,
            moduleName: this.getModuleName(moduleId),
            description: this.getModuleDescription(moduleId),
            enabled: enabledModules.includes(moduleId),
            categories: [],
          };
        }

        // Get fields for this category
        const categoryFields = fields
          .filter((f: any) => {
            const fieldCategory = f.Category || f.category;
            const fieldActive = f.Active === 'True' || f.active === true;
            return fieldCategory === categoryId && fieldActive;
          })
          .map((f: any) => {
            const isRequired = mapping['Is Required'] === 'True' || mapping.isRequired === true;
            const isMandatory = f['Is Mandatory'] === 'True' || f.isMandatory === true;
            const displayOrder = parseInt(
              mapping['Display Order'] || 
              mapping.displayOrder || 
              f['Display Order'] || 
              f.displayOrder || 
              '0'
            );

            let options: string[] | undefined;
            if (f['Field Options'] || f.fieldOptions) {
              try {
                const optionsStr = f['Field Options'] || f.fieldOptions;
                options = typeof optionsStr === 'string' 
                  ? JSON.parse(optionsStr) 
                  : optionsStr;
              } catch {
                // If parsing fails, treat as comma-separated string
                options = (f['Field Options'] || f.fieldOptions || '').split(',').map((o: string) => o.trim());
              }
            }

            return {
              fieldId: f['Field ID'] || f.fieldId || f.id,
              label: f['Field Label'] || f.fieldLabel || f.label,
              type: f['Field Type'] || f.fieldType || f.type || 'text',
              placeholder: f['Field Placeholder'] || f.fieldPlaceholder || f.placeholder,
              options,
              isRequired,
              isMandatory,
              displayOrder,
            } as ClientFieldConfig;
          })
          .sort((a, b) => a.displayOrder - b.displayOrder);

        // Add category to module
        const categoryDisplayOrder = parseInt(
          mapping['Display Order'] || 
          mapping.displayOrder || 
          cat['Display Order'] || 
          cat.displayOrder || 
          '0'
        );

        moduleConfigs[moduleId].categories.push({
          categoryId,
          categoryName,
          description: cat.Description || cat.description,
          isRequired: mapping['Is Required'] === 'True' || mapping.isRequired === true,
          displayOrder: categoryDisplayOrder,
          fields: categoryFields,
        });
      });

    // Sort categories within each module
    Object.values(moduleConfigs).forEach((module) => {
      module.categories.sort((a, b) => a.displayOrder - b.displayOrder);
    });

    // Get version from mappings (if exists)
    const configVersion = clientMappings.length > 0
      ? (clientMappings[0].Version || clientMappings[0].version)
      : undefined;

    // Get product ID from mappings (if exists)
    const configProductId = clientMappings.length > 0
      ? (clientMappings[0]['Product ID'] || clientMappings[0].productId)
      : undefined;

    return {
      clientId,
      clientName,
      enabledModules,
      modules: Object.values(moduleConfigs).filter((m) => m.enabled),
      version: configVersion,
      productId: configProductId || productId,
    };
  }

  /**
   * Configure client modules and form fields (KAM only)
   * 
   * Allows a KAM to configure which modules and form fields are enabled for a client.
   * Creates ClientFormMapping entries for the specified configuration.
   * 
   * @param kamUserId - KAM user ID (for authorization)
   * @param options - Configuration options
   * @returns Created mappings
   */
  async configureClientModules(
    kamUserId: string,
    options: ConfigureClientModulesOptions
  ): Promise<any[]> {
    const { clientId, enabledModules, categories, productId } = options;

    // Verify client exists and is assigned to this KAM
    const clients = await n8nClient.fetchTable('Clients');
    const client = clients.find((c: any) => 
      c.id === clientId || 
      c['Client ID'] === clientId ||
      c.id === clientId?.toString() ||
      c['Client ID'] === clientId?.toString()
    );

    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Verify KAM assignment
    const assignedKAM = client['Assigned KAM'] || '';
    if (assignedKAM !== kamUserId) {
      // Try to match by KAM Users table
      const kamUsers = await n8nClient.fetchTable('KAM Users');
      const kamUser = kamUsers.find((k: any) => 
        k.id === kamUserId || 
        k['KAM ID'] === kamUserId
      );
      
      if (!kamUser || assignedKAM !== kamUser.id && assignedKAM !== kamUser['KAM ID']) {
        throw new Error(`Access denied: Client not managed by this KAM`);
      }
    }

    // Update client's Enabled Modules
    await n8nClient.postClient({
      ...client,
      'Enabled Modules': enabledModules.join(', '),
    });

    // Create version timestamp for form config versioning
    const versionTimestamp = new Date().toISOString();

    // If categories are provided, create mappings for them
    if (categories && categories.length > 0) {
      const [formCategories] = await Promise.all([
        n8nClient.fetchTable('Form Categories'),
      ]);

      const mappingPromises = categories.map(async (catConfig, index) => {
        // Verify category exists
        const category = formCategories.find((c: any) => 
          c.id === catConfig.categoryId ||
          c['Category ID'] === catConfig.categoryId
        );

        if (!category) {
          throw new Error(`Category not found: ${catConfig.categoryId}`);
        }

        // Create or update Client Form Mapping
        const mappingData = {
          id: `MAP-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          'Mapping ID': `MAP-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          Client: clientId,
          Category: catConfig.categoryId,
          'Is Required': catConfig.isRequired ? 'True' : 'False',
          'Display Order': catConfig.displayOrder.toString(),
          'Version': versionTimestamp,
          'Product ID': productId || '',
        };

        await n8nClient.postClientFormMapping(mappingData);
        return mappingData;
      });

      return await Promise.all(mappingPromises);
    }

    // If no categories specified, just update enabled modules
    return [];
  }

  /**
   * Determine module ID from category name/ID
   * 
   * Maps category names to module IDs based on naming patterns.
   */
  private determineModuleFromCategory(categoryName: string, categoryId: string): string {
    const nameLower = categoryName.toLowerCase();
    
    // Module M1: Pay In/Out Ledger
    if (nameLower.includes('ledger') || nameLower.includes('commission') || nameLower.includes('payout')) {
      return Module.M1;
    }
    
    // Module M2: Master Form Builder
    if (nameLower.includes('form') || nameLower.includes('kyc') || nameLower.includes('document')) {
      return Module.M2;
    }
    
    // Module M3: File Status Tracking
    if (nameLower.includes('status') || nameLower.includes('tracking') || nameLower.includes('workflow')) {
      return Module.M3;
    }
    
    // Module M4: Audit Log & Query Dialog
    if (nameLower.includes('audit') || nameLower.includes('query') || nameLower.includes('log')) {
      return Module.M4;
    }
    
    // Module M5: Action Center
    if (nameLower.includes('action') || nameLower.includes('notification') || nameLower.includes('alert')) {
      return Module.M5;
    }
    
    // Module M6: Daily Summary Reports
    if (nameLower.includes('report') || nameLower.includes('summary') || nameLower.includes('daily')) {
      return Module.M6;
    }
    
    // Module M7: File Summary Insights
    if (nameLower.includes('insight') || nameLower.includes('summary') || nameLower.includes('ai')) {
      return Module.M7;
    }
    
    // Default to M2 (Master Form Builder)
    return Module.M2;
  }

  /**
   * Get module display name
   */
  private getModuleName(moduleId: string): string {
    const moduleNames: Record<string, string> = {
      [Module.M1]: 'Pay In/Out Ledger',
      [Module.M2]: 'Master Form Builder',
      [Module.M3]: 'File Status Tracking',
      [Module.M4]: 'Audit Log & Query Dialog',
      [Module.M5]: 'Action Center',
      [Module.M6]: 'Daily Summary Reports',
      [Module.M7]: 'File Summary Insights',
    };
    return moduleNames[moduleId] || moduleId;
  }

  /**
   * Get module description
   */
  private getModuleDescription(moduleId: string): string {
    const descriptions: Record<string, string> = {
      [Module.M1]: 'Commission ledger and payout management',
      [Module.M2]: 'Dynamic form configuration and field management',
      [Module.M3]: 'Loan application status tracking and workflow',
      [Module.M4]: 'Audit trail and query management',
      [Module.M5]: 'Notifications and action items',
      [Module.M6]: 'Daily summary and reporting',
      [Module.M7]: 'AI-powered file insights and summaries',
    };
    return descriptions[moduleId] || '';
  }
}

// Export singleton instance
export const formConfigService = new FormConfigService();

