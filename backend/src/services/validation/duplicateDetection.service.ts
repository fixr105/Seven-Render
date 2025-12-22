/**
 * Module 2: Duplicate Detection Service
 * 
 * Implements duplicate application detection based on PAN (primary key)
 * Warns but allows submission (soft validation)
 */

import { n8nClient } from '../airtable/n8nClient.js';

/**
 * Check for duplicate application by PAN
 * 
 * @param pan - PAN number to check
 * @param clientId - Client ID (to filter by client)
 * @param excludeApplicationId - Application ID to exclude from check (for updates)
 * @returns Duplicate application if found, null otherwise
 */
export async function checkDuplicateByPAN(
  pan: string,
  clientId?: string,
  excludeApplicationId?: string
): Promise<{ id: string; fileId: string; applicantName: string; status: string } | null> {
  if (!pan || pan.trim().length === 0) {
    return null;
  }

  try {
    // Fetch Loan Application table
    const applications = await n8nClient.fetchTable('Loan Application');

    // Search for PAN in form data
    const duplicates = applications.filter((app: any) => {
      // Skip excluded application
      if (excludeApplicationId && app.id === excludeApplicationId) {
        return false;
      }

      // Filter by client if specified
      if (clientId && app.Client !== clientId) {
        return false;
      }

      // Parse form data to check for PAN
      let formData: any = {};
      try {
        if (app['Form Data']) {
          formData = typeof app['Form Data'] === 'string' 
            ? JSON.parse(app['Form Data']) 
            : app['Form Data'];
        }
      } catch (e) {
        // Invalid JSON, skip
        return false;
      }

      // Check various PAN field names
      const panFields = ['pan', 'pan_card', 'pan_number', 'PAN', 'PAN Card', 'PAN Number'];
      const appPAN = panFields
        .map(field => formData[field])
        .find(value => value && typeof value === 'string');

      if (!appPAN) {
        return false;
      }

      // Normalize PAN (uppercase, remove spaces)
      const normalizedPAN = pan.trim().toUpperCase().replace(/\s+/g, '');
      const normalizedAppPAN = appPAN.trim().toUpperCase().replace(/\s+/g, '');

      return normalizedPAN === normalizedAppPAN;
    });

    if (duplicates.length > 0) {
      const duplicate = duplicates[0];
      return {
        id: duplicate.id,
        fileId: duplicate['File ID'] || duplicate.fileId,
        applicantName: duplicate['Applicant Name'] || duplicate.applicantName || 'Unknown',
        status: duplicate.Status || duplicate.status,
      };
    }

    return null;
  } catch (error: any) {
    console.error('[DuplicateDetection] Error checking duplicate:', error);
    // Don't throw - allow submission even if duplicate check fails
    return null;
  }
}

/**
 * Check for duplicate by borrower details (name + other identifiers)
 * 
 * @param borrowerName - Borrower name
 * @param clientId - Client ID
 * @param excludeApplicationId - Application ID to exclude
 * @returns Duplicate application if found
 */
export async function checkDuplicateByBorrowerDetails(
  borrowerName: string,
  clientId?: string,
  excludeApplicationId?: string
): Promise<{ id: string; fileId: string; applicantName: string; status: string } | null> {
  if (!borrowerName || borrowerName.trim().length === 0) {
    return null;
  }

  try {
    const applications = await n8nClient.fetchTable('Loan Application');

    const normalizedName = borrowerName.trim().toLowerCase();

    const duplicates = applications.filter((app: any) => {
      if (excludeApplicationId && app.id === excludeApplicationId) {
        return false;
      }

      if (clientId && app.Client !== clientId) {
        return false;
      }

      const appName = (app['Applicant Name'] || app.applicantName || '').trim().toLowerCase();
      return appName === normalizedName;
    });

    if (duplicates.length > 0) {
      const duplicate = duplicates[0];
      return {
        id: duplicate.id,
        fileId: duplicate['File ID'] || duplicate.fileId,
        applicantName: duplicate['Applicant Name'] || duplicate.applicantName || 'Unknown',
        status: duplicate.Status || duplicate.status,
      };
    }

    return null;
  } catch (error: any) {
    console.error('[DuplicateDetection] Error checking duplicate by borrower:', error);
    return null;
  }
}


