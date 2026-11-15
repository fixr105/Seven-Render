import type { QualifyResponse, RankOfferRaw } from '../../services/engineClient';

export type { QualifyResponse };

export type PostSubmitPhase =
  | 'resolving'
  | 'qualify'
  | 'qualify_error'
  | 'not_eligible'
  | 'rejected'
  | 'ntc_upload'
  | 'co_qualify'
  | 'write_qualified'
  | 'documents'
  | 'vkyc_gate'
  | 'lender_rank'
  | 'rank_error'
  | 'offer'
  | 'write_approval'
  | 'enach'
  | 'doc_fill'
  | 'stamp_step'
  | 'esign_step'
  | 'signing_sent'
  | 'done'
  | 'error';

export type DisplayOffer = {
  id: string;
  label: string;
  amount: number;
  roi: number;
  pf: number;
  emi: number;
  tenure: number;
  apr: number;
  real_lender_id: string;
  source: RankOfferRaw;
};

export type RequiredDocSlot = {
  fieldId: string;
  label: string;
  required: boolean;
};

export type UploadedDocEntry = {
  fieldId: string;
  url: string;
  filename: string;
};

export type FilledDocs = {
  sanctionLetter: string;
  loanAgreement: string;
  ckyc: string;
};

export type PostSubmitSession = {
  fileId: string;
  recordId: string;
  formData: Record<string, unknown>;
  /**
   * Set when a saved file is reopened. The flow starts here and does not
   * re-run qualify, offers, or document fill.
   */
  resumePhase?: PostSubmitPhase;
  /**
   * @deprecated Do not reuse for pass/fail. Post-submit always calls /engine/qualify
   * fresh (bureau cache is server-side; BRE re-evaluates every time).
   */
  qualifyResult?: QualifyResponse | null;
};

export type PostSubmitRuntime = {
  phase: PostSubmitPhase;
  recordId: string;
  fileId: string;
  formData: Record<string, unknown>;
  qualifyResult: QualifyResponse | null;
  coApplicantResult: QualifyResponse | null;
  requiredDocs: RequiredDocSlot[];
  uploads: Record<string, UploadedDocEntry>;
  offers: DisplayOffer[];
  selectedOfferId: string | null;
  consent: boolean;
  filledDocs: FilledDocs | null;
  errorMessage: string | null;
  busy: boolean;
};
