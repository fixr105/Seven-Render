import type { ClientLinkPoolItem } from '../services/api';

export const B2C_EV_DOCUMENTS_CATEGORY = 'Documents';
export const USED_CLIENT_WEBHOOK_LINKS_STORAGE_KEY = 'seven_used_client_webhook_links';
export const FOLDER_LINK_MASKED_DISPLAY = '••••••••••••••••••••••••••••••••';

export const B2C_EV_FILE_RADIO_OPTIONS = [
  { value: 'yes_added_to_folder', label: 'Yes, Added to Folder' },
  { value: 'awaiting_will_update', label: 'Awaiting, Will Update Folder' },
  { value: 'not_available', label: 'Not Available' },
] as const;

export type FormConfigCategory = {
  categoryId?: string;
  categoryName?: string;
  'Category Name'?: string;
  description?: string;
  fields?: FormConfigField[];
};

export type FormConfigField = {
  fieldId?: string;
  id?: string;
  'Field ID'?: string;
  label?: string;
  fieldLabel?: string;
  'Field Label'?: string;
  type?: string;
  fieldType?: string;
  'Field Type'?: string;
  isRequired?: boolean;
  isMandatory?: boolean;
  'Is Required'?: string;
  'Is Mandatory'?: string;
};

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function getDocumentDisplayKey(fieldLabel: string, categoryName: string): string {
  return `${fieldLabel} - ${categoryName || B2C_EV_DOCUMENTS_CATEGORY}`;
}

export function getDocumentCategories(formConfig: FormConfigCategory[]): FormConfigCategory[] {
  return formConfig.filter((category) =>
    (category.fields || []).some((field) => {
      const fieldType = field.type || field.fieldType || field['Field Type'] || '';
      return fieldType === 'file';
    })
  );
}

export function isFileFieldRequired(field: FormConfigField): boolean {
  return (
    field.isRequired === true ||
    field.isMandatory === true ||
    field['Is Required'] === 'True' ||
    field['Is Mandatory'] === 'True'
  );
}

export function isFileOptionValue(value: unknown): boolean {
  if (value == null) return false;
  const normalized = readString(value);
  return [
    'Yes, Added to Folder',
    'Awaiting, Will Update Folder',
    'added_to_link',
    'to_be_shared',
    'yes_added_to_folder',
    'awaiting_will_update',
    'Not Available',
    'not_available',
  ].includes(normalized);
}

export function isFileFieldSatisfied(value: unknown): boolean {
  return isFileOptionValue(value);
}

export function toStoredFileOptionValue(value: string): string {
  if (value === 'yes_added_to_folder') return 'Yes, Added to Folder';
  if (value === 'awaiting_will_update') return 'Awaiting, Will Update Folder';
  if (value === 'not_available') return 'Not Available';
  return value;
}

export function isFileOptionChecked(formValue: unknown, optionValue: string): boolean {
  const value = readString(formValue);
  if (optionValue === 'yes_added_to_folder') {
    return value === 'Yes, Added to Folder' || value === 'added_to_link';
  }
  if (optionValue === 'awaiting_will_update') {
    return value === 'Awaiting, Will Update Folder' || value === 'to_be_shared';
  }
  if (optionValue === 'not_available') {
    return value === 'Not Available' || value === 'not_available';
  }
  return false;
}

export function isValidDocumentsFolderLink(link: unknown): boolean {
  const normalized = readString(link).toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('drive.google.com') ||
    normalized.includes('onedrive.live.com') ||
    normalized.includes('sharepoint.com')
  );
}

export function isFolderLinkAccessConfirmed(formData: Record<string, unknown>): boolean {
  const folderLink = readString(formData._documentsFolderLink);
  if (!folderLink) return false;
  const consumedLink = readString(formData['_meta.documentsFolderLink.consumedLink']);
  return (
    consumedLink === folderLink &&
    Boolean(readString(formData['_meta.documentsFolderLink.consumedAt']))
  );
}

export function readUsedClientWebhookLinks(): Set<string> {
  try {
    const raw = sessionStorage.getItem(USED_CLIENT_WEBHOOK_LINKS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((item) => readString(item)).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function persistUsedClientWebhookLinks(links: Set<string>): void {
  try {
    sessionStorage.setItem(
      USED_CLIENT_WEBHOOK_LINKS_STORAGE_KEY,
      JSON.stringify(Array.from(links))
    );
  } catch {
    // ignore storage write errors
  }
}

export type NormalizedLinkPoolItem = {
  link: string;
  status: string;
};

export function normalizeLinkPoolItem(item: string | ClientLinkPoolItem): NormalizedLinkPoolItem {
  if (typeof item === 'string') {
    return { link: item.trim(), status: '' };
  }
  return {
    link: readString(item.link),
    status: readString(item.status),
  };
}

export function validateB2cEvDocumentsStage(
  formData: Record<string, unknown>,
  formConfig: FormConfigCategory[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  const folderLink = readString(formData._documentsFolderLink);

  if (!isValidDocumentsFolderLink(folderLink)) {
    errors._documentsFolderLink = 'Please generate or provide a valid document folder link';
  } else if (!isFolderLinkAccessConfirmed(formData)) {
    errors._documentsFolderLink = 'Copy or open the folder link before continuing';
  }

  for (const category of getDocumentCategories(formConfig)) {
    const categoryName =
      category.categoryName || category['Category Name'] || category.categoryId || B2C_EV_DOCUMENTS_CATEGORY;

    for (const field of category.fields || []) {
      const fieldId = field.fieldId || field.id || field['Field ID'] || '';
      const fieldLabel = field.label || field.fieldLabel || field['Field Label'] || fieldId;
      const fieldType = field.type || field.fieldType || field['Field Type'] || '';
      if (fieldType !== 'file') continue;

      const displayKey = getDocumentDisplayKey(fieldLabel, categoryName);
      const value = formData[displayKey] ?? formData[fieldId];
      if (isFileFieldRequired(field) && !isFileFieldSatisfied(value)) {
        errors[displayKey] = `${fieldLabel} is required`;
      }
    }
  }

  return errors;
}
