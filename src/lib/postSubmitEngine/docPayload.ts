import type { EnachDetails } from './enach';
import { readEnachFromFormData } from './enach';
import type { DisplayOffer } from './types';

function str(fd: Record<string, unknown>, key: string): string {
  const value = fd[key];
  if (value == null) return '';
  return String(value).trim();
}

function num(fd: Record<string, unknown>, key: string): number {
  const raw = fd[key];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function joinAddress(fd: Record<string, unknown>, keys: string[]): string {
  return keys.map((k) => str(fd, k)).filter(Boolean).join(', ');
}

/** Today as DD/MM/YYYY for OptiPro declaration / signing fields. */
export function formatDocDateDdMmYyyy(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Last 4 digits of Aadhaar collected in the wizard.
 * Never returns "XXXX" — empty string when missing / unusable.
 */
export function aadhaarLast4FromForm(
  fd: Record<string, unknown>,
  prefix: 'borrower' | 'coApplicant'
): string {
  const candidates = [
    str(fd, `${prefix}.aadhaar`),
    str(fd, `${prefix}.aadhaarNumber`),
    str(fd, `${prefix}.aadhaarLast4`),
  ];
  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 4) return digits.slice(-4);
  }
  return '';
}

/** Map Seven-Render form_data → OptiPro POSTfull body shape. */
export function buildDocPayload(
  formData: Record<string, unknown>,
  selectedOffer: DisplayOffer,
  fileId: string,
  enachDetails?: EnachDetails | null
): Record<string, unknown> {
  const fd = formData;
  const signingDate = formatDocDateDdMmYyyy();
  const coName = str(fd, 'coApplicant.name');
  const coParts = coName.split(/\s+/).filter(Boolean);

  const sanctioned = selectedOffer.amount || num(fd, 'loan.amount');
  const pf = selectedOffer.pf || num(fd, 'loan.processingFee');
  const disbursal =
    num(fd, 'loan.disbursalAmount') || Math.max(0, Number(sanctioned) - Number(pf || 0));
  const enach = enachDetails || readEnachFromFormData(fd);

  return {
    borrower: {
      prefix: 'Mr',
      first_name: str(fd, 'borrower.firstName'),
      last_name: str(fd, 'borrower.lastName'),
      full_name:
        str(fd, 'borrower.customerName') ||
        `${str(fd, 'borrower.firstName')} ${str(fd, 'borrower.lastName')}`.trim(),
      father_first_name: str(fd, 'borrower.fatherName'),
      father_last_name: '',
      father_prefix: 'Mr',
      gender: str(fd, 'borrower.gender') || 'Male',
      dob: str(fd, 'borrower.dob'),
      pan: str(fd, 'borrower.pan'),
      aadhaar_last4: aadhaarLast4FromForm(fd, 'borrower'),
      mobile: str(fd, 'borrower.mobile'),
      email: str(fd, 'borrower.email'),
      Borrower_address: joinAddress(fd, [
        'borrower.address.line1',
        'borrower.address.village',
        'borrower.address.district',
        'borrower.address.state',
        'borrower.address.pincode',
      ]),
      declaration_date: signingDate,
      declaration_place:
        str(fd, 'borrower.address.district') ||
        str(fd, 'borrower.address.village') ||
        'Bengaluru',
    },
    guarantor: {
      first_name: coParts[0] || '',
      last_name: coParts.slice(1).join(' ') || '',
      father_first_name: '',
      father_middle_name: '',
      gender: str(fd, 'coApplicant.gender') || 'Male',
      dob: str(fd, 'coApplicant.dob'),
      pan: str(fd, 'coApplicant.pan'),
      aadhaar_last4: aadhaarLast4FromForm(fd, 'coApplicant'),
      mobile: str(fd, 'coApplicant.mobile'),
      email: str(fd, 'coApplicant.email'),
      permanent_address: joinAddress(fd, [
        'coApplicant.address.line1',
        'coApplicant.address.village',
        'coApplicant.address.district',
        'coApplicant.address.state',
        'coApplicant.address.pincode',
      ]),
      declaration_date: signingDate,
      declaration_place: str(fd, 'coApplicant.address.district') || 'Bengaluru',
    },
    dealer: {
      name: str(fd, 'dealer.name') || str(fd, 'dealer.tradeName'),
      bank: str(fd, 'dealer.bankName'),
      account_no: str(fd, 'dealer.accountNumber'),
      ifsc: str(fd, 'dealer.ifscCode'),
    },
    loan_amounts: {
      sanctioned_amount: sanctioned,
      processing_fee: pf,
      emi: selectedOffer.emi || num(fd, 'loan.emiAmount'),
      disbursement_amount: disbursal,
      net_disbursed: num(fd, 'loan.disbursalAmount') || disbursal || '',
    },
    commercials: {
      interest_rate_pct: selectedOffer.roi || num(fd, 'loan.interestRate'),
      tenure_months: selectedOffer.tenure || num(fd, 'loan.tenureMonths'),
      repayment_frequency: 'Monthly',
      interest_calculation: 'Reducing Balance',
      penal_charge: '2% per month on overdue EMI',
    },
    lender: {
      nach_collection_account: {
        bank: enach?.bankName || '',
        account_no: enach?.accountNumber || '',
        ifsc: enach?.ifscCode || '',
        account_holder: enach?.accountHolderName || '',
        account_type: enach?.accountType || '',
      },
    },
    case: {
      signing_date: signingDate,
      application_id: fileId,
    },
  };
}
