/**
 * API Service - Frontend API Client
 * Wraps all backend endpoints, handles JWT auth, and provides role-based access
 */

// Ensure API_BASE_URL includes /api prefix for Vercel deployment
const getApiBaseUrl = () => {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  
  // If VITE_API_BASE_URL is explicitly set, use it
  if (baseUrl) {
    // If it's a full URL (not localhost), ensure it has /api
    if (!baseUrl.includes('localhost') && !baseUrl.startsWith('/')) {
      // It's a production URL - ensure /api is appended
      if (!baseUrl.endsWith('/api')) {
        return baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;
      }
      return baseUrl;
    }
    // For localhost or relative paths, return as-is
    return baseUrl;
  }
  
  // In production, try to use current origin to avoid relative path issues
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin;
    // Only use absolute URL if we're not on localhost (production)
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return `${origin}/api`;
    }
  }
  
  // Default: use relative path (works for both dev proxy and Vercel production)
  // In development, Vite proxy handles /api -> localhost:3001
  // In production, Vercel rewrites handle /api -> serverless function
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

// Types
export type UserRole = 'client' | 'kam' | 'credit_team' | 'nbfc' | 'admin';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    role: UserRole;
    clientId?: string;
    kamId?: string;
    nbfcId?: string;
    name?: string;
  };
  token: string;
}

export interface UserContext {
  id: string;
  email: string;
  role: UserRole;
  clientId?: string;
  kamId?: string;
  nbfcId?: string;
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
    message: string;
    raisedBy: string;
    timestamp: string;
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
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  // Token Management
  private loadToken(): void {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  getToken(): string | null {
    return this.token;
  }

  // Generic request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Always reload token from localStorage before each request
    // This ensures we have the latest token even if it was updated elsewhere
    this.loadToken();
    
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Public endpoints that don't require authentication
    const publicEndpoints = ['/auth/login', '/auth/register', '/health'];
    const isPublicEndpoint = publicEndpoints.some(publicPath => endpoint.startsWith(publicPath));

    // Add auth token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      // Debug logging in development
      if (import.meta.env.DEV) {
        console.log(`[ApiService] Sending request to ${endpoint} with token: ${this.token.substring(0, 20)}...`);
      }
    } else if (!isPublicEndpoint) {
      // Only warn for protected endpoints that require authentication
      console.warn(`[ApiService] No token available for request to ${endpoint}. User may need to login.`);
      console.warn(`[ApiService] localStorage.getItem('auth_token'):`, localStorage.getItem('auth_token'));
    }

