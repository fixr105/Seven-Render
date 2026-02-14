/**
 * Role Enforcement Middleware with Admin Override
 * 
 * Intercepts sensitive operations and enforces role-based permissions.
 * Supports admin override tokens for emergency access.
 * 
 * Rules:
 * - Approve/Reject Loan: Credit, Admin (Admin can override)
 * - Disburse Loan: Admin only (Admin override token required)
 * - Edit Commission Post-Disbursal: No one (Only Admin with override)
 * - KAM Trying to Update Status: Blocked (No override)
 * - Unauthorized Role Actions: Logged as violation (Email alert optional)
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../config/constants.js';
import { n8nClient } from '../services/airtable/n8nClient.js';
import fetch from 'node-fetch';

// Extend Express Request to include override info
declare global {
  namespace Express {
    interface Request {
      adminOverride?: {
        used: boolean;
        token: string;
        reason?: string;
      };
    }
  }
}

/**
 * Permission rules for sensitive actions
 */
interface PermissionRule {
  action: string;
  allowedRoles: UserRole[];
  allowAdminOverride: boolean;
  requireOverrideToken?: boolean; // If true, admin must provide override token
  endpoint?: string; // Optional: specific endpoint pattern
  method?: string; // Optional: HTTP method
}

const PERMISSION_RULES: PermissionRule[] = [
  {
    action: 'approve_reject_loan',
    allowedRoles: [UserRole.CREDIT],
    allowAdminOverride: true,
    endpoint: '/credit/loan-applications/:id/nbfc-decision',
    method: 'POST',
  },
  {
    action: 'disburse_loan',
    allowedRoles: [], // Admin only - no roles in allowedRoles means only admin override
    allowAdminOverride: true,
    requireOverrideToken: true,
    endpoint: '/credit/loan-applications/:id/mark-disbursed',
    method: 'POST',
  },
  {
    action: 'edit_commission_post_disbursal',
    allowedRoles: [], // No one allowed by default
    allowAdminOverride: true,
    requireOverrideToken: true,
    endpoint: '/credit/ledger/entries',
    method: 'POST',
  },
  {
    action: 'update_loan_status',
    allowedRoles: [UserRole.CREDIT], // KAM not allowed
    allowAdminOverride: false, // No override for KAM
    endpoint: '/loan-applications/:id/status',
    method: 'POST',
  },
  {
    action: 'update_loan_status',
    allowedRoles: [UserRole.CREDIT],
    allowAdminOverride: false,
    endpoint: '/credit/loan-applications/:id/status',
    method: 'POST',
  },
  {
    action: 'post_admin_activity_log',
    allowedRoles: [UserRole.CREDIT, UserRole.KAM],
    allowAdminOverride: true,
    endpoint: '/webhook/adminactivitylog',
    method: 'POST',
  },
  {
    action: 'post_commission_ledger',
    allowedRoles: [UserRole.CREDIT],
    allowAdminOverride: true,
    requireOverrideToken: false,
    endpoint: '/webhook/commissionledger',
    method: 'POST',
  },
];

/**
 * Get admin override tokens from environment
 */
function getAdminOverrideTokens(): string[] {
  const tokens = process.env.ADMIN_OVERRIDE_TOKENS;
  if (!tokens) {
    return [];
  }
  return tokens.split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Validate admin override token
 */
function validateAdminOverrideToken(token: string): boolean {
  const validTokens = getAdminOverrideTokens();
  return validTokens.includes(token);
}

/**
 * Check if user has admin role
 */
function isAdmin(user: any): boolean {
  // Check if user role is admin (might be stored as 'admin' or 'Admin')
  // Also check if email is in admin list from environment
  const role = user?.role?.toLowerCase();
  const email = user?.email?.toLowerCase();
  
  // Check role
  if (role === 'admin' || role === 'administrator') {
    return true;
  }
  
  // Check if email is in admin list
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()).filter(Boolean) || [];
  if (email && adminEmails.includes(email)) {
    return true;
  }
  
  return false;
}

/**
 * Check if action is allowed for user role
 */
function isActionAllowed(
  action: string,
  userRole: UserRole | string,
  rule: PermissionRule
): boolean {
  // If no allowed roles, only admin override is allowed
  if (rule.allowedRoles.length === 0) {
    return false; // Must use admin override
  }
  
  // Check if user role is in allowed roles
  return rule.allowedRoles.includes(userRole as UserRole);
}

