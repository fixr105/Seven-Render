import { describe, expect, it, vi } from 'vitest';
import { applyFilledDocUrls, fillLoanDocuments, offerFromPersistedLoan } from '../filledDocs';
import { resolveResumePhase } from '../resolveResumePhase';

const LOAN = {
  'loan.amount': '111725',
  'loan.interestRate': '28',
  'loan.processingFee': '7541',
  'loan.processingFeePct': '6.75',
  'loan.emiAmount': '7672',
  'loan.tenureMonths': '18',
  'loan.disbursalAmount': '104184',
};

describe('persisted loan documents', () => {
  it('rebuilds the accepted offer from loan fields saved on the file', () => {
    const offer = offerFromPersistedLoan(LOAN);
    expect(offer).toMatchObject({
      amount: 111725,
      roi: 28,
      pf: 7541,
      emi: 7672,
      tenure: 18,
    });
  });

  it('returns null when no sanctioned amount was saved', () => {
    expect(offerFromPersistedLoan({ 'loan.interestRate': '28' })).toBeNull();
  });

  it('writes only the fills that returned a URL and keeps an earlier URL', () => {
    const saved = applyFilledDocUrls(
      { '_meta.docs.sanctionLetter': 'https://files.example/sanction.pdf' },
      {
        sanctionLetter: null,
        loanAgreement: 'https://files.example/agreement.pdf',
        ckyc: '',
      }
    );
    expect(saved.formData['_meta.docs.sanctionLetter']).toBe('https://files.example/sanction.pdf');
    expect(saved.formData['_meta.docs.loanAgreement']).toBe('https://files.example/agreement.pdf');
    expect(saved.formData['_meta.docs.ckyc']).toBeUndefined();
    expect(saved.complete).toBe(false);
  });

  it('marks the file ready for stamps when all three URLs are stored', () => {
    const saved = applyFilledDocUrls(
      {},
      {
        sanctionLetter: 'https://files.example/sanction.pdf',
        loanAgreement: 'https://files.example/agreement.pdf',
        ckyc: 'https://files.example/ckyc.pdf',
      }
    );
    expect(saved.complete).toBe(true);
    expect(resolveResumePhase(saved.formData)).toBe('stamps');
  });

  it('keeps successful URLs when one fill throws', async () => {
    const result = await fillLoanDocuments({
      formData: LOAN,
      offer: offerFromPersistedLoan(LOAN)!,
      fileId: 'SFMWHK65WO',
      fillSanctionLetter: vi.fn(async () => 'https://files.example/sanction.pdf'),
      fillLoanAgreement: vi.fn(async () => {
        throw new Error('agreement failed');
      }),
      fillCkyc: vi.fn(async () => 'https://files.example/ckyc.pdf'),
    });
    expect(result.formData['_meta.docs.sanctionLetter']).toBe('https://files.example/sanction.pdf');
    expect(result.formData['_meta.docs.ckyc']).toBe('https://files.example/ckyc.pdf');
    expect(result.formData['_meta.docs.loanAgreement']).toBeUndefined();
    expect(result.complete).toBe(false);
    expect(result.errors).toEqual(['agreement failed']);
  });
});
