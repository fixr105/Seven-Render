/**
 * n8n Webhook Client
 * Handles GET and POST requests to n8n webhooks
 * 
 * GET webhooks use "Search records" nodes in n8n workflow
 * These return Airtable records in various formats that need parsing
 */

import fetch from 'node-fetch';
import { n8nConfig } from '../../config/airtable.js';
import { N8nGetResponse, UserAccount } from '../../types/entities.js';
import { getWebhookUrl, TABLE_NAMES } from '../../config/webhookConfig.js';
import { cacheService } from './cache.service.js';
import { n8nEndpoints, getTableToGetWebhookPath } from './n8nEndpoints.js';

/**
 * Type definitions for n8n webhook responses
 */

/**
 * Airtable record format (with fields property)
 * Format: { id, createdTime, fields: { Field1: value1, ... } }
 */
interface AirtableRecordFormat {
  id: string;
  createdTime?: string;
  fields: Record<string, any>;
}

/**
 * Flattened record format (fields directly on object)
 * Format: { id, createdTime, Field1: value1, Field2: value2, ... }
 */
interface FlattenedRecordFormat {
  id: string;
  createdTime?: string;
  [key: string]: any;
}

/**
 * n8n webhook response can be:
 * - Array of records (Airtable or flattened format)
 * - Single record object
 * - Object with nested arrays
 */
type N8nWebhookResponse = 
  | AirtableRecordFormat[]
  | FlattenedRecordFormat[]
  | AirtableRecordFormat
  | FlattenedRecordFormat
  | { records?: AirtableRecordFormat[] | FlattenedRecordFormat[] }
  | { data?: AirtableRecordFormat[] | FlattenedRecordFormat[] }
  | Record<string, AirtableRecordFormat[] | FlattenedRecordFormat[]>;

/**
 * Parsed record - normalized to flattened format with clean field names
 * 
 * All records from n8n GET webhooks are normalized to this format:
 * - Fields are directly on the object (not nested in 'fields' property)
 * - Field names match Airtable column names exactly
 * - id and createdTime are always present
 * 
 * Example:
 * {
 *   id: "rec123",
 *   createdTime: "2025-01-01T00:00:00.000Z",
 *   "File ID": "SF20250101001",
 *   "Client": "CL001",
 *   "Status": "pending_kam_review",
 *   ...
 * }
 */
export interface ParsedRecord {
  id: string;
  createdTime?: string;
  [key: string]: any;
}

/**
 * Type-safe parser for n8n GET webhook responses
 * Handles both Airtable format (with fields property) and flattened format
 */
class N8nResponseParser {
  /**
   * Check if record is in Airtable format (has fields property)
   */
  private isAirtableFormat(record: any): record is AirtableRecordFormat {
    return (
      typeof record === 'object' &&
      record !== null &&
      'id' in record &&
      'fields' in record &&
      typeof record.fields === 'object' &&
      record.fields !== null
    );
  }

  /**
   * Check if record is in flattened format (fields directly on object)
   */
  private isFlattenedFormat(record: any): record is FlattenedRecordFormat {
    return (
      typeof record === 'object' &&
      record !== null &&
      'id' in record &&
      !('fields' in record) &&
      Object.keys(record).length > 1 // Has more than just id
    );
  }

  /**
   * Normalize a record to flattened format
   * Converts Airtable format to flattened format
   */
  private normalizeRecord(record: any): ParsedRecord | null {
    if (!record || typeof record !== 'object' || !('id' in record)) {
      return null;
    }

    // Skip records with only id and createdTime (empty records)
    const keys = Object.keys(record).filter(k => k !== 'id' && k !== 'createdTime');
    if (keys.length === 0) {
      return null;
    }

    // Handle Airtable format: { id, createdTime, fields: {...} }
    if (this.isAirtableFormat(record)) {
      return {
        id: record.id,
        createdTime: record.createdTime,
        ...record.fields, // Spread fields to flatten
      };
    }

    // Handle flattened format: { id, createdTime, Field1: value1, ... }
    if (this.isFlattenedFormat(record)) {
      return {
        id: record.id,
        createdTime: record.createdTime,
        ...Object.fromEntries(
          Object.entries(record).filter(([key]) => key !== 'id' && key !== 'createdTime')
        ),
      };
    }

    // Unknown format, try to return as-is
    return record as ParsedRecord;
  }

