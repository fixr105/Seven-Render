/**
 * Query Service
 * Handles query/audit log operations with proper File Auditing Log and Notification integration
 */

import { n8nClient } from '../airtable/n8nClient.js';
import { notificationService } from '../notifications/notification.service.js';
import { parseQueryContent } from '../../utils/queryParser.js';

export interface QueryThread {
  rootQuery: {
    id: string;
    fileId: string;
    message: string;
    actor: string;
    timestamp: string;
    targetUserRole: string;
    resolved: boolean;
    actionEventType: string;
    editHistory?: Array<{ editedAt: string }>;
  };
  replies: Array<{
    id: string;
    message: string;
    actor: string;
    timestamp: string;
    targetUserRole: string;
    resolved: boolean;
  }>;
  isResolved: boolean;
  totalReplies: number;
}

export class QueryService {
  /**
   * Create a query entry in File Auditing Log and send notification
   */
  async createQuery(
    fileId: string,
    clientId: string,
    actor: string,
    actorRole: string,
    message: string,
    targetUserRole: string,
    actionEventType: string = 'query_raised'
  ): Promise<string> {
    const queryId = `QUERY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Create File Auditing Log entry
    await n8nClient.postFileAuditLog({
      id: queryId,
      'Log Entry ID': queryId,
      File: fileId,
      Timestamp: timestamp,
      Actor: actor,
      'Action/Event Type': actionEventType,
      'Details/Message': message,
      'Target User/Role': targetUserRole,
      Resolved: 'False',
    });

    // Get recipient email based on target role
    let recipientEmail = '';
    let recipientRole = targetUserRole;

    if (targetUserRole === 'client') {
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => c.id === clientId || c['Client ID'] === clientId);
      recipientEmail = client?.['Contact Email / Phone']?.split(' / ')[0] || '';
    } else if (targetUserRole === 'kam') {
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => c.id === clientId || c['Client ID'] === clientId);
      const kamId = client?.['Assigned KAM'] || '';
      
      if (kamId) {
        const kamUsers = await n8nClient.fetchTable('KAM Users');
        const kamUser = kamUsers.find((k: any) => k.id === kamId || k['KAM ID'] === kamId);
        recipientEmail = kamUser?.Email || '';
      }
    } else if (targetUserRole === 'credit_team') {
      const creditUsers = await n8nClient.fetchTable('Credit Team Users');
      const activeCredit = creditUsers.find(
        (u: any) => (u.Status || u.status || '').toLowerCase() === 'active' && (u.Email || u.email)
      );
      recipientEmail = activeCredit?.Email || activeCredit?.email || '';
      recipientRole = 'credit_team';
    }

    // Create notification if we have a recipient
    if (recipientEmail || recipientRole) {
      try {
        await notificationService.notifyQueryCreated(
          fileId,
          clientId,
          message,
          recipientEmail || actor, // Fallback to actor if no email found
          recipientRole,
          actor
        );
      } catch (error) {
        console.error('Failed to create notification for query:', error);
        // Don't fail the query creation if notification fails
      }
    }

    return queryId;
  }

  /**
   * Create a reply to an existing query
   */
  async createQueryReply(
    parentQueryId: string,
    fileId: string,
    clientId: string,
    actor: string,
    actorRole: string,
    message: string,
    targetUserRole: string
  ): Promise<string> {
    const replyId = `QUERY-REPLY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Get parent query to determine original target
    const auditLogs = await n8nClient.fetchTable('File Auditing Log');
    const parentQuery = auditLogs.find((q: any) => q.id === parentQueryId);

    if (!parentQuery) {
      throw new Error('Parent query not found');
    }

    // Create reply entry - format message to include parent reference for threading
    const replyMessage = `Reply to query ${parentQueryId}: ${message}`;
    
    await n8nClient.postFileAuditLog({
      id: replyId,
      'Log Entry ID': replyId,
      File: fileId,
      Timestamp: timestamp,
      Actor: actor,
      'Action/Event Type': 'query_reply',
      'Details/Message': replyMessage,
      'Target User/Role': targetUserRole || parentQuery['Target User/Role'] || '',
      Resolved: 'False',
    });

    // Get recipient email for notification
    let recipientEmail = '';
    let recipientRole = targetUserRole || parentQuery['Target User/Role'] || '';

    if (recipientRole === 'client') {
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => c.id === clientId || c['Client ID'] === clientId);
      recipientEmail = client?.['Contact Email / Phone']?.split(' / ')[0] || '';
    } else if (recipientRole === 'kam') {
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => c.id === clientId || c['Client ID'] === clientId);
      const kamId = client?.['Assigned KAM'] || '';
      
