/**
 * Response DTOs (Data Transfer Objects)
 */

import { UserRole, LoanStatus } from '../config/constants.js';

// Auth Responses
export interface LoginResponse {
  user: {
    id: string;
    email: string;
    role: UserRole;
    clientId?: string;
    kamId?: string;
    nbfcId?: string;
  };
  token: string;
}

export interface MeResponse {
  id: string;
  email: string;
  role: UserRole;
  clientId?: string;
  kamId?: string;
  nbfcId?: string;
  name?: string;
}

// Dashboard Responses
export interface ClientDashboardResponse {
  activeApplications: Array<{
    id: string;
    fileId: string;
    status: LoanStatus;
    applicantName?: string;
    requestedAmount?: string;
  }>;
  ledgerSummary: {
    totalEarned: number;
    pending: number;
    paid: number;
    balance: number;
  };
  pendingQueries: Array<{
    id: string;
    fileId: string;
    message: string;
    raisedBy: string;
    timestamp: string;
  }>;
  payoutRequests: Array<{
    id: string;
    amount: number;
    status: string;
    requestedDate: string;
  }>;
}

export interface KAMDashboardResponse {
  clients: Array<{
    id: string;
    name: string;
    email: string;
    activeApplications: number;
  }>;
  filesByStage: {
    underReview: number;
    queryPending: number;
    readyForCredit: number;
  };
  pendingQuestionsFromCredit: Array<{
    id: string;
    fileId: string;
    message: string;
  }>;
  ledgerDisputes: Array<{
    id: string;
    client: string;
    amount: number;
    status: string;
  }>;
}

export interface CreditDashboardResponse {
  filesByStage: {
    pendingCreditReview: number;
    queryWithKAM: number;
    inNegotiation: number;
    sentToNBFC: number;
    approved: number;
    rejected: number;
    disbursed: number;
  };
  aggregateMetrics: {
    filesReceivedToday: number;
    filesSentToLendersToday: number;
    filesApprovedToday: number;
    filesRejectedToday: number;
    totalDisbursedToday: number;
    pendingQueries: number;
  };
}

export interface NBFCDashboardResponse {
  assignedApplications: Array<{
    id: string;
    fileId: string;
    client: string;
    amount: string;
    product: string;
    dateSent: string;
    status: LoanStatus;
  }>;
}

// Generic API Response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

