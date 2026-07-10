import { B2C_EV_GEO_PHOTO_SLOTS, isB2cEvGeoPhotoSlotId } from './b2cEvGeoPhotos';
import { getExternalMediaUrl } from './shareableMediaUrl';

export const DOCUMENTS_FOLDER_FIELD_ID = '_documentsFolderLink';

export interface ApplicationDocumentEntry {
  fieldId: string;
  url: string;
  fileName: string;
}

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function getApplicationDocumentLabel(fieldId: string): string {
  if (fieldId === DOCUMENTS_FOLDER_FIELD_ID) return 'Documents Folder';
  if (isB2cEvGeoPhotoSlotId(fieldId)) {
    return B2C_EV_GEO_PHOTO_SLOTS.find((slot) => slot.id === fieldId)?.label ?? fieldId;
  }
  return fieldId.replace(/_/g, ' ');
}

export function normalizeApplicationDocument(
  doc: ApplicationDocumentEntry
): ApplicationDocumentEntry | null {
  let { fieldId, url, fileName } = doc;
  url = getExternalMediaUrl(url);
  if (!url) return null;

  if ((fieldId === 'https' || fieldId === 'http') && url.startsWith('//')) {
    url = getExternalMediaUrl(`${fieldId}:${url}`);
    fileName = fileName || url.split('/').pop()?.split('?')[0] || 'document';
    fieldId = 'document';
  }

  if (fieldId === 'https' || fieldId === 'http') {
    fieldId = 'document';
  }

  return {
    fieldId,
    url,
    fileName: fileName || url.split('/').pop()?.split('?')[0] || 'document',
  };
}

export function normalizeApplicationDocuments(
  documents: ApplicationDocumentEntry[]
): ApplicationDocumentEntry[] {
  const byKey = new Map<string, ApplicationDocumentEntry>();
  for (const doc of documents) {
    const normalized = normalizeApplicationDocument(doc);
    if (!normalized) continue;
    const key = `${normalized.fieldId}:${normalized.url}`;
    byKey.set(key, normalized);
  }
  return Array.from(byKey.values());
}

export function partitionApplicationDocuments(
  documents: ApplicationDocumentEntry[],
  folderLinkFromForm?: unknown
): {
  folderLink: string;
  mediaDocuments: ApplicationDocumentEntry[];
} {
  const normalized = normalizeApplicationDocuments(documents);
  const folderDoc = normalized.find((doc) => doc.fieldId === DOCUMENTS_FOLDER_FIELD_ID);
  const folderLink = readString(folderLinkFromForm) || folderDoc?.url || '';
  const mediaDocuments = normalized.filter((doc) => doc.fieldId !== DOCUMENTS_FOLDER_FIELD_ID);

  return { folderLink, mediaDocuments };
}

export function isImageDocument(fileName: string, url: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return true;
  }
  const lowerUrl = getExternalMediaUrl(url).toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i.test(lowerUrl);
}

export function coerceApplicationDocuments(documents: unknown): ApplicationDocumentEntry[] {
  if (!Array.isArray(documents)) return [];

  return documents.flatMap((doc) => {
    if (!doc || typeof doc !== 'object') return [];
    const fieldId = readString((doc as ApplicationDocumentEntry).fieldId);
    const url = readString((doc as ApplicationDocumentEntry).url);
    if (!fieldId || !url) return [];

    const fileName =
      readString((doc as ApplicationDocumentEntry).fileName) ||
      url.split('/').pop()?.split('?')[0] ||
      'document';

    return [{ fieldId, url, fileName }];
  });
}
