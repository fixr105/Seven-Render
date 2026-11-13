import { documentFieldId } from './documents';

export interface DealerFormField {
  fieldId: string;
  label: string;
  type: string;
  placeholder: string;
  options: string[];
  isRequired: boolean;
  displayOrder: number;
}

export interface DealerFormCategory {
  categoryId: string;
  categoryName: string;
  displayOrder: number;
  isCoApplicant: boolean;
  fields: DealerFormField[];
}

export interface CanonicalPerson {
  name: string;
  pan: string;
  mobile: string;
  email: string;
  dob: string;
}

export interface CanonicalApplication {
  fullName: string;
  pan: string;
  mobile: string;
  email: string;
  dob: string;
  employmentType: string;
  monthlyIncome: number;
  existingObligations: number;
  requestedLoanAmount: number;
  preferredTenure: number;
  onRoadPrice: number;
  selectType: 'Rental' | 'EMI';
  coApplicant: CanonicalPerson | null;
}

export interface VehicleOption {
  id: string;
  make: string;
  model: string;
  price: number;
  fundingAmount: number;
  label: string;
}

export interface ProductDocumentRequirement {
  id: string;
  title: string;
  fieldId: string;
  displayOrder: number;
  isRequired: boolean;
}

const FILE_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function fieldKey(label: string, categoryName: string): string {
  return `${label} - ${categoryName || 'Documents'}`;
}

export function createFileId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (const byte of bytes) {
    suffix += FILE_ID_ALPHABET[byte % FILE_ID_ALPHABET.length];
  }
  return `SF${suffix}`;
}

export function calculateAge(dob: string, today = new Date()): number {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return Math.max(age, 0);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function flattenRecord(value: unknown): Record<string, unknown> {
  const row = asRecord(value);
  if (!row) return {};
  const fields = asRecord(row.fields) ?? {};
  return { ...fields, ...row, id: row.id ?? fields.id };
}

export function extractRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map((item) => flattenRecord(item));
  const row = asRecord(payload);
  if (!row) return [];
  for (const key of ['records', 'data', 'items', 'result']) {
    const nested = row[key];
    if (Array.isArray(nested)) return extractRecords(nested);
    const nestedRecord = asRecord(nested);
    if (nestedRecord) {
      const found = extractRecords(nestedRecord);
      if (found.length > 0) return found;
    }
  }
  if (row.fields || row.id || row['Field Label'] || row['Category Name'] || row['File ID']) {
    return [flattenRecord(row)];
  }
  return [];
}

export function extractRecordId(payload: unknown): string {
  const records = extractRecords(payload);
  const first = records[0];
  const fromRecord = first?.id ?? first?.record_id ?? first?.recordId;
  if (fromRecord) return String(fromRecord);
  const row = asRecord(payload);
  const direct = row?.id ?? row?.record_id ?? row?.recordId;
  return direct ? String(direct) : '';
}

