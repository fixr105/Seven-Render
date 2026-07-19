import type { B2cEvFieldDef } from '../config/forms/b2cEvFormSchema';

export const EMPTY_FIELD_PLACEHOLDER = '—';

type FormatFieldDef = Pick<B2cEvFieldDef, 'key' | 'type' | 'options'>;

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  const normalized = String(value).trim();
  return normalized === '' || normalized === '-' || normalized === '—';
}

function formatCurrencyValue(value: unknown): string {
  const num = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString('en-IN');
}

function formatPercentValue(value: unknown): string {
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(num)) return String(value);
  const percent = num > 0 && num <= 1 ? num * 100 : num;
  const rounded = Math.round(percent * 100) / 100;
  return `${rounded}%`;
}

function formatDateValue(value: unknown): string {
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatSelectValue(value: unknown, options: B2cEvFieldDef['options']): string {
  const raw = String(value);
  const match = options?.find((option) => option.value === raw);
  return match ? match.label : raw;
}

/**
 * Renders a stored B2C-EV form value using the field's declared type so read-only
 * review screens show currency grouping, percentages and readable dates instead of
 * the raw string. Empty / placeholder values collapse to a single em-dash.
 */
export function formatB2cEvFieldValue(field: FormatFieldDef, value: unknown): string {
  if (isEmptyValue(value)) return EMPTY_FIELD_PLACEHOLDER;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  // GST rate is modelled as a select but stored as a fraction (e.g. 0.05).
  if (field.key === 'loan.gstRate') return formatPercentValue(value);

  switch (field.type) {
    case 'currency':
      return formatCurrencyValue(value);
    case 'percent':
      return formatPercentValue(value);
    case 'date':
      return formatDateValue(value);
    case 'select':
      return formatSelectValue(value, field.options);
    default:
      return String(value);
  }
}
