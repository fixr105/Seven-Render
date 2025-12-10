/**
 * Unified Applications Hook
 * Combines data from webhook and database
 * Automatically syncs webhook data to database
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWebhookTables } from './useWebhookData';
import { useApplications, LoanApplication } from './useApplications';
import { syncWebhookRecordsToDB } from '../lib/webhookSync';
import { useAuthSafe } from './useAuthSafe';
import { supabase } from '../lib/supabase';
import { getTableFields } from '../lib/webhookConfig';

// Re-export type for compatibility
export type LoanApplicationFromWebhook = {
  id: string;
  file_number: string;
  client_id?: string;
  applicant_name: string;
  loan_product_id?: string | null;
  requested_loan_amount: number | null;
  status: string;
  client?: { company_name: string };
  loan_product?: { name: string; code: string };
  created_at: string;
  updated_at: string;
  [key: string]: any;
};

export interface UnifiedApplication extends LoanApplication {
  source: 'database' | 'webhook' | 'synced';
  webhookData?: LoanApplicationFromWebhook;
}

export const useUnifiedApplications = (options: {
  autoSync?: boolean;
  syncOnMount?: boolean;
} = {}) => {
  // Default to false - no auto-sync or auto-fetch
  const { autoSync = false, syncOnMount = false } = options;
  const { userRole, userRoleId } = useAuthSafe();
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientIds, setClientIds] = useState<string[]>([]);

  // Helper to check if userRoleId is a test user
  const isTestUser = (id: string | null | undefined): boolean => {
    return id ? id.startsWith('test-') : false;
  };

  // Helper to check if a string is a valid UUID
  const isValidUUID = (str: string | null | undefined): boolean => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Fetch client ID(s) for role-based filtering
  useEffect(() => {
    const fetchClientFilter = async () => {
      // Skip for test users
      if (isTestUser(userRoleId)) {
        setClientId(null);
        setClientIds([]);
        return;
      }

      if (userRole === 'client' && userRoleId && isValidUUID(userRoleId)) {
        const { data: clientData, error } = await supabase
          .from('dsa_clients')
          .select('id')
          .eq('user_id', userRoleId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching client data in useUnifiedApplications:', error);
          setClientId(null);
          setClientIds([]);
          return;
        }
        
        setClientId(clientData?.id || null);
        setClientIds(clientData ? [clientData.id] : []);
      } else if (userRole === 'kam' && userRoleId && isValidUUID(userRoleId)) {
        const { data: clients, error } = await supabase
          .from('dsa_clients')
          .select('id')
          .eq('kam_id', userRoleId);
        
        if (error) {
          console.error('Error fetching KAM clients in useUnifiedApplications:', error);
          setClientId(null);
          setClientIds([]);
          return;
        }
        
        setClientIds(clients?.map((c: { id: string }) => c.id) || []);
        setClientId(null);
      } else {
        setClientId(null);
        setClientIds([]);
      }
    };
    fetchClientFilter();
  }, [userRole, userRoleId]);

  // Fetch only the tables we need: Loan Application, Clients, Loan Products
  const requiredTables = ['Loan Application', 'Clients', 'Loan Products'];
  const { data: webhookData, loading: webhookLoading, error: webhookError, refetch: refetchWebhook } = useWebhookTables(requiredTables);
  
  // Transform webhook data to LoanApplicationFromWebhook format
  const webhookApps: LoanApplicationFromWebhook[] = useMemo(() => {
    const loanApps = webhookData['Loan Application'] || [];
    const clients = webhookData['Clients'] || [];
    const loanProducts = webhookData['Loan Products'] || [];
    
    // Create lookup maps
    const clientMap = new Map(clients.map((c: any) => [c['Client ID'] || c.id, c]));
    const productMap = new Map(loanProducts.map((p: any) => [p['Product ID'] || p.id, p]));
    
    // Transform loan applications
    return loanApps.map((app: any) => {
      const clientId = app['Client'] || app['Client ID'];
      const productId = app['Loan Product'] || app['Product ID'];
      const client = clientId ? clientMap.get(clientId) : null;
      const product = productId ? productMap.get(productId) : null;
      
      return {
        id: app.id,
        file_number: app['File ID'] || app.id,
        client_id: clientId,
        applicant_name: app['Applicant Name'] || 'N/A',
        loan_product_id: productId || null,
        requested_loan_amount: parseFloat(app['Requested Loan Amount']?.toString().replace(/[^0-9.]/g, '') || '0') || null,
        status: app['Status'] || 'draft',
        client: client ? { company_name: client['Client Name'] || client['Primary Contact Name'] || 'Unknown' } : undefined,
        loan_product: product ? { name: product['Product Name'] || 'N/A', code: product['Product ID'] || '' } : undefined,
        created_at: app['Creation Date'] || app['Created Time'] || new Date().toISOString(),
        updated_at: app['Last Updated'] || app['Creation Date'] || new Date().toISOString(),
        // Include all original fields
        ...app,
      } as LoanApplicationFromWebhook;
    });
  }, [webhookData]);
  
  const { applications: dbApps, loading: dbLoading, refetch: refetchDB } = useApplications();

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Filter webhook apps by role (client/KAM filtering)
  const filteredWebhookApps = useMemo(() => {
    if (userRole === 'client' && clientId) {
      // For client: filter by client_id or client identifier
      return webhookApps.filter(app => {
        const appClientId = app.client_id || (app as any).client;
        const appClientName = app.client?.company_name || (app as any).client_name;
        // If webhook has client_id, match it
        // Otherwise, we'll need to resolve it later, so include it for now
        return !appClientId || appClientId === clientId;
      });
    } else if (userRole === 'kam' && clientIds.length > 0) {
      // For KAM: filter by client_ids
      return webhookApps.filter(app => {
        const appClientId = app.client_id || (app as any).client;
        return !appClientId || clientIds.includes(appClientId);
      });
    }
    // For other roles (credit_team, nbfc), show all
    return webhookApps;
  }, [webhookApps, userRole, clientId, clientIds]);

  // Sync webhook data to database
  const syncToDatabase = useCallback(async () => {
    // Skip sync for test users
    if (isTestUser(userRoleId)) {
      if (import.meta.env.DEV) {
        console.warn('Test user detected - skipping webhook sync. Please use real authentication for full functionality.');
      }
      return;
    }

    // Only sync filtered webhook apps (respecting role-based filtering)
    if (!autoSync || filteredWebhookApps.length === 0) return;

    setSyncing(true);
    setSyncError(null);

    try {
      if (import.meta.env.DEV) {
        console.log(`Syncing ${filteredWebhookApps.length} webhook records to database...`);
      }
      
      const results = await syncWebhookRecordsToDB(filteredWebhookApps, {
        upsert: true,
        updateExisting: true,
      });

      if (import.meta.env.DEV) {
        console.log(`Sync complete: ${results.success} succeeded, ${results.failed} failed`);
      }
      
      if (results.failed > 0) {
        console.error('Sync errors:', results.errors);
        // Check if errors are RLS-related
        const rlsErrors = results.errors.filter((e: any) => e.code === '42501');
        if (rlsErrors.length > 0) {
          setSyncError(`${results.failed} records failed to sync due to permissions. Please ensure you have proper access or contact an administrator.`);
        } else {
          setSyncError(`${results.failed} records failed to sync. Check console for details.`);
        }
      }

      setLastSyncTime(new Date());
      
      // Refresh database data after sync
      await refetchDB();
    } catch (error: any) {
      console.error('Error syncing webhook data:', error);
      if (error.code === '42501') {
        setSyncError('Permission denied: Unable to sync webhook data. Please ensure you have proper access or contact an administrator.');
      } else {
        setSyncError(error.message || 'Failed to sync webhook data to database');
      }
    } finally {
      setSyncing(false);
    }
  }, [filteredWebhookApps, autoSync, refetchDB, userRoleId]);

  // Auto-sync on mount if explicitly enabled (default: false)
  // Only syncs if syncOnMount is true AND webhook data is available
  useEffect(() => {
    if (syncOnMount && !webhookLoading && !dbLoading && filteredWebhookApps.length > 0 && !syncing) {
      syncToDatabase();
    }
  }, [syncOnMount, webhookLoading, dbLoading, filteredWebhookApps.length, syncing, syncToDatabase]);

  // Merge and deduplicate applications
  // CRITICAL: Use file_number for deduplication, not id, because:
  // - Database records have UUIDs as id
  // - Webhook records have Airtable IDs (recXXX) as id
  // - These will never match, so we use file_number as the business identifier
  const unifiedApplications: UnifiedApplication[] = useMemo(() => {
    const merged: Map<string, UnifiedApplication> = new Map();

    // Add database applications first (source of truth)
    // These are already filtered by role in useApplications
    // Use file_number as key for deduplication
    dbApps.forEach(app => {
      const key = app.file_number || app.id;
      merged.set(key, {
        ...app,
        source: 'database',
      });
    });

    // Add filtered webhook applications (will be synced if not in DB)
    filteredWebhookApps.forEach(webhookApp => {
      // Use file_number for matching, fallback to id if file_number not available
      const key = webhookApp.file_number || webhookApp.id;
      const existing = merged.get(key);
      
      if (existing) {
        // Update with webhook data but keep DB as source
        merged.set(key, {
          ...existing,
          webhookData: webhookApp,
          source: 'synced',
        });
      } else {
        // New from webhook, will be synced
        merged.set(key, {
          ...webhookApp as any,
          source: 'webhook',
          webhookData: webhookApp,
        });
      }
    });

    return Array.from(merged.values());
  }, [dbApps, filteredWebhookApps]);

  const loading = webhookLoading || dbLoading || syncing;
  const error = webhookError || syncError;

  const refetch = useCallback(async () => {
    // Refetch webhook tables (force refresh)
    await refetchWebhook();
    await refetchDB();
    if (autoSync) {
      await syncToDatabase();
    }
  }, [refetchWebhook, refetchDB, autoSync, syncToDatabase]);

  return {
    applications: unifiedApplications,
    loading,
    error,
    syncing,
    lastSyncTime,
    refetch,
    syncToDatabase,
    webhookCount: filteredWebhookApps.length,
    dbCount: dbApps.length,
  };
};

