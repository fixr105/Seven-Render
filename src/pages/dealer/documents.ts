export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export interface UploadedDocument {
  fieldId: string;
  url: string;
  filename: string;
}

export function buildDocumentsString(files: UploadedDocument[]): string {
  return files.map((file) => `${file.fieldId}:${file.url}|${file.filename}`).join(',');
}

export function documentFieldId(recordTitle: string): string {
  return recordTitle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function documentRejection(file: { name: string; size: number }): string | null {
  if (file.size > MAX_DOCUMENT_BYTES) return 'Each file must be 10MB or smaller.';
  const name = file.name.toLowerCase();
  const accepted = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.pdf');
  if (!accepted) return 'Upload a JPG, PNG, or PDF.';
  return null;
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}
