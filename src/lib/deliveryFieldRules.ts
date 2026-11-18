import { hasValue } from './formPath';
import { normalizeChassis } from './iotTagging';

export const INSURANCE_SAVED_AT = '_meta.delivery.insuranceSavedAt';
export const VEHICLE_SAVED_AT = '_meta.delivery.vehicleSavedAt';
export const DELIVERY_SUBMITTED_AT = '_meta.delivery.submittedAt';
export const DELIVERY_COMPLETED_AT = '_meta.delivery.completed_at';

export const INSURANCE_FIELD_KEYS = [
  'insurance.cost',
  'insurance.provider',
  'insurance.policyNumber',
  'insurance.issuedDate',
  'insurance.periodMonths',
] as const;

export const VEHICLE_FIELD_KEYS = [
  'vehicle.cost',
  'vehicle.manufacturingYear',
  'vehicle.invoiceNumber',
  'vehicle.invoiceDate',
  'vehicle.downpayment',
  'vehicle.registrationCost',
  'vehicle.chassisNumber',
] as const;

const INSURANCE_MESSAGES = {
  'insurance.cost': 'Enter the insurance cost in rupees.',
  'insurance.provider': 'Enter the insurance provider.',
  'insurance.policyNumber': 'Enter the policy number.',
  'insurance.issuedDate': 'Policy date cannot be in the future.',
  'insurance.periodMonths': 'Enter a period between 1 and 60 months.',
} as const;

const VEHICLE_MESSAGES = {
  'vehicle.cost': 'Enter the vehicle cost.',
  'vehicle.manufacturingYear': 'Enter a valid manufacturing year.',
  'vehicle.invoiceDate': 'Invoice date cannot be in the future.',
  'vehicle.downpayment': 'Downpayment cannot be more than the vehicle cost.',
  'vehicle.registrationCost': 'Enter the registration cost.',
  'vehicle.chassisNumber': 'Enter the 17-character chassis number.',
} as const;

export const DELIVERY_FIELD_LABELS: Record<string, string> = {
  'insurance.cost': 'Insurance Cost (₹)',
  'insurance.provider': 'Insurance Provider',
  'insurance.policyNumber': 'Policy Number',
  'insurance.issuedDate': 'Policy Issued Date',
  'insurance.periodMonths': 'Period of Insurance (months)',
  'vehicle.cost': 'Cost of Vehicle (₹)',
  'vehicle.manufacturingYear': 'Manufacturing Year',
  'vehicle.invoiceNumber': 'Sales Invoice Number',
  'vehicle.invoiceDate': 'Sales Invoice Date',
  'vehicle.downpayment': 'Downpayment Paid by Borrower (₹)',
  'vehicle.registrationCost': 'Vehicle Registration Cost (₹)',
  'vehicle.chassisNumber': 'Chassis Number (17 characters)',
  'geoPhotos.withSupportPerson.url': 'Upload geo tagged photo with borrower',
  'geoPhotos.withVehicle.url': 'Upload geo tagged photo of borrower with vehicle',
  'geoPhotos.atResidence.url': 'Upload geo tagged photo of borrower at residence location',
  'iot.deviceId': 'IoT device ID / IMEI',
  'iot.chassisNumber': 'Chassis number',
};

export function istToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function istYear(now: Date = new Date()): number {
  return Number(istToday(now).slice(0, 4));
}

function readText(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  return value == null ? '' : String(value).trim();
}

function moneyWithCents(raw: string): number | null {
  const text = raw.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

function positiveNumber(raw: string): number | null {
  const text = raw.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

function calendarDate(raw: string): string | null {
  const text = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return text;
}

export function validateInsuranceFields(
  formData: Record<string, unknown>,
  today: string = istToday()
): Record<string, string> {
  const errors: Record<string, string> = {};
  const cost = moneyWithCents(readText(formData, 'insurance.cost'));
  if (cost == null || cost <= 0) errors['insurance.cost'] = INSURANCE_MESSAGES['insurance.cost'];
  if (readText(formData, 'insurance.provider').length < 2) {
    errors['insurance.provider'] = INSURANCE_MESSAGES['insurance.provider'];
  }
  if (readText(formData, 'insurance.policyNumber').length < 3) {
    errors['insurance.policyNumber'] = INSURANCE_MESSAGES['insurance.policyNumber'];
  }
  const issued = calendarDate(readText(formData, 'insurance.issuedDate'));
  if (!issued || issued > today) {
    errors['insurance.issuedDate'] = INSURANCE_MESSAGES['insurance.issuedDate'];
  }
  const period = readText(formData, 'insurance.periodMonths');
  const months = /^\d+$/.test(period) ? Number(period) : NaN;
  if (!Number.isInteger(months) || months < 1 || months > 60) {
    errors['insurance.periodMonths'] = INSURANCE_MESSAGES['insurance.periodMonths'];
  }
  return errors;
}

export function validateVehicleFields(
  formData: Record<string, unknown>,
  today: string = istToday(),
  year: number = istYear()
): Record<string, string> {
  const errors: Record<string, string> = {};
  const cost = positiveNumber(readText(formData, 'vehicle.cost'));
  if (cost == null || cost <= 0) errors['vehicle.cost'] = VEHICLE_MESSAGES['vehicle.cost'];

  const made = readText(formData, 'vehicle.manufacturingYear');
  const madeYear = /^\d{4}$/.test(made) ? Number(made) : NaN;
  if (!Number.isInteger(madeYear) || madeYear < year - 3 || madeYear > year) {
    errors['vehicle.manufacturingYear'] = VEHICLE_MESSAGES['vehicle.manufacturingYear'];
  }

  const invoiced = calendarDate(readText(formData, 'vehicle.invoiceDate'));
  if (!invoiced || invoiced > today) {
    errors['vehicle.invoiceDate'] = VEHICLE_MESSAGES['vehicle.invoiceDate'];
  }

  const down = positiveNumber(readText(formData, 'vehicle.downpayment'));
  if (down == null || down < 0 || cost == null || down > cost) {
    errors['vehicle.downpayment'] = VEHICLE_MESSAGES['vehicle.downpayment'];
  }

  const registration = positiveNumber(readText(formData, 'vehicle.registrationCost'));
  if (registration == null || registration < 0) {
    errors['vehicle.registrationCost'] = VEHICLE_MESSAGES['vehicle.registrationCost'];
  }

  const chassis = normalizeChassis(readText(formData, 'vehicle.chassisNumber'));
  if (chassis.length !== 17 || /[IOQ]/.test(chassis)) {
    errors['vehicle.chassisNumber'] = VEHICLE_MESSAGES['vehicle.chassisNumber'];
  }

  return errors;
}

export function normalizedVehicleChassis(formData: Record<string, unknown>): string {
  return normalizeChassis(readText(formData, 'vehicle.chassisNumber'));
}

export function isInsuranceDone(formData: Record<string, unknown>, now: Date = new Date()): boolean {
  if (!hasValue(formData, INSURANCE_SAVED_AT)) return false;
  return Object.keys(validateInsuranceFields(formData, istToday(now))).length === 0;
}

export function isVehicleDone(formData: Record<string, unknown>, now: Date = new Date()): boolean {
  if (!hasValue(formData, VEHICLE_SAVED_AT)) return false;
  return Object.keys(validateVehicleFields(formData, istToday(now), istYear(now))).length === 0;
}

export function deliveryFieldLabel(fieldId: string, fallback: string): string {
  return DELIVERY_FIELD_LABELS[fieldId] || fallback;
}
