/**
 * Queries Controller
 * Handles threaded query discussions using embedded metadata
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import {
  parseQueryContent,
  buildQueryContent,
  updateQueryStatus,
  getParentId,
} from '../utils/queryParser.js';

export class QueriesController {
  /**
   * POST /queries/:parentId/replies
   * Post a reply to a query (creates child query)
   */
  async postReply(req: Request, res: Response): Promise<void> {
    try {
      const { parentId } = req.params;
      const { message, fileId, actor, targetUserRole } = req.body;

      if (!message || !message.trim()) {
        res.status(400).json({
          success: false,
          error: 'Message is required',
        });
        return;
      }

      // Get all data to verify parent exists
      // Note: Queries are stored in File Auditing Log, not a separate table
      // Fetch File Auditing Log and filter for query action types
      const auditLogs = await n8nClient.fetchTable('File Auditing Log');
      const queries = auditLogs.filter((log: any) => 
        log['Action/Event Type']?.toLowerCase().includes('query')
      );
      
      // Find parent query
      const parentQuery = queries.find((q: any) => q.id === parentId);
      
      if (!parentQuery) {
        res.status(404).json({
          success: false,
          error: 'Parent query not found',
        });
        return;
      }

      // Parse parent content to get file ID if not provided
      const parentContent = parentQuery.Content || parentQuery.content || '';
      const parentMetadata = parseQueryContent(parentContent);
      const queryFileId = fileId || parentQuery.File || parentQuery.file || '';

      // Build reply content with parent reference
      const replyContent = buildQueryContent(message.trim(), {
        parent: parentId,
        status: 'open',
      });

      // Create reply entry in File Auditing Log
      const replyId = `QUERY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Post to File Auditing Log - this is critical, so we must fail if it doesn't work
      await n8nClient.postFileAuditLog({
        id: replyId,
        'Log Entry ID': replyId,
        File: queryFileId,
        Timestamp: new Date().toISOString(),
        Actor: actor || req.user!.email,
        'Action/Event Type': 'query_reply',
        'Details/Message': replyContent, // Contains embedded metadata
        'Target User/Role': targetUserRole || parentQuery['Target User/Role'] || '',
        Resolved: 'False',
      });

      res.json({
        success: true,
        data: {
          id: replyId,
          parentId,
          message: message.trim(),
          content: replyContent,
          status: 'open',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to post reply',
      });
    }
  }

  /**
   * GET /queries/thread/:id
   * Get root query and all replies (thread)
   */
  async getThread(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch File Auditing Log table
      const auditLogs = await n8nClient.fetchTable('File Auditing Log');
      
      // Filter for query-related entries
      const queryEntries = auditLogs.filter(
        (log: any) =>
          log['Action/Event Type']?.includes('query') ||
          (log['Details/Message'] && (
            log['Details/Message'].includes('[[parent:') ||
            log['Details/Message'].includes('[[status:')
          ))
      );

      // Find root query
      const rootQuery = queryEntries.find((q: any) => q.id === id);
      
      if (!rootQuery) {
        res.status(404).json({
          success: false,
          error: 'Query not found',
        });
        return;
      }

      // Parse root query
      const rootContent = rootQuery['Details/Message'] || rootQuery.Content || '';
      const rootMetadata = parseQueryContent(rootContent);

      // Find all replies (entries with parent = id)
      const replies = queryEntries
        .filter((q: any) => {
          const content = q['Details/Message'] || q.Content || '';
          const parentId = getParentId(content);
          return parentId === id;
        })
        .map((q: any) => {
          const content = q['Details/Message'] || q.Content || '';
          const metadata = parseQueryContent(content);
          return {
            id: q.id,
            parentId: metadata.parent,
            message: metadata.message,
            status: metadata.status,
            actor: q.Actor,
            timestamp: q.Timestamp,
            targetUserRole: q['Target User/Role'],
            resolved: q.Resolved === 'True',
          };
        })
        .sort((a, b) => {
          // Handle missing timestamps - treat as oldest (0)
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
        });

      // Build thread response
      const thread = {
        root: {
          id: rootQuery.id,
          message: rootMetadata.message,
          status: rootMetadata.status,
          actor: rootQuery.Actor,
          timestamp: rootQuery.Timestamp,
          targetUserRole: rootQuery['Target User/Role'],
          resolved: rootQuery.Resolved === 'True',
          fileId: rootQuery.File,
        },
        replies,
        totalReplies: replies.length,
        isResolved: rootMetadata.status === 'resolved' || rootQuery.Resolved === 'True',
      };

      res.json({
        success: true,
        data: thread,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch thread',
      });
    }
  }

  /**
   * POST /queries/:id/resolve
   * Mark query as resolved
   */
  async resolveQuery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only File Auditing Log table
      const auditLogs = await n8nClient.fetchTable('File Auditing Log');
      
      // Find query entry
      const queryEntry = auditLogs.find((q: any) => q.id === id);
      
      if (!queryEntry) {
        res.status(404).json({
          success: false,
          error: 'Query not found',
        });
        return;
      }

      const currentContent = queryEntry['Details/Message'] || queryEntry.Content || '';
      const updatedContent = updateQueryStatus(currentContent, 'resolved');

      // Update entry
      await n8nClient.postFileAuditLog({
        ...queryEntry,
        'Details/Message': updatedContent,
        Resolved: 'True',
      });

      res.json({
        success: true,
        data: {
          id,
          status: 'resolved',
          message: parseQueryContent(updatedContent).message,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to resolve query',
      });
    }
  }

  /**
   * POST /queries/:id/reopen
   * Reopen a resolved query
   */
  async reopenQuery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only File Auditing Log table
      const auditLogs = await n8nClient.fetchTable('File Auditing Log');
      
      // Find query entry
      const queryEntry = auditLogs.find((q: any) => q.id === id);
      
      if (!queryEntry) {
        res.status(404).json({
          success: false,
          error: 'Query not found',
        });
        return;
      }

      const currentContent = queryEntry['Details/Message'] || queryEntry.Content || '';
      const updatedContent = updateQueryStatus(currentContent, 'open');

      // Update entry
      await n8nClient.postFileAuditLog({
        ...queryEntry,
        'Details/Message': updatedContent,
        Resolved: 'False',
      });

      res.json({
        success: true,
        data: {
          id,
          status: 'open',
          message: parseQueryContent(updatedContent).message,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to reopen query',
      });
    }
  }
}

export const queriesController = new QueriesController();

