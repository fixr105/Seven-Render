import { AuthUser } from '../../types/auth.js';
import { n8nClient } from '../airtable/n8nClient.js';
import {
  ClientProductEntitlementError,
  assertClientProductAssigned,
  resolveClientAssignedProducts,
} from '../entitlements/clientProducts.service.js';

export interface VehicleOption {
  vehicleId: string;
  make: string;
  model: string;
  requestedLoanAmount: string;
}

const VEHICLE_FETCH_ATTEMPTS = 3;
const VEHICLE_FETCH_TIMEOUT_MS = 20000;
const VEHICLE_FETCH_RETRY_DELAY_MS = 300;

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeLower(value: unknown): string {
  return normalize(value).toLowerCase();
}

function splitMultiValue(raw: unknown): string[] {
  const text = normalize(raw);
  if (!text) return [];
  return text
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickFirst(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value == null) continue;
    if (Array.isArray(value)) {
      const first = normalize(value[0]);
      if (first) return first;
      continue;
    }
    const parsed = normalize(value);
    if (parsed) return parsed;
  }
  return '';
}

function parseAmount(value: unknown): string {
  const raw = normalize(value);
  if (!raw) return '';
  const numeric = parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return String(numeric);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchVehicleRows(): Promise<Array<Record<string, unknown>>> {
  let delayMs = VEHICLE_FETCH_RETRY_DELAY_MS;
  for (let attempt = 1; attempt <= VEHICLE_FETCH_ATTEMPTS; attempt += 1) {
    const rows = (await n8nClient.fetchTable(
      'Vehicles',
      false,
      undefined,
      VEHICLE_FETCH_TIMEOUT_MS
    )) as Array<Record<string, unknown>>;
    if (rows.length > 0) {
      return rows;
    }
    if (attempt < VEHICLE_FETCH_ATTEMPTS) {
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
  return [];
}

function parseVehicleRecord(record: Record<string, unknown>): VehicleOption | null {
  const vehicleId = pickFirst(record, ['Vehicle ID', 'vehicleId', 'id']);
  const make = pickFirst(record, ['Make', 'make', 'Maker', 'maker', 'Brand', 'brand']);
  const model = pickFirst(record, ['Model', 'model', 'Variant', 'variant']);
  const requestedLoanAmount = parseAmount(
    pickFirst(record, [
      'Requested Loan Amount',
      'requestedLoanAmount',
      'Loan Amount',
      'loanAmount',
      'Funding Amount',
      'fundingAmount',
      'Amount',
      'amount',
    ])
  );

  if (!vehicleId || !make || !model || !requestedLoanAmount) return null;
  return { vehicleId, make, model, requestedLoanAmount };
}

function isProductAllowed(record: Record<string, unknown>, productId: string): boolean {
  const normalizedProductId = normalizeLower(productId);
  const direct = normalizeLower(
    pickFirst(record, ['Product ID', 'productId', 'Loan Product', 'loanProduct'])
  );
  if (direct && direct === normalizedProductId) return true;

  const allowedProducts = splitMultiValue(
    pickFirst(record, ['Allowed Products', 'allowedProducts', 'Products', 'products'])
  ).map((item) => normalizeLower(item));
  if (allowedProducts.length === 0) return !direct;
  return allowedProducts.includes(normalizedProductId);
}

function isClientAllowed(record: Record<string, unknown>, clientId: string): boolean {
  const allowedClients = splitMultiValue(
    pickFirst(record, [
      'Allowed Clients',
      'allowedClients',
      'Client IDs',
      'clientIds',
      'Client ID',
      'clientId',
      'Clients',
    ])
  ).map((item) => normalizeLower(item));
  if (allowedClients.length === 0) return true;
  return allowedClients.includes(normalizeLower(clientId));
}

export async function getClientVehicleOptions(
  user: AuthUser,
  productId: string
): Promise<VehicleOption[]> {
  await assertClientProductAssigned(user, productId);
  const { clientId } = await resolveClientAssignedProducts(user);
  const rows = await fetchVehicleRows();

  const result: VehicleOption[] = [];
  for (const row of rows as Array<Record<string, unknown>>) {
    if (!isProductAllowed(row, productId)) continue;
    if (!isClientAllowed(row, clientId)) continue;
    const parsed = parseVehicleRecord(row);
    if (parsed) result.push(parsed);
  }

  const seen = new Set<string>();
  const deduped: VehicleOption[] = [];
  for (const item of result) {
    const key = `${normalizeLower(item.vehicleId)}|${normalizeLower(item.make)}|${normalizeLower(item.model)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

export async function resolveRequestedLoanAmountFromVehicleSelection(
  user: AuthUser,
  productId: string,
  selection: { vehicleId?: unknown; make?: unknown; model?: unknown }
): Promise<VehicleOption | null> {
  const vehicleId = normalize(selection.vehicleId);
  const make = normalize(selection.make);
  const model = normalize(selection.model);

  if (!vehicleId && (!make || !model)) return null;

  const options = await getClientVehicleOptions(user, productId);
  if (vehicleId) {
    const byId = options.find((option) => normalizeLower(option.vehicleId) === normalizeLower(vehicleId));
    if (byId) return byId;
  }
  if (make && model) {
    const byMakeModel = options.find(
      (option) =>
        normalizeLower(option.make) === normalizeLower(make) &&
        normalizeLower(option.model) === normalizeLower(model)
    );
    if (byMakeModel) return byMakeModel;
  }

  throw new ClientProductEntitlementError(
    'Selected vehicle is not available for your account and product assignment.',
    403
  );
}