  /**
   * Parse n8n webhook response and return array of normalized records
   * 
   * @param response - Raw response from n8n webhook
   * @returns Array of parsed records in flattened format
   */
  parse(response: N8nWebhookResponse): ParsedRecord[] {
    // Handle array of records
    if (Array.isArray(response)) {
      const parsed = response
        .map(record => this.normalizeRecord(record))
        .filter((record): record is ParsedRecord => record !== null);
      
      if (process.env.LOG_WEBHOOK_CALLS === 'true') {
        console.log(`[N8nResponseParser] Parsed ${parsed.length} records from array response`);
      }
      return parsed;
    }

    // Handle object with records/data property
    if (typeof response === 'object' && response !== null) {
      const responseObj = response as Record<string, any>;
      
      // Check for records property
      if ('records' in responseObj && Array.isArray(responseObj.records)) {
        const parsed = responseObj.records
          .map(record => this.normalizeRecord(record))
          .filter((record): record is ParsedRecord => record !== null);
        
        if (process.env.LOG_WEBHOOK_CALLS === 'true') {
          console.log(`[N8nResponseParser] Parsed ${parsed.length} records from records property`);
        }
        return parsed;
      }

      // Check for data property
      if ('data' in responseObj && Array.isArray(responseObj.data)) {
        const parsed = responseObj.data
          .map(record => this.normalizeRecord(record))
          .filter((record): record is ParsedRecord => record !== null);
        
        if (process.env.LOG_WEBHOOK_CALLS === 'true') {
          console.log(`[N8nResponseParser] Parsed ${parsed.length} records from data property`);
        }
        return parsed;
      }

      // Check if object has table-like structure (keys are table names with arrays)
      const arrayKeys = Object.keys(responseObj).filter(key => 
        Array.isArray(responseObj[key]) && responseObj[key].length > 0
      );
      
      if (arrayKeys.length > 0) {
        // This is likely a multi-table response, extract first array
        // (For single table webhooks, there should only be one array)
        const firstArray = responseObj[arrayKeys[0]];
        const parsed = firstArray
          .map((record: any) => this.normalizeRecord(record))
          .filter((record: ParsedRecord | null): record is ParsedRecord => record !== null);
        
        if (process.env.LOG_WEBHOOK_CALLS === 'true') {
          console.log(`[N8nResponseParser] Parsed ${parsed.length} records from table key: ${arrayKeys[0]}`);
        }
        return parsed;
      }

      // Handle single record object
      const normalized = this.normalizeRecord(responseObj);
      if (normalized) {
        if (process.env.LOG_WEBHOOK_CALLS === 'true') {
          console.log(`[N8nResponseParser] Parsed single record`);
        }
        return [normalized];
      }
    }

    // Unknown format, return empty array
    if (process.env.LOG_WEBHOOK_CALLS === 'true') {
      console.warn(`[N8nResponseParser] Unknown response format, returning empty array`);
    }
    return [];
  }
}

// Singleton parser instance
const responseParser = new N8nResponseParser();