/**
 * Find permission rule for request
 */
function findPermissionRule(req: Request): PermissionRule | null {
  const path = req.path;
  const method = req.method;
  
  // Try to match endpoint pattern
  for (const rule of PERMISSION_RULES) {
    if (rule.method && rule.method !== method) {
      continue;
    }
    
    if (rule.endpoint) {
      // Simple pattern matching (supports :id params)
      // Convert /credit/loan-applications/:id/mark-disbursed to regex
      const pattern = rule.endpoint
        .replace(/:[^/]+/g, '[^/]+') // Replace :id with [^/]+
        .replace(/\//g, '\\/'); // Escape slashes
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(path)) {
        return rule;
      }
    }
  }
  
  // Check for webhook endpoints (these might be called directly)
  if (path.includes('/webhook/adminactivitylog') && method === 'POST') {
    return PERMISSION_RULES.find(r => r.action === 'post_admin_activity_log') || null;
  }
  
  if (path.includes('/webhook/commissionledger') && method === 'POST') {
    return PERMISSION_RULES.find(r => r.action === 'post_commission_ledger') || null;
  }
  
  // Check if path contains sensitive keywords
  if (path.includes('mark-disbursed') && method === 'POST') {
    return PERMISSION_RULES.find(r => r.action === 'disburse_loan') || null;
  }
  
  if (path.includes('ledger/entries') && method === 'POST') {
    return PERMISSION_RULES.find(r => r.action === 'edit_commission_post_disbursal') || null;
  }
  
  return null;
}

/**
 * Log access violation
 */
async function logViolation(
  req: Request,
  action: string,
  reason: string,
  blocked: boolean = true
): Promise<void> {
  try {
    const userId = req.user?.id || 'UNKNOWN';
    const userEmail = req.user?.email || 'UNKNOWN';
    const userRole = req.user?.role || 'UNKNOWN';
    
    const violationLog = {
      id: `VIOLATION-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      'Activity ID': `VIOLATION-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      Timestamp: new Date().toISOString(),
      'Performed By': userEmail,
      'Action Type': 'access_violation',
      'Description/Details': `Access violation: ${action}. User: ${userEmail} (${userRole}). Reason: ${reason}. Status: ${blocked ? 'Blocked' : 'Allowed with override'}`,
      'Target Entity': 'system',
      'Reference Type': 'Access Violation',
      'Reference ID': req.path,
      'Previous Status': 'N/A',
      'Updated Status': blocked ? 'Blocked' : 'Override Used',
      'Remarks': reason,
    };
    
    await n8nClient.postAdminActivityLog(violationLog);
    console.log(`[RoleEnforcement] Violation logged: ${action} by ${userEmail} (${userRole})`);
  } catch (error: any) {
    console.error('[RoleEnforcement] Failed to log violation:', error.message);
  }
}

/**
 * Send email alert to admins (optional)
 */
async function sendAdminAlert(
  action: string,
  userEmail: string,
  userRole: string,
  reason: string,
  overrideUsed: boolean = false
): Promise<void> {
  try {
    // Only send if email webhook is configured
    const emailWebhookUrl = process.env.N8N_POST_EMAIL_URL || `${process.env.N8N_BASE_URL}/webhook/email`;
    
    // Get admin emails from environment or use default
    const adminEmails = process.env.ADMIN_ALERT_EMAILS?.split(',').map(e => e.trim()).filter(Boolean) || [];
    
    if (adminEmails.length === 0) {
      console.log('[RoleEnforcement] No admin alert emails configured, skipping email');
      return;
    }
    
    const subject = overrideUsed 
      ? `[Override Used] ${action} by ${userEmail}`
      : `[Access Violation] ${action} blocked for ${userEmail}`;
    
    const body = overrideUsed
      ? `Admin override was used for action: ${action}\n\nUser: ${userEmail} (${userRole})\nReason: ${reason}\nTime: ${new Date().toISOString()}\n\nThis action was allowed with admin override token.`
      : `Access violation detected and blocked:\n\nAction: ${action}\nUser: ${userEmail} (${userRole})\nReason: ${reason}\nTime: ${new Date().toISOString()}\n\nThis action was blocked due to insufficient permissions.`;
    
    const emailData = {
      to: adminEmails.join(', '),
      subject,
      body,
    };
    
    const response = await fetch(emailWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });
    
    if (response.ok) {
      console.log(`[RoleEnforcement] Admin alert email sent to ${adminEmails.join(', ')}`);
    } else {
      console.warn(`[RoleEnforcement] Failed to send admin alert email: ${response.status}`);
    }
  } catch (error: any) {
    console.error('[RoleEnforcement] Failed to send admin alert:', error.message);
  }
}

