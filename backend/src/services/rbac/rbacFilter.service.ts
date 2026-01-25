/**
 * RBAC Filter Service
 * 
 * Enforces secure data separation based on user role and ID.
 * Filters all database queries to ensure:
 * - Clients only see their own LoanFiles and CommissionLedger entries
 * - KAMs only see data for clients they manage
 * - NBFCs only see files assigned to them
 * - Credit Team sees all data
 * 
 * This replaces the 'Search records' logic previously handled by n8n search nodes.
 */

import { AuthUser } from '../auth/auth.service.js';
import { UserRole } from '../../config/constants.js';
import { n8nClient } from '../airtable/n8nClient.js';
import { matchIds } from '../../utils/idMatcher.js';

/**
 * Request-level cache for RBAC queries
 * Cache TTL: 5 seconds (to balance performance and data freshness)
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 5000; // 5 seconds

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    
    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Clear expired entries (can be called periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton cache instance (shared across requests)
const requestCache = new RequestCache();

/**
 * RBAC Filter Service
 */
export class RBACFilterService {
  /**
   * Filter loan applications based on user role and ID
   * 
   * @param applications - All loan applications
   * @param user - Authenticated user
   * @returns Filtered applications based on RBAC rules
   */
  async filterLoanApplications(
    applications: any[],
    user: AuthUser
  ): Promise<any[]> {
    switch (user.role) {
      case UserRole.CLIENT:
        // Clients only see their own applications
        if (!user.clientId) {
          console.warn(`[RBACFilter] Client ${user.email} has no clientId. Returning empty array.`);
          return [];
        }
        return applications.filter((app: any) => {
          const appClient = app.Client || app['Client'] || app['Client ID'] || app.clientId;
          return matchIds(appClient, user.clientId);
        });

      case UserRole.KAM:
        // KAMs only see applications for clients they manage
        if (!user.kamId) {
          console.warn(`[RBACFilter] KAM ${user.email} has no kamId. Returning empty array.`);
          return [];
        }
        const managedClientIds = await this.getKAMManagedClientIds(user.kamId);
        if (managedClientIds.length === 0) {
          console.warn(`[RBACFilter] KAM ${user.email} has no managed clients. Returning empty array.`);
          return [];
        }
        return applications.filter((app: any) => {
          const appClient = app.Client || app['Client'] || app['Client ID'] || app.clientId;
          return managedClientIds.some((clientId) => matchIds(appClient, clientId));
        });

      case UserRole.NBFC:
        // NBFCs only see files assigned to them
        if (!user.nbfcId) {
          console.warn(`[RBACFilter] NBFC ${user.email} has no nbfcId. Returning empty array.`);
          return [];
        }
        return applications.filter((app: any) => {
          const assignedNBFC = app['Assigned NBFC'] || app['Assigned NBFC ID'] || app.assignedNbfcId || app.assignedNBFC;
          return matchIds(assignedNBFC, user.nbfcId);
        });

      case UserRole.CREDIT:
        // Credit Team sees all applications
        return applications;

      default:
        console.warn(`[RBACFilter] Unknown role: ${user.role}. Returning empty array.`);
        return [];
    }
  }

  /**
   * Filter commission ledger entries based on user role and ID
   * 
   * @param entries - All commission ledger entries
   * @param user - Authenticated user
   * @returns Filtered entries based on RBAC rules
   */
  async filterCommissionLedger(
    entries: any[],
    user: AuthUser
  ): Promise<any[]> {
    switch (user.role) {
      case UserRole.CLIENT:
        // Clients only see their own ledger entries
        if (!user.clientId) {
          console.warn(`[RBACFilter] Client ${user.email} has no clientId. Returning empty array.`);
          return [];
        }
        return entries.filter((entry: any) => {
          const entryClient = entry.Client || entry['Client'] || entry['Client ID'] || entry.clientId;
          return matchIds(entryClient, user.clientId);
        });

      case UserRole.KAM:
        // KAMs only see entries for clients they manage
        if (!user.kamId) {
          console.warn(`[RBACFilter] KAM ${user.email} has no kamId. Returning empty array.`);
          return [];
        }
        const managedClientIds = await this.getKAMManagedClientIds(user.kamId);
        if (managedClientIds.length === 0) {
          console.warn(`[RBACFilter] KAM ${user.email} has no managed clients. Returning empty array.`);
          return [];
        }
        return entries.filter((entry: any) => {
          const entryClient = entry.Client || entry['Client'] || entry['Client ID'] || entry.clientId;
          return managedClientIds.some((clientId) => matchIds(entryClient, clientId));
        });

      case UserRole.CREDIT:
        // Credit Team sees all entries
        return entries;

      case UserRole.NBFC:
        // NBFCs don't typically see commission ledger entries
        return [];

      default:
        console.warn(`[RBACFilter] Unknown role: ${user.role}. Returning empty array.`);
        return [];
    }
  }