      if (kamId) {
        const kamUsers = await n8nClient.fetchTable('KAM Users');
        const kamUser = kamUsers.find((k: any) => k.id === kamId || k['KAM ID'] === kamId);
        recipientEmail = kamUser?.Email || '';
      }
    }

    // Create notification
    if (recipientEmail || recipientRole) {
      try {
        await notificationService.notifyQueryReply(
          fileId,
          clientId,
          message,
          recipientEmail || actor,
          recipientRole,
          actor
        );
      } catch (error) {
        console.error('Failed to create notification for query reply:', error);
      }
    }

    return replyId;
  }

  /**
   * Get all queries for a file, grouped into threads
   */
  async getQueriesForFile(fileId: string): Promise<QueryThread[]> {
    const auditLogs = await n8nClient.fetchTable('File Auditing Log');

    // Filter for query-related entries for this file
    const queryEntries = auditLogs.filter((log: any) => {
      const isForFile = log.File === fileId;
      const isQuery = log['Action/Event Type']?.toLowerCase().includes('query');
      return isForFile && isQuery;
    });

    // Group into threads - root queries are those that are not replies and not edit/resolution entries
    const actionType = (e: any) => (e['Action/Event Type'] || '').toLowerCase();
    const rootQueries = queryEntries.filter((entry: any) => {
      const message = entry['Details/Message'] || '';
      if (message.includes('Reply to query')) return false;
      if (actionType(entry).includes('query_edited') || actionType(entry).includes('query_resolved')) return false;
      return true;
    });

    // Build threads
    const threads: QueryThread[] = rootQueries.map((root: any) => {
      const rawMessage = (root['Details/Message'] ?? '').toString();
      const parsed = parseQueryContent(rawMessage);
      let rootMessage = parsed.message?.trim() || '(No message)';
      if (/^Reply to query\s+\S+\s*:?\s*$/.test(rootMessage)) {
        rootMessage = '(No message)';
      }
      const rootId = root.id;

      // Edit history for this root query
      const editHistory = queryEntries
        .filter((entry: any) => actionType(entry).includes('query_edited') && (entry['Details/Message'] || '').includes(`Edit of query ${rootId} at `))
        .map((entry: any) => {
          const msg = entry['Details/Message'] || '';
          const atMatch = msg.match(/Edit of query \S+ at ([^:]+):/);
          return { editedAt: atMatch ? atMatch[1].trim() : entry.Timestamp || '' };
        })
        .sort((a, b) => (a.editedAt > b.editedAt ? -1 : 1));

      // Find all replies to this root query
      const replies = queryEntries
        .filter((entry: any) => {
          const message = entry['Details/Message'] || '';
          return message.includes(`Reply to query ${rootId}`);
        })
        .map((entry: any) => {
          const message = entry['Details/Message'] || '';
          // Extract the actual reply message (after "Reply to query ID: ")
          const replyMessage = message.replace(`Reply to query ${rootId}: `, '').trim();
          
          return {
            id: entry.id,
            message: replyMessage,
            actor: entry.Actor || '',
            timestamp: entry.Timestamp || '',
            targetUserRole: entry['Target User/Role'] || '',
            resolved: entry.Resolved === 'True',
          };
        })
        .sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
        });

      return {
        rootQuery: {
          id: root.id,
          fileId: root.File || fileId,
          message: rootMessage,
          actor: root.Actor || '',
          timestamp: root.Timestamp || '',
          targetUserRole: root['Target User/Role'] || '',
          resolved: root.Resolved === 'True',
          actionEventType: root['Action/Event Type'] || '',
          editHistory: editHistory.length > 0 ? editHistory : undefined,
        },
        replies,
        isResolved: root.Resolved === 'True',
        totalReplies: replies.length,
      };
    });

    // Sort threads by timestamp (newest first)
    threads.sort((a, b) => {
      const timeA = a.rootQuery.timestamp ? new Date(a.rootQuery.timestamp).getTime() : 0;
      const timeB = b.rootQuery.timestamp ? new Date(b.rootQuery.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    return threads;
  }

  /** Allowed time window (ms) to edit own query after creation. Default 15 minutes. */
  private readonly QUERY_EDIT_WINDOW_MS = 15 * 60 * 1000;

  /**
   * Update (edit) a query by the author within the allowed time window. Appends edit history as a new audit row.
   */
  async updateQuery(
    queryId: string,
    fileId: string,
    userEmail: string,
    newMessage: string
  ): Promise<void> {
    const auditLogs = await n8nClient.fetchTable('File Auditing Log');
    const query = auditLogs.find((q: any) => q.id === queryId);

    if (!query) {
      throw new Error('Query not found');
    }

    if (query.File !== fileId) {
      throw new Error('Query does not belong to this application');
    }

    const actor = (query.Actor || '').trim();
    if (!actor || actor.toLowerCase() !== (userEmail || '').toLowerCase()) {
      throw new Error('Only the query author can edit this query');
    }

    const created = new Date(query.Timestamp || 0).getTime();
    const now = Date.now();
    if (now - created > this.QUERY_EDIT_WINDOW_MS) {
      throw new Error('Query can only be edited within 15 minutes of creation');
    }

    const previousMessage = query['Details/Message'] || '';
    if (previousMessage === newMessage) {
      return;
    }

    await n8nClient.postFileAuditLog({
      ...query,
      'Details/Message': newMessage,
    });

    const editId = `QUERY-EDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const editTimestamp = new Date().toISOString();
    await n8nClient.postFileAuditLog({
      id: editId,
      'Log Entry ID': editId,
      File: fileId,
      Timestamp: editTimestamp,
      Actor: userEmail,
      'Action/Event Type': 'query_edited',
      'Details/Message': `Edit of query ${queryId} at ${editTimestamp}: "${previousMessage.substring(0, 200)}${previousMessage.length > 200 ? '...' : ''}" → "${newMessage.substring(0, 200)}${newMessage.length > 200 ? '...' : ''}"`,
      'Target User/Role': query['Target User/Role'] || '',
      Resolved: query.Resolved || 'False',
    });
  }

  /**
   * Resolve a query and create resolution log entry.
   * Only the query author can resolve, regardless of role.
   */
  async resolveQuery(
    queryId: string,
    fileId: string,
    clientId: string,
    resolvedBy: string,
    resolutionMessage?: string,
    _resolverRole?: string
  ): Promise<void> {
    const auditLogs = await n8nClient.fetchTable('File Auditing Log');
    const query = auditLogs.find((q: any) => q.id === queryId);

    if (!query) {
      throw new Error('Query not found');
    }

    const queryActor = (query.Actor || '').trim().toLowerCase();
    const resolverEmail = (resolvedBy || '').trim().toLowerCase();
    if (queryActor && resolverEmail !== queryActor) {
      throw new Error('Only the query author can resolve this query');
    }

    // Update query to resolved
    await n8nClient.postFileAuditLog({
      ...query,
      Resolved: 'True',
    });

    // Create resolution log entry
    const resolutionId = `QUERY-RESOLVE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const resolutionText = resolutionMessage || `Query resolved by ${resolvedBy}`;

    await n8nClient.postFileAuditLog({
      id: resolutionId,
      'Log Entry ID': resolutionId,
      File: fileId,
      Timestamp: new Date().toISOString(),
      Actor: resolvedBy,
      'Action/Event Type': 'query_resolved',
      'Details/Message': `Query ${queryId} resolved: ${resolutionText}`,
      'Target User/Role': query['Target User/Role'] || '',
      Resolved: 'True',
    });
  }
}

export const queryService = new QueryService();

