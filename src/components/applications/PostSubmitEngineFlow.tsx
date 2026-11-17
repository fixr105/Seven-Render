import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { JourneyRail, railStepIdForPostSubmit } from '../dealer-ui/JourneyRail';
import { PageHeader } from '../dealer-ui/PageHeader';
import { ActionBar } from '../dealer-ui/ActionBar';
import { documentOwner, orderDocumentSlots } from '../dealer-ui/documentOwner';
import { UploadRow } from '../dealer-ui/UploadRow';
import { DealerWaiting } from '../dealer-ui/DealerWaiting';
import { apiService } from '../../services/api';
import {
  airtableGet,
  airtableWrite,
  fillCkyc,
  fillLoanAgreement,
  fillSanctionLetter,
  qualifyApplicant,
  uploadFileToUrl,
  uploadToUrl,
  type QualifyResponse,
} from '../../services/engineClient';
import {
  buildCanonical,
  formatInr,
  hasCoApplicantForQualify,
} from '../../lib/postSubmitEngine/canonical';
import { fillLoanDocuments, offerFromPersistedLoan } from '../../lib/postSubmitEngine/filledDocs';
import {
  applyEnachToFormData,
  buildEnachDetails,
  readEnachFromFormData,
  maskBankAccountNumber,
  validateEnachForm,
  type EnachAccountType,
  type EnachDetails,
} from '../../lib/postSubmitEngine/enach';
import {
  applyAcceptedOfferToFormData,
  buildOffers,
  OFFERS_UNAVAILABLE_MESSAGE,
  parseLenderRecord,
  pickActiveLender,
  readFrozenLoanFromFormData,
  type LenderRow,
} from '../../lib/postSubmitEngine/offers';
import {
  getPricing,
  isPricingEligible,
  isPricingUnavailable,
  PRICING_NOT_ELIGIBLE_MESSAGE,
  PRICING_UNAVAILABLE_MESSAGE,
} from '../../lib/lenderBrePricing';
import { fireEvent, flushCrm } from '../../lib/crmEvents';
import {
  buildRequiredDocsFromAirtable,
  formatDocumentsField,
  readStoredDocumentUploads,
} from '../../lib/postSubmitEngine/requiredDocs';
import { safeDevLog } from '../../lib/postSubmitEngine/masking';
import {
  formatAllFailedReasons,
  isOnlyNtcBankStatementRequired,
  routeAfterQualifyFail,
} from '../../lib/postSubmitEngine/ntcBankStatementGate';
import {
  decideQualifyAdvance,
  hasStrictQualifyPass,
  isPostQualifyLockedPhase,
  stampNtcStatementUploaded,
} from '../../lib/postSubmitEngine/qualifyPassGate';
import { NTC_BANK_STATEMENT_PENDING_KEY } from '../../lib/postSubmitEngine/resolveResumePhase';
import { getSupportPersonParty } from '../../lib/postSubmitEngine/supportPersonParty';
import {
  flaggedResumePhase,
  postSubmitPhaseHint,
  withPostSubmitFlag,
  type PostSubmitFlagKey,
} from '../../lib/postSubmitEngine/resolveResumePhase';
import { getBorrowerCibilScoreFromFormData } from '../../lib/b2cEvCibilProbability';
import { areRequiredKycDocsUploaded, hasCompletedWizardKycDocuments } from '../../lib/kycRequiredDocs';
import { formatEngineSetupError } from '../../lib/engineSetupError';
import { openKamComplianceRequest } from '../../lib/b2cEvKamRequest';
import {
  fetchVkycByFileId,
  isVkycDone,
  markLoanFileVkycRequested,
  requestVkyc,
  type VkycRow,
} from '../../lib/vkycLinks';
import {
  nextVkycPollFailureCount,
  shouldShowVkycStatusCheckError,
  VKYC_STATUS_CHECK_MESSAGE,
} from '../../lib/vkycPollFailures';
import { VideoKycCard } from './VideoKycCard';
import { StampPapersStep } from './StampPapersStep';
import { EsignStep } from './EsignStep';
import type {
  DisplayOffer,
  FilledDocs,
  PostSubmitPhase,
  PostSubmitSession,
  RequiredDocSlot,
  UploadedDocEntry,
} from '../../lib/postSubmitEngine/types';

const PRODUCT_DOC_ID = 'LP012';

function uploadsFromForm(formData: Record<string, unknown>): Record<string, UploadedDocEntry> {
  const stored = readStoredDocumentUploads(formData);
  return Object.fromEntries(
    Object.entries(stored).map(([fieldId, value]) => [
      fieldId,
      { fieldId, url: value.url, filename: value.filename },
    ])
  );
}
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const VKYC_POLL_MS = 10_000;
const SIGNING_SENT_KEY = '_meta.signing.sentAt';

type Props = {
  session: PostSubmitSession;
};

