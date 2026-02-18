/**
 * Module 1: Form Config Versioning Service
 *
 * Handles form configuration versioning logic:
 * - Applies to drafts + new apps only (submitted files frozen)
 * - Field removal = hidden for new/drafts, retained for old submitted files
 *
 * Product Documents table has no Version field; returns null (callers use || '').
 */

/**
 * Get the latest form config version for a client.
 * Product Documents has no Version field; returns null.
 * Callers (loan workflow, etc.) handle null with || ''.
 */
export async function getLatestFormConfigVersion(_clientId: string): Promise<string | null> {
  // Product Documents: no version field
  return null;
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
  
  // For drafts/new apps, use latest version (Product Documents: null)
  if (shouldApplyFormConfig(application)) {
    return await getLatestFormConfigVersion(clientId);
  }
  
  // Fallback: use latest version
  return await getLatestFormConfigVersion(clientId);
}
