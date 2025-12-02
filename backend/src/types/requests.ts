/**
 * Request DTOs (Data Transfer Objects)
 */

import { UserRole, LoanStatus, LenderDecisionStatus, Module } from '../config/constants.js';

// Auth Requests
export interface LoginRequest {
  email: string;
  password: string;
}

// Client Requests
export interface CreateLoanApplicationRequest {
  productId: string;
  borrowerIdentifiers?: {
    pan?: string;
    name?: string;
  };
}

export interface UpdateLoanApplicationFormRequest {
  formData: Record<string, any>;
  documentUploads?: Array<{
    fieldId: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
  }>;
}

export interface RespondToQueryRequest {
  message: string;
  newDocs?: Array<{
    fieldId: string;
    fileUrl: string;
    fileName: string;
  }>;
  answers?: Record<string, any>;
}

export interface CreatePayoutRequestRequest {
  amountRequested?: number;
  full?: boolean;
}

export interface CreateLedgerQueryRequest {
  message: string;
}

// KAM Requests
export interface CreateClientRequest {
  name: string;
  email: string;
  phone?: string;
  kamId: string;
  enabledModules: Module[];
  commissionRate?: number | string; // Commission rate as percentage (e.g., 1.5 for 1.5%)
}

export interface UpdateClientModulesRequest {
  enabledModules?: Module[];
  commissionRate?: number | string; // Commission rate as percentage (e.g., 1.5 for 1.5%)
}

export interface CreateFormMappingRequest {
  productId: string;
  categoryId: string;
  fieldId: string;
  isRequired: boolean;
  displayOrder: number;
}

export interface EditLoanApplicationRequest {
  formData?: Record<string, any>;
  notes?: string;
}

export interface RaiseQueryToClientRequest {
  message: string;
  fieldsRequested?: string[];
  documentsRequested?: string[];
  allowsClientToEdit?: boolean;
}

// Credit Requests
export interface RaiseCreditQueryRequest {
  message: string;
  requestedDocs?: string[];
  clarifications?: string[];
}

export interface AssignNBFCsRequest {
  nbfcIds: string[];
}

export interface CaptureNBFCDecisionRequest {
  nbfcId: string;
  decision: LenderDecisionStatus;
  approvedAmount?: number;
  terms?: string;
  rejectionReason?: string;
  clarificationMessage?: string;
}

export interface MarkDisbursedRequest {
  disbursedAmount: number;
  disbursedDate: string;
  lenderId: string;
}

export interface ApprovePayoutRequest {
  approvedAmount: number;
  note?: string;
}

export interface RejectPayoutRequest {
  reason: string;
}

// NBFC Requests
export interface RecordNBFCDecisionRequest {
  decision: LenderDecisionStatus;
  approvedAmount?: number;
  terms?: string;
  rejectionReason?: string;
  clarificationMessage?: string;
}

// Reports Requests
export interface GenerateDailySummaryRequest {
  date?: string; // YYYY-MM-DD, defaults to today
}