function Shell({
  title,
  phase,
  formData,
  children,
}: {
  title: string;
  phase: string;
  formData?: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const fileId = String(formData?.['_meta.fileId'] || '').trim();
  return (
    <div className="post-submit-engine min-h-[60vh] bg-dealer-surface">
      <div className="w-full">
        <JourneyRail currentStepId={railStepIdForPostSubmit(phase)} />
        <PageHeader
          phase={railStepIdForPostSubmit(phase) === 'photos' ? 'Delivery' : 'Approval'}
          title={title}
          helper=""
          fileId={fileId || undefined}
          saveLabel=""
          formData={formData}
        />
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-dealer-border bg-dealer-surface p-5 text-sm text-dealer-text">
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-[12px] bg-dealer-navy px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-[12px] border border-dealer-border bg-dealer-surface px-5 py-3 text-sm font-semibold text-dealer-navy"
    >
      {children}
    </button>
  );
}

function BusyRow({ label }: { label: string }) {
  return (
    <DealerWaiting title={label}>
      <Loader2 className="mt-3 h-5 w-5 animate-spin text-dealer-navy" aria-hidden />
    </DealerWaiting>
  );
}

export const PostSubmitEngineFlow: React.FC<Props> = ({ session }) => {
  const navigate = useNavigate();
  const resumePhase = session.resumePhase;
  const [phase, setPhase] = useState<PostSubmitPhase>(resumePhase ?? 'resolving');
  const [recordId, setRecordId] = useState(session.recordId);
  const [formData, setFormData] = useState(session.formData);
  const [qualifyResult, setQualifyResult] = useState<QualifyResponse | null>(
    resumePhase && isPostQualifyLockedPhase(resumePhase) ? { ok: true, pass: true } : null
  );
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocSlot[]>([]);
  const [uploads, setUploads] = useState<Record<string, UploadedDocEntry>>(() =>
    uploadsFromForm(session.formData)
  );
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [offers, setOffers] = useState<DisplayOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [enachDetails, setEnachDetails] = useState<EnachDetails | null>(null);
  const [enachHolderName, setEnachHolderName] = useState('');
  const [enachBankName, setEnachBankName] = useState('');
  const [enachAccountNumber, setEnachAccountNumber] = useState('');
  const [enachConfirmAccount, setEnachConfirmAccount] = useState('');
  const [enachIfsc, setEnachIfsc] = useState('');
  const [enachAccountType, setEnachAccountType] = useState<EnachAccountType>('Savings');
  const [enachTouched, setEnachTouched] = useState(false);
  const [filledDocs, setFilledDocs] = useState<FilledDocs | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ntcUploading, setNtcUploading] = useState(false);
  const [ntcUploadedName, setNtcUploadedName] = useState<string | null>(null);
  const [vkycRow, setVkycRow] = useState<VkycRow | null>(null);
  const [vkycBusy, setVkycBusy] = useState(false);
  const [vkycError, setVkycError] = useState<string | null>(null);
  const [vkycPollFailures, setVkycPollFailures] = useState(0);

  const fileId = session.fileId;
  const startedRef = useRef(false);
  const advanceLock = useRef(false);
  const originalQualifyPayloadRef = useRef<Record<string, unknown> | null>(null);
  const pendingDocFillRef = useRef<{
    formData: Record<string, unknown>;
    enach: EnachDetails;
    offer: DisplayOffer;
  } | null>(null);
  const docFillBootRef = useRef(false);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const docsSkippedRef = useRef(false);
  const rankAutoStartedRef = useRef(false);
  const signingSentWrittenRef = useRef(false);
  const vkycFailedFiredRef = useRef(false);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;

  const canonical = useMemo(() => buildCanonical(formData), [formData]);
  const selectedOffer = offers.find((o) => o.id === selectedOfferId) || null;

  const buildApplicantQualifyPayload = useCallback(
    (extra?: Record<string, unknown>): Record<string, unknown> => ({
      Full_Name: canonical.fullName,
      Mobile_Number: canonical.mobile,
      PAN_Number: canonical.pan,
      name: canonical.fullName,
      mobile: canonical.mobile,
      pan: canonical.pan,
      email: canonical.email || '',
      consent_bureau: true,
      consent_bureau_at: new Date().toISOString(),
      application_id: fileId,
      product_code: 'ev_dealer',
      requested_amount: Number(canonical.requestedLoanAmount) || 0,
      ...extra,
    }),
    [canonical, fileId]
  );

  const requiredUploadsComplete = useMemo(() => {
    return requiredDocs.filter((d) => d.required).every((d) => Boolean(uploads[d.fieldId]?.url));
  }, [requiredDocs, uploads]);

  const writeFormData = useCallback(
    async (fields: Record<string, unknown>, nextFormData?: Record<string, unknown>) => {
      const run = async () => {
        const payloadForm = nextFormData || formDataRef.current;
        await airtableWrite({
          table: 'Loan Applications',
          record_id: recordId,
          fields: {
            ...fields,
            'Last Updated': new Date().toISOString(),
            'Form Data': JSON.stringify(payloadForm),
          },
        });
        if (nextFormData) {
          formDataRef.current = nextFormData;
          setFormData(nextFormData);
        }
      };
      // One save at a time, so an older screen cannot overwrite a newer one.
      const queued = writeChainRef.current.then(run, run);
      writeChainRef.current = queued.then(
        () => undefined,
        () => undefined
      );
      return queued;
    },
    [recordId]
  );

  const markPostSubmitFlag = useCallback(
    async (key: PostSubmitFlagKey) => {
      const next = withPostSubmitFlag(formDataRef.current, key);
      if (next === formDataRef.current) return;
      formDataRef.current = next;
      setFormData(next);
      try {
        await writeFormData({}, next);
      } catch {
        // The in-memory flag still stops a second fire in this mount.
      }
    },
    [writeFormData]
  );

  const resolveRecordId = useCallback(async (): Promise<string> => {
    if (recordId.startsWith('rec')) return recordId;
    const filter = `{File ID} = '${fileId}'`;
    const res = await airtableGet({
      table: 'Loan Applications',
      filter,
      filter_formula: filter,
    });
    const id = res.records?.[0]?.id || (typeof res.id === 'string' ? res.id : '');
    if (!id || !id.startsWith('rec')) {
      throw new Error('Could not resolve Airtable record for this application');
    }
    setRecordId(id);
    return id;
  }, [fileId, recordId]);

  const rejectAsNotEligible = useCallback(
    async (resolvedId: string, reason: string) => {
      setErrorMessage(reason);
      try {
        await airtableWrite({
          table: 'Loan Applications',
          record_id: resolvedId,
          fields: {
            Status: 'Rejected',
            'Last Updated': new Date().toISOString(),
            'Form Data': JSON.stringify(formData),
            'Lender Decision Remarks': reason.slice(0, 500),
          },
        });
      } catch {
        // Still stop the UI even if Airtable write fails.
      }
      // Hard stop — never continue to documents/rank/offer.
      setPhase('rejected');
      return;
    },
    [formData]
  );

  const handleQualifyFailure = useCallback(
    async (resolvedId: string, raw: QualifyResponse) => {
      setQualifyResult(raw);
      const route = routeAfterQualifyFail(raw);
      if (route === 'ntc_upload') {
        // NTC-only — bank statement may clear the gate; do not reject yet.
        const next = {
          ...formDataRef.current,
          [NTC_BANK_STATEMENT_PENDING_KEY]: true,
        };
        formDataRef.current = next;
        setFormData(next);
        setPhase('ntc_upload');
        try {
          await airtableWrite({
            table: 'Loan Applications',
            record_id: resolvedId,
            fields: {
              'Last Updated': new Date().toISOString(),
              'Form Data': JSON.stringify(next),
            },
          });
        } catch {
          // The in-memory flag still keeps this visit on the upload screen.
        }
        return;
      }
      await rejectAsNotEligible(resolvedId, formatAllFailedReasons(raw));
      return;
    },
    [rejectAsNotEligible]
  );

  const runQualify = useCallback(async () => {
    const already = flaggedResumePhase(formDataRef.current);
    if (already === 'offer' || already === 'rejected' || already === 'stamp_step') {
      setPhase(already);
      return;
    }
    setPhase('qualify');
    setBusy(true);
    setErrorMessage(null);
    await markPostSubmitFlag('qualifyFired');
    try {
      const resolvedId = await resolveRecordId();
      setRecordId(resolvedId);

      // BRE runs on a first visit. A stored qualify result plus qualifyFired skips this
      // on refresh so the dealer is not charged or shown a second eligibility pass.
      const basePayload = buildApplicantQualifyPayload();
      originalQualifyPayloadRef.current = basePayload;

      const response = await qualifyApplicant(basePayload);
      const knownBureauScore = getBorrowerCibilScoreFromFormData(formData);
      const decision = decideQualifyAdvance(response, { knownBureauScore });
      setQualifyResult(decision.raw);

      // HARD GATE — advance when decideQualifyAdvance says so (strict pass or score reconcile).
      if (decision.advance) {
        setPhase('co_qualify');
        return;
      }

      await handleQualifyFailure(resolvedId, decision.raw);
      return; // mandatory — never fall through to documents/rank/offer
    } catch (err) {
      const reason =
        err instanceof Error && err.message
          ? err.message
          : 'No Experian / credit check result was returned. The application cannot proceed.';
      setErrorMessage(reason);
      setPhase('qualify_error');
    } finally {
      setBusy(false);
    }
  }, [
    buildApplicantQualifyPayload,
    formData,
    handleQualifyFailure,
    markPostSubmitFlag,
    resolveRecordId,
  ]);

  const handleNtcBankStatementSelected = async (file: File | null) => {
    if (!file || ntcUploading || busy) return;
    const allowed =
      /^(image\/(jpeg|jpg|png)|application\/pdf)$/i.test(file.type) ||
      /\.(jpe?g|png|pdf)$/i.test(file.name);
    if (!allowed) {
      setErrorMessage('Please upload JPG, PNG, or PDF.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorMessage('File must be 10MB or smaller.');
      return;
    }

    setNtcUploading(true);
    setBusy(true);
    setErrorMessage(null);
    try {
      const uploadedUrl = await uploadFileToUrl(file);
      setNtcUploadedName(file.name);

      const resolvedId = recordId.startsWith('rec') ? recordId : await resolveRecordId();
      await airtableWrite({
        table: 'Loan Applications',
        record_id: resolvedId,
        fields: {
          Notes: `Bank Statement: ${uploadedUrl}`,
          'Last Updated': new Date().toISOString(),
        },
      });

      const original = originalQualifyPayloadRef.current || buildApplicantQualifyPayload();
      const requalify = await qualifyApplicant({
        ...original,
        has_bank_statement: true,
      });
      const knownBureauScore = getBorrowerCibilScoreFromFormData(formData);
      const decision = decideQualifyAdvance(requalify, { knownBureauScore });
      const statementClearsNtc =
        !decision.advance && isOnlyNtcBankStatementRequired(decision.raw);
      if (decision.advance || statementClearsNtc) {
        const accepted = statementClearsNtc
          ? stampNtcStatementUploaded(decision.raw)
          : decision.raw;
        const next = {
          ...formDataRef.current,
          [NTC_BANK_STATEMENT_PENDING_KEY]: false,
        };
        formDataRef.current = next;
        setFormData(next);
        await airtableWrite({
          table: 'Loan Applications',
          record_id: resolvedId,
          fields: {
            'Last Updated': new Date().toISOString(),
            'Form Data': JSON.stringify(next),
          },
        });
        setQualifyResult(accepted);
        setPhase('co_qualify');
        return;
      }

      setQualifyResult(decision.raw);
      await rejectAsNotEligible(resolvedId, formatAllFailedReasons(decision.raw));
      return;
    } catch (err) {
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'Could not upload bank statement. Please try again.'
      );
    } finally {
      setNtcUploading(false);
      setBusy(false);
    }
  };

  const runCoQualifyAndContinue = useCallback(async () => {
    if (advanceLock.current) return;

    // HARD GATE — ZERO paths to documents/rank/offer unless pass === true.
    if (!qualifyResult || qualifyResult.pass !== true) {
      setPhase('rejected');
      setErrorMessage(
        errorMessage || 'Credit check did not pass. The application cannot proceed.'
      );
      return; // mandatory
    }

    advanceLock.current = true;
    setBusy(true);
    try {
      const support = getSupportPersonParty(formData);
      if (support.ok) {
        try {
          const pan = String(formData[`${support.party.prefix}.pan`] || '');
          const consentKey =
            support.party.prefix === 'guarantor'
              ? '_meta.guarantorBureau.checked_at'
              : '_meta.coApplicantBureau.checked_at';
          const consentAt = String(formData[consentKey] || '') || new Date().toISOString();
          // Same request shape as wizard support-person Verify. Fail/error must not block.
          await qualifyApplicant({
            Full_Name: support.party.name,
            Mobile_Number: support.party.mobile,
            PAN_Number: pan,
            consent_bureau_at: consentAt,
            application_id: `${fileId}-CO`,
            requested_amount: Number(canonical.requestedLoanAmount) || 0,
          });
        } catch {
          // A co-applicant bureau error must not block the borrower who already passed.
        }
      }

      // Re-check before any Status write / documents advance (pass can never be assumed).
      if (!hasStrictQualifyPass(qualifyResult)) {
        setPhase('rejected');
        return;
      }

      setPhase('write_qualified');
      await writeFormData({ Status: 'Qualified' });

      if (!hasStrictQualifyPass(qualifyResult)) {
        setPhase('rejected');
        return;
      }

      // Jump past documents only when every required slot already has a stored link.
      if (areRequiredKycDocsUploaded(formData) || hasCompletedWizardKycDocuments(formData)) {
        const documentsString = String(
          formData['_meta.kycDocuments.documentsString'] || ''
        ).trim();
        if (documentsString) {
          await writeFormData({ Documents: documentsString });
        }
        docsSkippedRef.current = true;
        setPhase('lender_rank');
        return;
      }

      setPhase('documents');
      const filter = `{Product ID} = '${PRODUCT_DOC_ID}'`;
      let docs: RequiredDocSlot[] = [];
      try {
        const docRes = await airtableGet({
          table: 'Product Document',
          filter,
          filter_formula: filter,
        });
        docs = buildRequiredDocsFromAirtable(
          docRes.records,
          hasCoApplicantForQualify(formData)
        );
      } catch {
        docs = buildRequiredDocsFromAirtable(undefined, hasCoApplicantForQualify(formData));
      }
      setRequiredDocs(docs);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to continue after qualify');
      setPhase('error');
    } finally {
      setBusy(false);
      advanceLock.current = false;
    }
  }, [
    canonical.requestedLoanAmount,
    errorMessage,
    fileId,
    formData,
    qualifyResult,
    writeFormData,
  ]);

  const handleFileSelected = async (doc: RequiredDocSlot, file: File | null) => {
    if (!file) return;
    const allowed =
      /^(image\/(jpeg|jpg|png)|application\/pdf)$/i.test(file.type) ||
      /\.(jpe?g|png|pdf)$/i.test(file.name);
    if (!allowed) {
      setErrorMessage(`${doc.label}: please upload JPG, PNG, or PDF.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorMessage(`${doc.label}: file must be 10MB or smaller.`);
      return;
    }
    setUploadingField(doc.fieldId);
    setErrorMessage(null);
    try {
      const url = await uploadToUrl(file, file.name);
      const entry = { fieldId: doc.fieldId, url, filename: file.name };
      const nextUploads = { ...uploadsRef.current, [doc.fieldId]: entry };
      uploadsRef.current = nextUploads;
      setUploads(nextUploads);
      const stored = readStoredDocumentUploads(formDataRef.current);
      const documents = formatDocumentsField(nextUploads);
      const nextForm = {
        ...formDataRef.current,
        '_meta.kycDocuments.uploads': {
          ...stored,
          [doc.fieldId]: { url, filename: file.name },
        },
        '_meta.kycDocuments.documentsString': documents,
        '_meta.postSubmit.uploads': nextUploads,
      };
      formDataRef.current = nextForm;
      try {
        await writeFormData({ Documents: documents }, nextForm);
      } catch {
        setErrorMessage(`${doc.label} uploaded, but it could not be saved. Please try again.`);
      }
    } catch {
      setErrorMessage(`Could not upload ${doc.label}. Please try again.`);
    } finally {
      setUploadingField(null);
    }
  };

  const loadDefaultLenderName = async (): Promise<string | null> => {
    try {
      const cfg = await airtableGet({
        table: 'Config',
        filter_formula: "{key} = 'default_lender'",
        max: 1,
      });
      const row = cfg.records?.[0];
      if (!row) return null;
      return String(row.value ?? '').trim() || null;
    } catch {
      return null;
    }
  };

  const runLenderRank = async () => {
    await markPostSubmitFlag('rankStarted');
    setPhase('lender_rank');
    setErrorMessage(null);

    const lendersRes = await airtableGet({
      table: 'Lenders',
      filter_formula: "{status} = 'active'",
      max: 50,
    });
    const lenders: LenderRow[] = (lendersRes.records || [])
      .map((row) => parseLenderRecord(row as Record<string, unknown>))
      .filter((row): row is LenderRow => Boolean(row));

    let defaultLenderName: string | null = null;
    if (lenders.length > 1) {
      defaultLenderName = await loadDefaultLenderName();
    }
    const picked = pickActiveLender(lenders, defaultLenderName);
    if (!picked.ok) {
      setErrorMessage(picked.reason);
      setPhase('rank_error');
      return;
    }

    const pan = String(canonical.pan || formData['borrower.pan'] || '').trim().toUpperCase();
    const productId = String(
      formData['productId'] || formData.loan_product_id || formData.loanProductId || ''
    ).trim();
    const pricing = await getPricing(pan, picked.lender.name, productId);
    if (isPricingUnavailable(pricing)) {
      const nextForm = await fireEvent('PRICING_UNAVAILABLE', {
        summary: pricing.message,
        fileKey: fileId,
        formData,
        applicantName: canonical.fullName,
        applicantMobile: canonical.mobile,
        writeFormData: async (fd) => {
          setFormData(fd);
          await writeFormData({}, fd);
        },
      });
      setFormData(nextForm);
      setErrorMessage(pricing.message || PRICING_UNAVAILABLE_MESSAGE);
      setPhase('rank_error');
      return;
    }
    if (!isPricingEligible(pricing)) {
      const reason = PRICING_NOT_ELIGIBLE_MESSAGE;
      const nextForm = await fireEvent('PRICING_NOT_ELIGIBLE', {
        summary: reason,
        fileKey: fileId,
        formData,
        applicantName: canonical.fullName,
        applicantMobile: canonical.mobile,
        writeFormData: async (fd) => {
          setFormData(fd);
          await writeFormData({ Status: 'Rejected' }, fd);
        },
      });
      setFormData(nextForm);
      setErrorMessage(reason);
      setPhase('rejected');
      return;
    }

    const built = buildOffers(readFrozenLoanFromFormData(formData), picked.lender, {
      roi_pct: pricing.roi_pct,
      pf_pct: pricing.pf_pct,
    });
    if (!built.ok) {
      setErrorMessage(built.reason);
      setPhase('rank_error');
      return;
    }

    const pricedForm = {
      ...formData,
      '_meta.pricing': {
        rule_id: pricing.rule_id,
        roi_pct: pricing.roi_pct,
        pf_pct: pricing.pf_pct,
        priced_at: new Date().toISOString(),
      },
    };
    setFormData(pricedForm);

    setOffers(built.offers);
    setSelectedOfferId(built.offers[0].id);
    setPhase('offer');
  };

  const runLenderRankSafe = async () => {
    setBusy(true);
    try {
      await runLenderRank();
    } catch {
      setErrorMessage(OFFERS_UNAVAILABLE_MESSAGE);
      setPhase('rank_error');
    } finally {
      setBusy(false);
    }
  };

  const continueFromDocuments = async () => {
    if (!requiredUploadsComplete) {
      setErrorMessage('Please upload all required documents.');
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const documents = formatDocumentsField(uploads);
      await writeFormData({ Documents: documents });
      await runLenderRank();
    } catch {
      setErrorMessage(OFFERS_UNAVAILABLE_MESSAGE);
      setPhase('rank_error');
    } finally {
      setBusy(false);
    }
  };

  const runDocFillAndStamps = async (
    nextFormData: Record<string, unknown>,
    enach: EnachDetails,
    offerArg?: DisplayOffer
  ) => {
    const offer = offerArg ?? selectedOffer ?? offerFromPersistedLoan(nextFormData);
    setPhase('doc_fill');
    if (!offer) {
      setErrorMessage('The accepted offer is missing. Go back and select an offer, then try again.');
      return;
    }
    await markPostSubmitFlag('docFillStarted');
    const saved = await fillLoanDocuments({
      formData: nextFormData,
      offer,
      fileId,
      enach,
      fillSanctionLetter,
      fillLoanAgreement,
      fillCkyc,
    });
    setFilledDocs(saved.filled);
    setFormData(saved.formData);
    await writeFormData({}, saved.formData);
    if (!saved.complete) {
      setErrorMessage(saved.errors[0] || 'Loan documents are not ready yet.');
      return;
    }
    setPhase('stamp_step');
  };

  const runDocFillRef = useRef(runDocFillAndStamps);
  runDocFillRef.current = runDocFillAndStamps;

  // A reopened file that already saved eNACH should not sit on the spinner.
  // Video KYC still has to finish before the loan documents are prepared.
  useEffect(() => {
    if (phase !== 'doc_fill' || resumePhase !== 'doc_fill') return;
    if (docFillBootRef.current) return;
    docFillBootRef.current = true;
    const saved = readEnachFromFormData(formDataRef.current);
    const offer = offerFromPersistedLoan(formDataRef.current);
    if (!saved || !offer) return;
    void (async () => {
      let row: VkycRow | null = null;
      try {
        row = await fetchVkycByFileId(fileId);
      } catch {
        row = null;
      }
      if (isVkycDone(row)) {
        await runDocFillRef.current(formDataRef.current, saved, offer);
        return;
      }
      pendingDocFillRef.current = {
        formData: formDataRef.current,
        enach: saved,
        offer,
      };
      setVkycRow(row);
      setPhase('vkyc_gate');
    })();
  }, [phase, resumePhase, fileId]);
  const runRankSafeRef = useRef(runLenderRankSafe);
  runRankSafeRef.current = runLenderRankSafe;

  const beginDocFillWithVkycGate = async (
    nextFormData: Record<string, unknown>,
    enach: EnachDetails,
    offer: DisplayOffer
  ) => {
    let row: VkycRow | null = null;
    try {
      row = await fetchVkycByFileId(fileId);
    } catch {
      row = null;
    }
    setVkycRow(row);
    if (isVkycDone(row)) {
      await runDocFillAndStamps(nextFormData, enach, offer);
      return;
    }
    pendingDocFillRef.current = { formData: nextFormData, enach, offer };
    setPhase('vkyc_gate');
  };

  const handleRequestVkyc = async (again: boolean) => {
    setVkycBusy(true);
    setVkycError(null);
    try {
      const row = await requestVkyc({
        fileId,
        mobile: canonical.mobile,
        borrowerName: canonical.fullName,
        existingRecordId: again ? vkycRow?.id : undefined,
      });
      setVkycRow(row);
      await markLoanFileVkycRequested(fileId, row);
      const kamPatch = await openKamComplianceRequest({
        applicationId: recordId || fileId,
        itemId: 'vkyc',
        applicantName: canonical.fullName,
        formData: {
          ...formDataRef.current,
          '_meta.vkyc.status': row.status,
          '_meta.vkyc.requestedAt': row.requested_at,
        },
      });
      const nextFormData = {
        ...formDataRef.current,
        '_meta.vkyc.recordId': row.id,
        '_meta.vkyc.status': row.status,
        '_meta.vkyc.requestedAt': row.requested_at,
        ...kamPatch,
      };
      formDataRef.current = nextFormData;
      setFormData(nextFormData);
      const metaPatch: Record<string, string> = {
        '_meta.vkyc.recordId': row.id,
        '_meta.vkyc.status': row.status,
        '_meta.vkyc.requestedAt': row.requested_at,
        ...kamPatch,
      };
      let saved = false;
      try {
        await writeFormData({}, nextFormData);
        saved = true;
      } catch {
        // The loan API below is the copy the KAM checklist reads.
      }
      for (const applicationId of [fileId, recordId]) {
        if (!applicationId) continue;
        try {
          const response = await apiService.updateApplicationForm(applicationId, metaPatch);
          if (response.success) saved = true;
        } catch {
          // The other id may still match the loan file the KAM opens.
        }
      }
      if (!saved) {
        setVkycError('Video KYC was requested, but the file status did not save.');
      }
    } catch (err) {
      setVkycError(formatEngineSetupError(err, 'VKYC Links'));
    } finally {
      setVkycBusy(false);
    }
  };

  const acceptOffer = async () => {
    if (!selectedOffer || !consent) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      setPhase('write_approval');
      const withLoanKeys = applyAcceptedOfferToFormData(formData, selectedOffer);
      setFormData(withLoanKeys);
      await writeFormData(
        {
          'Approved Loan Amount': Number(selectedOffer.amount),
          'Lender Decision Status': 'Approved',
          'Lender Decision Date': new Date().toISOString().split('T')[0],
          'Lender Decision Remarks': `Seven Fincorp — ${selectedOffer.label} | ROI ${selectedOffer.roi}% | Tenure ${selectedOffer.tenure}m`,
          'Assigned NBFC': selectedOffer.real_lender_id || 'Fintree',
        },
        withLoanKeys
      );

      setEnachHolderName(
        String(withLoanKeys['borrower.customerName'] || canonical.fullName || '')
      );
      setEnachBankName('');
      setEnachAccountNumber('');
      setEnachConfirmAccount('');
      setEnachIfsc('');
      setEnachAccountType('Savings');
      setEnachTouched(false);
      setEnachDetails(null);
      setPhase('enach');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not save offer acceptance');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  };

  const enachErrors = validateEnachForm({
    accountHolderName: enachHolderName,
    bankName: enachBankName,
    accountNumber: enachAccountNumber,
    confirmAccountNumber: enachConfirmAccount,
    ifscCode: enachIfsc,
    accountType: enachAccountType,
  });
  const enachValid = Object.keys(enachErrors).length === 0;

  const proceedFromEnach = async () => {
    setEnachTouched(true);
    if (!enachValid) return;
    const offer = selectedOffer ?? offerFromPersistedLoan(formDataRef.current);
    if (!offer) {
      setErrorMessage('The accepted offer is missing. Go back and select an offer, then try again.');
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const details = buildEnachDetails({
        accountHolderName: enachHolderName,
        bankName: enachBankName,
        accountNumber: enachAccountNumber,
        ifscCode: enachIfsc,
        accountType: enachAccountType,
      });
      let nextFormData = applyEnachToFormData(formDataRef.current, details);
      const kamPatch = await openKamComplianceRequest({
        applicationId: recordId || fileId,
        itemId: 'enach',
        applicantName: canonical.fullName,
        formData: nextFormData,
      });
      nextFormData = { ...nextFormData, ...kamPatch };
      formDataRef.current = nextFormData;
      setEnachDetails(details);
      setFormData(nextFormData);
      await writeFormData({}, nextFormData);
      await beginDocFillWithVkycGate(nextFormData, details, offer);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Document preparation failed');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (phase !== 'documents' || requiredDocs.length > 0) return;
    let cancelled = false;
    void (async () => {
      const filter = `{Product ID} = '${PRODUCT_DOC_ID}'`;
      let docs: RequiredDocSlot[] = [];
      try {
        const docRes = await airtableGet({
          table: 'Product Document',
          filter,
          filter_formula: filter,
        });
        docs = buildRequiredDocsFromAirtable(
          docRes.records,
          hasCoApplicantForQualify(formDataRef.current)
        );
      } catch {
        docs = buildRequiredDocsFromAirtable(
          undefined,
          hasCoApplicantForQualify(formDataRef.current)
        );
      }
      if (cancelled) return;
      const stored = uploadsFromForm(formDataRef.current);
      const known = new Set(docs.map((doc) => doc.fieldId));
      const extras: RequiredDocSlot[] = [];
      for (const [fieldId, entry] of Object.entries(stored)) {
        if (!known.has(fieldId)) {
          extras.push({ fieldId, label: entry.filename || fieldId, required: false });
        }
      }
      setRequiredDocs([...extras, ...docs]);
      setUploads((prev) => (Object.keys(prev).length > 0 ? prev : stored));
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, requiredDocs.length]);

  // Boot: resolve + qualify once. A resumed file starts at resumePhase and does not re-qualify.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const flagged = flaggedResumePhase(session.formData);
    if (resumePhase || flagged) {
      if (!resumePhase && flagged) setPhase(flagged);
      safeDevLog('post-submit resume', { fileId, phase: resumePhase || flagged });
      return;
    }
    safeDevLog('post-submit started', { fileId });
    void markPostSubmitFlag('flowStarted');
    void runQualify();
  }, [fileId, resumePhase, runQualify, markPostSubmitFlag, session.formData]);

  useEffect(() => {
    const hint = postSubmitPhaseHint(phase);
    if (!hint) return;
    if (formData['_meta.postSubmitPhase'] === hint) return;
    const next = { ...formData, '_meta.postSubmitPhase': hint };
    void writeFormData({}, next).catch(() => undefined);
  }, [phase, formData, writeFormData]);

  // After applicant qualify pass → co-qualify chain (gated again inside the runner)
  useEffect(() => {
    if (phase !== 'co_qualify') return;
    if (!qualifyResult || qualifyResult.pass !== true) {
      setPhase('rejected');
      return; // mandatory — never auto-advance without pass === true
    }
    void runCoQualifyAndContinue();
  }, [phase, qualifyResult, runCoQualifyAndContinue]);

  // Defense: if anything moves into a post-qualify phase without pass === true, force rejected.
  useEffect(() => {
    if (!isPostQualifyLockedPhase(phase)) return;
    if (hasStrictQualifyPass(qualifyResult)) return;
    setPhase('rejected');
  }, [phase, qualifyResult]);

  // Flush pending CRM events when the file is opened (after qualify boot).
  useEffect(() => {
    if (phase !== 'documents' && phase !== 'lender_rank' && phase !== 'offer') return;
    void flushCrm(formDataRef.current, {
      fileKey: fileId,
      applicantName: String(formDataRef.current['borrower.customerName'] || ''),
      applicantMobile: String(formDataRef.current['borrower.mobile'] || ''),
      writeFormData: async (next) => {
        setFormData(next);
        await writeFormData({}, next);
      },
    }).then((next) => setFormData(next));
  }, [phase, fileId, writeFormData]);

  // VKYC gate: poll until an officer marks the video KYC Done, then resume doc fill.
  useEffect(() => {
    if (phase !== 'vkyc_gate') return;
    let cancelled = false;

    const poll = async () => {
      try {
        const row = await fetchVkycByFileId(fileId);
        if (cancelled) return;
        setVkycRow(row);
        setVkycPollFailures(0);
        if (row?.status === 'Failed' && !vkycFailedFiredRef.current) {
          vkycFailedFiredRef.current = true;
          const remarks = String(row.remarks || '').trim() || 'no remarks';
          void fireEvent('VKYC_FAILED', {
            summary: `Video KYC failed: ${remarks}`,
            fileKey: fileId,
            formData: formDataRef.current,
            applicantName: String(formDataRef.current['borrower.customerName'] || ''),
            applicantMobile: String(formDataRef.current['borrower.mobile'] || ''),
          }).then((next) => setFormData(next));
        }
        if (!isVkycDone(row)) return;
        const pending = pendingDocFillRef.current;
        if (!pending) return;
        pendingDocFillRef.current = null;
        setBusy(true);
        try {
          await runDocFillRef.current(pending.formData, pending.enach, pending.offer);
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : 'Document preparation failed');
          setPhase('error');
        } finally {
          setBusy(false);
        }
      } catch {
        if (cancelled) return;
        setVkycPollFailures((n) => nextVkycPollFailureCount(n, false));
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), VKYC_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [phase, fileId]);

  // Documents phase skipped (KYC docs already uploaded) — start lender ranking once.
  useEffect(() => {
    if (phase !== 'lender_rank' || !docsSkippedRef.current) return;
    if (rankAutoStartedRef.current) return;
    rankAutoStartedRef.current = true;
    void runRankSafeRef.current();
  }, [phase]);

  // Stamp `_meta.signing.sentAt` once so the dealer delivery page unlocks (after eSign signed).
  useEffect(() => {
    if (phase !== 'signing_sent' || signingSentWrittenRef.current) return;
    signingSentWrittenRef.current = true;
    const current = formDataRef.current;
    if (String(current[SIGNING_SENT_KEY] || '').trim()) {
      void markPostSubmitFlag('signingsentWritten');
      return;
    }
    const stamped = { ...current, [SIGNING_SENT_KEY]: new Date().toISOString() };
    const next = withPostSubmitFlag(stamped, 'signingsentWritten');
    formDataRef.current = next;
    setFormData(next);
    void writeFormData({}, next).catch((err) => {
      signingSentWrittenRef.current = false;
      safeDevLog('signing sentAt write failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }, [phase, formData, writeFormData, markPostSubmitFlag]);

  if (phase === 'resolving' || phase === 'qualify' || phase === 'co_qualify' || phase === 'write_qualified') {
    return (
      <Shell phase={phase} formData={formData} title="Checking eligibility">
        <BusyRow label="Please wait while we process your application…" />
      </Shell>
    );
  }

  if (phase === 'qualify_error') {
    return (
      <Shell phase={phase} formData={formData} title="Eligibility check">
        <StatusCard>
          <p className="post-submit-body mb-4">{errorMessage || 'Something went wrong.'}</p>
          <PrimaryButton
            onClick={() => {
              startedRef.current = false;
              void runQualify();
            }}
            disabled={busy}
          >
            Retry
          </PrimaryButton>
        </StatusCard>
      </Shell>
    );
  }

  if (phase === 'ntc_upload') {
    return (
      <Shell phase={phase} formData={formData} title="Bank Statement Required">
        <p
          className="post-submit-body mb-4 text-sm text-dealer-text-quiet"
          data-testid="post-submit-ntc-subtitle"
        >
          This applicant is new to credit. Please upload the last 3 months’ bank statement to
          proceed.
        </p>
        {errorMessage && (
          <p className="post-submit-body mb-3 text-sm text-dealer-error" role="alert">
            {errorMessage}
          </p>
        )}
        <UploadRow
          fieldId="ntc-bank-statement"
          label="Bank statement"
          required
          ownerLine="Applicant"
          ownerName="Applicant"
          ownerRole="Applicant"
          initials="AP"
          filename={ntcUploadedName || undefined}
          uploading={ntcUploading}
          onFile={(file) => void handleNtcBankStatementSelected(file)}
          rowTestId="post-submit-ntc-upload"
          inputTestId="post-submit-ntc-input"
        />
      </Shell>
    );
  }

  if (phase === 'not_eligible' || phase === 'rejected') {
    return (
      <Shell phase={phase} formData={formData} title="Not eligible">
        <StatusCard>
          <p
            className="post-submit-body mb-4 whitespace-pre-line text-sm text-dealer-text-quiet"
            data-testid="post-submit-not-eligible-reason"
          >
            {errorMessage ||
              'This application is not eligible to proceed at this time.'}
          </p>
          <p className="mb-4 text-xs text-dealer-text-quiet" data-testid="post-submit-rejected">
            Application status: Rejected
          </p>
          <div className="flex flex-wrap gap-3">
            <PrimaryButton onClick={() => navigate('/')}>Back to Home</PrimaryButton>
            <SecondaryButton onClick={() => navigate('/applications')}>
              My Applications
            </SecondaryButton>
          </div>
        </StatusCard>
      </Shell>
    );
  }

  if (phase === 'documents') {
    return (
      <Shell phase={phase} formData={formData} title="Upload documents">
        <p className="mb-4 text-sm leading-5 text-dealer-text-quiet">
          Step 5 of 12 — upload required files (JPG, PNG, or PDF · max 10MB).
        </p>
        <ul className="space-y-4">
          {orderDocumentSlots(requiredDocs).map((doc) => {
            const uploaded = uploads[doc.fieldId];
            const isUploading = uploadingField === doc.fieldId;
            const owner = documentOwner(formData, doc);
            return (
              <li key={doc.fieldId}>
                <UploadRow
                  fieldId={doc.fieldId}
                  label={doc.required ? doc.label : `${doc.label} (optional)`}
                  required={doc.required}
                  ownerLine={owner.line}
                  ownerName={owner.name || owner.role}
                  ownerRole={owner.role}
                  initials={owner.initials}
                  filename={uploaded?.filename}
                  fileUrl={uploaded?.url}
                  uploading={isUploading}
                  onFile={(file) => void handleFileSelected(doc, file)}
                  rowTestId={`post-submit-doc-${doc.fieldId}`}
                  inputTestId={`post-submit-doc-input-${doc.fieldId}`}
                />
              </li>
            );
          })}
        </ul>
        {errorMessage && <p className="mt-4 text-sm text-dealer-error">{errorMessage}</p>}
        <ActionBar
          hideBack
          hideSave
          onBack={() => undefined}
          onSave={() => undefined}
          onPrimary={() => void continueFromDocuments()}
          primaryLabel={busy ? 'Continuing…' : 'Continue'}
          primaryDisabled={busy || requiredDocs.length === 0 || !requiredUploadsComplete}
          primaryBusy={busy}
        />
      </Shell>
    );
  }

  if (phase === 'lender_rank') {
    return (
      <Shell phase={phase} formData={formData} title="Finding offers">
        <BusyRow label="Matching lenders for your application…" />
      </Shell>
    );
  }

  if (phase === 'rank_error') {
    return (
      <Shell phase={phase} formData={formData} title="Offers unavailable">
        <StatusCard>
          <p className="post-submit-body mb-4" data-testid="post-submit-offers-error">
            {errorMessage || OFFERS_UNAVAILABLE_MESSAGE}
          </p>
          <PrimaryButton
            onClick={() =>
              void (docsSkippedRef.current ? runLenderRankSafe() : continueFromDocuments())
            }
            disabled={busy}
          >
            Retry
          </PrimaryButton>
        </StatusCard>
      </Shell>
    );
  }

  if (phase === 'offer') {
    return (
      <Shell phase={phase} formData={formData} title="Select your offer">
        <p className="post-submit-body mb-4 text-sm text-dealer-text-quiet">Step 7 of 12</p>
        <div className="space-y-4">
          {offers.map((offer) => {
            const selected = offer.id === selectedOfferId;
            return (
              <div
                key={offer.id}
                className={`rounded-[12px] border p-4 ${
                  selected ? 'border-dealer-navy bg-dealer-surface-soft' : 'border-dealer-border bg-dealer-surface'
                }`}
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-dealer-navy">
                  {offer.label}
                </p>
                <dl className="post-submit-body mt-4 space-y-2 text-sm text-dealer-text">
                  <div className="flex justify-between gap-4">
                    <dt className="text-dealer-text-quiet">Loan Amount</dt>
                    <dd className="font-medium">{formatInr(offer.amount)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-dealer-text-quiet">Interest Rate</dt>
                    <dd className="font-medium">{offer.roi}% p.a.</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-dealer-text-quiet">Tenure</dt>
                    <dd className="font-medium">{offer.tenure} months</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-dealer-text-quiet">EMI</dt>
                    <dd className="font-medium">{formatInr(offer.emi)}/month</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-dealer-text-quiet">Processing Fee</dt>
                    <dd className="font-medium">{formatInr(offer.pf)} + GST</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <PrimaryButton onClick={() => setSelectedOfferId(offer.id)}>
                    Select This Offer
                  </PrimaryButton>
                </div>
              </div>
            );
          })}
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-[12px] border border-dealer-border p-4">
          <input
            type="checkbox"
            className="mt-1"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span className="post-submit-body text-sm text-dealer-text">
            I, {canonical.fullName || 'the applicant'}, authorise Seven Fincorp and its lending
            partners to process this loan application, carry out required background checks, and
            disburse the loan as per the selected terms.
          </span>
        </label>

        {errorMessage && <p className="mt-3 text-sm text-dealer-error">{errorMessage}</p>}

        <ActionBar
          hideBack
          hideSave
          onBack={() => undefined}
          onSave={() => undefined}
          onPrimary={() => void acceptOffer()}
          primaryLabel={busy ? 'Processing…' : 'Accept & Proceed'}
          primaryDisabled={!selectedOffer || !consent || busy}
          primaryBusy={busy}
        />
      </Shell>
    );
  }

  if (phase === 'enach') {
    const show = (key: keyof typeof enachErrors) =>
      enachTouched && enachErrors[key] ? (
        <p className="mt-1 text-xs text-dealer-error">{enachErrors[key]}</p>
      ) : null;

    return (
      <Shell phase={phase} formData={formData} title="eNACH Setup">
        <p className="post-submit-body mb-4 text-sm text-dealer-text-quiet">
          Enter the bank account from which EMI will be deducted.
        </p>
        <StatusCard>
          <div className="space-y-4">
            <div>
              <label htmlFor="enach-holder" className="mb-1 block text-sm font-medium text-dealer-text">
                Account Holder Name
              </label>
              <input
                id="enach-holder"
                type="text"
                value={enachHolderName}
                onChange={(e) => setEnachHolderName(e.target.value)}
                className="min-h-11 w-full rounded-[12px] border border-dealer-border px-3 py-2 text-sm text-dealer-text focus:border-dealer-navy focus:outline-none focus:ring-2 focus:ring-dealer-navy"
                autoComplete="name"
              />
              {show('accountHolderName')}
            </div>
            <div>
              <label htmlFor="enach-bank" className="mb-1 block text-sm font-medium text-dealer-text">
                Bank Name
              </label>
              <input
                id="enach-bank"
                type="text"
                value={enachBankName}
                onChange={(e) => setEnachBankName(e.target.value)}
                className="min-h-11 w-full rounded-[12px] border border-dealer-border px-3 py-2 text-sm text-dealer-text focus:border-dealer-navy focus:outline-none focus:ring-2 focus:ring-dealer-navy"
                autoComplete="organization"
              />
              {show('bankName')}
            </div>
            <div>
              <label htmlFor="enach-account" className="mb-1 block text-sm font-medium text-dealer-text">
                Account Number
              </label>
              <input
                id="enach-account"
                type="password"
                inputMode="numeric"
                value={enachAccountNumber}
                onChange={(e) =>
                  setEnachAccountNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 18))
                }
                className="min-h-11 w-full rounded-[12px] border border-dealer-border px-3 py-2 text-sm text-dealer-text focus:border-dealer-navy focus:outline-none focus:ring-2 focus:ring-dealer-navy"
                autoComplete="off"
              />
              {show('accountNumber')}
            </div>
            <div>
              <label htmlFor="enach-confirm" className="mb-1 block text-sm font-medium text-dealer-text">
                Confirm Account Number
              </label>
              <input
                id="enach-confirm"
                type="password"
                inputMode="numeric"
                value={enachConfirmAccount}
                onChange={(e) =>
                  setEnachConfirmAccount(e.target.value.replace(/[^\d]/g, '').slice(0, 18))
                }
                className="min-h-11 w-full rounded-[12px] border border-dealer-border px-3 py-2 text-sm text-dealer-text focus:border-dealer-navy focus:outline-none focus:ring-2 focus:ring-dealer-navy"
                autoComplete="off"
              />
              {show('confirmAccountNumber')}
            </div>
            <div>
              <label htmlFor="enach-ifsc" className="mb-1 block text-sm font-medium text-dealer-text">
                IFSC Code
              </label>
              <input
                id="enach-ifsc"
                type="text"
                value={enachIfsc}
                onChange={(e) => setEnachIfsc(e.target.value.toUpperCase().slice(0, 11))}
                className="min-h-11 w-full rounded-[12px] border border-dealer-border px-3 py-2 text-sm uppercase text-dealer-text focus:border-dealer-navy focus:outline-none focus:ring-2 focus:ring-dealer-navy"
                autoComplete="off"
                spellCheck={false}
              />
              {show('ifscCode')}
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-dealer-text">Account Type</legend>
              <div className="flex gap-6">
                <label className="flex min-h-11 items-center gap-2 text-sm text-dealer-text">
                  <input
                    type="radio"
                    name="enach-account-type"
                    checked={enachAccountType === 'Savings'}
                    onChange={() => setEnachAccountType('Savings')}
                  />
                  Savings
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm text-dealer-text">
                  <input
                    type="radio"
                    name="enach-account-type"
                    checked={enachAccountType === 'Current'}
                    onChange={() => setEnachAccountType('Current')}
                  />
                  Current
                </label>
              </div>
              {show('accountType')}
            </fieldset>
          </div>
        </StatusCard>

        {enachValid && enachAccountNumber.length >= 4 && (
          <p className="post-submit-body mt-3 text-xs text-dealer-text-quiet">
            Account for EMI debit: {maskBankAccountNumber(enachAccountNumber)} · IFSC {enachIfsc}
          </p>
        )}

        {errorMessage && <p className="mt-3 text-sm text-dealer-error">{errorMessage}</p>}

        <div className="mt-6">
          <button
            type="button"
            onClick={() => void proceedFromEnach()}
            disabled={busy || !enachValid}
            className="inline-flex w-full items-center justify-center rounded-[12px] bg-dealer-navy px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Proceed to Documents'}
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === 'vkyc_gate') {
    return (
      <Shell phase={phase} formData={formData} title="Video KYC">
        <p className="post-submit-body mb-4 text-sm text-dealer-text-quiet">
          Video KYC must be completed before your loan documents are prepared. Keep this page
          open — we will continue automatically.
        </p>
        <VideoKycCard
          row={vkycRow}
          busy={vkycBusy}
          statusCheckError={
            shouldShowVkycStatusCheckError(vkycPollFailures) ? VKYC_STATUS_CHECK_MESSAGE : null
          }
          onRequest={() => void handleRequestVkyc(false)}
          onRequestAgain={() => void handleRequestVkyc(true)}
        />
        {vkycError ? <p className="mt-3 text-sm text-dealer-error">{vkycError}</p> : null}
      </Shell>
    );
  }

  if (phase === 'write_approval' || phase === 'doc_fill') {
    const label = phase === 'write_approval' ? 'Saving offer…' : 'Preparing your loan documents…';
    return (
      <Shell phase={phase} formData={formData} title="Preparing documents">
        <BusyRow label={label} />
        {errorMessage ? (
          <p className="mt-4 text-center text-sm text-dealer-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {enachDetails && phase === 'doc_fill' && (
          <p className="post-submit-body mt-3 text-center text-xs text-dealer-text-quiet">
            eNACH {maskBankAccountNumber(enachDetails.accountNumber)} · {enachDetails.ifscCode}
          </p>
        )}
      </Shell>
    );
  }

  if (phase === 'stamp_step') {
    return (
      <Shell phase={phase} formData={formData} title="Stamp papers">
        {filledDocs ? (
          <ul className="post-submit-body mb-4 list-disc space-y-1 pl-5 text-sm text-dealer-text">
            <li>
              <a
                className="text-dealer-navy underline"
                href={filledDocs.sanctionLetter}
                target="_blank"
                rel="noreferrer"
              >
                Sanction letter
              </a>
            </li>
            <li>
              <a
                className="text-dealer-navy underline"
                href={filledDocs.loanAgreement}
                target="_blank"
                rel="noreferrer"
              >
                Loan agreement
              </a>
            </li>
            <li>
              <a
                className="text-dealer-navy underline"
                href={filledDocs.ckyc}
                target="_blank"
                rel="noreferrer"
              >
                CKYC form
              </a>
            </li>
          </ul>
        ) : null}
        <StampPapersStep
          fileId={fileId}
          formData={formData}
          filledDocs={filledDocs}
          writeFormData={writeFormData}
          onPackReady={(next) => setFormData(next)}
          onContinueToEsign={() => setPhase('esign_step')}
        />
      </Shell>
    );
  }

  if (phase === 'esign_step') {
    return (
      <Shell phase={phase} formData={formData} title="E-sign">
        <EsignStep
          fileId={fileId}
          formData={formData}
          writeFormData={writeFormData}
          onBackToStamp={() => setPhase('stamp_step')}
          onSigned={(next) => {
            setFormData(next);
            setPhase('signing_sent');
          }}
        />
      </Shell>
    );
  }

  if (phase === 'signing_sent') {
    const deliveryUnlocked = Boolean(String(formData[SIGNING_SENT_KEY] || '').trim());
    return (
      <Shell phase={phase} formData={formData} title="E-sign">
        <StatusCard>
          <p className="post-submit-body">
            Both signatures are in. Continue to delivery when you are ready.
          </p>
          <div className="mt-4">
            <PrimaryButton
              onClick={() => navigate(`/dealer/delivery/${fileId}`)}
              disabled={!deliveryUnlocked}
            >
              Continue to delivery
            </PrimaryButton>
          </div>
        </StatusCard>
      </Shell>
    );
  }

  if (phase === 'done' && !selectedOffer) {
    return (
      <Shell phase={phase} formData={formData} title="Delivery">
        <StatusCard>
          <p className="post-submit-body">Delivery</p>
          <div className="mt-4">
            <PrimaryButton onClick={() => navigate(`/dealer/delivery/${fileId}`)}>
              Continue to delivery
            </PrimaryButton>
          </div>
        </StatusCard>
      </Shell>
    );
  }

  if (phase === 'done' && selectedOffer) {
    return (
      <Shell phase={phase} formData={formData} title="Loan Application Complete">
        <StatusCard>
          <div className="mb-4 flex items-center gap-2 text-dealer-navy">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
            <span className="font-semibold">✓ Loan Application Complete</span>
          </div>
          <dl className="post-submit-body space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-dealer-text-quiet">File</dt>
              <dd className="font-medium">{fileId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-dealer-text-quiet">Lender</dt>
              <dd className="font-medium">Seven Fincorp</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-dealer-text-quiet">Amount</dt>
              <dd className="font-medium">{formatInr(selectedOffer.amount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-dealer-text-quiet">EMI</dt>
              <dd className="font-medium">
                {formatInr(selectedOffer.emi)}/month × {selectedOffer.tenure} months
              </dd>
            </div>
          </dl>
          <p className="post-submit-body mt-4 text-sm text-dealer-text-quiet">
            The customer has received the sanction letter and loan agreement on their registered
            email.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <PrimaryButton onClick={() => navigate(`/dealer/delivery/${fileId}`)}>
              Continue to delivery
            </PrimaryButton>
            <SecondaryButton onClick={() => navigate('/applications/new')}>
              New Application
            </SecondaryButton>
            <SecondaryButton onClick={() => navigate('/applications')}>
              My Applications
            </SecondaryButton>
          </div>
        </StatusCard>
      </Shell>
    );
  }

  if (phase === 'error') {
    return (
      <Shell phase={phase} formData={formData} title="Something went wrong">
        <StatusCard>
          <p className="post-submit-body mb-4">{errorMessage || 'Please try again later.'}</p>
          <div className="flex flex-wrap gap-3">
            <PrimaryButton onClick={() => navigate(`/applications/${fileId}`)}>
              View application
            </PrimaryButton>
            <SecondaryButton onClick={() => navigate('/applications')}>
              My Applications
            </SecondaryButton>
          </div>
        </StatusCard>
      </Shell>
    );
  }

  return (
    <Shell phase={phase} formData={formData} title="Processing">
      <BusyRow label="Please wait…" />
    </Shell>
  );
};
