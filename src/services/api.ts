/**
 * API Service - Frontend API Client
 * Wraps all backend endpoints, handles JWT auth, and provides role-based access
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
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
      return {
        success: false,
        error: error.message || 'Network error',
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
  async getFormConfig(): Promise<ApiResponse<FormConfig>> {
    return this.request<FormConfig>('/client/form-config');
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
   */
  async createApplication(data: {
    productId: string;
    borrowerIdentifiers?: {
      pan?: string;
      name?: string;
    };
  }): Promise<ApiResponse<{ loanApplicationId: string; fileId: string }>> {
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
   * Create new client
   */
  async createClient(data: {
    name: string;
    email: string;
    phone: string;
    commissionRate?: string;
    modules?: string[];
  }): Promise<ApiResponse<{ clientId: string; userId: string }>> {
    return this.request('/kam/clients', {
      method: 'POST',
      body: JSON.stringify(data),
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
   * Get form mappings for client
   */
  async getFormMappings(clientId: string): Promise<ApiResponse> {
    return this.request(`/kam/clients/${clientId}/form-mappings`);
  }

  /**
   * Create form mapping
   */
  async createFormMapping(
    clientId: string,
    data: {
      category: string;
      isRequired: boolean;
      displayOrder?: number;
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
      decision: string;
      decisionDate: string;
      remarks?: string;
      approvedAmount?: string;
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
   * Create ledger query
   */
  async createLedgerQuery(
    ledgerEntryId: string,
    query: string
  ): Promise<ApiResponse> {
    return this.request(`/clients/me/ledger/${ledgerEntryId}/query`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  /**
   * Create payout request
   */
  async createPayoutRequest(amount: number): Promise<ApiResponse> {
    return this.request('/clients/me/payout-requests', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  /**
   * Get client payout requests
   */
  async getPayoutRequests(): Promise<ApiResponse<PayoutRequest[]>> {
    return this.request<PayoutRequest[]>('/clients/me/payout-requests');
  }

  // ==================== REPORTS ====================

  /**
   * Generate daily summary report
   */
  async generateDailySummary(): Promise<ApiResponse> {
    return this.request('/reports/daily/generate', {
      method: 'POST',
    });
  }

  /**
   * Get daily summary report
   */
  async getDailySummary(date: string): Promise<ApiResponse> {
    return this.request(`/reports/daily/${date}`);
  }

  // ==================== AUDIT LOGS ====================

  /**
   * Get file audit log
   */
  async getFileAuditLog(applicationId: string): Promise<ApiResponse<AuditLogEntry[]>> {
    return this.request<AuditLogEntry[]>(`/loan-applications/${applicationId}/audit-log`);
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

// Export types
export type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  UserContext,
  DashboardSummary,
  LoanApplication,
  FormConfig,
  CommissionLedgerEntry,
  PayoutRequest,
  FormCategory,
  CreditTeamUser,
  AuditLogEntry,
};