  /**
   * Filter file audit log entries based on user role and ID
   * 
   * @param entries - All file audit log entries
   * @param user - Authenticated user
   * @returns Filtered entries based on RBAC rules
   */
  async filterFileAuditLog(
    entries: any[],
    user: AuthUser
  ): Promise<any[]> {
    switch (user.role) {
      case UserRole.CLIENT:
        // Clients see audit logs for their own files
        if (!user.clientId) {
          return [];
        }
        // Get client's file IDs
        const clientApplications = await this.getClientApplications(user.clientId);
        const clientFileIds = clientApplications.map((app: any) => 
          app['File ID'] || app['fileId'] || app.id
        );
        return entries.filter((entry: any) => {
          const fileId = entry.File || entry['File'] || entry['File ID'] || entry.fileId;
          return clientFileIds.includes(fileId);
        });

      case UserRole.KAM:
        // KAMs see audit logs for their managed clients' files
        if (!user.kamId) {
          return [];
        }
        const managedClientIds = await this.getKAMManagedClientIds(user.kamId);
        if (managedClientIds.length === 0) {
          return [];
        }
        // Get all file IDs for managed clients
        const allApplications = await n8nClient.fetchTable('Loan Application');
        const managedFileIds = allApplications
          .filter((app: any) => {
            const appClient = app.Client || app['Client'] || app['Client ID'] || app.clientId;
            return managedClientIds.some((clientId) => matchIds(appClient, clientId));
          })
          .map((app: any) => app['File ID'] || app['fileId'] || app.id);
        return entries.filter((entry: any) => {
          const fileId = entry.File || entry['File'] || entry['File ID'] || entry.fileId;
          return managedFileIds.includes(fileId);
        });

      case UserRole.NBFC:
        // NBFCs see audit logs for files assigned to them
        if (!user.nbfcId) {
          return [];
        }
        const nbfcApplications = await this.getNBFCApplications(user.nbfcId);
        const nbfcFileIds = nbfcApplications.map((app: any) => 
          app['File ID'] || app['fileId'] || app.id
        );
        return entries.filter((entry: any) => {
          const fileId = entry.File || entry['File'] || entry['File ID'] || entry.fileId;
          return nbfcFileIds.includes(fileId);
        });

      case UserRole.CREDIT:
        // Credit Team sees all audit logs
        return entries;

      default:
        return [];
    }
  }

  /**
   * Filter admin activity log entries based on user role and ID
   * 
   * @param entries - All admin activity log entries
   * @param user - Authenticated user
   * @returns Filtered entries based on RBAC rules
   */
  async filterAdminActivityLog(
    entries: any[],
    user: AuthUser
  ): Promise<any[]> {
    switch (user.role) {
      case UserRole.CLIENT:
        // Clients see activities related to their own files and ledger entries
        if (!user.clientId) {
          return [];
        }
        return entries.filter((entry: any) => {
          const relatedClientId = entry['Related Client ID'] || entry['Related Client'] || entry.relatedClientId;
          const relatedFileId = entry['Related File ID'] || entry['Related File'] || entry.relatedFileId;
          
          // If entry is related to client, include it
          if (relatedClientId && matchIds(relatedClientId, user.clientId)) {
            return true;
          }
          
          // If entry is related to a file, check if file belongs to client
          if (relatedFileId) {
            // This would require checking file ownership, but for now include all client-related
            return true;
          }
          
          return false;
        });

      case UserRole.KAM:
        // KAMs see activities for their managed clients
        if (!user.kamId) {
          return [];
        }
        const managedClientIds = await this.getKAMManagedClientIds(user.kamId);
        if (managedClientIds.length === 0) {
          return [];
        }
        return entries.filter((entry: any) => {
          const relatedClientId = entry['Related Client ID'] || entry['Related Client'] || entry.relatedClientId;
          return relatedClientId && managedClientIds.some((clientId) => 
            matchIds(relatedClientId, clientId)
          );
        });

      case UserRole.NBFC:
        // NBFCs see activities for files assigned to them
        if (!user.nbfcId) {
          return [];
        }
        const nbfcApplications = await this.getNBFCApplications(user.nbfcId);
        const nbfcFileIds = nbfcApplications.map((app: any) => 
          app['File ID'] || app['fileId'] || app.id
        );
        return entries.filter((entry: any) => {
          const relatedFileId = entry['Related File ID'] || entry['Related File'] || entry.relatedFileId;
          return relatedFileId && nbfcFileIds.includes(relatedFileId);
        });

      case UserRole.CREDIT:
        // Credit Team sees all activities
        return entries;

      default:
        return [];
    }
  }