export class N8nClient {
  /**
   * Fetch data from a single table webhook
   * Uses caching to prevent excessive webhook executions
   * 
   * This method calls n8n "Search records" webhooks which return Airtable records.
   * The response is parsed using N8nResponseParser to handle different formats:
   * - Airtable format: { id, createdTime, fields: {...} }
   * - Flattened format: { id, createdTime, Field1: value1, ... }
   * - Array of records
   * - Single record object
   * 
   * @param tableName - Name of the table to fetch (must match webhookConfig.ts)
   * @param useCache - Whether to use cache (default: true)
   * @param cacheTTL - Cache TTL in milliseconds (default: 60 seconds)
   * @returns Array of parsed records in flattened format with clean field names
   * 
   * Webhook Mapping:
   * - GET → /webhook/{tablePath} → Airtable: {tableName}
   * - See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async fetchTable(tableName: string, useCache: boolean = true, cacheTTL?: number, timeoutMs: number = 5000): Promise<ParsedRecord[]> {
    console.log(`[fetchTable] START - Table: ${tableName}, useCache: ${useCache}, timeoutMs: ${timeoutMs}`);
    const cacheKey = `table:${tableName}`;
    
    // Check cache first
    if (useCache) {
      const cached = cacheService.get<ParsedRecord[]>(cacheKey);
      if (cached !== null) {
        // Log when cache prevents webhook call (always log to verify GET webhooks are not triggered)
        console.log(`📦 [CACHE HIT] Using cached data for ${tableName} (${cached.length} records) - GET webhook NOT called`);
        return cached;
      }
      console.log(`[fetchTable] No cache found for ${tableName}, will fetch from webhook`);
    }

    const url = getWebhookUrl(tableName);
    console.log(`[fetchTable] Webhook URL for ${tableName}: ${url || 'NULL - NO URL CONFIGURED'}`);
    if (!url) {
      // Always log this error - it's critical for debugging production issues
      console.error(`❌ [fetchTable] No webhook URL configured for table: ${tableName}`);
      console.error(`❌ [fetchTable] This means the webhook will NOT be called and empty array will be returned`);
      return [];
    }

    try {
      // N8N_BASE_URL is required - validate it exists
      if (!process.env.N8N_BASE_URL) {
        throw new Error('N8N_BASE_URL environment variable is required. Please set it in your environment configuration.');
      }
      const n8nBaseUrl = process.env.N8N_BASE_URL;
      
      // Add timeout support to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Webhook failed for ${tableName}: ${response.status} ${response.statusText}`);
        }

        const rawData: any = await response.json();
        
        // Use type-safe parser to handle n8n response format
        // Parser handles: Airtable format, flattened format, arrays, single records
        const records = responseParser.parse(rawData as N8nWebhookResponse);
        
        // Always log successful webhook fetches
        console.log(`✅ [WEBHOOK SUCCESS] Fetched and parsed ${records.length} records from ${tableName} webhook`);
        
        // Cache the parsed result (persists until invalidated)
        if (useCache) {
          // Cache holds indefinitely until explicitly invalidated via POST operations
          cacheService.set(cacheKey, records);
        }
        
        return records;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          const timeoutError = new Error(`Webhook timeout for ${tableName} after ${timeoutMs}ms`);
          console.error(`⏱️ [fetchTable] ${timeoutError.message}`);
          console.error(`⏱️ [fetchTable] Webhook URL: ${url}`);
          // Return empty array instead of throwing to prevent cascading failures
          return [];
        }
        console.error(`❌ [fetchTable] Fetch error for ${tableName}:`, fetchError.message);
        console.error(`❌ [fetchTable] Webhook URL: ${url}`);
        // Return empty array instead of throwing to prevent cascading failures
        return [];
      }
    } catch (error) {
      console.error(`❌ [fetchTable] Error fetching ${tableName}:`, error);
      console.error(`❌ [fetchTable] Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url: url || 'NO URL',
        tableName,
      });
      // Return empty array instead of throwing to prevent cascading failures
      return [];
    }
  }

  /**
   * Fetch multiple tables in parallel
   * All tables are parsed using the standardized parser
   * 
   * @param tableNames - Array of table names to fetch (must match webhookConfig.ts)
   * @returns Object with table names as keys and arrays of parsed records as values
   */
  async fetchMultipleTables(tableNames: string[]): Promise<Record<string, ParsedRecord[]>> {
    // Validate table names
    const invalidTables = tableNames.filter(t => !TABLE_NAMES.includes(t));
    if (invalidTables.length > 0) {
      console.warn(`[fetchMultipleTables] Invalid table names: ${invalidTables.join(', ')}`);
    }

    const validTables = tableNames.filter(t => TABLE_NAMES.includes(t));
    
    // Fetch all tables in parallel using standardized parser
    const fetchPromises = validTables.map(async (tableName) => {
      try {
        const data = await this.fetchTable(tableName);
        return { tableName, data, error: null };
      } catch (error: any) {
        console.error(`[fetchMultipleTables] Failed to fetch ${tableName}:`, error);
        return { tableName, data: [] as ParsedRecord[], error: error.message };
      }
    });

    const results = await Promise.all(fetchPromises);
    
    // Build result object with type-safe parsed records
    const result: Record<string, ParsedRecord[]> = {};
    results.forEach(({ tableName, data, error }) => {
      if (error) {
        console.error(`[fetchMultipleTables] Error fetching ${tableName}: ${error}`);
        result[tableName] = [];
      } else {
        result[tableName] = data;
      }
    });

    return result;
  }


