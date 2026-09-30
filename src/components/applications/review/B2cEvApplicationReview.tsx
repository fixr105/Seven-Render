import React, { useEffect, useMemo, useState } from 'react';
import { getVisibleB2cEvStages } from '../../../config/forms/b2cEvFormSchema';
import { B2C_EV_GEO_PHOTO_SLOTS } from '../../../lib/b2cEvGeoPhotos';
import { getBorrowerCibilScoreFromFormData } from '../../../lib/b2cEvCibilProbability';
import { isPanLookupSuccessful } from '../../../lib/b2cEvPanLookup';
import { formatB2cEvFieldValue } from '../../../lib/b2cEvFieldFormat';
import type { FormConfigCategory } from '../../../lib/b2cEvDocuments';
import { CibilProbabilityBar } from '../CibilProbabilityBar';
import { B2cEvGeoPhotoReview } from './B2cEvGeoPhotoReview';
import { B2cEvSupportPersonReview } from './B2cEvSupportPersonReview';
import { B2cEvComplianceReview } from './B2cEvComplianceReview';
import { B2cEvDocumentsReview } from './B2cEvDocumentsReview';
import { KamClientKycPanel } from './KamClientKycPanel';
import { apiService, type ApiResponse } from '../../../services/api';
import type { ComplianceItemId } from '../../../lib/b2cEvCompliance';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

const BUREAU_FORM_KEYS = [
  'dpd_3m',
  'dpd_6m',
  'overdue_12m',
  'dpd_60plus_24m',
  'dpd_90plus_36m',
  'emi_overdue',
  'cc_overdue',
  'enquiries_30d',
  'written_off_3y',
  'loan_amount',
  'ntc_bank_statement',
  'bureau_report_present',
] as const;

function bureauParamsFromFormData(
  formData: Record<string, unknown>
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const key of BUREAU_FORM_KEYS) {
    const raw = formData[key] ?? formData[`_meta.bureau.${key}`];
    if (raw == null || readString(raw) === '') continue;
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      params[key] = raw;
    } else {
      params[key] = readString(raw);
    }
  }
  return params;
}

/** Review-only stage titles that read more clearly than the client-facing wizard titles. */
const REVIEW_STAGE_TITLES: Record<string, string> = {
  product: 'Applicant Verification (PAN)',
};

function resolveFieldValue(formData: Record<string, unknown>, key: string): unknown {
  const direct = formData[key];
  const hasDirect = direct != null && readString(direct) !== '' && readString(direct) !== '-';
  if (hasDirect) return direct;
  // The borrower PAN is auto-filled from the PAN lookup; fall back to it when the
  // profile copy was not persisted so the KAM does not see a blank PAN.
  if (key === 'borrower.pan') return formData['_meta.panLookup.panNumber'];
  return direct;
}

function resolveInitialOpenStageId(
  stages: ReturnType<typeof getVisibleB2cEvStages>,
  formData: Record<string, unknown>,
  userRole?: string | null
): string | null {
  const defaultStageId = stages[0]?.id ?? null;
  const isReviewer = userRole === 'kam' || userRole === 'credit_team' || userRole === 'admin';
  if (!isReviewer) return defaultStageId;

  const hasGeoPhotos = B2C_EV_GEO_PHOTO_SLOTS.some((slot) => readString(formData[slot.urlKey]));
  if (hasGeoPhotos && stages.some((stage) => stage.id === 'geo-photos')) {
    return 'geo-photos';
  }

  return defaultStageId;
}

export interface B2cEvApplicationReviewProps {
  formData: Record<string, unknown>;
  applicationId: string;
  clientId?: string;
  userRole?: string | null;
  highlightComplianceItem?: ComplianceItemId;
  highlightDoRequest?: boolean;
  onUpdated?: () => void;
}

