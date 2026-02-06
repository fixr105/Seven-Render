/**
 * Predefined NBFC rejection reasons for the decision UI.
 * Stored in Lender Decision Remarks when selected; "Other" allows free text.
 */

export interface NbfcRejectionReasonOption {
  value: string;
  label: string;
}

export const NBFC_REJECTION_REASONS: NbfcRejectionReasonOption[] = [
  { value: 'credit_profile', label: 'Credit profile does not meet criteria' },
  { value: 'documentation_incomplete', label: 'Documentation incomplete' },
  { value: 'policy_mismatch', label: 'Policy mismatch' },
  { value: 'capacity_exhausted', label: 'Capacity exhausted' },
  { value: 'pricing', label: 'Pricing / terms not viable' },
  { value: 'other', label: 'Other' },
];
