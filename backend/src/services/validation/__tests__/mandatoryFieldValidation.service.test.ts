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
    const formData = {
      'PAN - Documents': 'Yes, Added to Folder',
      _documentsFolderLink: 'https://drive.google.com/drive/folders/abc123',
    };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    expect(result.isValid).toBe(true);
    expect(result.formatErrors).toBeUndefined();
    expect(result.missingFields).toHaveLength(0);
  });

  it('does not add PAN format error when value is Not Available (file option)', async () => {
    const formData = {
      'PAN - Documents': 'Not Available',
      _documentsFolderLink: 'https://drive.google.com/drive/folders/abc123',
    };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    // Not Available satisfies required file field (user has made a selection); no PAN format error
    expect(result.formatErrors).toBeUndefined();
    expect(result.missingFields?.some((f) => f.fieldId === 'pan-1')).toBe(false);
  });

  it('does not add PAN format error when value is Awaiting, Will Update Folder', async () => {
    const formData = {
      'PAN - Documents': 'Awaiting, Will Update Folder',
      _documentsFolderLink: 'https://onedrive.live.com/embed?cid=xyz',
    };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    expect(result.isValid).toBe(true);
    expect(result.formatErrors).toBeUndefined();
    expect(result.missingFields).toHaveLength(0);
  });
});