export const B2cEvApplicationReview: React.FC<B2cEvApplicationReviewProps> = ({
  formData,
  applicationId,
  clientId,
  userRole,
  highlightComplianceItem,
  highlightDoRequest,
  onUpdated,
}) => {
  const stages = useMemo(() => getVisibleB2cEvStages(formData), [formData]);
  const [openStageId, setOpenStageId] = useState<string | null>(() =>
    resolveInitialOpenStageId(getVisibleB2cEvStages(formData), formData, userRole)
  );

  const productId = readString(formData.loan_product_id) || readString(formData.productId);
  const [formConfig, setFormConfig] = useState<FormConfigCategory[]>([]);
  const [formConfigLoading, setFormConfigLoading] = useState(false);

  useEffect(() => {
    if (!clientId || !productId) {
      setFormConfig([]);
      return;
    }
    let cancelled = false;
    setFormConfigLoading(true);
    void apiService
      .getKAMClientFormConfig(clientId, productId)
      .then((response: ApiResponse<Array<Record<string, unknown>>>) => {
        if (cancelled) return;
        setFormConfig(
          response.success && Array.isArray(response.data)
            ? (response.data as FormConfigCategory[])
            : []
        );
      })
      .finally(() => {
        if (!cancelled) setFormConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, productId]);

  const cibilScore = isPanLookupSuccessful(formData)
    ? getBorrowerCibilScoreFromFormData(formData)
    : null;

  const isStaff =
    userRole === 'kam' || userRole === 'credit_team' || userRole === 'admin';
  const [recommendation, setRecommendation] = useState<{
    lender: string | null;
    roi: number | null;
    loaded: boolean;
  }>({ lender: null, roi: null, loaded: false });

  useEffect(() => {
    if (!isStaff || cibilScore == null || !productId) {
      setRecommendation({ lender: null, roi: null, loaded: false });
      return;
    }
    let cancelled = false;
    void apiService.getCibilChances(cibilScore, productId, bureauParamsFromFormData(formData)).then((res) => {
      if (cancelled) return;
      const lender = res.success && res.data?.recommendedLender ? String(res.data.recommendedLender) : null;
      const roiRaw = res.data?.recommendedLenderROI;
      const roi = typeof roiRaw === 'number' && Number.isFinite(roiRaw) ? roiRaw : null;
      setRecommendation({ lender, roi, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, [isStaff, cibilScore, productId, formData]);

  return (
    <div className="space-y-4" data-testid="b2c-ev-application-review">
      {cibilScore != null && (
        <CibilProbabilityBar cibilScore={cibilScore} loanProductId={productId} />
      )}

      {isStaff && recommendation.loaded && (
        <p
          className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600"
          data-testid="b2c-recommended-lender"
        >
          {recommendation.lender ? (
            <>
              <span className="text-neutral-500">Recommended Lender:</span> {recommendation.lender}
              {recommendation.roi != null && (
                <span className="mt-1 block text-neutral-500">
                  Best Rate: {recommendation.roi}%
                </span>
              )}
            </>
          ) : (
            <span className="text-neutral-500">No eligible lender found for current profile</span>
          )}
        </p>
      )}

      {clientId && isStaff && (
        <KamClientKycPanel clientId={clientId} />
      )}

      {stages.map((stage) => {
        const isOpen = openStageId === stage.id;
        return (
          <div
            key={stage.id}
            className="overflow-hidden rounded-xl border border-neutral-200"
            data-testid={`b2c-review-stage-${stage.id}`}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between bg-neutral-50 px-4 py-3 text-left"
              onClick={() => setOpenStageId(isOpen ? null : stage.id)}
            >
              <span className="text-sm font-semibold text-neutral-900">
                {REVIEW_STAGE_TITLES[stage.id] ?? stage.title}
              </span>
              <span className="text-xs text-neutral-500">{isOpen ? 'Hide' : 'Show'}</span>
            </button>
            {isOpen && (
              <div className="space-y-4 border-t border-neutral-200 p-4">
                {stage.id === 'geo-photos' ? (
                  <B2cEvGeoPhotoReview formData={formData} />
                ) : stage.id === 'support-person' ? (
                  <B2cEvSupportPersonReview formData={formData} />
                ) : (
                  <div className="space-y-2">
                    {stage.fields.map((field) => (
                      <div
                        key={field.key}
                        className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-2"
                      >
                        <p className="text-sm text-neutral-500">{field.label}</p>
                        <p className="text-sm text-neutral-900 sm:col-span-2">
                          {formatB2cEvFieldValue(field, resolveFieldValue(formData, field.key))}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <B2cEvDocumentsReview
        formData={formData}
        clientId={clientId}
        formConfig={formConfig}
        formConfigLoading={formConfigLoading}
      />

      <B2cEvComplianceReview
        formData={formData}
        formConfig={formConfig}
        applicationId={applicationId}
        userRole={userRole}
        highlightComplianceItem={highlightComplianceItem}
        highlightDoRequest={highlightDoRequest}
        onUpdated={onUpdated}
      />
    </div>
  );
};
