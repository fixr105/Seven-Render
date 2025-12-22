/**
 * Module 2: OneDrive Upload Service
 * 
 * Handles document uploads to OneDrive (primary storage)
 * Returns OneDrive share links that are stored in Airtable
 */

import fetch from 'node-fetch';

/**
 * OneDrive upload configuration
 * Note: In production, these should be environment variables
 */
const ONEDRIVE_CONFIG = {
  uploadUrl: process.env.ONEDRIVE_UPLOAD_URL || '', // n8n webhook or direct OneDrive API
  accessToken: process.env.ONEDRIVE_ACCESS_TOKEN || '',
};

/**
 * Upload file to OneDrive
 * 
 * @param file - File buffer or file path
 * @param fileName - Name for the uploaded file
 * @param folderPath - Optional folder path in OneDrive
 * @returns OneDrive share link
 */
export async function uploadToOneDrive(
  file: Buffer | string,
  fileName: string,
  folderPath?: string
): Promise<{ shareLink: string; fileId: string; webUrl: string }> {
  // If no OneDrive config, return mock link for development
  if (!ONEDRIVE_CONFIG.uploadUrl && process.env.MOCK_MODE === 'true') {
    console.log('[OneDriveUpload] Mock mode: returning mock OneDrive link');
    return {
      shareLink: `https://onedrive.live.com/mock/${Date.now()}/${fileName}`,
      fileId: `mock-${Date.now()}`,
      webUrl: `https://onedrive.live.com/mock/${Date.now()}/${fileName}`,
    };
  }

  if (!ONEDRIVE_CONFIG.uploadUrl) {
    throw new Error('OneDrive upload URL not configured. Set ONEDRIVE_UPLOAD_URL environment variable.');
  }

  try {
    // If uploadUrl is an n8n webhook, use it
    // Otherwise, use Microsoft Graph API directly
    
    // For now, assume n8n webhook handles OneDrive upload
    // Format: { file: base64 or buffer, fileName, folderPath }
    const fileData = typeof file === 'string' ? file : file.toString('base64');
    
    const response = await fetch(ONEDRIVE_CONFIG.uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName,
        fileData,
        folderPath: folderPath || 'LoanDocuments',
        contentType: 'application/octet-stream',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OneDrive upload failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const result = await response.json();
    
    // Expected response format: { shareLink, fileId, webUrl }
    return {
      shareLink: result.shareLink || result.share_link || result.url,
      fileId: result.fileId || result.file_id || result.id,
      webUrl: result.webUrl || result.web_url || result.shareLink || result.url,
    };
  } catch (error: any) {
    console.error('[OneDriveUpload] Error uploading file:', error);
    throw new Error(`Failed to upload file to OneDrive: ${error.message}`);
  }
}

/**
 * Upload multiple files to OneDrive
 * 
 * @param files - Array of { file: Buffer, fileName: string }
 * @param folderPath - Optional folder path
 * @returns Array of upload results
 */
export async function uploadMultipleToOneDrive(
  files: Array<{ file: Buffer; fileName: string }>,
  folderPath?: string
): Promise<Array<{ fileName: string; shareLink: string; fileId: string; webUrl: string }>> {
  const uploadPromises = files.map(async ({ file, fileName }) => {
    const result = await uploadToOneDrive(file, fileName, folderPath);
    return {
      fileName,
      ...result,
    };
  });

  return Promise.all(uploadPromises);
}


