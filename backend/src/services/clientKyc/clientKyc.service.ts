import { AuthUser } from '../../types/auth.js';
import { n8nClient } from '../airtable/n8nClient.js';
import { AIRTABLE_TABLE_NAMES } from '../airtable/n8nEndpoints.js';
import { resolveClientRecord } from '../entitlements/clientProducts.service.js';

export interface ClientKycDealerProfile {
  id: string;
  clientId: string;
  loginEmail: string;
  status: string;
  kycVerified: boolean;
  kycVerifiedDate: string | null;
  dealerId: string;
  tradeName: string;
  dealerName: string;
  dealerContact: string;
  dealerEmail: string;
  gstNumber: string;
  dealerPan: string;
  dealerAddress: string;
  dealerCity: string;
  dealerState: string;
  dealerPincode: string;
  dealerBankName: string;
  dealerAccountNumber: string;
  dealerIfscCode: string;
  nameInBank: string;
  displayLabel: string;
}

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value == null) continue;
    const trimmed = String(value).trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function readBoolean(record: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (value === true || value === 'true' || value === 'TRUE' || value === 'True') return true;
    if (value === false || value === 'false' || value === 'FALSE' || value === 'False') return false;
  }
  return false;
}

function clientIdMatchesRecord(lookupId: string, record: Record<string, unknown>): boolean {
  const normalizedLookupId = lookupId.trim();
  if (!normalizedLookupId) return false;

  const recordClientId = readString(record, ['Client ID', 'clientId']);
  if (recordClientId === normalizedLookupId) return true;

  const recordKycId = readString(record, ['Client KYC Record', 'clientKycRecord']);
  if (recordKycId && recordKycId.startsWith(`${normalizedLookupId}-`)) return true;

  return false;
}

function isActiveRecord(record: Record<string, unknown>): boolean {
  const status = readString(record, ['Status', 'status']).toLowerCase();
  if (!status) return true;
  if (status === 'active') return true;
  return status !== 'inactive' && status !== 'pending kyc';
}

function buildDisplayLabel(record: Record<string, unknown>): string {
  const explicit = readString(record, ['Selected Dealer Display', 'selectedDealerDisplay']);
  if (explicit) return explicit;

  const tradeName = readString(record, ['Trade Name', 'tradeName']);
  const dealerName = readString(record, ['Dealer Name', 'dealerName']);
  const contact = readString(record, ['Dealer Contact', 'dealerContact']);
  const name = tradeName || dealerName;
  if (name && contact) return `${name} - ${contact}`;
  return name || contact;
}

export function normalizeClientKycRecord(record: Record<string, unknown>): ClientKycDealerProfile {
  const tradeName = readString(record, ['Trade Name', 'tradeName']);
  const dealerName = readString(record, ['Dealer Name', 'dealerName', 'Client Name', 'clientName']);

  return {
    id: readString(record, ['id']) || String(record.id ?? ''),
    clientId: readString(record, ['Client ID', 'clientId']),
    loginEmail: readString(record, ['Login Email', 'loginEmail']),
    status: readString(record, ['Status', 'status']) || 'Active',
    kycVerified: readBoolean(record, ['KYC Verified', 'kycVerified']),
    kycVerifiedDate: readString(record, ['KYC Verified Date', 'kycVerifiedDate']) || null,
    dealerId: readString(record, ['Dealer ID', 'dealerId']),
    tradeName,
    dealerName: dealerName || tradeName,
    dealerContact: readString(record, ['Dealer Contact', 'dealerContact']),
    dealerEmail: readString(record, ['Dealer Email', 'dealerEmail']),
    gstNumber: readString(record, ['GST Number', 'gstNumber']),
    dealerPan: readString(record, ['Dealer PAN', 'dealerPan']),
    dealerAddress: readString(record, ['Dealer Address', 'dealerAddress']),
    dealerCity: readString(record, ['Dealer City', 'dealerCity']),
    dealerState: readString(record, ['Dealer State', 'dealerState']),
    dealerPincode: readString(record, ['Dealer Pincode', 'dealerPincode']),
    dealerBankName: readString(record, ['Dealer Bank Name', 'dealerBankName']),
    dealerAccountNumber: readString(record, ['Dealer Account Number', 'dealerAccountNumber']),
    dealerIfscCode: readString(record, ['Dealer IFSC Code', 'dealerIfscCode']),
    nameInBank: readString(record, ['Name in Bank', 'nameInBank']),
    displayLabel: buildDisplayLabel(record),
  };
}

export function findClientKycRecord(
  records: Record<string, unknown>[],
  clientId: string
): Record<string, unknown> | null {
  const normalizedClientId = clientId.trim();
  if (!normalizedClientId) return null;

  const activeRecords = records.filter(isActiveRecord);
  return (
    activeRecords.find((record) => clientIdMatchesRecord(normalizedClientId, record)) ?? null
  );
}

export async function getClientKycForUser(user: AuthUser): Promise<ClientKycDealerProfile | null> {
  const { clientId } = await resolveClientRecord(user);
  return getClientKycForClientId(clientId);
}

export async function getClientKycForClientId(clientId: string): Promise<ClientKycDealerProfile | null> {
  const normalizedClientId = clientId.trim();
  if (!normalizedClientId) return null;

  const records = (await n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.CLIENT_KYC, true)) as Record<
    string,
    unknown
  >[];

  const match = findClientKycRecord(records, normalizedClientId);
  if (!match) return null;

  const profile = normalizeClientKycRecord(match);
  if (profile.clientId !== normalizedClientId) return null;

  return profile;
}

export function clientKycToFormDataPatch(profile: ClientKycDealerProfile): Record<string, unknown> {
  return {
    'dealer.id': profile.dealerId,
    'dealer.tradeName': profile.tradeName,
    'dealer.name': profile.dealerName,
    'dealer.contact': profile.dealerContact,
    'dealer.email': profile.dealerEmail,
    'dealer.gstNumber': profile.gstNumber,
    'dealer.pan': profile.dealerPan,
    'dealer.address': profile.dealerAddress,
    'dealer.city': profile.dealerCity,
    'dealer.state': profile.dealerState,
    'dealer.pincode': profile.dealerPincode,
    'dealer.bankName': profile.dealerBankName,
    'dealer.accountNumber': profile.dealerAccountNumber,
    'dealer.ifscCode': profile.dealerIfscCode,
    'dealer.nameInBank': profile.nameInBank,
    'dealer.displayLabel': profile.displayLabel,
    'dealer.linkedClientId': profile.clientId,
    '_meta.dealerKycVerified': profile.kycVerified,
    '_meta.dealerKycVerifiedDate': profile.kycVerifiedDate,
  };
}
