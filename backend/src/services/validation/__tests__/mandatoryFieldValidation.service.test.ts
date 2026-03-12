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

  const validFolderLink = 'https://drive.google.com/d/folder/abc123';

  it('does not add PAN format error when PAN-identified field has type file and value is file option', async () => {
    const formData = { 'PAN - Documents': 'Yes, Added to Folder', _documentsFolderLink: validFolderLink };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    expect(result.isValid).toBe(true);
    expect(result.formatErrors).toBeUndefined();
    expect(result.missingFields).toHaveLength(0);
  });

  it('does not add PAN format error when value is Not Available (file option)', async () => {
    const formData = { 'PAN - Documents': 'Not Available' };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    // Not Available satisfies required file field; only folder link is missing. No PAN format error.
    expect(result.formatErrors).toBeUndefined();
    expect(result.missingFields?.some((f) => f.fieldId === '_documentsFolderLink')).toBe(true);
    expect(result.missingFields?.some((f) => f.fieldId === 'pan-1')).toBe(false);
  });

  it('does not add PAN format error when value is Awaiting, Will Update Folder', async () => {
    const formData = { 'PAN - Documents': 'Awaiting, Will Update Folder', _documentsFolderLink: validFolderLink };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    expect(result.isValid).toBe(true);
    expect(result.formatErrors).toBeUndefined();
    expect(result.missingFields).toHaveLength(0);
  });

  it('blocks submission when folder link is missing even if another field has http URL', async () => {
    const formData = { 'PAN - Documents': 'Yes, Added to Folder', otherField: 'http://example.com/link' };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    expect(result.isValid).toBe(false);
    expect(result.missingFields?.some((f) => f.fieldId === '_documentsFolderLink')).toBe(true);
  });

  it('allows submission when valid folder link and all document checklist items have status', async () => {
    const formData = {
      _documentsFolderLink: 'https://onedrive.live.com/redir?resid=xyz',
      'PAN - Documents': 'Yes, Added to Folder',
    };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    expect(result.isValid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it('blocks submission when folder link is valid but required document checklist field has no status', async () => {
    const formData = { _documentsFolderLink: validFolderLink };
    const result = await validateMandatoryFields(formData, 'test-client-id');
    expect(result.isValid).toBe(false);
    expect(result.missingFields?.some((f) => f.fieldId === 'pan-1')).toBe(true);
  });
});