/**
 * Role enforcement middleware
 */
export const enforceRolePermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip if no user (authentication middleware should handle this)
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }
    
    // Find permission rule for this request
    const rule = findPermissionRule(req);
    
    // If no rule found, allow request (not a sensitive endpoint)
    if (!rule) {
      next();
      return;
    }
    
    const userRole = req.user.role;
    const userEmail = req.user.email || 'UNKNOWN';
    const isUserAdmin = isAdmin(req.user);
    
    // Check if action is allowed for user role
    const actionAllowed = isActionAllowed(rule.action, userRole, rule);
    
    // Check for admin override token
    const overrideToken = req.headers['x-admin-override-token'] as string;
    const hasOverrideToken = overrideToken && validateAdminOverrideToken(overrideToken);
    
    // Decision logic
    let allowRequest = false;
    let overrideUsed = false;
    let reason = '';
    
    if (actionAllowed) {
      // User has permission, allow request
      allowRequest = true;
      reason = `User ${userEmail} (${userRole}) has permission for ${rule.action}`;
    } else if (isUserAdmin && rule.allowAdminOverride) {
      // Admin trying to override
      if (rule.requireOverrideToken) {
        // Override token required
        if (hasOverrideToken) {
          allowRequest = true;
          overrideUsed = true;
          reason = `Admin override used with valid token for ${rule.action}`;
          req.adminOverride = {
            used: true,
            token: overrideToken,
            reason: 'Admin override with token',
          };
        } else {
          allowRequest = false;
          reason = `Admin override token required for ${rule.action} but not provided`;
        }
      } else {
        // Override allowed without token
        allowRequest = true;
        overrideUsed = true;
        reason = `Admin override used (no token required) for ${rule.action}`;
        req.adminOverride = {
          used: true,
          token: '',
          reason: 'Admin override without token',
        };
      }
    } else {
      // Action not allowed
      allowRequest = false;
      if (isUserAdmin && !rule.allowAdminOverride) {
        reason = `Admin override not allowed for ${rule.action}`;
      } else if (isUserAdmin && rule.requireOverrideToken && !hasOverrideToken) {
        reason = `Admin override token required for ${rule.action}`;
      } else {
        reason = `User ${userEmail} (${userRole}) does not have permission for ${rule.action}`;
      }
    }
    
    // Log violation or override
    if (!allowRequest || overrideUsed) {
      await logViolation(req, rule.action, reason, !allowRequest);
      
      // Send email alert if configured
      if (process.env.ENABLE_ADMIN_ALERTS === 'true') {
        await sendAdminAlert(rule.action, userEmail, userRole, reason, overrideUsed);
      }
    }
    
    // Block or allow request
    if (!allowRequest) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        details: reason,
        action: rule.action,
        requiredRoles: rule.allowedRoles,
        userRole,
        adminOverrideAvailable: rule.allowAdminOverride && isUserAdmin,
        overrideTokenRequired: rule.requireOverrideToken,
      });
      return;
    }
    
    // Request allowed, continue
    if (overrideUsed) {
      console.log(`[RoleEnforcement] Request allowed with override: ${rule.action} by ${userEmail}`);
    }
    
    next();
  } catch (error: any) {
    console.error('[RoleEnforcement] Error in middleware:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error in role enforcement',
    });
  }
};

/**
 * Helper function to check if admin override was used
 */
export function wasAdminOverrideUsed(req: Request): boolean {
  return req.adminOverride?.used === true;
}

/**
 * Helper function to get override reason
 */
export function getOverrideReason(req: Request): string | undefined {
  return req.adminOverride?.reason;
}