  /**
   * GET User Accounts directly from dedicated webhook
   * This is used specifically for login/authentication
   * Loads only once and waits for response
   * Includes timeout to prevent Vercel function timeouts
   */
  async getUserAccounts(timeoutMs: number = 5000): Promise<UserAccount[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const webhookUrl = n8nConfig.getUserAccountsUrl;
      console.log(`[getUserAccounts] Fetching user accounts with ${timeoutMs}ms timeout`);
      console.log(`[getUserAccounts] Webhook URL: ${webhookUrl}`);
      if (!process.env.N8N_BASE_URL) {
        throw new Error('N8N_BASE_URL environment variable is required. Please set it in your environment configuration.');
      }
      const startTime = Date.now();
      
      // Wrap entire fetch + JSON parsing in Promise.race to ensure timeout works
      const fetchPromise = (async () => {
        console.log(`[getUserAccounts] Making GET request to: ${webhookUrl}`);
        const response = await fetch(webhookUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        const fetchDuration = Date.now() - startTime;
        console.log(`[getUserAccounts] Fetch completed in ${fetchDuration}ms, status: ${response.status}`);

        if (!response.ok) {
          throw new Error(`User Accounts webhook failed: ${response.status} ${response.statusText}`);
        }

        // Also timeout the JSON parsing in case response body is large
        const jsonStartTime = Date.now();
        const jsonPromise = response.json();
        const jsonTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('JSON parsing timeout')), Math.max(timeoutMs - 2000, 2000))
        );
        
        const jsonData = await Promise.race([jsonPromise, jsonTimeout]);
        const jsonDuration = Date.now() - jsonStartTime;
        console.log(`[getUserAccounts] JSON parsing completed in ${jsonDuration}ms`);
        return jsonData;
      })();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => {
          controller.abort();
          reject(new Error(`User Accounts webhook timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      );

      const data = await Promise.race([fetchPromise, timeoutPromise]) as any;
      clearTimeout(timeoutId);
      const totalDuration = Date.now() - startTime;
      console.log(`[getUserAccounts] Total duration: ${totalDuration}ms, returned ${Array.isArray(data) ? data.length : 'non-array'} records`);
      
      // The webhook returns an array of user accounts directly
      if (Array.isArray(data)) {
        return data as UserAccount[];
      }
      
      // If it's an object, try to extract User Accounts
      if (typeof data === 'object' && data !== null && data !== undefined && 'User Accounts' in data) {
        const userAccountsData = (data as Record<string, any>)['User Accounts'];
        return Array.isArray(userAccountsData) ? userAccountsData as UserAccount[] : [];
      }
      
      console.warn('Unexpected response format from User Accounts webhook');
      return [];
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError' || error.message?.includes('timed out') || error.message?.includes('timeout')) {
        throw new Error(`User Accounts webhook timed out after ${timeoutMs}ms. Please try again.`);
      }
      console.error('Error fetching User Accounts from dedicated webhook:', error);
      throw error;
    }
  }

  /**
   * Invalidate cache for a specific table
   * Only invalidates if the table name is valid and cache exists
   */
  invalidateCache(tableName: string): void {
    if (!tableName || tableName.trim() === '') {
      return; // Don't invalidate if table name is empty
    }
    const cacheKey = `table:${tableName}`;
    const hadCache = cacheService.get(cacheKey) !== null;
    cacheService.clear(cacheKey);
    // Only log if cache actually existed
    if (hadCache && process.env.LOG_CACHE_INVALIDATION === 'true') {
      console.log(`🗑️  Cache invalidated for ${tableName}`);
    }
  }

  /**
   * Invalidate cache for multiple tables
   */
  invalidateCacheMultiple(tableNames: string[]): void {
    tableNames.forEach(tableName => this.invalidateCache(tableName));
  }

  /**
   * POST data to n8n webhook
   * This will invalidate relevant caches after successful POST
   */
  async postData(webhookUrl: string, data: Record<string, any>, retries: number = 3): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[postData] Posting to webhook: ${webhookUrl} (attempt ${attempt}/${retries})`);
        console.log(`[postData] Data:`, JSON.stringify(data, null, 2));
        
        // Add timeout to prevent hanging requests (55 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout
        
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const responseText = await response.text();
          console.log(`[postData] Response status: ${response.status} ${response.statusText}`);
          console.log(`[postData] Response body: ${responseText.substring(0, 500)}`);

          if (!response.ok) {
            const errorMessage = `n8n POST webhook failed: ${response.status} ${response.statusText}. Response: ${responseText}`;
            console.error(`[postData] ${errorMessage}`);
            
            // Retry on 5xx errors or network issues
            if (response.status >= 500 || response.status === 0) {
              throw new Error(errorMessage);
            }
            // Don't retry on 4xx errors (client errors)
            throw new Error(errorMessage);
          }
          
          // Handle empty response
          if (responseText.trim() === '') {
            console.log('[postData] Empty response received, treating as success');
            // Return a proper success object that can be serialized
            return { success: true, message: 'Data posted successfully', data: null };
          }

          // Try to parse JSON response
          try {
            const parsed = JSON.parse(responseText);
            console.log('[postData] Successfully parsed JSON response:', typeof parsed);
            // Ensure we always return an object (not null or undefined)
            if (parsed === null || parsed === undefined) {
              return { success: true, message: 'Data posted successfully', data: null };
            }
            return parsed;
          } catch (parseError: any) {
            console.warn('[postData] Response is not JSON, returning as text');
            console.warn('[postData] Response text:', responseText.substring(0, 200));
            // Return a proper object structure
            return { success: true, message: 'Data posted successfully', data: { raw: responseText }, status: response.status };
          }
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error(`Webhook request timed out after 55 seconds`);
          }
          throw fetchError;
        }
      } catch (error: any) {
        lastError = error;
        console.error(`[postData] Attempt ${attempt} failed:`, error.message);
        
        // If this is the last attempt, throw the error
        if (attempt === retries) {
          console.error(`[postData] All ${retries} attempts failed for ${webhookUrl}`);
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
        console.log(`[postData] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Should never reach here, but just in case
    throw lastError || new Error('Failed to post data after all retries');
  }

  // Specific POST methods for each webhook
  async postAdminActivityLog(data: Record<string, any>) {
    return this.postData(n8nConfig.postLogUrl, data);
  }

  async postClientFormMapping(data: Record<string, any>) {
    console.log('[postClientFormMapping] Starting POST to Client Form Mapping webhook');
    console.log('[postClientFormMapping] Webhook URL:', n8nConfig.postClientFormMappingUrl);
    console.log('[postClientFormMapping] Data:', JSON.stringify(data, null, 2));
    
    try {
      const result = await this.postData(n8nConfig.postClientFormMappingUrl, data);
      console.log('[postClientFormMapping] Webhook response:', JSON.stringify(result, null, 2));
      
      // Invalidate cache for Client Form Mapping and related tables
      this.invalidateCache('Client Form Mapping');
      this.invalidateCache('Form Categories');
      this.invalidateCache('Form Fields');
      
      console.log('[postClientFormMapping] Cache invalidated, returning result');
      return result;
    } catch (error: any) {
      console.error('[postClientFormMapping] Error posting to webhook:', error.message);
      console.error('[postClientFormMapping] Error stack:', error.stack);
      throw error;
    }
  }

  async postCommissionLedger(data: Record<string, any>) {
    const result = await this.postData(n8nConfig.postCommissionLedgerUrl, data);
    // Invalidate cache for Commission Ledger
    this.invalidateCache('Commission Ledger');
    return result;
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
    const result = await this.postData(n8nConfig.postCreditTeamUsersUrl, creditUserData);
    // Invalidate cache for Credit Team Users
    this.invalidateCache('Credit Team Users');
    return result;
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
    const result = await this.postData(n8nConfig.postDailySummaryUrl, dailySummaryData);
    // Invalidate cache for Daily Summary Report
    this.invalidateCache('Daily Summary Report');
    return result;
  }

  /**
   * POST Email via n8n webhook (Outlook Send a message)
   * 
   * Webhook Path: /webhook/email
   * Used for sending daily summary reports to management
   * 
   * Expected payload format:
   * {
   *   to: string | string[], // Email recipient(s)
   *   subject: string,
   *   body: string, // HTML or plain text
   *   cc?: string | string[],
   *   bcc?: string | string[],
   * }
   */
  async postEmail(data: {
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    bcc?: string | string[];
  }): Promise<any> {
    const emailData = {
      to: Array.isArray(data.to) ? data.to.join(', ') : data.to,
      subject: data.subject,
      body: data.body,
      cc: data.cc ? (Array.isArray(data.cc) ? data.cc.join(', ') : data.cc) : '',
      bcc: data.bcc ? (Array.isArray(data.bcc) ? data.bcc.join(', ') : data.bcc) : '',
    };
    
    return this.postData(n8nConfig.postEmailUrl, emailData);
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
    const result = await this.postData(n8nConfig.postFileAuditLogUrl, fileAuditLogData);
    // Invalidate cache for File Auditing Log
    this.invalidateCache('File Auditing Log');
    return result;
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
    const result = await this.postData(n8nConfig.postFormCategoryUrl, formCategoryData);
    // Invalidate cache for Form Categories and related tables
    this.invalidateCache('Form Categories');
    this.invalidateCache('Client Form Mapping');
    return result;
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
    const result = await this.postData(n8nConfig.postFormFieldsUrl, formFieldData);
    // Invalidate cache for Form Fields and related tables
    this.invalidateCache('Form Fields');
    this.invalidateCache('Form Categories');
    return result;
  }

  async postKamUser(data: Record<string, any>) {
    const result = await this.postData(n8nConfig.postKamUsersUrl, data);
    // Invalidate cache for KAM Users
    this.invalidateCache('KAM Users');
    return result;
  }

  /**
   * POST Loan Application to n8n webhook
   * 
   * Webhook Path: /webhook/loanapplications (plural) - POST create/update operations
   * Airtable Table: Loan Applications
   * 
   * Note: GET operations use /webhook/loanapplication (singular) via fetchTable('Loan Application')
   * 
   * Called from:
   * - LoanController.createApplication() - Create new application
   * - LoanController.updateApplicationForm() - Update form data
   * - LoanController.submitApplication() - Submit draft
   * - KAMController.editApplication() - KAM edits application
   * - KAMController.forwardToCredit() - Forward to credit
   * - CreditController.markInNegotiation() - Mark in negotiation
   * - CreditController.assignNBFCs() - Assign to NBFC
   * - CreditController.captureNBFCDecision() - Record NBFC decision
   * - CreditController.markDisbursed() - Mark as disbursed
   * - NBFController.recordDecision() - NBFC records decision
   * 
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async postLoanApplication(data: Record<string, any>) {
    // Ensure only exact fields are sent to applications webhook
    // Only send: id, File ID, Client, Applicant Name, Loan Product, Requested Loan Amount,
    // Documents, Status, Assigned Credit Analyst, Assigned NBFC, Lender Decision Status,
    // Lender Decision Date, Lender Decision Remarks, Approved Loan Amount, AI File Summary,
    // Form Data, Creation Date, Submitted Date, Last Updated, Asana Task ID, Asana Task Link
    
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
      // Asana Integration fields
      'Asana Task ID': data['Asana Task ID'] || data.asanaTaskId || '',
      'Asana Task Link': data['Asana Task Link'] || data.asanaTaskLink || '',
    };
    const result = await this.postData(n8nConfig.postApplicationsUrl, loanApplicationData);
    // Invalidate cache for Loan Applications and related tables
    this.invalidateCache('Loan Application');
    this.invalidateCache('File Auditing Log');
    return result;
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
    const result = await this.postData(n8nConfig.postLoanProductsUrl, loanProductData);
    // Invalidate cache for Loan Products
    this.invalidateCache('Loan Products');
    return result;
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
    const result = await this.postData(n8nConfig.postNBFCPartnersUrl, nbfcPartnerData);
    // Invalidate cache for NBFC Partners
    this.invalidateCache('NBFC Partners');
    return result;
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
    const result = await this.postData(n8nConfig.postAddUserUrl, userAccountData);
    // Invalidate cache for User Accounts
    this.invalidateCache('User Accounts');
    return result;
  }

  async postClient(data: Record<string, any>) {
    // Ensure only exact fields are sent to Client webhook
    // Only send: id, Client ID, Client Name, Primary Contact Name, Contact Email / Phone, Assigned KAM, Enabled Modules, Commission Rate, Status, Form Categories
    console.log('[postClient] Starting postClient with data:', JSON.stringify(data, null, 2));
    console.log('[postClient] Webhook URL:', n8nConfig.postClientUrl);
    
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
    
    console.log('[postClient] Prepared clientData:', JSON.stringify(clientData, null, 2));
    console.log('[postClient] Calling postData with URL:', n8nConfig.postClientUrl);
    
    try {
      const result = await this.postData(n8nConfig.postClientUrl, clientData);
      console.log('[postClient] postData completed successfully:', JSON.stringify(result, null, 2));
      
      // Invalidate cache for Clients and related tables only after successful POST
      if (result && !result.error) {
        this.invalidateCache('Clients');
        this.invalidateCache('User Accounts');
        console.log('[postClient] Cache invalidated for Clients and User Accounts');
      } else {
        console.warn('[postClient] Result contains error, not invalidating cache:', result);
      }
      return result;
    } catch (error: any) {
      console.error('[postClient] Error in postData:', error.message);
      console.error('[postClient] Error stack:', error.stack);
      throw error;
    }
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
    const result = await this.postData(n8nConfig.postNotificationUrl, notificationData);
    // Invalidate cache for Notifications
    this.invalidateCache('Notifications');
    return result;
  }
}

export const n8nClient = new N8nClient();

