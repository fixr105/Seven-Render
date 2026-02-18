/**
 * API Service - Frontend API Client
 * Wraps all backend endpoints, handles JWT auth, and provides role-based access
 */

import { defaultLogger } from '../utils/logger.js';
import { errorTracker } from '../utils/errorTracker.js';

// Ensure API_BASE_URL includes /api prefix for Vercel deployment
const getApiBaseUrl = () => {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();

  // In development (including E2E), use /api so Vite proxy works when VITE_API_BASE_URL is unset
  if (!baseUrl) {
    if (typeof window !== 'undefined' && !import.meta.env.DEV) {
      throw new Error('VITE_API_BASE_URL environment variable is required. Please set it in your environment configuration.');
    }
    return '/api';
  }

  // Ensure /api is appended if not present
  if (!baseUrl.endsWith('/api')) {
    return baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;
  }
  return baseUrl;
};

const API_BASE_URL = getApiBaseUrl();

// Types
export type UserRole = 'client' | 'kam' | 'credit_team' | 'nbfc' | 'admin';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UserContext {
  id: string;
  email: string;
  role: UserRole;
  clientId?: string | null;
  kamId?: string | null;
  nbfcId?: string | null;
  creditTeamId?: string | null;
  name?: string;
}

export interface DashboardSummary {
  activeApplications: Array<{
    id: string;
    fileId: string;
    status: string;
    applicantName?: string;
    requestedAmount?: string;
  }>;
  ledgerSummary?: {
    totalEarned: number;
    pending: number;
    paid: number;
    balance: number;
  };
  pendingQueries?: Array<{
    id: string;
    fileId: string;
    applicationId?: string;
    message: string;
    raisedBy?: string;
    timestamp?: string;
  }>;
  /** KAM dashboard: queries raised to KAM (from Credit or Client) */
  pendingQuestionsFromCredit?: Array<{
    id: string;
    fileId: string;
    applicationId?: string;
    message: string;
  }>;
  payoutRequests?: Array<{
    id: string;
    amount: number;
    status: string;
    requestedDate: string;
  }>;
}

export interface LoanApplication {
  id: string;
  fileId: string;
  client: string;
  applicantName: string;
  loanProduct: string;
  requestedLoanAmount: string;
  documents: string;
  status: string;
  assignedCreditAnalyst?: string;
  assignedNBFC?: string;
  lenderDecisionStatus?: string;
  lenderDecisionDate?: string;
  lenderDecisionRemarks?: string;
  approvedLoanAmount?: string;
  aiFileSummary?: string;
  formData?: any;
  creationDate: string;
  submittedDate?: string;
  lastUpdated: string;
}

export interface FormConfig {
  categories: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    description?: string;
    displayOrder: string;
    active: string;
  }>;
  fields: Array<{
    id: string;
    fieldId: string;
    category: string;
    fieldLabel: string;
    fieldType: string;
    fieldPlaceholder?: string;
    fieldOptions?: string;
    isMandatory: string;
    displayOrder: string;
    active: string;
  }>;
  mappings: Array<{
    id: string;
    mappingId: string;
    client: string;
    category: string;
    isRequired: string;
    displayOrder: string;
  }>;
}

export interface CommissionLedgerEntry {
  id: string;
  ledgerEntryId: string;
  client: string;
  loanFile: string;
  date: string;
  disbursedAmount: string;
  commissionRate: string;
  payoutAmount: string;
  description: string;
  disputeStatus: string;
  payoutRequest: string;
}

export interface PayoutRequest {
  id: string;
  amount: number;
  status: string;
  requestedDate: string;
  approvedDate?: string;
  rejectedDate?: string;
  rejectionReason?: string;
}

export interface FormCategory {
  id: string;
  categoryId: string;
  categoryName: string;
  description?: string;
  displayOrder: string;
  active: string;
}

export interface CreditTeamUser {
  id: string;
  creditUserId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
}

export interface AuditLogEntry {
  id: string;
  logEntryId: string;
  file: string;
  timestamp: string;
  actor: string;
  actionEventType: string;
  detailsMessage: string;
  targetUserRole: string;
  resolved: string;
}

class ApiService {
  private baseUrl: string;
  /** Bearer token for when cookies are not sent (e.g. E2E, some proxies). Set on login, cleared on logout. */
  private bearerToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Generic request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Auth: cookies (primary) or Bearer token (fallback when cookies blocked)
    if (this.bearerToken && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/validate')) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.bearerToken}`;
    }

