/**
 * Mandatory Field Validation Service Tests
 * Ensures PAN format validation is skipped for file-type fields and file-option values.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { validateMandatoryFields } from '../mandatoryFieldValidation.service.js';
import * as simpleFormConfigModule from '../../formConfig/simpleFormConfig.service.js';

const mockFormConfig = {
  categories: [
    {
      categoryId: 'documents',
      categoryName: 'Documents',
      fields: [
        { fieldId: 'pan-1', label: 'PAN', type: 'file', isRequired: true },
      ],
    },
  ],
};

jest.mock('../../formConfig/simpleFormConfig.service.js', () => ({
  getSimpleFormConfig: jest.fn(),
}));

describe('mandatoryFieldValidation.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (simpleFormConfigModule.getSimpleFormConfig as jest.Mock<any>).mockResolvedValue(mockFormConfig);
  });

  it('does not add PAN format error when PAN-identified field has type file and value is file option', async () => {
    const formData = { 'PAN - Documents': 'Yes, Added to Folder' };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    expect(result.isValid).toBe(true);
    expect(result.formatErrors).toBeUndefined();
    expect(result.missingFields).toHaveLength(0);
  });

  it('does not add PAN format error when value is Not Available (file option)', async () => {
    const formData = { 'PAN - Documents': 'Not Available' };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    // Not Available does not satisfy required file field, so field can be missing; but no PAN format error
    expect(result.formatErrors).toBeUndefined();
    expect(result.missingFields?.some((f) => f.fieldId === 'pan-1')).toBe(true);
  });

  it('does not add PAN format error when value is Awaiting, Will Update Folder', async () => {
    const formData = { 'PAN - Documents': 'Awaiting, Will Update Folder' };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    expect(result.isValid).toBe(true);
    expect(result.formatErrors).toBeUndefined();
    expect(result.missingFields).toHaveLength(0);
  });
});
