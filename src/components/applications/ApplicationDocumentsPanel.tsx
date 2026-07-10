import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ExternalLink, Eye, File, FileText, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  getApplicationDocumentLabel,
  isImageDocument,
  partitionApplicationDocuments,
  type ApplicationDocumentEntry,
} from '../../lib/applicationDocuments';
import { getExternalMediaUrl } from '../../lib/shareableMediaUrl';
import { isValidDocumentsFolderLink } from '../../lib/b2cEvDocuments';
import { ReviewableMediaImage } from './ReviewableMediaImage';

export interface ApplicationDocumentsPanelProps {
  documents: ApplicationDocumentEntry[];
  folderLinkFromForm?: unknown;
  showReviewerTips?: boolean;
}

function openDocument(url: string): void {
  window.open(getExternalMediaUrl(url), '_blank', 'noopener,noreferrer');
}

function downloadDocument(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = getExternalMediaUrl(url);
  link.download = fileName || 'document';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.click();
}

export const ApplicationDocumentsPanel: React.FC<ApplicationDocumentsPanelProps> = ({
  documents,
  folderLinkFromForm,
  showReviewerTips = false,
}) => {
  const { t } = useTranslation();
  const { folderLink, mediaDocuments } = useMemo(
    () => partitionApplicationDocuments(documents, folderLinkFromForm),
    [documents, folderLinkFromForm]
  );

  if (!folderLink && mediaDocuments.length === 0) {
    return null;
  }

  const externalFolderLink = getExternalMediaUrl(folderLink);
  const hasValidFolderLink = isValidDocumentsFolderLink(externalFolderLink);

  return (
    <Card data-testid="application-documents-panel">
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle>
            {t('pages.applicationDetail.uploadedDocuments', { count: mediaDocuments.length })}
          </CardTitle>
          {showReviewerTips && (
            <Badge variant="info">{t('pages.applicationDetail.filesFromBackend')}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasValidFolderLink && (
          <section
            className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
            data-testid="application-documents-folder-link"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-neutral-900">Documents Folder Link</p>
                <a
                  href={externalFolderLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-sm text-brand-primary hover:underline"
                  data-testid="application-documents-folder-link-anchor"
                >
                  {externalFolderLink}
                </a>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={FolderOpen}
                onClick={() => openDocument(externalFolderLink)}
              >
                {t('common.open')}
              </Button>
            </div>
          </section>
        )}

        {mediaDocuments.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {mediaDocuments.map((doc, index) => {
              const externalUrl = getExternalMediaUrl(doc.url);
              const label = getApplicationDocumentLabel(doc.fieldId);
              const showImagePreview = isImageDocument(doc.fileName, doc.url);
              const fileExtension = doc.fileName?.split('.').pop()?.toLowerCase() || '';
              const isPdf = fileExtension === 'pdf';

              return (
                <div
                  key={`${doc.fieldId}-${index}`}
                  className="flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-4"
                  data-testid={`application-document-${doc.fieldId}`}
                >
                  <div className="mb-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{label}</p>
                      {fileExtension && (
                        <Badge variant="info" className="text-xs uppercase">
                          {fileExtension}
                        </Badge>
                      )}
                    </div>
                    {doc.fileName && doc.fileName !== label && (
                      <p className="truncate text-xs text-neutral-500" title={doc.fileName}>
                        {doc.fileName}
                      </p>
                    )}
                  </div>

                  <div className="mb-4 flex-1">
                    {showImagePreview ? (
                      <ReviewableMediaImage
                        url={externalUrl}
                        label={label}
                        className="max-h-48 w-full"
                        testId={`application-document-preview-${doc.fieldId}`}
                      />
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg bg-neutral-50">
                        {isPdf ? (
                          <FileText className="h-10 w-10 text-error" />
                        ) : (
                          <File className="h-10 w-10 text-neutral-400" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 border-t border-neutral-200 pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      className="flex-1"
                      onClick={() => openDocument(externalUrl)}
                    >
                      {t('common.view')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Download}
                      className="flex-1"
                      onClick={() => downloadDocument(externalUrl, doc.fileName)}
                    >
                      {t('common.download')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={ExternalLink}
                      onClick={() => openDocument(externalUrl)}
                    >
                      {t('common.open')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showReviewerTips && mediaDocuments.length > 0 && (
          <p className="text-xs text-neutral-500">{t('pages.applicationDetail.documentsTip')}</p>
        )}
      </CardContent>
    </Card>
  );
};
