/**
 * Single source of truth for frontend route paths and 404 usage.
 * Used for path audit, docs, and tests. Routing logic stays in App.tsx.
 *
 * Note: Invalid /applications/:id (non-existent or no access) is intentionally
 * handled in-page in ApplicationDetail and does not use the global 404 page.
 */

export type FrontendPathType = 'action' | 'redirect' | '404';

export interface FrontendPathEntry {
  path: string;
  type: FrontendPathType;
  description?: string;
}

/** All frontend paths and their outcome (action, redirect, or 404). */
export const FRONTEND_PATHS: FrontendPathEntry[] = [
  { path: '/', type: 'redirect', description: 'Redirects to /dashboard' },
  { path: '/login', type: 'action', description: 'Login page' },
  { path: '/forgot-password', type: 'action', description: 'Forgot password page' },
  { path: '/reset-password', type: 'action', description: 'Reset password with token from email' },
  { path: '/LOGIN', type: 'redirect', description: 'Redirects to /login' },
  { path: '/Login', type: 'redirect', description: 'Redirects to /login' },
  { path: '/dashboard', type: 'action', description: 'Dashboard' },
  { path: '/applications', type: 'action', description: 'Applications list' },
  { path: '/applications/new', type: 'action', description: 'New application (client only)' },
  { path: '/applications/:id', type: 'action', description: 'Application detail (invalid id handled in-page)' },
  { path: '/ledger', type: 'action', description: 'Ledger' },
  { path: '/clients', type: 'action', description: 'Clients' },
  { path: '/profile', type: 'action', description: 'Profile' },
  { path: '/settings', type: 'action', description: 'Settings' },
  { path: '/reports', type: 'action', description: 'Reports' },
  { path: '/admin/activity-log', type: 'action', description: 'Admin activity log' },
  { path: '/admin/user-accounts', type: 'action', description: 'Admin user accounts' },
  { path: '/admin/nbfc-partners', type: 'action', description: 'Admin NBFC partners' },
  { path: '/form-configuration', type: 'action', description: 'Form configuration' },
  { path: '/unauthorized', type: 'action', description: 'Unauthorized message' },
  { path: '*', type: '404', description: 'Catch-all: NotFoundPage' },
];

export interface NotFoundAction {
  id: string;
  description: string;
}

/**
 * How many 404 pages exist and for what actions they are used.
 * See also docs/PATHS_AND_404.md.
 */
export const NOT_FOUND_USAGE = {
  pageCount: 1,
  componentName: 'NotFoundPage',
  actions: [
    {
      id: 'unmatched_route',
      description: 'Any path that does not match a defined route',
    },
  ] as NotFoundAction[],
};
