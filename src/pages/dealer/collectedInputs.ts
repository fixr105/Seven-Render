import { calculateAge, fieldKey, type CanonicalApplication, type CanonicalPerson, type DealerFormCategory, type DealerFormField, type ProductDocumentRequirement } from './formModel';

const APPLICANT = 'Applicant';
const CO_APPLICANT = 'Co-applicant';

function textField(fieldId: string, label: string, type = 'text'): DealerFormField {
  return { fieldId, label, type, placeholder: '', options: [], isRequired: true, displayOrder: 0 };
}

export function applicantCategory(): DealerFormCategory {
  const fields: DealerFormField[] = [
    textField('full_name', 'Full Name'),
    textField('pan', 'PAN'),
    textField('mobile', 'Mobile Number'),
    textField('email', 'Email'),
    textField('dob', 'Date of Birth', 'date'),
    { fieldId: 'employment', label: 'Employment Type', type: 'select', placeholder: '', options: ['Salaried', 'Self Employed'], isRequired: true, displayOrder: 0 },
    textField('income', 'Monthly Income', 'number'),
    textField('obligations', 'Existing Monthly Obligations', 'number'),
    textField('amount', 'Requested Loan Amount', 'number'),
    textField('tenure', 'Preferred Tenure', 'number'),
    textField('vehicle_value', 'On-road Price', 'number'),
    { fieldId: 'purchase', label: 'Purchase Type', type: 'select', placeholder: '', options: ['EMI', 'Rental'], isRequired: true, displayOrder: 0 },
  ];
  return { categoryId: 'applicant', categoryName: APPLICANT, displayOrder: 0, isCoApplicant: false, fields };
}

export function coApplicantCategory(): DealerFormCategory {
  return {
    categoryId: 'co-applicant',
    categoryName: CO_APPLICANT,
    displayOrder: 1,
    isCoApplicant: true,
    fields: [
      textField('co_name', 'Full Name'),
      textField('co_pan', 'PAN'),
      textField('co_mobile', 'Mobile Number'),
      textField('co_email', 'Email'),
      textField('co_dob', 'Date of Birth', 'date'),
    ],
  };
}

const COLLECTED_LABELS = applicantCategory().fields.concat(coApplicantCategory().fields).map((field) => field.label.toLowerCase());

export function isCollectedLabel(label: string): boolean {
  return COLLECTED_LABELS.includes(label.trim().toLowerCase());
}

export function withCollectedCategories(configured: DealerFormCategory[]): DealerFormCategory[] {
  const extras = configured.flatMap((category) => {
    const fields = category.fields.filter((field) => !isCollectedLabel(field.label));
    if (fields.length === 0) return [];
    return [{ ...category, fields }];
  });
  const applicantExtras = extras.filter((category) => !category.isCoApplicant);
  const coExtras = extras.filter((category) => category.isCoApplicant);
  return [applicantCategory(), ...applicantExtras, coApplicantCategory(), ...coExtras];
}

export function defaultCollectedValues(): Record<string, string> {
  return {
    [fieldKey('Preferred Tenure', APPLICANT)]: '36',
    [fieldKey('Purchase Type', APPLICANT)]: 'EMI',
    [fieldKey('Existing Monthly Obligations', APPLICANT)]: '0',
  };
}

export function fallbackDocuments(includeCoApplicant = false): ProductDocumentRequirement[] {
  const docs: ProductDocumentRequirement[] = [
    { id: 'pan_card', title: 'PAN Card', fieldId: 'pan_card', displayOrder: 1, isRequired: true },
    { id: 'aadhaar_front', title: 'Aadhaar Front', fieldId: 'aadhaar_front', displayOrder: 2, isRequired: true },
    { id: 'aadhaar_back', title: 'Aadhaar Back', fieldId: 'aadhaar_back', displayOrder: 3, isRequired: true },
    { id: 'passport_photo', title: 'Passport Photo', fieldId: 'passport_photo', displayOrder: 4, isRequired: true },
    {
      id: 'bank_statement_3_months',
      title: 'Bank Statement 3 months',
      fieldId: 'bank_statement_3_months',
      displayOrder: 5,
      isRequired: false,
    },
  ];
  if (includeCoApplicant) {
    docs.push(
      { id: 'co_pan', title: 'Co-applicant PAN', fieldId: 'co_pan', displayOrder: 6, isRequired: true },
      { id: 'co_aadhaar', title: 'Co-applicant Aadhaar', fieldId: 'co_aadhaar', displayOrder: 7, isRequired: true }
    );
  }
  return docs;
}

export function qualifyRequest(
  person: Pick<CanonicalPerson, 'name' | 'mobile' | 'pan' | 'email'>,
  fileId: string,
  consentedAt: string,
  requestedAmount = 0
): Record<string, unknown> {
  return {
    Full_Name: person.name,
    Mobile_Number: person.mobile,
    PAN_Number: person.pan,
    name: person.name,
    mobile: person.mobile,
    pan: person.pan,
    email: person.email,
    consent_bureau: true,
    consent_bureau_at: consentedAt,
    application_id: fileId,
    product_code: 'ev_dealer',
    requested_amount: Number(requestedAmount) || 0,
  };
}

export function rankRequest(
  canonical: CanonicalApplication,
  fileId: string,
  score: number | null,
  coApplicantRaw: Record<string, unknown> | null,
  monthlyObligationsFromQualify?: number
): Record<string, unknown> {
  return {
    application_id: fileId,
    applicant: {
      income: canonical.monthlyIncome,
      existing_obligations:
        monthlyObligationsFromQualify != null && monthlyObligationsFromQualify > 0
          ? monthlyObligationsFromQualify
          : canonical.existingObligations,
      employment: canonical.employmentType || 'Salaried',
      age: calculateAge(canonical.dob) || 30,
      ...(score == null ? {} : { score }),
    },
    co_applicant: coApplicantRaw,
    loan: {
      amount: canonical.requestedLoanAmount,
      tenure: canonical.preferredTenure || 36,
      vehicle_value: canonical.onRoadPrice,
    },
  };
}
