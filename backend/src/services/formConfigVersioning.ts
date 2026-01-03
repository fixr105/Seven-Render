/**
 * Module 1: Form Config Versioning Service
 * 
 * Handles form configuration versioning logic:
 * - Applies to drafts + new apps only (submitted files frozen)
 * - Field removal = hidden for new/drafts, retained for old submitted files
 */

import { n8nClient } from './airtable/n8nClient.js';

/**
 * Get the latest form config version for a client
 */
export async function getLatestFormConfigVersion(clientId: string): Promise<string | null> {
  try {
    const mappings = await n8nClient.fetchTable('Client Form Mapping');
    const clientMappings = mappings.filter((m: any) => {
      const mappingClientId = m.Client || m.client || m['Client ID'];
      return mappingClientId === clientId || 
             mappingClientId === clientId?.toString();
    });
    
    if (clientMappings.length === 0) {
      return null;
    }
    
    // Get latest version timestamp
    const versions = clientMappings
      .map((m: any) => m.Version || m.version)
      .filter(Boolean)
      .sort()
      .reverse();
    
    return versions[0] || null;
  } catch (error) {
    console.error('[FormConfigVersioning] Error getting latest version:', error);
    return null;
  }
}

/**
 * Check if form config should be applied to an application
 * Module 1: Versioning behavior - applies to drafts + new apps only
 */
export function shouldApplyFormConfig(application: any): boolean {
  // If application is draft or newly created (no submitted date), apply latest form config
  const status = application.Status || application.status;
  const submittedDate = application['Submitted Date'] || application.submittedDate;
  
  // Drafts and new applications (no submitted date) should use latest form config
  if (status === 'draft' || !submittedDate) {
    return true;
  }
  
  // Submitted files are frozen - use their stored form config version
  return false;
}

/**
 * Get form config version for an application
 * Returns the version stored in the application (for submitted files) or latest (for drafts)
 */
export async function getFormConfigVersionForApplication(
  application: any,
  clientId: string
): Promise<string | null> {
  // If application has a stored form config version, use it (frozen for submitted files)
  const storedVersion = application['Form Config Version'] || application.formConfigVersion;
  if (storedVersion) {
    return storedVersion;
  }
  
  // For drafts/new apps, use latest version
  if (shouldApplyFormConfig(application)) {
    return await getLatestFormConfigVersion(clientId);
  }
  
  // Fallback: use latest version
  return await getLatestFormConfigVersion(clientId);
}










