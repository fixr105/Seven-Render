import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, ExternalLink, FolderOpen, RefreshCw, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { apiService } from '../../services/api';
import {
  B2C_EV_FILE_RADIO_OPTIONS,
  FOLDER_LINK_MASKED_DISPLAY,
  getDocumentCategories,
  getDocumentDisplayKey,
  isFileFieldRequired,
  isFileOptionChecked,
  isValidDocumentsFolderLink,
  normalizeLinkPoolItem,
  persistUsedClientWebhookLinks,
  toStoredFileOptionValue,
  type FormConfigCategory,
} from '../../lib/b2cEvDocuments';

function readFieldValue(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value);
}

const blockFolderLinkFieldInteraction = (event: React.SyntheticEvent): void => {
  event.preventDefault();
};

export interface B2cEvDocumentsSectionProps {
  formData: Record<string, unknown>;
  formConfig: FormConfigCategory[];
  fieldErrors: Record<string, string>;
  usedWebhookLinks: Set<string>;
  onFieldChange: (key: string, value: string) => void;
  onFolderLinkConsumed: (link: string) => void;
  formConfigLoading?: boolean;
}

export const B2cEvDocumentsSection: React.FC<B2cEvDocumentsSectionProps> = ({
  formData,
  formConfig,
  fieldErrors,
  usedWebhookLinks,
  onFieldChange,
  onFolderLinkConsumed,
  formConfigLoading = false,
}) => {
  const { t } = useTranslation();
  const [folderLinkGenerating, setFolderLinkGenerating] = useState(false);
  const [folderLinkStatus, setFolderLinkStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [copiedFolderUrl, setCopiedFolderUrl] = useState(false);

  const folderLink = readFieldValue(formData, '_documentsFolderLink');
  const documentCategories = getDocumentCategories(formConfig);

  const handleGenerateFolderLink = async () => {
    setFolderLinkStatus(null);
    setFolderLinkGenerating(true);
    try {
      const poolResponse = await apiService.getClientLinkPool();
      if (!poolResponse.success || !Array.isArray(poolResponse.data)) {
        throw new Error(poolResponse.error || 'Failed to fetch link pool');
      }

      const candidates = poolResponse.data
        .map(normalizeLinkPoolItem)
        .filter((item) => item.link !== '' && item.status.toUpperCase() !== 'YES');
      const selectedLink = candidates.find((item) => !usedWebhookLinks.has(item.link))?.link;
      if (!selectedLink) {
        setFolderLinkStatus({
          type: 'info',
          message: t('pages.newApplication.noUnusedLinks'),
        });
        return;
      }

      onFieldChange('_documentsFolderLink', selectedLink);
      setCopiedFolderUrl(false);
      setFolderLinkStatus({
        type: 'success',
        message: t('pages.newApplication.linkGeneratedSuccess'),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate folder link';
      setFolderLinkStatus({ type: 'error', message });
    } finally {
      setFolderLinkGenerating(false);
    }
  };

  const markFolderLinkUsed = async (link: string) => {
    if (usedWebhookLinks.has(link)) return;

    const consumeResponse = await apiService.consumeClientLink(link);
    if (!consumeResponse.success) {
      throw new Error(consumeResponse.error || 'Failed to mark link as used');
    }

    onFolderLinkConsumed(link);
  };

  const handleCopyFolderLink = async () => {
    if (!folderLink) return;
    try {
      await markFolderLinkUsed(folderLink);
      await navigator.clipboard.writeText(folderLink);
      setCopiedFolderUrl(true);
      window.setTimeout(() => setCopiedFolderUrl(false), 2500);
      setFolderLinkStatus({ type: 'success', message: t('pages.newApplication.linkCopiedSuccess') });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not copy the folder link. Please copy it manually from the input.';
      setFolderLinkStatus({ type: 'error', message });
    }
  };

  const handleOpenFolderLink = async () => {
    if (!folderLink) return;
    try {
      const parsedUrl = new URL(folderLink);
      await markFolderLinkUsed(folderLink);
      const opened = window.open(parsedUrl.toString(), '_blank', 'noopener,noreferrer');
      if (!opened) {
        setFolderLinkStatus({
          type: 'error',
          message: 'Popup blocked. Please allow popups for this site and try again.',
        });
      }
    } catch {
      setFolderLinkStatus({
        type: 'error',
        message: 'Please enter a valid folder link before opening.',
      });
    }
  };

  return (
    <div className="space-y-6 border-t border-neutral-200 pt-6" data-testid="b2c-documents-section">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-neutral-200 bg-gradient-to-r from-brand-primary/[0.10] via-brand-primary/[0.06] to-white">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-white p-2 shadow-sm ring-1 ring-brand-primary/20">
              <FolderOpen className="h-5 w-5 text-brand-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">
                {t('pages.newApplication.documentsFolderRequired')}
              </CardTitle>
              <p className="mt-1 text-sm text-neutral-600">
                {t('pages.newApplication.documentsFolderHint')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <section
              role="button"
              tabIndex={0}
              aria-label="Generate and fill folder link"
              data-testid="generate-link-button"
              onClick={() => {
                if (!folderLinkGenerating) void handleGenerateFolderLink();
              }}
              onKeyDown={(event) => {
                if (folderLinkGenerating) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void handleGenerateFolderLink();
                }
              }}
              className="cursor-pointer rounded-2xl border border-brand-primary/20 bg-brand-primary/[0.05] p-4 transition-all hover:-translate-y-0.5 hover:bg-brand-primary/[0.08] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 sm:p-5"
            >
              <h3 className="text-base font-semibold text-neutral-900">
                {t('pages.newApplication.generateLink')}
              </h3>
              <p className="mt-1 text-sm text-neutral-700">{t('pages.newApplication.generateLinkHint')}</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-brand-primary ring-1 ring-brand-primary/20">
                {folderLinkGenerating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
                <span>
                  {folderLinkGenerating
                    ? t('pages.newApplication.generatingLink')
                    : t('pages.newApplication.generateLink')}
                </span>
              </div>
              {folderLinkStatus && (
                <p
                  className={`mt-3 text-sm ${
                    folderLinkStatus.type === 'error'
                      ? 'text-error'
                      : folderLinkStatus.type === 'success'
                        ? 'text-success'
                        : 'text-neutral-700'
                  }`}
                  aria-live="polite"
                >
                  {folderLinkStatus.message}
                </p>
              )}
              {copiedFolderUrl && (
                <p className="mt-2 text-sm text-success" aria-live="polite">
                  {t('pages.newApplication.linkCopiedSuccess')}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
              <h3 className="text-base font-semibold text-neutral-900">
                {t('pages.newApplication.folderLink')}
              </h3>
              <p className="mt-1 text-sm text-neutral-600">{t('pages.newApplication.folderLinkHint')}</p>
              <Input
                id="_documentsFolderLink"
                label={t('pages.newApplication.folderLink')}
                type="text"
                required
                readOnly
                aria-readonly="true"
                autoComplete="off"
                spellCheck={false}
                placeholder={t('pages.newApplication.folderLinkEmptyPlaceholder')}
                value={folderLink ? FOLDER_LINK_MASKED_DISPLAY : ''}
                onCopy={blockFolderLinkFieldInteraction}
                onCut={blockFolderLinkFieldInteraction}
                onPaste={blockFolderLinkFieldInteraction}
                onContextMenu={blockFolderLinkFieldInteraction}
                onKeyDown={(event) => {
                  if (event.key !== 'Tab') event.preventDefault();
                }}
                error={fieldErrors._documentsFolderLink}
                helperText={
                  fieldErrors._documentsFolderLink
                    ? undefined
                    : folderLink
                      ? t('pages.newApplication.folderLinkAssignedHelper')
                      : t('pages.newApplication.folderLinkEmptyHelper')
                }
                className="mt-3 cursor-not-allowed select-none bg-neutral-100 text-neutral-500 caret-transparent"
                data-testid="folder-link-display"
                data-folder-link-assigned={folderLink ? 'true' : 'false'}
              />
              <div className="mt-4 grid w-full grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  icon={Copy}
                  onClick={() => void handleCopyFolderLink()}
                  disabled={!folderLink}
                  data-testid="copy-folder-link"
                >
                  {t('pages.newApplication.copyLink')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  icon={ExternalLink}
                  onClick={() => void handleOpenFolderLink()}
                  disabled={!folderLink}
                  data-testid="open-folder-link"
                >
                  {t('pages.newApplication.openLink')}
                </Button>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>

      {formConfigLoading ? (
        <p className="text-sm text-neutral-600" data-testid="b2c-documents-loading">
          Loading document checklist…
        </p>
      ) : documentCategories.length === 0 ? (
        <p className="text-sm text-neutral-600" data-testid="b2c-documents-empty">
          No document checklist configured for this loan product.
        </p>
      ) : (
        documentCategories.map((category) => {
          const categoryName =
            category.categoryName ||
            category['Category Name'] ||
            category.categoryId ||
            'Documents';

          return (
            <Card key={category.categoryId || categoryName} data-testid="b2c-documents-checklist">
              <CardHeader>
                <CardTitle>{categoryName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(category.fields || []).map((field) => {
                  const fieldId = field.fieldId || field.id || field['Field ID'] || '';
                  const fieldLabel = field.label || field.fieldLabel || field['Field Label'] || fieldId;
                  const fieldType = field.type || field.fieldType || field['Field Type'] || '';
                  if (fieldType !== 'file') return null;

                  const displayKey = getDocumentDisplayKey(fieldLabel, categoryName);
                  const formValue = formData[displayKey] ?? formData[fieldId];
                  const error = fieldErrors[displayKey] || fieldErrors[fieldId];

                  return (
                    <div key={displayKey} data-testid={`b2c-document-field-${fieldId}`}>
                      <label className="block text-sm font-medium text-neutral-700">
                        {fieldLabel}
                        {isFileFieldRequired(field) && <span className="ml-1 text-error">*</span>}
                      </label>
                      <div className="mt-2 flex flex-wrap gap-4" role="radiogroup" aria-label={fieldLabel}>
                        {B2C_EV_FILE_RADIO_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <input
                              type="radio"
                              name={fieldId}
                              value={option.value}
                              checked={isFileOptionChecked(formValue, option.value)}
                              onChange={() => onFieldChange(displayKey, toStoredFileOptionValue(option.value))}
                              data-testid={`b2c-document-option-${fieldId}-${option.value}`}
                              className="h-4 w-4 border-neutral-300 text-brand-primary focus:ring-brand-primary"
                            />
                            <span className="text-sm text-neutral-700">{option.label}</span>
                          </label>
                        ))}
                      </div>
                      {error && <p className="mt-1 text-sm text-error">{error}</p>}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}

      {folderLink && isValidDocumentsFolderLink(folderLink) && usedWebhookLinks.has(folderLink) && (
        <p className="text-xs text-success" data-testid="b2c-documents-folder-access-confirmed">
          Folder link accessed — you can update the document checklist above.
        </p>
      )}
    </div>
  );
};
