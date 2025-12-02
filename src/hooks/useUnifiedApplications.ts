/**
 * Unified Applications Hook
 * Combines data from webhook and database
 * Automatically syncs webhook data to database
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWebhookApplications, LoanApplicationFromWebhook } from './useWebhookData';
import { useApplications, LoanApplication } from './useApplications';
import { syncWebhookRecordsToDB } from '../lib/webhookSync';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export interface UnifiedApplication extends LoanApplication {
  source: 'database' | 'webhook' | 'synced';
  webhookData?: LoanApplicationFromWebhook;
}

export const useUnifiedApplications = (options: {
  autoSync?: boolean;
  syncOnMount?: boolean;
} = {}) => {
  const { autoSync = true, syncOnMount = true } = options;
  const { userRole, userRoleId } = useAuth();
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
        
        setClientIds(clients?.map(c => c.id) || []);
        setClientId(null);
      } else {
        setClientId(null);
        setClientIds([]);
      }
    };
    fetchClientFilter();
  }, [userRole, userRoleId]);

  // Fetch from both sources
  const { applications: webhookApps, loading: webhookLoading, error: webhookError, refetch: refetchWebhook } = useWebhookApplications();
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
      console.warn('Test user detected - skipping webhook sync. Please use real authentication for full functionality.');
      return;
    }

    // Only sync filtered webhook apps (respecting role-based filtering)
    if (!autoSync || filteredWebhookApps.length === 0) return;

    setSyncing(true);
    setSyncError(null);

    try {
      console.log(`Syncing ${filteredWebhookApps.length} webhook records to database...`);
      
      const results = await syncWebhookRecordsToDB(filteredWebhookApps, {
        upsert: true,
        updateExisting: true,
      });

      console.log(`Sync complete: ${results.success} succeeded, ${results.failed} failed`);
      
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

  // Auto-sync on mount if enabled
  // Wait for both webhook and DB data to load before syncing to prevent race conditions
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
    await Promise.all([refetchWebhook(), refetchDB()]);
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

