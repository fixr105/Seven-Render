/** Same save as the signed e-sign record: the Express flag is the string "true". */
export function withSignedLoanAgreement(
  formData: Record<string, unknown>,
  esign: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...formData,
    '_meta.esign': esign,
    'compliance.loanAgreementSigned': 'true',
  };
}
