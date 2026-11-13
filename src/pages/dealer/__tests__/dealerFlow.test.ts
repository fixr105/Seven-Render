import { describe, expect, it } from 'vitest';
import { buildEnginePayload } from '../../../services/engineClient';
import { qualifyRequest, withCollectedCategories } from '../collectedInputs';
import { fieldKey, readCanonical } from '../formModel';
import { isValidAadhaar, isValidPan, maskAadhaar, maskPan } from '../validation';
import { buildDocumentsString } from '../documents';
import { buildDisplayOffers, calculateReducingEmi } from '../offers';

describe('engine airtable payload', () => {
  it('sends the form filter as filter_formula and keeps the env base id', () => {
    expect(
      buildEnginePayload(
        'airtable_get',
        { table: 'Client Form Mapping', filter: "{Client} = 'USER-1'", base_id: 'from-the-screen' },
        'appzbyi8q7pJRl1cd'
      )
    ).toEqual({
      table: 'Client Form Mapping',
      filter: "{Client} = 'USER-1'",
      filter_formula: "{Client} = 'USER-1'",
      base_id: 'appzbyi8q7pJRl1cd',
    });
  });
});

describe('collected stage inputs', () => {
  it('turns the application inputs into the qualify payload', () => {
    const values = {
      [fieldKey('Full Name', 'Applicant')]: 'Ada Lovelace',
      [fieldKey('PAN', 'Applicant')]: 'ABCDE1234F',
      [fieldKey('Mobile Number', 'Applicant')]: '9876543210',
      [fieldKey('Email', 'Applicant')]: 'ada@example.com',
      [fieldKey('Date of Birth', 'Applicant')]: '1990-01-02',
      [fieldKey('Employment Type', 'Applicant')]: 'Salaried',
      [fieldKey('Monthly Income', 'Applicant')]: '80000',
      [fieldKey('Existing Monthly Obligations', 'Applicant')]: '5000',
      [fieldKey('Requested Loan Amount', 'Applicant')]: '450000',
      [fieldKey('Preferred Tenure', 'Applicant')]: '36',
      [fieldKey('On-road Price', 'Applicant')]: '500000',
      [fieldKey('Purchase Type', 'Applicant')]: 'EMI',
    };
    const canonical = readCanonical(withCollectedCategories([]), values, false);
    expect(canonical).toMatchObject({
      fullName: 'Ada Lovelace',
      pan: 'ABCDE1234F',
      mobile: '9876543210',
      monthlyIncome: 80000,
      existingObligations: 5000,
      requestedLoanAmount: 450000,
      preferredTenure: 36,
      onRoadPrice: 500000,
      selectType: 'EMI',
    });
    expect(qualifyRequest({
      name: canonical.fullName,
      mobile: canonical.mobile,
      pan: canonical.pan,
      email: canonical.email,
    }, 'SFTEST1234', '2026-01-01T00:00:00.000Z', canonical.requestedLoanAmount)).toMatchObject({
      Full_Name: 'Ada Lovelace',
      Mobile_Number: '9876543210',
      PAN_Number: 'ABCDE1234F',
      consent_bureau: true,
      consent_bureau_at: '2026-01-01T00:00:00.000Z',
      application_id: 'SFTEST1234',
      requested_amount: 450000,
    });
  });
});

describe('dealer identity checks', () => {
  it('accepts a 12-digit Aadhaar that passes Verhoeff and rejects a bad one', () => {
    expect(isValidAadhaar('234123412346')).toBe(true);
    expect(isValidAadhaar('123456789012')).toBe(false);
    expect(isValidAadhaar('23412341234')).toBe(false);
  });

  it('masks Aadhaar and PAN in read-only form', () => {
    expect(maskAadhaar('234123412346')).toBe('XXXX XXXX 2346');
    expect(maskPan('ABCDE1234F')).toBe('XXXXX1234X');
  });

  it('validates PAN shape', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true);
    expect(isValidPan('abcde1234f')).toBe(false);
    expect(isValidPan('ABCD1234F')).toBe(false);
  });
});

describe('dealer documents string', () => {
  it('joins uploads in the existing fieldId:url|filename format', () => {
    expect(
      buildDocumentsString([
        { fieldId: 'pan_card', url: 'https://url1', filename: 'pan_card.jpg' },
        { fieldId: 'aadhaar', url: 'https://url2', filename: 'aadhaar_front.jpg' },
        { fieldId: 'aadhaar_back', url: 'https://url3', filename: 'aadhaar_back.jpg' },
      ])
    ).toBe(
      'pan_card:https://url1|pan_card.jpg,aadhaar:https://url2|aadhaar_front.jpg,aadhaar_back:https://url3|aadhaar_back.jpg'
    );
  });
});

describe('dealer offers', () => {
  it('rounds reducing-balance EMI to the nearest rupee', () => {
    expect(calculateReducingEmi(450000, 14.5, 36)).toBe(15489);
  });

  it('adds a Standard card when there is one ranked offer', () => {
    const cards = buildDisplayOffers([
      {
        lenderId: 'FT-1',
        roi: 14.5,
        pf: 4500,
        amount: 450000,
        tenure: 36,
        apr: 16,
        downPayment: 50000,
      },
    ]);

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      label: 'Seven Fincorp — Value',
      roi: 14.5,
      pf: 4500,
      emi: 15489,
      amount: 450000,
      tenure: 36,
      downPayment: 50000,
      realLenderId: 'FT-1',
    });
    expect(cards[1]).toMatchObject({
      label: 'Seven Fincorp — Standard',
      roi: 16.5,
      pf: 9000,
      emi: 15932,
      realLenderId: 'FT-1',
    });
    expect(cards.map((card) => card.label).join(' ')).not.toMatch(/Fintree|ENN/i);
  });

  it('keeps the three lowest-APR offers and labels them A, B, and C', () => {
    const cards = buildDisplayOffers([
      { lenderId: 'a', roi: 18, pf: 1000, amount: 100000, tenure: 24, apr: 22, downPayment: 0 },
      { lenderId: 'b', roi: 12, pf: 1000, amount: 100000, tenure: 24, apr: 14, downPayment: 0 },
      { lenderId: 'c', roi: 15, pf: 1000, amount: 100000, tenure: 24, apr: 17, downPayment: 0 },
      { lenderId: 'd', roi: 16, pf: 1000, amount: 100000, tenure: 24, apr: 19, downPayment: 0 },
    ]);

    expect(cards.map((card) => card.label)).toEqual([
      'Seven Fincorp — Option A',
      'Seven Fincorp — Option B',
      'Seven Fincorp — Option C',
    ]);
    expect(cards.map((card) => card.realLenderId)).toEqual(['b', 'c', 'd']);
  });
});