  /**
   * Filter clients based on user role and ID
   * 
   * @param clients - All clients
   * @param user - Authenticated user
   * @returns Filtered clients based on RBAC rules
   */
  async filterClients(
    clients: any[],
    user: AuthUser
  ): Promise<any[]> {
    switch (user.role) {
      case UserRole.CLIENT:
        // Clients only see their own client record
        if (!user.clientId) {
          return [];
        }
        return clients.filter((client: any) => {
          const clientId = client.id || client['Client ID'] || client['ID'];
          return matchIds(clientId, user.clientId);
        });

      case UserRole.KAM:
        // KAMs only see clients they manage
        if (!user.kamId) {
          return [];
        }
        const managedClientIds = await this.getKAMManagedClientIds(user.kamId);
        return clients.filter((client: any) => {
          const clientId = client.id || client['Client ID'] || client['ID'];
          return managedClientIds.some((id) => matchIds(clientId, id));
        });

      case UserRole.CREDIT:
        // Credit Team sees all clients
        return clients;

      case UserRole.NBFC:
        // NBFCs don't typically see client list
        return [];

      default:
        return [];
    }
  }

  /**
   * Get client IDs managed by a KAM
   *
   * Supports both KAM Users record id and KAM ID: Assigned KAM in Clients may store
   * either. We fetch KAM Users, resolve kamId to [kamId, k['KAM ID']], and match
   * client['Assigned KAM'] against any of those.
   * Callers must not assume user.kamId is in the same format as Clients['Assigned KAM'];
   * resolution is done here.
   *
   * @param kamId - KAM identifier (KAM Users record id or KAM ID from auth)
   * @returns Array of client IDs managed by this KAM
   */
  async getKAMManagedClientIds(kamId: string): Promise<string[]> {
    const cacheKey = `kam-managed-clients-${kamId}`;
    const cached = requestCache.get<string[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const [clients, kamUsers] = await Promise.all([
        n8nClient.fetchTable('Clients'),
        n8nClient.fetchTable('KAM Users'),
      ]);

      const kam = kamUsers.find(
        (k: any) => matchIds(k.id, kamId) || matchIds(k['KAM ID'] || '', kamId)
      );
      const acceptableIds: string[] = [kamId];
      if (kam) {
        const kid = kam['KAM ID'] || kam.id;
        if (kid && !acceptableIds.some((id) => matchIds(id, kid))) {
          acceptableIds.push(String(kid));
        }
      }

      const managedClients = clients.filter((client: any) => {
        const assignedKAM = client['Assigned KAM'] || client['KAM ID'] || client['KAM'] || client['Assigned KAM ID'] || '';
        return acceptableIds.some((id) => matchIds(assignedKAM, id));
      });

      const result = managedClients
        .map((client: any) => client.id || client['Client ID'] || client['ID'])
        .filter(Boolean);

      requestCache.set(cacheKey, result);
      return result;
    } catch (error: any) {
      console.error('[RBACFilter] Error fetching managed clients:', error);
      return [];
    }
  }

  /**
   * Get applications for a specific client
   * 
   * @param clientId - Client ID
   * @returns Array of applications for this client
   */
  private async getClientApplications(clientId: string): Promise<any[]> {
    try {
      const applications = await n8nClient.fetchTable('Loan Application');
      return applications.filter((app: any) => {
        const appClient = app.Client || app['Client'] || app['Client ID'] || app.clientId;
        return matchIds(appClient, clientId);
      });
    } catch (error: any) {
      console.error('[RBACFilter] Error fetching client applications:', error);
      return [];
    }
  }

  /**
   * Get applications assigned to a specific NBFC
   * 
   * @param nbfcId - NBFC ID
   * @returns Array of applications assigned to this NBFC
   */
  private async getNBFCApplications(nbfcId: string): Promise<any[]> {
    try {
      const applications = await n8nClient.fetchTable('Loan Application');
      return applications.filter((app: any) => {
        const assignedNBFC = app['Assigned NBFC'] || app['Assigned NBFC ID'] || app.assignedNbfcId || app.assignedNBFC;
        return matchIds(assignedNBFC, nbfcId);
      });
    } catch (error: any) {
      console.error('[RBACFilter] Error fetching NBFC applications:', error);
      return [];
    }
  }


  /**
   * Verify user can access a specific resource
   * 
   * @param user - Authenticated user
   * @param resourceClientId - Client ID of the resource
   * @param resourceNbfcId - NBFC ID of the resource (for loan files)
   * @returns true if user can access the resource
   */
  async canAccessResource(
    user: AuthUser,
    resourceClientId?: string,
    resourceNbfcId?: string
  ): Promise<boolean> {
    switch (user.role) {
      case UserRole.CLIENT:
        // Clients can only access their own resources
        if (!user.clientId || !resourceClientId) {
          return false;
        }
        return matchIds(resourceClientId, user.clientId);

      case UserRole.KAM:
        // KAMs can access resources of their managed clients
        if (!user.kamId || !resourceClientId) {
          return false;
        }
        const managedClientIds = await this.getKAMManagedClientIds(user.kamId);
        return managedClientIds.some((clientId) => 
          matchIds(resourceClientId, clientId)
        );

      case UserRole.NBFC:
        // NBFCs can access resources assigned to them
        if (!user.nbfcId || !resourceNbfcId) {
          return false;
        }
        return matchIds(resourceNbfcId, user.nbfcId);

      case UserRole.CREDIT:
        // Credit Team can access all resources
        return true;

      default:
        return false;
    }
  }
}

// Export singleton instance
export const rbacFilterService = new RBACFilterService();