    try {
      // Add timeout for fetch requests
      // Login webhook should respond quickly, but allow up to 55 seconds for Vercel function limit
      const isLoginRequest = endpoint.includes('/auth/login');
      const timeoutMs = isLoginRequest ? 55000 : 30000; // 55s for login (Vercel limit is 60s), 30s for others
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      let response: Response;
      try {
        response = await fetch(url, {
          ...options,
          headers,
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

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        // If not JSON, return the text as error
        console.error('Failed to parse JSON response:', text.substring(0, 200));
        return {
          success: false,
          error: `Invalid JSON response from server: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`,
        };
      }

      if (!response.ok) {
        // Handle 401/403 errors specially - token might be invalid or expired
        if (response.status === 401 || response.status === 403) {
          // Clear token if unauthorized/forbidden
          this.clearToken();
          return {
            success: false,
            error: data.error || `Authentication failed (${response.status}). Please login again.`,
          };
        }
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error: any) {
      console.error('API request error:', error);
      console.error('Request URL:', url);
      console.error('Base URL:', this.baseUrl);
      console.error('Endpoint:', endpoint);
      
      // Provide more specific error messages
      let errorMessage = 'Network error';
      
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        const isLocalhost = this.baseUrl.includes('localhost') || this.baseUrl.startsWith('/api');
        if (isLocalhost) {
          errorMessage = `Cannot connect to backend API. Please ensure the backend server is running on port 3001.\n\nTo start the server:\n  cd backend\n  npm run dev`;
        } else {
          errorMessage = `Cannot connect to backend API at ${url}. This could be due to:\n- Network connectivity issues\n- CORS configuration\n- Server is down or unreachable\n\nPlease check your network connection and try again.`;
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

  // ==================== AUTHENTICATION ====================

  /**
   * Login and receive JWT token
   */
  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data?.token) {
      this.setToken(response.data.token);
    }

    return response;
  }

  /**
   * Get current authenticated user
   */
  async getMe(): Promise<ApiResponse<UserContext>> {
    return this.request<UserContext>('/auth/me');
  }

  /**
   * Logout (clear token)
   */
  logout(): void {
    this.clearToken();
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
   * Reply to a query
   */
  async replyToQuery(
    applicationId: string,
    queryId: string,
    reply: string
  ): Promise<ApiResponse> {
    return this.request(`/loan-applications/${applicationId}/queries/${queryId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply }),
    });
  }

  // ==================== LOAN APPLICATIONS ====================

  /**
   * Create new loan application
   * Module 2: Supports documentUploads array with OneDrive links
   */
  async createApplication(data: {
    productId: string;
    applicantName?: string;
    requestedLoanAmount?: number;
    formData?: Record<string, any>;
    documentUploads?: Array<{ fieldId: string; fileUrl: string; fileName: string }>; // Module 2: OneDrive links
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
  }>> {
    return this.request('/loan-applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Module 2: Upload document to OneDrive
   * Returns OneDrive share link for storage in Airtable
   */
  async uploadDocument(
    file: File,
    fieldId: string,
    fileName?: string
  ): Promise<ApiResponse<{ shareLink: string; fileId: string; webUrl: string; fieldId: string; fileName: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fieldId', fieldId);
    if (fileName) {
      formData.append('fileName', fileName);
    }

    const url = `${this.baseUrl}/documents/upload`;
    const headers: HeadersInit = {};
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const text = await response.text();
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: `Empty response from server (${response.status})`,
        };
      }

      const data = JSON.parse(text);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.clearToken();
          return {
            success: false,
            error: data.error || 'Authentication failed',
          };
        }
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error: any) {
      console.error('Document upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload document',
      };
    }
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
   * Get form mappings for client (KAM only)
   */
  async getFormMappings(clientId: string): Promise<ApiResponse> {
    return this.request(`/kam/clients/${clientId}/form-mappings`);
  }

  /**
   * Get form mappings for client (Public - for form links)
   */
  async getPublicFormMappings(clientId: string): Promise<ApiResponse> {
    return this.request(`/public/clients/${clientId}/form-mappings`);
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
      modules?: string[]; // For bulk creation
      productId?: string; // Module 1: Optional loan product ID
    }
  ): Promise<ApiResponse> {
    return this.request(`/kam/clients/${clientId}/form-mappings`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
   * Get daily summary report
   */
  async getDailySummary(date: string): Promise<ApiResponse> {
    return this.request(`/reports/daily/${date}`);
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
   * Resolve a query
   */
  async resolveQuery(applicationId: string, queryId: string, resolutionMessage?: string): Promise<ApiResponse> {
    return this.request(`/loan-applications/${applicationId}/queries/${queryId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutionMessage }),
    });
  }

  /**
   * Get admin activity log
   */
  async getAdminActivityLog(): Promise<ApiResponse> {
    return this.request('/admin/activity-log');
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

  // ==================== FORM CATEGORIES ====================

  /**
   * List form categories
   */
  async listFormCategories(): Promise<ApiResponse<FormCategory[]>> {
    return this.request<FormCategory[]>('/form-categories');
  }

  /**
   * Get single form category
   */
  async getFormCategory(categoryId: string): Promise<ApiResponse<FormCategory>> {
    return this.request<FormCategory>(`/form-categories/${categoryId}`);
  }

  /**
   * Create form category
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

  /**
   * Check if user has required role
   */
  hasRole(requiredRoles: UserRole[]): boolean {
    // This should be called after getMe() to get current user role
    // For now, we'll check token and let backend enforce
    return true; // Backend will enforce RBAC
  }

  /**
   * Get user role from token (basic check)
   */
  async getUserRole(): Promise<UserRole | null> {
    const me = await this.getMe();
    if (me.success && me.data) {
      return me.data.role;
    }
    return null;
  }

  /**
   * Check if user can access resource
   */
  canAccess(requiredRole: UserRole): Promise<boolean> {
    return this.getUserRole().then((role) => role === requiredRole);
  }
}

// Export singleton instance
export const apiService = new ApiService();

// All types and interfaces are already exported above

