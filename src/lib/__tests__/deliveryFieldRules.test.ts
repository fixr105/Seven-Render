import { describe, expect, it } from 'vitest';
import {
  INSURANCE_SAVED_AT,
  VEHICLE_SAVED_AT,
  isInsuranceDone,
  isVehicleDone,
  validateInsuranceFields,
  validateVehicleFields,
} from '../deliveryFieldRules';

const TODAY = '2026-11-18';
const YEAR = 2026;

const validInsurance = {
  'insurance.cost': '1500.50',
  'insurance.provider': 'ICICI',
  'insurance.policyNumber': 'POL1',
  'insurance.issuedDate': '2026-11-01',
  'insurance.periodMonths': '12',
};

const validVehicle = {
  'vehicle.cost': '90000',
  'vehicle.manufacturingYear': '2024',
  'vehicle.invoiceNumber': '',
  'vehicle.invoiceDate': '2026-11-01',
  'vehicle.downpayment': '10000',
  'vehicle.registrationCost': '0',
  'vehicle.chassisNumber': 'MA1TA2ABCD1234567',
};

describe('delivery field rules', () => {
  it('accepts a valid insurance card and rejects each rule with its message', () => {
    expect(validateInsuranceFields(validInsurance, TODAY)).toEqual({});
    expect(validateInsuranceFields({ ...validInsurance, 'insurance.cost': '0' }, TODAY)).toEqual({
      'insurance.cost': 'Enter the insurance cost in rupees.',
    });
    expect(validateInsuranceFields({ ...validInsurance, 'insurance.cost': '10.999' }, TODAY)).toEqual({
      'insurance.cost': 'Enter the insurance cost in rupees.',
    });
    expect(validateInsuranceFields({ ...validInsurance, 'insurance.provider': ' A ' }, TODAY)).toEqual({
      'insurance.provider': 'Enter the insurance provider.',
    });
    expect(validateInsuranceFields({ ...validInsurance, 'insurance.policyNumber': 'ab' }, TODAY)).toEqual({
      'insurance.policyNumber': 'Enter the policy number.',
    });
    expect(
      validateInsuranceFields({ ...validInsurance, 'insurance.issuedDate': '2026-12-01' }, TODAY)
    ).toEqual({
      'insurance.issuedDate': 'Policy date cannot be in the future.',
    });
    expect(validateInsuranceFields({ ...validInsurance, 'insurance.periodMonths': '61' }, TODAY)).toEqual({
      'insurance.periodMonths': 'Enter a period between 1 and 60 months.',
    });
    expect(validateInsuranceFields({ ...validInsurance, 'insurance.periodMonths': '1.5' }, TODAY)).toEqual({
      'insurance.periodMonths': 'Enter a period between 1 and 60 months.',
    });
  });

  it('accepts a valid vehicle card and rejects each rule with its message', () => {
    expect(validateVehicleFields(validVehicle, TODAY, YEAR)).toEqual({});
    expect(
      validateVehicleFields({ ...validVehicle, 'vehicle.cost': '0', 'vehicle.downpayment': '0' }, TODAY, YEAR)
    ).toEqual({
      'vehicle.cost': 'Enter the vehicle cost.',
    });
    expect(
      validateVehicleFields({ ...validVehicle, 'vehicle.manufacturingYear': '2020' }, TODAY, YEAR)
    ).toEqual({
      'vehicle.manufacturingYear': 'Enter a valid manufacturing year.',
    });
    expect(
      validateVehicleFields({ ...validVehicle, 'vehicle.invoiceDate': '2026-11-19' }, TODAY, YEAR)
    ).toEqual({
      'vehicle.invoiceDate': 'Invoice date cannot be in the future.',
    });
    expect(
      validateVehicleFields({ ...validVehicle, 'vehicle.downpayment': '90001' }, TODAY, YEAR)
    ).toEqual({
      'vehicle.downpayment': 'Downpayment cannot be more than the vehicle cost.',
    });
    expect(
      validateVehicleFields({ ...validVehicle, 'vehicle.registrationCost': '-1' }, TODAY, YEAR)
    ).toEqual({
      'vehicle.registrationCost': 'Enter the registration cost.',
    });
    expect(validateVehicleFields({ ...validVehicle, 'vehicle.chassisNumber': '' }, TODAY, YEAR)).toEqual({
      'vehicle.chassisNumber': 'Enter the 17-character chassis number.',
    });
    expect(
      validateVehicleFields({ ...validVehicle, 'vehicle.chassisNumber': 'MA1TA2IOQ123456789' }, TODAY, YEAR)
    ).toEqual({
      'vehicle.chassisNumber': 'Enter the 17-character chassis number.',
    });
  });

  it('marks a card done only after validation passes and the save timestamp exists', () => {
    expect(isInsuranceDone(validInsurance)).toBe(false);
    expect(isInsuranceDone({ ...validInsurance, [INSURANCE_SAVED_AT]: '2026-11-18T00:00:00.000Z' })).toBe(
      true
    );
    expect(
      isInsuranceDone({
        ...validInsurance,
        'insurance.cost': '',
        [INSURANCE_SAVED_AT]: '2026-11-18T00:00:00.000Z',
      })
    ).toBe(false);
    expect(isVehicleDone(validVehicle)).toBe(false);
    expect(isVehicleDone({ ...validVehicle, [VEHICLE_SAVED_AT]: '2026-11-18T00:00:00.000Z' })).toBe(true);
  });
});
