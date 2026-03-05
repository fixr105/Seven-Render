/**
 * Canonical section and field keys for Loan Products form configuration.
 * Aligned with backend/docs/LOAN_PRODUCTS_APPLICATION_RECORDS.md.
 * Used so the edit UI always shows every document field; unchecking a field
 * in one product does not remove it from the master list for other products.
 */

export interface CanonicalSectionKey {
  key: string;
  sectionId: string;
  sortKey: string;
}

/** Canonical section keys (column names as in Airtable / doc). Order matches doc. */
export const CANONICAL_SECTION_KEYS: CanonicalSectionKey[] = [
  { key: 'SECTION 1A – PERSONAL KYC (Applicants)', sectionId: '1A', sortKey: '1A' },
  { key: 'SECTION 1B – PERSONAL KYC (Co-Applicants)', sectionId: '1B', sortKey: '1B' },
  { key: 'SECTION 2A – BUSINESS KYC – PRIVATE LIMITED', sectionId: '2A', sortKey: '2A' },
  { key: 'SECTION 2B – BUSINESS KYC – LLP', sectionId: '2B', sortKey: '2B' },
  { key: 'SECTION 2C – BUSINESS KYC – PARTNERSHIP FIRM', sectionId: '2C', sortKey: '2C' },
  { key: 'SECTION 2D – BUSINESS KYC – SELF EMPLOYED / PROPRIETOR', sectionId: '2D', sortKey: '2D' },
  { key: 'SECTION 3A – ASSET WISE – HOUSING LOAN / LAP', sectionId: '3A', sortKey: '3A' },
  { key: 'SECTION 3B – ASSET WISE – FLEET / EV FINANCING', sectionId: '3B', sortKey: '3B' },
  { key: 'SECTION 3C – ASSET WISE – MACHINERY / EQUIPMENT (MM PRODUCT)', sectionId: '3C', sortKey: '3C' },
  { key: 'SECTION 4 – SUPPORTING / PROGRAM SPECIFIC DOCUMENTS', sectionId: '4', sortKey: '4' },
];

/** Canonical field keys by sectionId. 77 fields total per doc. */
export const CANONICAL_FIELD_KEYS_BY_SECTION: Record<string, string[]> = {
  '1A': ['Field 1A.1', 'Field 1A.2', 'Field 1A.3', 'Field 1A.4', 'Field 1A.5', 'Field 1A.6', 'Field 1A.7'],
  '1B': ['Field 1B.1', 'Field 1B.2', 'Field 1B.3', 'Field 1B.4', 'Field 1B.5', 'Field 1B.6', 'Field 1B.7'],
  '2A': [
    'Field 2A.1', 'Field 2A.2', 'Field 2A.3', 'Field 2A.4', 'Field 2A.5', 'Field 2A.6',
    'Field 2A.7', 'Field 2A.8', 'Field 2A.9', 'Field 2A.10', 'Field 2A.11', 'Field 2A.12',
  ],
  '2B': ['Field 2B.1', 'Field 2B.2', 'Field 2B.3', 'Field 2B.4', 'Field 2B.5', 'Field 2B.6', 'Field 2B.7', 'Field 2B.8'],
  '2C': [
    'Field 2C.1', 'Field 2C.2', 'Field 2C.3', 'Field 2C.4', 'Field 2C.5', 'Field 2C.6',
    'Field 2C.7', 'Field 2C.8', 'Field 2C.9', 'Field 2C.10',
  ],
  '2D': ['Field 2D.1', 'Field 2D.2', 'Field 2D.3', 'Field 2D.4', 'Field 2D.5', 'Field 2D.6', 'Field 2D.7'],
  '3A': ['Field 3A.1', 'Field 3A.2', 'Field 3A.3', 'Field 3A.4', 'Field 3A.5', 'Field 3A.6', 'Field 3A.7'],
  '3B': ['Field 3B.1', 'Field 3B.2', 'Field 3B.3', 'Field 3B.4', 'Field 3B.5', 'Field 3B.6'],
  '3C': ['Field 3C.1', 'Field 3C.2', 'Field 3C.3', 'Field 3C.4', 'Field 3C.5', 'Field 3C.6'],
  '4': ['Field 4.1', 'Field 4.2', 'Field 4.3', 'Field 4.4', 'Field 4.5', 'Field 4.6', 'Field 4.7'],
};
