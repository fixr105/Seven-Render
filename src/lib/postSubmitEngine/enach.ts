export type EnachAccountType = 'Savings' | 'Current';

export type EnachDetails = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: EnachAccountType;
};

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export type EnachFieldErrors = Partial<
  Record<
    | 'accountHolderName'
    | 'bankName'
    | 'accountNumber'
    | 'confirmAccountNumber'
    | 'ifscCode'
    | 'accountType',
    string
  >
>;

export function maskBankAccountNumber(accountNumber: string): string {
  const digits = String(accountNumber || '').replace(/\D/g, '');
  if (digits.length < 4) return '••••••••';
  return `${'•'.repeat(Math.max(6, digits.length - 4))}${digits.slice(-4)}`;
}

export function validateEnachForm(input: {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  accountType: string;
}): EnachFieldErrors {
  const errors: EnachFieldErrors = {};
  const holder = input.accountHolderName.trim();
  const bank = input.bankName.trim();
  const account = input.accountNumber.replace(/\s+/g, '');
  const confirm = input.confirmAccountNumber.replace(/\s+/g, '');
  const ifsc = input.ifscCode.trim().toUpperCase();

  if (holder.length < 3) {
    errors.accountHolderName = 'Enter the account holder name (min 3 characters)';
  }
  if (!bank) {
    errors.bankName = 'Enter the bank name';
  }
  if (!/^\d{9,18}$/.test(account)) {
    errors.accountNumber = 'Account number must be 9–18 digits';
  }
  if (confirm !== account) {
    errors.confirmAccountNumber = 'Account numbers do not match';
  }
  if (!IFSC_REGEX.test(ifsc)) {
    errors.ifscCode = 'Enter a valid IFSC (e.g. HDFC0001234)';
  }
  if (input.accountType !== 'Savings' && input.accountType !== 'Current') {
    errors.accountType = 'Select account type';
  }
  return errors;
}

export function buildEnachDetails(input: {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: EnachAccountType;
}): EnachDetails {
  return {
    accountHolderName: input.accountHolderName.trim(),
    bankName: input.bankName.trim(),
    accountNumber: input.accountNumber.replace(/\s+/g, ''),
    ifscCode: input.ifscCode.trim().toUpperCase(),
    accountType: input.accountType,
  };
}

/** Merge eNACH fields into Form Data JSON under enach.* keys. */
export function applyEnachToFormData(
  formData: Record<string, unknown>,
  enach: EnachDetails
): Record<string, unknown> {
  return {
    ...formData,
    'enach.accountHolderName': enach.accountHolderName,
    'enach.bankName': enach.bankName,
    'enach.accountNumber': enach.accountNumber,
    'enach.ifscCode': enach.ifscCode,
    'enach.accountType': enach.accountType,
  };
}

export function readEnachFromFormData(
  formData: Record<string, unknown>
): EnachDetails | null {
  const accountHolderName = String(formData['enach.accountHolderName'] || '').trim();
  const bankName = String(formData['enach.bankName'] || '').trim();
  const accountNumber = String(formData['enach.accountNumber'] || '').trim();
  const ifscCode = String(formData['enach.ifscCode'] || '').trim().toUpperCase();
  const accountTypeRaw = String(formData['enach.accountType'] || '').trim();
  const accountType =
    accountTypeRaw === 'Current' || accountTypeRaw === 'Savings'
      ? accountTypeRaw
      : null;
  if (!accountHolderName || !bankName || !accountNumber || !ifscCode || !accountType) {
    return null;
  }
  return {
    accountHolderName,
    bankName,
    accountNumber,
    ifscCode,
    accountType,
  };
}