    try {
      // Add timeout for fetch requests
      // Validate endpoint needs shorter timeout to avoid Vercel 30s limit
      const isApplicationRequest = endpoint.includes('/loan-applications') && options.method === 'POST';
      const isGetRequest = !options.method || options.method === 'GET';
      
      // Validate endpoint: 50s timeout (Fly.io backend has no 30s limit, n8n webhook can be slow)
      // Login, validate, and application creation: 60s (n8n webhook can be slow)
      // GET requests: 55s for n8n webhooks
      // Other requests: 30s timeout
      const isAuthRequest = endpoint.includes('/auth/login') || endpoint.includes('/auth/validate');
      const timeoutMs = isAuthRequest || isApplicationRequest ? 60000 : isGetRequest ? 55000 : 30000;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      let response: Response;
      try {
        response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include', // Include cookies (HTTP-only cookies for auth)
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. The server may be experiencing high load.`);
        }
        throw fetchError;
      }

      // Check if response has content
      const contentType = response.headers.get('content-type');
      const text = await response.text();
      
      // If response is empty, return error
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: `Empty response from server (${response.status} ${response.statusText})`,
        };
      }

      // Check if response is HTML (likely a 404 page or error page)
      const isHtml = contentType?.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<!doctype') || text.trim().startsWith('<html');
      
      if (isHtml) {
        // This is likely a 404 or error page
        let errorMessage = `Server returned HTML instead of JSON (${response.status} ${response.statusText})`;
        
        if (response.status === 404) {
          errorMessage = `Endpoint not found: ${endpoint}. The API route may not exist or the backend may not be properly deployed.`;
        } else if (response.status === 401 || response.status === 403) {
          errorMessage = `Authentication failed (${response.status}).`;
        } else if (response.status >= 500) {
          errorMessage = `Server error (${response.status}). The backend may be experiencing issues.`;
        }
        
        defaultLogger.error('Server returned HTML response', {
          endpoint,
          url,
          status: response.status,
          contentType,
          responsePreview: text.substring(0, 500),
        });
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (_parseError) {
        // If not JSON, return the text as error
        defaultLogger.error('Failed to parse JSON response', {
          endpoint,
          status: response.status,
          contentType,
          responsePreview: text.substring(0, 200),
        });
        return {
          success: false,
          error: `Invalid JSON response from server (${response.status}): ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
        };
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            error: data.error || `Authentication failed (${response.status}).`,
          };
        }
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const result: ApiResponse<T> & { _debug?: unknown } = {
        success: true,
        data: data.data || data,
      };
      if (data._debug !== undefined) (result as any)._debug = data._debug;
      return result;
    } catch (error: any) {
      defaultLogger.error('API request error', {
        endpoint,
        url,
        baseUrl: this.baseUrl,
        error: error.message,
        stack: error.stack,
      });

      // Track error for monitoring
      if (error instanceof Error) {
        errorTracker.captureException(error, {
          url: window.location.href,
          metadata: {
            endpoint,
            baseUrl: this.baseUrl,
          },
        });
      }
      
      // Provide more specific error messages
      let errorMessage = 'Network error';
      
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        const isRelativeUrl = this.baseUrl.startsWith('/') || !this.baseUrl.includes('://');
        
        if (isRelativeUrl) {
          errorMessage = `Cannot connect to backend API. The frontend is missing the VITE_API_BASE_URL environment variable.\n\nTo fix:\n1. Go to Vercel Dashboard → Settings → Environment Variables\n2. Add: VITE_API_BASE_URL = https://seven-dash.fly.dev\n3. Redeploy the frontend\n\nCurrent base URL: ${this.baseUrl}`;
        } else {
          const corsHint = endpoint.includes('/auth/login')
            ? '\n\nFor login: ensure the backend CORS_ORIGIN (Fly.io secrets) includes your exact frontend URL (e.g. https://seven-dashboard-seven.vercel.app with no trailing slash), then redeploy the backend.'
            : '';
          errorMessage = `Cannot connect to backend API at ${url}. This could be due to:\n- Network connectivity issues\n- CORS configuration (backend must allow your frontend origin)\n- Server is down or unreachable\n- Missing VITE_API_BASE_URL environment variable\n\nPlease check your network connection and try again.${corsHint}`;
        }
      } else if (error.message?.includes('JSON.parse')) {
        errorMessage = `Invalid response from server. The API may not be responding correctly.`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Login with email and password.
   * Token is set in HTTP-only cookie by server; also stored in memory for Bearer fallback when cookies blocked.
   */
  async login(email: string, password: string): Promise<ApiResponse<{ user: UserContext; token?: string }>> {
    const response = await this.request<{ user: UserContext; token?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.success && response.data?.token) {
      this.bearerToken = response.data.token;
    }
    return response;
  }

  /**
   * Get current user from /auth/me.
   * Requires valid auth cookie.
   */
  async getMe(): Promise<ApiResponse<UserContext>> {
    return this.request<UserContext>('/auth/me', { method: 'GET' });
  }

  /**
   * Logout - clears auth cookie on server and in-memory Bearer token.
   */
  async logout(): Promise<ApiResponse<{ message: string }>> {
    this.bearerToken = null;
    return this.request<{ message: string }>('/auth/logout', { method: 'POST' });
  }

  /**
   * Update current user's settings
   */
  async updateUserSettings(userId: string, settings: object): Promise<ApiResponse> {
    return this.request(`/user-accounts/${userId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ settings }),
    });
  }

  /**
   * List all user accounts (admin/credit_team)
   * @param fresh - If true, bypass cache (use after creating a new user)
   */
  async listUserAccounts(fresh = false): Promise<
    ApiResponse<Array<{ id: string; username: string; role: string; associatedProfile?: string; lastLogin?: string; accountStatus?: string }>>
  > {
    const query = fresh ? '?fresh=true' : '';
    return this.request(`/user-accounts${query}`);
  }

  /**
   * Create user account (credit_team/admin)
   */
  async createUserAccount(payload: {
    username: string;
    password: string;
    role: string;
    associatedProfile?: string;
    accountStatus?: string;
  }): Promise<ApiResponse<{ id: string; username: string; role: string; accountStatus: string }>> {
    return this.request('/user-accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get single user account
   */
  async getUserAccount(id: string): Promise<
    ApiResponse<{ id: string; username: string; role: string; associatedProfile?: string; lastLogin?: string; accountStatus?: string }>
  > {
    return this.request(`/user-accounts/${id}`);
  }

  /**
   * Update user account (admin/credit_team)
   */
  async updateUserAccount(
    id: string,
    data: { accountStatus?: string; role?: string; associatedProfile?: string }
  ): Promise<ApiResponse> {
    return this.request(`/user-accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * List NBFC partners
   */
  async listNBFCPartners(): Promise<
    ApiResponse<Array<{ id: string; lenderId?: string; lenderName: string; contactPerson?: string; contactEmailPhone?: string; addressRegion?: string; active: boolean }>>
  > {
    return this.request('/nbfc-partners');
  }

  /**
   * Get single NBFC partner
   */
  async getNBFCPartner(id: string): Promise<
    ApiResponse<{ id: string; lenderId?: string; lenderName: string; contactPerson?: string; contactEmailPhone?: string; addressRegion?: string; active: boolean }>
  > {
    return this.request(`/nbfc-partners/${id}`);
  }

  /**
   * Create NBFC partner (admin/credit_team)
   */
  async createNBFCPartner(data: {
    lenderName: string;
    contactPerson?: string;
    contactEmailPhone?: string;
    addressRegion?: string;
    active?: boolean;
  }): Promise<ApiResponse<{ id: string }>> {
    return this.request('/nbfc-partners', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update NBFC partner (admin/credit_team)
   */
  async updateNBFCPartner(
    id: string,
    data: { lenderName?: string; contactPerson?: string; contactEmailPhone?: string; addressRegion?: string; active?: boolean }
  ): Promise<ApiResponse> {
    return this.request(`/nbfc-partners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ==================== CLIENT ENDPOINTS ====================

  /**
   * Get client dashboard
   */
  async getClientDashboard(): Promise<ApiResponse<DashboardSummary>> {
    return this.request<DashboardSummary>('/client/dashboard');
  }

  /**
   * Get form configuration for client
   */
  async getFormConfig(productId?: string): Promise<ApiResponse<any[]>> {
    const url = productId ? `/client/form-config?productId=${productId}` : '/client/form-config';
    return this.request<any[]>(url);
  }

  /**
   * Get form config with debug diagnostics (temporary - for form loading debug)
   */
  async getFormConfigDebug(productId?: string): Promise<ApiResponse<any[]>> {
    const url = productId ? `/client/form-config-debug?productId=${productId}` : '/client/form-config-debug';
    return this.request<any[]>(url);
  }

  /**
   * Get list of product IDs that have configured forms for the client
   */
  async getConfiguredProducts(): Promise<ApiResponse<string[]>> {
    return this.request<string[]>('/client/configured-products');
  }

  /**
   * Create a new query (client only - client raises query to KAM)
   */
  async createClientQuery(applicationId: string, message: string): Promise<ApiResponse> {
    return this.request(`/loan-applications/${applicationId}/queries`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  /**
   * Reply to a query
   */
  async replyToQuery(
    applicationId: string,
    queryId: string,
    message: string
  ): Promise<ApiResponse> {
    return this.request(`/loan-applications/${applicationId}/queries/${queryId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message, reply: message }),
    });
  }

  // ==================== LOAN APPLICATIONS ====================

  /**
   * Create new loan application
   */
  async createApplication(data: {
    productId: string;
    applicantName?: string;
    requestedLoanAmount?: number;
    formData?: Record<string, any>;
    saveAsDraft?: boolean;
    // Legacy format support
    borrowerIdentifiers?: {
      pan?: string;
      name?: string;
    };
  }): Promise<ApiResponse<{ 
    loanApplicationId: string; 
    fileId: string; 
    status?: string;
    warnings?: string[]; // Module 2: Validation warnings
    duplicateFound?: { fileId: string; status: string } | null; // Module 2: Duplicate detection
    missingFields?: Array<{ fieldId: string; label: string }>; // Validation errors for missing required fields
  }>> {
    return this.request('/loan-applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update application form data
   */
  async updateApplicationForm(
    applicationId: string,
    formData: Record<string, any>
  ): Promise<ApiResponse> {
    return this.request(`/loan-applications/${applicationId}/form`, {
      method: 'POST',
      body: JSON.stringify({ formData }),
    });
  }

  /**
   * Submit application for review
   */
  async submitApplication(applicationId: string): Promise<ApiResponse> {
    return this.request(`/loan-applications/${applicationId}/submit`, {
      method: 'POST',
    });
  }

  /**
   * Withdraw application (client only)
   */
  async withdrawApplication(applicationId: string): Promise<ApiResponse> {
    return this.request(`/loan-applications/${applicationId}/withdraw`, {
      method: 'POST',
    });
  }

  /**
   * List loan applications (filtered by role)
   */
  async listApplications(params?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<ApiResponse<LoanApplication[]>> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params?.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params?.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    return this.request<LoanApplication[]>(
      `/loan-applications${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get single loan application
   */
  async getApplication(applicationId: string): Promise<ApiResponse<LoanApplication>> {
    return this.request<LoanApplication>(`/loan-applications/${applicationId}`);
  }

  // ==================== KAM ENDPOINTS ====================

  /**
   * Get KAM dashboard
   */
  async getKAMDashboard(): Promise<ApiResponse<DashboardSummary>> {
    return this.request<DashboardSummary>('/kam/dashboard');
  }

  /**
   * List clients (KAM or Credit Team)
   * Automatically uses the correct endpoint based on user role
   */
  async listClients(forceRefresh: boolean = false): Promise<ApiResponse<any[]>> {
    // Try to get user role from token or use KAM endpoint as default
    // The backend will handle role-based routing
    const url = forceRefresh ? '/kam/clients?forceRefresh=true' : '/kam/clients';
    return this.request<any[]>(url);
  }

  /**
   * List clients (Credit Team only)
   */
  async listCreditClients(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/credit/clients');
  }

  /**
   * Get client details (Credit Team only)
   */
  async getCreditClient(clientId: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/credit/clients/${clientId}`);
  }

  /**
   * Assign KAM to client (Credit Team only)
   */
  async assignKAMToClient(clientId: string, kamId: string | null): Promise<ApiResponse<any>> {
    return this.request<any>(`/credit/clients/${clientId}/assign-kam`, {
      method: 'POST',
      body: JSON.stringify({ kamId }),
    });
  }

  /**
   * List KAM users (Credit Team only)
   */
  async listKAMUsers(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/credit/kam-users');
  }

  /**
   * Create new client
   */
  async createClient(data: {
    name: string;
    contactPerson?: string;
    email: string;
    phone: string;
    commissionRate?: string;
    enabledModules?: string[];
    modules?: string[];
  }): Promise<ApiResponse<{ clientId: string; userId: string }>> {
    // Map modules to enabledModules for backend compatibility
    const payload = {
      name: data.name,
      contactPerson: data.contactPerson || data.name,
      email: data.email,
      phone: data.phone,
      commissionRate: data.commissionRate,
      enabledModules: data.enabledModules || data.modules || [],
    };
    return this.request('/kam/clients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Update client modules
   */
  async updateClientModules(
    clientId: string,
    modules: Record<string, boolean>
  ): Promise<ApiResponse> {
    return this.request(`/kam/clients/${clientId}/modules`, {
      method: 'PATCH',
      body: JSON.stringify({ modules }),
    });
  }

  /**
   * Get form mappings for client (Credit Team only)
   */
  async getFormMappings(clientId: string): Promise<ApiResponse> {
    return this.request(`/credit/clients/${clientId}/form-mappings`);
  }

  /**
   * Get form mappings for client (Public - for form links)
   */
  async getPublicFormMappings(clientId: string): Promise<ApiResponse> {
    return this.request(`/public/clients/${clientId}/form-mappings`);
  }

  /**
   * Get full form config for client (Public - for form links)
   * Returns categories with fields from Form Fields table.
   */
  async getPublicFormConfig(clientId: string, productId?: string): Promise<ApiResponse<any[]>> {
    const url = productId
      ? `/public/clients/${clientId}/form-config?productId=${productId}`
      : `/public/clients/${clientId}/form-config`;
    return this.request<any[]>(url);
  }

  /**
   * Create form mapping (single or bulk)
   * Module 1: Added productId support for linking form config to loan products
   */
  async createFormMapping(
    clientId: string,
    data: {
      category?: string;
      isRequired?: boolean;
      displayOrder?: number;
      modules?: string[] | Array<{ moduleId: string; includedFieldIds: string[] }>; // Bulk: string[] (legacy) or object with field IDs
      productId?: string; // Module 1: Optional loan product ID
    }
  ): Promise<ApiResponse> {
    return this.request(`/kam/clients/${clientId}/form-mappings`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Create Form Link row for a client (Credit Team only)
   */
  async createFormLink(
    clientId: string,
    data: { formLink?: string; productId?: string; mappingId: string }
  ): Promise<ApiResponse> {
    return this.request(`/credit/clients/${clientId}/form-links`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Create Record Title row (Credit Team only)
   */
  async createRecordTitle(data: {
    mappingId: string;
    recordTitle: string;
    displayOrder?: number;
    isRequired?: boolean;
  }): Promise<ApiResponse> {
    return this.request('/credit/record-titles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get Record Titles for a Mapping ID (Credit Team only)
   */
  async getRecordTitles(mappingId: string): Promise<ApiResponse<any[]>> {
    return this.request(`/credit/record-titles?mappingId=${encodeURIComponent(mappingId)}`);
  }

  /**
   * Patch Form Link (Credit Team only)
   */
  async patchFormLink(
    id: string,
    data: { clientId?: string; formLink?: string; productId?: string; mappingId?: string }
  ): Promise<ApiResponse> {
    return this.request(`/credit/form-links/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete Form Link (Credit Team only)
   */
  async deleteFormLink(id: string): Promise<ApiResponse> {
    return this.request(`/credit/form-links/${id}`, { method: 'DELETE' });
  }

  /**
   * Patch Record Title (Credit Team only)
   */
  async patchRecordTitle(
    id: string,
    data: { mappingId?: string; recordTitle?: string; displayOrder?: number; isRequired?: boolean }
  ): Promise<ApiResponse> {
    return this.request(`/credit/record-titles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete Record Title (Credit Team only)
   */
  async deleteRecordTitle(id: string): Promise<ApiResponse> {
    return this.request(`/credit/record-titles/${id}`, { method: 'DELETE' });
  }

  /**
   * Get Product Documents for a product (Credit Team - product-centric form config)
   */
  async getProductDocuments(productId: string): Promise<ApiResponse<any[]>> {
    return this.request(`/credit/products/${encodeURIComponent(productId)}/product-documents`);
  }

  /**
   * Get product form config for editing (sections with nested fields from Loan Products)
   */
  async getProductFormConfigEdit(productId: string): Promise<
    ApiResponse<{
      productId: string;
      productName: string;
      id: string;
      sections: Array<{
        sectionNum: number | string;
        enabled: boolean;
        name: string;
        fields: Array<{ key: string; label: string; enabled: boolean }>;
      }>;
    }>
  > {
    return this.request(`/credit/products/${encodeURIComponent(productId)}/form-config-edit`);
  }

  /**
   * Patch product form config (Section N, Field N) in Loan Products
   */
  async patchProductFormConfig(
    productId: string,
    data: {
      sections: Array<{
        sectionNum: number | string;
        enabled: boolean;
        name: string;
        fields: Array<{ key: string; label: string; enabled: boolean }>;
      }>;
    }
  ): Promise<ApiResponse> {
    return this.request(`/credit/products/${encodeURIComponent(productId)}/form-config`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Create Product Document (Credit Team only)
   */
  async createProductDocument(data: {
    productId: string;
    recordTitle: string;
    displayOrder?: number;
    isRequired?: boolean;
  }): Promise<ApiResponse> {
    return this.request('/credit/product-documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Patch Product Document (Credit Team only)
   */
  async patchProductDocument(
    id: string,
    data: { productId?: string; recordTitle?: string; displayOrder?: number; isRequired?: boolean }
  ): Promise<ApiResponse> {
    return this.request(`/credit/product-documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete Product Document (Credit Team only)
   */
  async deleteProductDocument(id: string): Promise<ApiResponse> {
    return this.request(`/credit/product-documents/${id}`, { method: 'DELETE' });
  }

  /**
   * List KAM's applications
   */
  async listKAMApplications(params?: {
    status?: string;
    search?: string;
  }): Promise<ApiResponse<LoanApplication[]>> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    return this.request<LoanApplication[]>(
      `/kam/loan-applications${query ? `?${query}` : ''}`
    );
  }

  /**
   * Edit application (KAM)
   */
  async editApplication(
    applicationId: string,
    updates: Partial<LoanApplication>
  ): Promise<ApiResponse> {
    return this.request(`/kam/loan-applications/${applicationId}/edit`, {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Raise query to client (KAM)
   */
  async raiseQueryToClient(
    applicationId: string,
    query: string
  ): Promise<ApiResponse> {
    return this.request(`/kam/loan-applications/${applicationId}/queries`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  /**
   * Forward application to credit (KAM)
   */
  async forwardToCredit(applicationId: string): Promise<ApiResponse> {
    return this.request(`/kam/loan-applications/${applicationId}/forward-to-credit`, {
      method: 'POST',
    });
  }

  // ==================== CREDIT TEAM ENDPOINTS ====================

  /**
   * Get credit team dashboard
   */
  async getCreditDashboard(): Promise<ApiResponse<DashboardSummary>> {
    return this.request<DashboardSummary>('/credit/dashboard');
  }

  /**
   * Get applications in Sent to NBFC that are past SLA (for follow-up).
   */
  async getCreditSlaPastDue(): Promise<
    ApiResponse<{ items: Array<{ fileId: string; applicationId?: string; sentAt: string; daysPastSLA: number }> }>
  > {
    return this.request<{ items: Array<{ fileId: string; applicationId?: string; sentAt: string; daysPastSLA: number }> }>(
      '/credit/sla-past-due'
    );
  }

  /**
   * List all applications (Credit)
   */
  async listCreditApplications(params?: {
    status?: string;
    search?: string;
  }): Promise<ApiResponse<LoanApplication[]>> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    return this.request<LoanApplication[]>(
      `/credit/loan-applications${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get single application (Credit)
   */
  async getCreditApplication(applicationId: string): Promise<ApiResponse<LoanApplication>> {
    return this.request<LoanApplication>(`/credit/loan-applications/${applicationId}`);
  }

  /**
   * Raise query to KAM (Credit)
   */
  async raiseQueryToKAM(
    applicationId: string,
    query: string
  ): Promise<ApiResponse> {
    return this.request(`/credit/loan-applications/${applicationId}/queries`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  /**
   * Update application status (Credit only - for approved, rejected, credit_query_with_kam, sent_to_nbfc, etc.)
   * Retries once after 2.5s on 404-like failures to mitigate serverless cold-start (timeout, HTML fallback, etc.).
   */
  async updateCreditApplicationStatus(
    applicationId: string,
    status: string,
    notes?: string
  ): Promise<ApiResponse> {
    const endpoint = `/credit/loan-applications/${applicationId}/status`;
    const opts = { method: 'POST' as const, body: JSON.stringify({ status, notes }) };
    const result = await this.request(endpoint, opts);
    const err = result.error ?? '';
    const shouldRetry =
      !result.success &&
      (err.includes('Endpoint not found') ||
        err.includes('Server returned HTML') ||
        err.includes('timed out') ||
        err.includes('HTTP 404') ||
        err.includes('Empty response'));
    if (shouldRetry) {
      await new Promise((r) => setTimeout(r, 2500));
      return this.request(endpoint, opts);
    }
    return result;
  }

  /**
   * Mark application in negotiation
   */
  async markInNegotiation(applicationId: string): Promise<ApiResponse> {
    return this.request(`/credit/loan-applications/${applicationId}/mark-in-negotiation`, {
      method: 'POST',
    });
  }

  /**
   * Assign NBFCs to application
   */
  async assignNBFCs(
    applicationId: string,
    nbfcIds: string[]
  ): Promise<ApiResponse> {
    return this.request(`/credit/loan-applications/${applicationId}/assign-nbfcs`, {
      method: 'POST',
      body: JSON.stringify({ nbfcIds }),
    });
  }

  /**
   * Capture NBFC decision
   */
  async captureNBFCDecision(
    applicationId: string,
    data: {
      nbfcId: string;
      decision: string;
      decisionDate: string;
      remarks?: string;
      approvedAmount?: string;
    }
  ): Promise<ApiResponse> {
    return this.request(`/credit/loan-applications/${applicationId}/nbfc-decision`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Mark application as disbursed
   */
  async markDisbursed(
    applicationId: string,
    data: {
      disbursedAmount: string;
      disbursedDate: string;
    }
  ): Promise<ApiResponse> {
    return this.request(`/credit/loan-applications/${applicationId}/mark-disbursed`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get all payout requests (Credit)
   */
  async getPayoutRequests(): Promise<ApiResponse<PayoutRequest[]>> {
    return this.request<PayoutRequest[]>('/credit/payout-requests');
  }

  /**
   * Approve payout request
   */
  async approvePayout(payoutRequestId: string): Promise<ApiResponse> {
    return this.request(`/credit/payout-requests/${payoutRequestId}/approve`, {
      method: 'POST',
    });
  }

  /**
   * Reject payout request
   */
  async rejectPayout(
    payoutRequestId: string,
    reason: string
  ): Promise<ApiResponse> {
    return this.request(`/credit/payout-requests/${payoutRequestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ==================== NBFC ENDPOINTS ====================

  /**
   * Get NBFC dashboard
   */
  async getNBFCDashboard(): Promise<ApiResponse<DashboardSummary>> {
    return this.request<DashboardSummary>('/nbfc/dashboard');
  }

  /**
   * List assigned applications (NBFC)
   */
  async listNBFCApplications(): Promise<ApiResponse<LoanApplication[]>> {
    return this.request<LoanApplication[]>('/nbfc/loan-applications');
  }

  /**
   * Get single application (NBFC)
   */
  async getNBFCApplication(applicationId: string): Promise<ApiResponse<LoanApplication>> {
    return this.request<LoanApplication>(`/nbfc/loan-applications/${applicationId}`);
  }

  /**
   * Record NBFC decision
   */
  /**
   * Get predefined NBFC rejection reasons for the decision modal
   */
  async getNbfcRejectionReasons(): Promise<ApiResponse<Array<{ value: string; label: string }>>> {
    return this.request<Array<{ value: string; label: string }>>('/nbfc/rejection-reasons');
  }

  async recordNBFCDecision(
    applicationId: string,
    data: {
      lenderDecisionStatus: string; // 'Approved' | 'Rejected' | 'Needs Clarification'
      lenderDecisionRemarks: string; // Required for Rejected, optional for others
      approvedAmount?: number; // Optional: for approved decisions
    }
  ): Promise<ApiResponse> {
    return this.request(`/nbfc/loan-applications/${applicationId}/decision`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== COMMISSION LEDGER ====================

  /**
   * Get client commission ledger
   */
  async getClientLedger(): Promise<ApiResponse<CommissionLedgerEntry[]>> {
    return this.request<CommissionLedgerEntry[]>('/clients/me/ledger');
  }

  /**
   * Create ledger query/dispute
   */
  async createLedgerQuery(
    ledgerEntryId: string,
    message: string
  ): Promise<ApiResponse> {
    return this.request(`/clients/me/ledger/${ledgerEntryId}/query`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  /**
   * Flag ledger entry for payout request
   */
  async flagLedgerPayout(ledgerEntryId: string): Promise<ApiResponse> {
    return this.request(`/clients/me/ledger/${ledgerEntryId}/flag-payout`, {
      method: 'POST',
    });
  }

  /**
   * Create payout request
   */
  async createPayoutRequest(data: { amount?: number; full?: boolean }): Promise<ApiResponse> {
    return this.request('/clients/me/payout-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get client payout requests
   */
  async getClientPayoutRequests(): Promise<ApiResponse<PayoutRequest[]>> {
    return this.request<PayoutRequest[]>('/clients/me/payout-requests');
  }

  // ==================== REPORTS ====================

  /**
   * Generate daily summary report
   */
  async generateDailySummary(date?: string, emailRecipients?: string[]): Promise<ApiResponse> {
    return this.request('/reports/daily/generate', {
      method: 'POST',
      body: JSON.stringify({ date, emailRecipients }),
    });
  }

  /**
   * Get daily summary report by date
   */
  async getDailySummary(date: string): Promise<ApiResponse> {
    return this.request(`/reports/daily/${date}`);
  }

  /**
   * Get latest daily summary report (single most recent)
   */
  async getLatestDailySummary(): Promise<ApiResponse<any>> {
    return this.request('/reports/daily/latest');
  }

  /**
   * List daily summary reports (last N reports)
   */
  async listDailySummaries(limit?: number): Promise<ApiResponse<any[]>> {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<any[]>(`/reports/daily/list${query}`);
  }

  // ==================== AUDIT LOGS ====================

  /**
   * Get file audit log
   */
  async getFileAuditLog(applicationId: string): Promise<ApiResponse<AuditLogEntry[]>> {
    return this.request<AuditLogEntry[]>(`/loan-applications/${applicationId}/audit-log`);
  }

  /**
   * Get queries for an application (grouped into threads)
   */
  async getQueries(applicationId: string): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/loan-applications/${applicationId}/queries`);
  }

  /**
   * Edit own query (within allowed time window). Only the query author can edit.
   */
  async updateQuery(applicationId: string, queryId: string, message: string): Promise<ApiResponse> {
    return this.request(`/loan-applications/${applicationId}/queries/${queryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ message }),
    });
  }

  /**
   * Resolve a query
   */
  async resolveQuery(applicationId: string, queryId: string, resolutionMessage?: string): Promise<ApiResponse> {
    return this.request(`/loan-applications/${applicationId}/queries/${queryId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutionMessage }),
    });
  }

  /**
   * Get admin activity log (optional filters via query params)
   */
  async getAdminActivityLog(params?: {
    dateFrom?: string;
    dateTo?: string;
    performedBy?: string;
    actionType?: string;
    targetEntity?: string;
  }): Promise<ApiResponse> {
    const searchParams = new URLSearchParams();
    if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params?.performedBy) searchParams.set('performedBy', params.performedBy);
    if (params?.actionType) searchParams.set('actionType', params.actionType);
    if (params?.targetEntity) searchParams.set('targetEntity', params.targetEntity);
    const query = searchParams.toString();
    const url = query ? `/admin/activity-log?${query}` : '/admin/activity-log';
    return this.request(url);
  }

  // ==================== AI SUMMARY ====================

  /**
   * Generate AI file summary
   */
  async generateAISummary(applicationId: string): Promise<ApiResponse> {
    return this.request(`/loan-applications/${applicationId}/generate-summary`, {
      method: 'POST',
    });
  }

  /**
   * Get AI file summary
   */
  async getAISummary(applicationId: string): Promise<ApiResponse<{ summary: string }>> {
    return this.request<{ summary: string }>(`/loan-applications/${applicationId}/summary`);
  }

  // ==================== FORM CATEGORIES (DEPRECATED) ====================
  // Form config now uses Form Link + Record Titles. Use Form Configuration page (Credit Team).

  /**
   * List form categories
   * @deprecated Form Categories is deprecated. Use Form Link + Record Titles via Form Configuration page.
   */
  async listFormCategories(): Promise<ApiResponse<FormCategory[]>> {
    return this.request<FormCategory[]>('/form-categories');
  }

  /**
   * Get single form category
   * @deprecated Form Categories is deprecated. Use Form Link + Record Titles.
   */
  async getFormCategory(categoryId: string): Promise<ApiResponse<FormCategory>> {
    return this.request<FormCategory>(`/form-categories/${categoryId}`);
  }

  /**
   * Create form category
   * @deprecated Form Categories is deprecated. Use Form Link + Record Titles.
   */
  async createFormCategory(data: {
    categoryName: string;
    description?: string;
    displayOrder?: number;
    active?: boolean;
  }): Promise<ApiResponse<FormCategory>> {
    return this.request<FormCategory>('/form-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update form category
   * @deprecated Form Categories is deprecated. Use Form Link + Record Titles.
   */
  async updateFormCategory(
    categoryId: string,
    data: Partial<FormCategory>
  ): Promise<ApiResponse> {
    return this.request(`/form-categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete form category
   * @deprecated Form Categories is deprecated. Use Form Link + Record Titles.
   */
  async deleteFormCategory(categoryId: string): Promise<ApiResponse> {
    return this.request(`/form-categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  // ==================== NOTIFICATIONS ====================

  /**
   * Get notifications for current user
   */
  async getNotifications(options?: {
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    if (options?.unreadOnly) {
      params.append('unreadOnly', 'true');
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    const queryString = params.toString();
    const url = queryString ? `/notifications?${queryString}` : '/notifications';
    return this.request<any[]>(url);
  }

  /**
   * Get unread notification count
   */
  async getUnreadNotificationCount(): Promise<ApiResponse<{ unreadCount: number }>> {
    return this.request<{ unreadCount: number }>('/notifications/unread-count');
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<ApiResponse> {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead(): Promise<ApiResponse> {
    return this.request('/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  // ==================== LOAN PRODUCTS ====================

  /**
   * List loan products
   */
  async listLoanProducts(activeOnly?: boolean): Promise<ApiResponse<Array<{
    id: string;
    productId: string;
    productName: string;
    description?: string;
    active: boolean;
    requiredDocumentsFields?: string;
  }>>> {
    const query = activeOnly ? '?activeOnly=true' : '';
    return this.request(`/loan-products${query}`);
  }

  /**
   * Get single loan product
   */
  async getLoanProduct(productId: string): Promise<ApiResponse<{
    id: string;
    productId: string;
    productName: string;
    description?: string;
    active: boolean;
    requiredDocumentsFields?: string;
  }>> {
    return this.request(`/loan-products/${productId}`);
  }

  // ==================== CREDIT TEAM USERS ====================

  /**
   * List credit team users
   */
  async listCreditTeamUsers(): Promise<ApiResponse<CreditTeamUser[]>> {
    return this.request<CreditTeamUser[]>('/credit-team-users');
  }

  /**
   * Get single credit team user
   */
  async getCreditTeamUser(userId: string): Promise<ApiResponse<CreditTeamUser>> {
    return this.request<CreditTeamUser>(`/credit-team-users/${userId}`);
  }

  /**
   * Create credit team user
   */
  async createCreditTeamUser(data: {
    name: string;
    email: string;
    phone: string;
    role?: string;
    status?: string;
  }): Promise<ApiResponse<CreditTeamUser>> {
    return this.request<CreditTeamUser>('/credit-team-users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update credit team user
   */
  async updateCreditTeamUser(
    userId: string,
    data: Partial<CreditTeamUser>
  ): Promise<ApiResponse> {
    return this.request(`/credit-team-users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete credit team user
   */
  async deleteCreditTeamUser(userId: string): Promise<ApiResponse> {
    return this.request(`/credit-team-users/${userId}`, {
      method: 'DELETE',
    });
  }

  // ==================== ROLE-BASED ACCESS HELPERS ====================

  hasRole(_requiredRoles: UserRole[]): boolean {
    return true;
  }

  async getUserRole(): Promise<UserRole | null> {
    return null;
  }

  canAccess(_requiredRole: UserRole): Promise<boolean> {
    return Promise.resolve(false);
  }
}

// Export singleton instance
export const apiService = new ApiService();

// All types and interfaces are already exported above