function textValue(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function orderOf(record: Record<string, unknown>): number {
  const value = Number(record['Display Order'] ?? record.displayOrder ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function isInactive(value: unknown): boolean {
  if (value == null || value === '') return false;
  if (value === false || value === 0) return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'false' || normalized === 'no' || normalized === '0' || normalized === 'inactive';
}

function isChecked(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'checked';
}

function parseOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.map((item) => String(item));
  } catch {
    // Field Options may be a comma-separated list.
  }
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function isCoApplicantCategory(name: string): boolean {
  return /co[-\s]?applicant/i.test(name);
}

export function buildFormCategories(
  mappings: Record<string, unknown>[],
  categories: Record<string, unknown>[],
  fields: Record<string, unknown>[]
): DealerFormCategory[] {
  const mappedCategoryIds = new Set<string>();
  const mappedFieldIds = new Set<string>();
  mappings.forEach((mapping) => {
    const categoryRef = textValue(mapping, ['Category', 'Category Name', 'Category ID', 'category']);
    if (categoryRef) mappedCategoryIds.add(categoryRef);
    const fieldRef = textValue(mapping, ['Field ID', 'Field', 'fieldId']);
    if (fieldRef) mappedFieldIds.add(fieldRef);
    const included = mapping.includedFieldIds ?? mapping['Included Fields'];
    if (Array.isArray(included)) {
      included.forEach((fieldId) => mappedFieldIds.add(String(fieldId)));
    }
  });

  return categories
    .filter((category) => !isInactive(category.Active ?? category.active))
    .filter((category) => {
      if (mappedCategoryIds.size === 0) return true;
      const categoryId = textValue(category, ['Category ID', 'categoryId', 'id']);
      const categoryName = textValue(category, ['Category Name', 'categoryName', 'name']);
      return mappedCategoryIds.has(categoryId) || mappedCategoryIds.has(categoryName);
    })
    .sort((left, right) => orderOf(left) - orderOf(right))
    .flatMap((category) => {
      const categoryId = textValue(category, ['Category ID', 'categoryId', 'id']);
      const categoryName = textValue(category, ['Category Name', 'categoryName', 'name']) || categoryId;
      const categoryFields = fields
        .filter((field) => !isInactive(field.Active ?? field.active))
        .filter((field) => {
          const fieldCategory = textValue(field, ['Category', 'Category Name', 'category']);
          return fieldCategory === categoryId || fieldCategory === categoryName;
        })
        .filter((field) => {
          if (mappedFieldIds.size === 0) return true;
          const fieldId = textValue(field, ['Field ID', 'fieldId', 'id']);
          const label = textValue(field, ['Field Label', 'fieldLabel', 'label']);
          return mappedFieldIds.has(fieldId) || mappedFieldIds.has(label);
        })
        .sort((left, right) => orderOf(left) - orderOf(right))
        .flatMap((field, index) => {
          const type = textValue(field, ['Field Type', 'fieldType', 'type']).toLowerCase() || 'text';
          if (type === 'file') return [];
          const label = textValue(field, ['Field Label', 'fieldLabel', 'label']) || `Field ${index + 1}`;
          return [{
            fieldId: textValue(field, ['Field ID', 'fieldId', 'id']) || `${categoryId}-${index}`,
            label,
            type,
            placeholder: textValue(field, ['Field Placeholder', 'placeholder']),
            options: parseOptions(field['Field Options'] ?? field.options),
            isRequired: isChecked(field['Is Mandatory'] ?? field['Is Required'] ?? field.isMandatory ?? field.isRequired),
            displayOrder: orderOf(field),
          }];
        });
      if (categoryFields.length === 0) return [];
      return [{
        categoryId: categoryId || categoryName,
        categoryName,
        displayOrder: orderOf(category),
        isCoApplicant: isCoApplicantCategory(categoryName),
        fields: categoryFields,
      }];
    });
}

function normalizedLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function valueText(value: string | boolean | undefined): string {
  if (typeof value === 'boolean') return value ? 'true' : '';
  return (value ?? '').trim();
}

function valueNumber(value: string | boolean | undefined): number {
  const parsed = Number(valueText(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function readCanonical(
  categories: DealerFormCategory[],
  values: Record<string, string | boolean>,
  includeCoApplicant: boolean
): CanonicalApplication {
  const canonical: CanonicalApplication = {
    fullName: '',
    pan: '',
    mobile: '',
    email: '',
    dob: '',
    employmentType: '',
    monthlyIncome: 0,
    existingObligations: 0,
    requestedLoanAmount: 0,
    preferredTenure: 36,
    onRoadPrice: 0,
    selectType: 'EMI',
    coApplicant: null,
  };
  const coApplicant: CanonicalPerson = { name: '', pan: '', mobile: '', email: '', dob: '' };

  categories.forEach((category) => {
    const targetIsCoApplicant = category.isCoApplicant && includeCoApplicant;
    if (category.isCoApplicant && !includeCoApplicant) return;
    category.fields.forEach((field) => {
      const raw = values[fieldKey(field.label, category.categoryName)];
      const text = valueText(raw);
      const label = normalizedLabel(field.label);
      const person = targetIsCoApplicant ? coApplicant : null;
      if (label.includes('pan') && !label.includes('company')) {
        if (person) person.pan = text.toUpperCase();
        else canonical.pan = text.toUpperCase();
        return;
      }
      if (label.includes('mobile') || label === 'phone' || label.includes('phone number')) {
        const digits = text.replace(/\D/g, '').slice(0, 10);
        if (person) person.mobile = digits;
        else canonical.mobile = digits;
        return;
      }
      if (label.includes('email')) {
        if (person) person.email = text;
        else canonical.email = text;
        return;
      }
      if (label.includes('date of birth') || label === 'dob' || label.endsWith(' dob')) {
        if (person) person.dob = text;
        else canonical.dob = text;
        return;
      }
      if (label.includes('employment')) {
        canonical.employmentType = text;
        return;
      }
      if (label.includes('obligation')) {
        canonical.existingObligations = valueNumber(raw);
        return;
      }
      if (label.includes('income')) {
        canonical.monthlyIncome = valueNumber(raw);
        return;
      }
      if (label.includes('loan amount')) {
        canonical.requestedLoanAmount = valueNumber(raw);
        return;
      }
      if (label.includes('tenure')) {
        const tenure = valueNumber(raw);
        if (tenure > 0) canonical.preferredTenure = tenure;
        return;
      }
      if (label.includes('on road') || label.includes('onroad') || label.includes('vehicle value')) {
        canonical.onRoadPrice = valueNumber(raw);
        return;
      }
      if (label === 'select' || label.includes('repayment') || label.includes('purchase type')) {
        if (text === 'Rental' || text === 'EMI') canonical.selectType = text;
        return;
      }
      if (label.includes('applicant name') || label.includes('full name') || label === 'name') {
        if (person) person.name = text;
        else if (!canonical.fullName) canonical.fullName = text;
      }
    });
  });

  if (includeCoApplicant && (coApplicant.name || coApplicant.pan || coApplicant.mobile)) {
    canonical.coApplicant = coApplicant;
  }
  return canonical;
}

export function isAadhaarLabel(label: string): boolean {
  return normalizedLabel(label).includes('aadhaar') || normalizedLabel(label).includes('aadhar');
}

export function isPanLabel(label: string): boolean {
  const labelText = normalizedLabel(label);
  return labelText.includes('pan') && !labelText.includes('company');
}

export function isVehicleLabel(label: string): boolean {
  return /\bvehicle\b/.test(normalizedLabel(label));
}

function productTags(record: Record<string, unknown>): string[] {
  const products = record.Products ?? record.products;
  if (Array.isArray(products)) return products.map((item) => String(item).trim()).filter(Boolean);
  if (typeof products === 'string') return products.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

export function filterVehicles(records: Record<string, unknown>[], productId: string): VehicleOption[] {
  const wanted = productId.trim().toLowerCase();
  return records.flatMap((record) => {
    const tags = productTags(record);
    if (wanted && !tags.some((tag) => tag.toLowerCase() === wanted)) return [];
    const make = textValue(record, ['Make', 'make']);
    const model = textValue(record, ['Model', 'model']);
    const id = textValue(record, ['Vehicle ID', 'id']);
    return [{
      id: id || `${make}-${model}`,
      make,
      model,
      price: Number(record.Price ?? record.price ?? 0) || 0,
      fundingAmount: Number(record['Funding Amount'] ?? record.fundingAmount ?? 0) || 0,
      label: [make, model].filter(Boolean).join(' '),
    }];
  });
}

export function productDocuments(
  records: Record<string, unknown>[],
  productId: string
): ProductDocumentRequirement[] {
  const wanted = productId.trim();
  return records
    .filter((record) => textValue(record, ['Product ID', 'productId']) === wanted)
    .sort((left, right) => orderOf(left) - orderOf(right))
    .flatMap((record, index) => {
      const title = textValue(record, ['Record Title', 'recordTitle', 'label']) || `Document ${index + 1}`;
      return [{
        id: textValue(record, ['id', 'Field ID']) || `doc-${index}`,
        title,
        fieldId: documentFieldId(title),
        displayOrder: orderOf(record),
        isRequired: isChecked(record['Is Required'] ?? record.isRequired ?? record['Is Mandatory']),
      }];
    });
}

export interface QualifySnapshot {
  pass: boolean;
  isNtc: boolean;
  score: number | null;
  monthlyObligations: number;
  raw: Record<string, unknown>;
}

export function readQualifySnapshot(payload: unknown): QualifySnapshot {
  const row = flattenRecord(payload);
  const nested = asRecord(row.data);
  const source = row.pass != null || row.is_ntc != null || row.score != null ? row : (nested ?? row);
  const score = asNumber(source.score);
  return {
    pass: source.pass === true,
    isNtc: source.is_ntc === true || source.isNtc === true,
    score,
    monthlyObligations: asNumber(source.monthly_obligations ?? source.monthlyObligations) ?? 0,
    raw: source,
  };
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
