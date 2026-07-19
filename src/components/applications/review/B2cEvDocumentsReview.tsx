import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '../../ui/Button';
import { apiService, type ApiResponse } from '../../../services/api';
import {
  getDocumentCategories,
  getDocumentDisplayKey,
  isFileOptionValue,
  isValidDocumentsFolderLink,
  type FormConfigCategory,
} from '../../../lib/b2cEvDocuments';
import { getExternalMediaUrl } from '../../../lib/shareableMediaUrl';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function formatChecklistValue(value: unknown): string {
  const normalized = readString(value);
  if (!normalized) return 'Not provided';
  if (normalized === 'yes_added_to_folder' || normalized === 'Yes, Added to Folder' || normalized === 'added_to_link') {
    return 'Yes, added to folder';
  }
  if (
    normalized === 'awaiting_will_update' ||
    normalized === 'Awaiting, Will Update Folder' ||
    normalized === 'to_be_shared'
  ) {
    return 'Awaiting, will update folder';
  }
  if (normalized === 'not_available' || normalized === 'Not Available') {
    return 'Not available';
  }
  return normalized;
}

export interface B2cEvDocumentsReviewProps {
  formData: Record<string, unknown>;
  clientId?: string;
  /** When provided, use this shared config instead of fetching internally. */
  formConfig?: FormConfigCategory[];
  formConfigLoading?: boolean;
}

export const B2cEvDocumentsReview: React.FC<B2cEvDocumentsReviewProps> = ({
  formData,
  clientId,
  formConfig: formConfigProp,
  formConfigLoading: formConfigLoadingProp,
}) => {
  const usingExternalConfig = formConfigProp !== undefined;
  const [internalFormConfig, setInternalFormConfig] = useState<FormConfigCategory[]>([]);
  const [internalFormConfigLoading, setInternalFormConfigLoading] = useState(false);

  const folderLink = readString(formData._documentsFolderLink);
  const externalFolderLink = getExternalMediaUrl(folderLink);
  const hasFolderLink = isValidDocumentsFolderLink(externalFolderLink);
  const productId = readString(formData.loan_product_id) || readString(formData.productId);

  useEffect(() => {
    if (usingExternalConfig || !clientId || !productId) return;
    setInternalFormConfigLoading(true);
    void apiService.getKAMClientFormConfig(clientId, productId).then((response: ApiResponse<Array<Record<string, unknown>>>) => {
      if (response.success && Array.isArray(response.data)) {
        setInternalFormConfig(response.data as FormConfigCategory[]);
      } else {
        setInternalFormConfig([]);
      }
      setInternalFormConfigLoading(false);
    });
  }, [clientId, productId, usingExternalConfig]);

  const formConfig = usingExternalConfig ? (formConfigProp as FormConfigCategory[]) : internalFormConfig;
  const formConfigLoading = usingExternalConfig
    ? Boolean(formConfigLoadingProp)
    : internalFormConfigLoading;

  const documentCategories = useMemo(() => getDocumentCategories(formConfig), [formConfig]);
  const fallbackChecklistEntries = useMemo(
    () =>
      Object.entries(formData).filter(([, value]) => isFileOptionValue(value)),
    [formData]
  );

  const hasChecklist = documentCategories.length > 0 || fallbackChecklistEntries.length > 0;
  if (!hasFolderLink && !hasChecklist) {
    return null;
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-neutral-200"
      data-testid="b2c-documents-review"
    >
      <div className="bg-neutral-50 px-4 py-3">
        <p className="text-sm font-semibold text-neutral-900">Documents</p>
        <p className="text-xs text-neutral-500">Client folder link and document checklist</p>
      </div>
      <div className="space-y-4 border-t border-neutral-200 p-4">
        {hasFolderLink ? (
          <div className="space-y-2" data-testid="b2c-documents-review-folder-link">
            <p className="text-sm text-neutral-500">Documents Folder Link</p>
            <a
              href={externalFolderLink}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-brand-primary hover:underline"
            >
              {externalFolderLink}
            </a>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={FolderOpen}
              onClick={() => window.open(externalFolderLink, '_blank', 'noopener,noreferrer')}
            >
              Open folder
            </Button>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No documents folder link provided yet.</p>
        )}

        {formConfigLoading ? (
          <p className="text-sm text-neutral-600">Loading document checklist…</p>
        ) : documentCategories.length > 0 ? (
          documentCategories.map((category) => {
            const categoryName =
              category.categoryName ||
              category['Category Name'] ||
              category.categoryId ||
              'Documents';

            return (
              <div key={category.categoryId || categoryName} className="space-y-3">
                <p className="text-sm font-medium text-neutral-900">{categoryName}</p>
                {(category.fields || []).map((field) => {
                  const fieldId = field.fieldId || field.id || field['Field ID'] || '';
                  const fieldLabel = field.label || field.fieldLabel || field['Field Label'] || fieldId;
                  const fieldType = field.type || field.fieldType || field['Field Type'] || '';
                  if (fieldType !== 'file') return null;

                  const displayKey = getDocumentDisplayKey(fieldLabel, categoryName);
                  const value = formData[displayKey] ?? formData[fieldId];

                  return (
                    <div
                      key={displayKey}
                      className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-2"
                    >
                      <p className="text-sm text-neutral-500">{fieldLabel}</p>
                      <p className="text-sm text-neutral-900 sm:col-span-2">
                        {formatChecklistValue(value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          fallbackChecklistEntries.map(([key, value]) => (
            <div key={key} className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-2">
              <p className="text-sm text-neutral-500">{key}</p>
              <p className="text-sm text-neutral-900 sm:col-span-2">{formatChecklistValue(value)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
