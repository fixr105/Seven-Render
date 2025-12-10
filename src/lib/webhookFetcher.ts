/**
 * Individual Table Webhook Fetcher
 * Fetches data from individual table webhooks instead of single GET webhook
 */

import { getWebhookUrl, getTableFields, TABLE_NAMES } from './webhookConfig';

export interface WebhookFetchOptions {
  tables: string[]; // Array of table names to fetch
  forceRefresh?: boolean; // Force fresh fetch even if cached
}

// Global cache for each table
const tableCache: Record<string, {
  data: any[];
  lastFetch: number;
  fetchPromise: Promise<any[]> | null;
}> = {};

// Cache duration: 30 minutes (reduced webhook executions)
const CACHE_DURATION = 1800000;

/**
 * Fetch data from a single table webhook
 */
export const fetchTableData = async (tableName: string, forceRefresh = false): Promise<any[]> => {
      const url = getWebhookUrl(tableName);
  if (!url) {
    if (import.meta.env.DEV) {
      console.warn(`No webhook URL configured for table: ${tableName}`);
    }
    return [];
  }

  const now = Date.now();
  const cache = tableCache[tableName];

  // Check cache if not forcing refresh
  if (!forceRefresh && cache) {
    if (cache.data && cache.lastFetch && (now - cache.lastFetch < CACHE_DURATION)) {
      // Only log cache hits in development mode
      if (import.meta.env.DEV) {
        console.log(`Using cached data for ${tableName} (age: ${Math.round((now - cache.lastFetch) / 1000)}s)`);
      }
      return cache.data;
    }

    // If fetch is in progress, wait for it
    if (cache.fetchPromise) {
      if (import.meta.env.DEV) {
        console.log(`Waiting for existing fetch for ${tableName}...`);
      }
      return await cache.fetchPromise;
    }
  }

  // Initialize cache if needed
  if (!tableCache[tableName]) {
    tableCache[tableName] = {
      data: [],
      lastFetch: 0,
      fetchPromise: null,
    };
  }

  // Start new fetch
  const fetchPromise = (async () => {
    try {
      // Only log in development mode to reduce console noise
      if (import.meta.env.DEV) {
        console.log(`Fetching ${tableName} from: ${url}`);
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle different response formats
      let records: any[] = [];
      
      if (Array.isArray(data)) {
        records = data;
      } else if (data.records && Array.isArray(data.records)) {
        records = data.records;
      } else if (data.data && Array.isArray(data.data)) {
        records = data.data;
      } else if (typeof data === 'object') {
        // Single record or object with table name as key
        const tableKey = Object.keys(data).find(key => 
          Array.isArray(data[key]) || 
          (typeof data[key] === 'object' && data[key] !== null)
        );
        if (tableKey && Array.isArray(data[tableKey])) {
          records = data[tableKey];
        } else {
          // Single record
          records = [data];
        }
      }

      // Only log in development mode
      if (import.meta.env.DEV) {
        console.log(`✅ Fetched ${records.length} records from ${tableName}`);
      }
      
      // Update cache
      tableCache[tableName].data = records;
      tableCache[tableName].lastFetch = Date.now();
      tableCache[tableName].fetchPromise = null;
      
      return records;
    } catch (error: any) {
      console.error(`Error fetching ${tableName}:`, error);
      tableCache[tableName].fetchPromise = null;
      throw error;
    }
  })();

  tableCache[tableName].fetchPromise = fetchPromise;
  return await fetchPromise;
};

/**
 * Fetch data from multiple table webhooks
 * Only fetches the tables specified in the options
 */
export const fetchMultipleTables = async (options: WebhookFetchOptions): Promise<Record<string, any[]>> => {
  const { tables, forceRefresh = false } = options;
  
  // Validate table names
  const invalidTables = tables.filter(t => !TABLE_NAMES.includes(t));
  if (invalidTables.length > 0 && import.meta.env.DEV) {
    console.warn(`Invalid table names: ${invalidTables.join(', ')}`);
  }

  const validTables = tables.filter(t => TABLE_NAMES.includes(t));
  
  // Fetch all tables in parallel
  const fetchPromises = validTables.map(async (tableName) => {
    try {
      const data = await fetchTableData(tableName, forceRefresh);
      return { tableName, data, error: null };
      } catch (error: any) {
        // Always log errors, but reduce verbosity in production
        if (import.meta.env.DEV) {
          console.error(`Failed to fetch ${tableName}:`, error);
        } else {
          console.error(`Failed to fetch ${tableName}: ${error.message}`);
        }
        return { tableName, data: [], error: error.message };
      }
  });

  const results = await Promise.all(fetchPromises);
  
  // Build result object
  const result: Record<string, any[]> = {};
    results.forEach(({ tableName, data, error }) => {
      if (error) {
        // Always log errors
        console.error(`Error fetching ${tableName}: ${error}`);
        result[tableName] = [];
      } else {
        result[tableName] = data;
      }
    });

  return result;
};

/**
 * Clear cache for specific tables or all tables
 */
export const clearTableCache = (tableNames?: string[]): void => {
  if (tableNames) {
    tableNames.forEach(tableName => {
      if (tableCache[tableName]) {
        tableCache[tableName].lastFetch = 0;
        tableCache[tableName].data = [];
      }
    });
  } else {
    // Clear all caches
    Object.keys(tableCache).forEach(key => {
      tableCache[key].lastFetch = 0;
      tableCache[key].data = [];
    });
  }
};

/**
 * Get cached data for a table (without fetching)
 */
export const getCachedTableData = (tableName: string): any[] | null => {
  const cache = tableCache[tableName];
  if (cache && cache.data && cache.lastFetch) {
    const now = Date.now();
    if (now - cache.lastFetch < CACHE_DURATION) {
      return cache.data;
    }
  }
  return null;
};

