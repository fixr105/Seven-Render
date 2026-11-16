/**
 * Unit tests for product form config service.
 * Ensures unselecting a document field in one product does not remove it from the master list for others.
 */

import { describe, it, expect } from '@jest/globals';
import {
  extractProductFormConfigForEditWithMaster,
  buildProductFormConfigPayloadForRecord,
  parseProductFormConfig,
  type EditorSection,
} from '../productFormConfig.service.js';

describe('productFormConfig.service', () => {
  it('does not require RC, existing loan statement, insurance, or permit', () => {
    const sections = parseProductFormConfig({
      'SECTION 3B – ASSET WISE – FLEET / EV FINANCING': 'Y',
      'Field 3B.1': 'Vehicle Proforma Invoice',
      'Field 3B.3': 'RC Copy (if takeover)',
      'Field 3B.4': 'Existing Loan Statement (BT cases)',
      'Field 3B.5': 'Insurance Copy',
      'Field 3B.6': 'Permit Copy (if commercial vehicle)',
    });
    const fields = sections.flatMap((section) => section.fields);
    expect(fields.find((field) => field.fieldId === 'field-3b.1')?.isRequired).toBe(true);
    for (const fieldId of ['field-3b.3', 'field-3b.4', 'field-3b.5', 'field-3b.6']) {
      expect(fields.find((field) => field.fieldId === fieldId)?.isRequired).toBe(false);
    }
  });

  describe('extractProductFormConfigForEditWithMaster (canonical master list)', () => {
    it('includes Field 1A.5 in master list when Product A has it Empty/missing and Product B has a label', () => {
      // Product A: Field 1A.5 set to Empty (or missing, as Airtable omits empty fields)
      const productA: Record<string, unknown> = {
        id: 'recA',
        'Product ID': 'LP008',
        'SECTION 1A – PERSONAL KYC (Applicants)': 'Y',
        'Field 1A.1': 'PAN Card',
        'Field 1A.5': 'Empty',
      };

      // Product B: Field 1A.5 has a label
      const productB: Record<string, unknown> = {
        id: 'recB',
        'Product ID': 'LP009',
        'SECTION 1A – PERSONAL KYC (Applicants)': 'Y',
        'Field 1A.1': 'PAN Card',
        'Field 1A.5': 'Personal Bank Statement – Last 6/12 Months',
      };

      const { sections } = extractProductFormConfigForEditWithMaster(productB, [productA, productB]);

      const section1A = sections.find(
        (s) => s.sectionNum === '1A' || (typeof s.sectionNum === 'string' && s.sectionNum === '1A')
      );
      expect(section1A).toBeDefined();
      const field1A5 = section1A!.fields.find((f) => f.key === 'Field 1A.5');
      expect(field1A5).toBeDefined();
      expect(field1A5!.label).toBe('Personal Bank Statement – Last 6/12 Months');
      expect(field1A5!.enabled).toBe(true);
    });

    it('includes Field 1A.5 when only product has it missing (canonical supplies key)', () => {
      // Single product with Field 1A.5 omitted (simulates GET after PATCH set it to Empty)
      const productWithoutField1A5: Record<string, unknown> = {
        id: 'recA',
        'Product ID': 'LP008',
        'SECTION 1A – PERSONAL KYC (Applicants)': 'Y',
        'Field 1A.1': 'PAN Card',
        'Field 1A.2': 'Aadhaar',
        // Field 1A.5 not present
      };

      const { sections } = extractProductFormConfigForEditWithMaster(productWithoutField1A5, [
        productWithoutField1A5,
      ]);

      const section1A = sections.find(
        (s) => s.sectionNum === '1A' || (typeof s.sectionNum === 'string' && s.sectionNum === '1A')
      );
      expect(section1A).toBeDefined();
      const field1A5 = section1A!.fields.find((f) => f.key === 'Field 1A.5');
      expect(field1A5).toBeDefined();
      expect(field1A5!.enabled).toBe(false);
      expect(field1A5!.label).toBe('');
    });
  });

  describe('buildProductFormConfigPayloadForRecord', () => {
    it('scopes payload to product and keeps id', () => {
      const product: Record<string, unknown> = {
        id: 'recX',
        'Product ID': 'LP008',
        'SECTION 1A – PERSONAL KYC (Applicants)': 'Y',
        'Field 1A.1': 'PAN Card',
        'Field 1A.5': 'Empty',
      };
      const sections: EditorSection[] = [
        {
          sectionNum: '1A',
          enabled: true,
          name: 'Personal KYC',
          fields: [
            { key: 'Field 1A.1', label: 'PAN Card', enabled: true },
            { key: 'Field 1A.5', label: '', enabled: false },
          ],
        },
      ];
      const payload = buildProductFormConfigPayloadForRecord(product, sections);
      expect(payload.id).toBe('recX');
      expect(payload['Field 1A.5']).toBe('Empty');
    });
  });
});
