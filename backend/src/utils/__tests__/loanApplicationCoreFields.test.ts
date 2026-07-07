import { describe, it, expect } from '@jest/globals';
import {
  resolveLoanApplicationCoreFields,
  resolveLoanApplicationPromotedFields,
  resolveDocumentsFromFormData,
  buildPromotedApplicationRecord,
  mergeFormDataJson,
  stripBase64GeoPhotoUrls,
} from '../loanApplicationCoreFields.js';

describe('resolveLoanApplicationCoreFields', () => {
  it('reads snake_case keys from merged form data', () => {
    const result = resolveLoanApplicationCoreFields({
      applicant_name: 'Jane Doe',
      loan_product_id: 'LP001',
      requested_loan_amount: '500000',
    });

    expect(result).toEqual({
      applicantName: 'Jane Doe',
      productId: 'LP001',
      requestedLoanAmount: '500000',
    });
  });

  it('reads camelCase keys from merged form data', () => {
    const result = resolveLoanApplicationCoreFields({
      applicantName: 'John Smith',
      productId: 'LP002',
      requestedLoanAmount: '750000',
    });

    expect(result).toEqual({
      applicantName: 'John Smith',
      productId: 'LP002',
      requestedLoanAmount: '750000',
    });
  });

  it('falls back to existing record top-level columns', () => {
    const result = resolveLoanApplicationCoreFields(
      {},
      {
        'Applicant Name': 'Existing Name',
        'Loan Product': 'LP010',
        'Requested Loan Amount': '100000',
      }
    );

    expect(result).toEqual({
      applicantName: 'Existing Name',
      productId: 'LP010',
      requestedLoanAmount: '100000',
    });
  });

  it('prefers merged form data over existing record', () => {
    const result = resolveLoanApplicationCoreFields(
      { applicant_name: 'Updated Name' },
      {
        'Applicant Name': 'Old Name',
        'Loan Product': 'LP010',
        'Requested Loan Amount': '100000',
      }
    );

    expect(result.applicantName).toBe('Updated Name');
    expect(result.productId).toBe('LP010');
    expect(result.requestedLoanAmount).toBe('100000');
  });

  it('falls back to parsed Form Data JSON on existing record', () => {
    const result = resolveLoanApplicationCoreFields(
      {},
      {
        'Form Data': JSON.stringify({
          applicant_name: 'From JSON',
          loan_product_id: 'LP099',
          requested_loan_amount: '250000',
        }),
      }
    );

    expect(result).toEqual({
      applicantName: 'From JSON',
      productId: 'LP099',
      requestedLoanAmount: '250000',
    });
  });
});

describe('resolveLoanApplicationPromotedFields', () => {
  it('promotes B2C EV dotted keys to top-level contact fields', () => {
    const result = resolveLoanApplicationPromotedFields({
      'borrower.customerName': 'RAHUL GONSALVES',
      'borrower.mobile': '9687599179',
      'borrower.email': 'rahul@example.com',
      'loan.amount': '56522',
      loan_product_id: 'LP001',
    });

    expect(result.applicantName).toBe('RAHUL GONSALVES');
    expect(result.requestedLoanAmount).toBe('56522');
    expect(result.productId).toBe('LP001');
    expect(result.mobileNumber).toBe('9687599179');
    expect(result.emailId).toBe('rahul@example.com');
  });

  it('excludes base64 geo photo URLs from Documents', () => {
    const documents = resolveDocumentsFromFormData({
      'geoPhotos.withSupportPerson.url': 'data:image/jpeg;base64,abc123',
      'geoPhotos.withSupportPerson.fileName': 'photo.jpg',
    });

    expect(documents).toBe('');
  });

  it('includes https geo photo URLs in Documents', () => {
    const documents = resolveDocumentsFromFormData({
      'geoPhotos.withVehicle.url': 'https://cdn.example.com/vehicle.jpg',
      'geoPhotos.withVehicle.fileName': 'vehicle.jpg',
    });

    expect(documents).toBe('withVehicle:https://cdn.example.com/vehicle.jpg|vehicle.jpg');
  });

  it('includes all three uploadtourl geo photo URLs in Documents for Airtable', () => {
    const formData = {
      'geoPhotos.withSupportPerson.url':
        'https://cdn.uploadtourl.com/5205686d-bb3a-472d-8288-96cc03370814_geo-test.jpg',
      'geoPhotos.withSupportPerson.fileName': 'geo-test.jpg',
      'geoPhotos.withVehicle.url':
        'https://cdn.uploadtourl.com/vehicle-geo-test.jpg',
      'geoPhotos.withVehicle.fileName': 'vehicle.jpg',
      'geoPhotos.atResidence.url':
        'https://cdn.uploadtourl.com/residence-geo-test.jpg',
      'geoPhotos.atResidence.fileName': 'residence.jpg',
    };

    const documents = resolveDocumentsFromFormData(formData);
    expect(documents).toContain(
      'withSupportPerson:https://cdn.uploadtourl.com/5205686d-bb3a-472d-8288-96cc03370814_geo-test.jpg|geo-test.jpg'
    );
    expect(documents).toContain(
      'withVehicle:https://cdn.uploadtourl.com/vehicle-geo-test.jpg|vehicle.jpg'
    );
    expect(documents).toContain(
      'atResidence:https://cdn.uploadtourl.com/residence-geo-test.jpg|residence.jpg'
    );

    const record = buildPromotedApplicationRecord({}, formData, {
      applicantName: 'Test User',
      productId: 'LP001',
      requestedLoanAmount: '100000',
      mobileNumber: '9999999999',
      emailId: 'test@example.com',
      documents,
    });

    expect(record.Documents).toBe(documents);
    const storedFormData = JSON.parse(String(record['Form Data'])) as Record<string, unknown>;
    expect(storedFormData['geoPhotos.withSupportPerson.url']).toBe(
      'https://cdn.uploadtourl.com/5205686d-bb3a-472d-8288-96cc03370814_geo-test.jpg'
    );
    expect(storedFormData['geoPhotos.withVehicle.url']).toBe(
      'https://cdn.uploadtourl.com/vehicle-geo-test.jpg'
    );
    expect(storedFormData['geoPhotos.atResidence.url']).toBe(
      'https://cdn.uploadtourl.com/residence-geo-test.jpg'
    );
  });
});

describe('buildPromotedApplicationRecord', () => {
  it('sets existing Airtable column names on the record payload', () => {
    const record = buildPromotedApplicationRecord(
      { 'File ID': 'SF123', Status: 'Draft' },
      { 'borrower.mobile': '9999999999' },
      {
        applicantName: 'Jane Doe',
        productId: 'LP001',
        requestedLoanAmount: '500000',
        mobileNumber: '9999999999',
        emailId: 'jane@example.com',
        documents: '',
      },
      { 'Last Updated': '2026-01-01T00:00:00.000Z' }
    );

    expect(record['Applicant Name']).toBe('Jane Doe');
    expect(record['Mobile Number']).toBe('9999999999');
    expect(record['Email Id']).toBe('jane@example.com');
    expect(record['Requested Loan Amount']).toBe('500000');
    expect(record['Form Data']).toContain('borrower.mobile');
  });
});

describe('mergeFormDataJson', () => {
  it('merges incoming form data over existing JSON', () => {
    const merged = mergeFormDataJson(
      {
        'Form Data': JSON.stringify({ pan: 'ABCDE1234F', applicant_name: 'Old' }),
      },
      { applicant_name: 'New', email: 'test@example.com' }
    );

    expect(merged).toEqual({
      pan: 'ABCDE1234F',
      applicant_name: 'New',
      email: 'test@example.com',
    });
  });

  it('strips base64 geo photo URLs during merge', () => {
    const merged = mergeFormDataJson(
      { 'Form Data': '{}' },
      {
        'geoPhotos.withSupportPerson.url': 'data:image/jpeg;base64,abc',
        'geoPhotos.withSupportPerson.fileName': 'photo.jpg',
        'geoPhotos.withVehicle.url': 'https://cdn.example.com/vehicle.jpg',
      }
    );

    expect(merged['geoPhotos.withSupportPerson.url']).toBeUndefined();
    expect(merged['geoPhotos.withVehicle.url']).toBe('https://cdn.example.com/vehicle.jpg');
  });
});

describe('stripBase64GeoPhotoUrls', () => {
  it('removes data URLs and file names for geo photo slots', () => {
    const sanitized = stripBase64GeoPhotoUrls({
      'geoPhotos.atResidence.url': 'data:image/jpeg;base64,xyz',
      'geoPhotos.atResidence.fileName': 'home.jpg',
      'borrower.mobile': '9999999999',
    });

    expect(sanitized['geoPhotos.atResidence.url']).toBeUndefined();
    expect(sanitized['geoPhotos.atResidence.fileName']).toBeUndefined();
    expect(sanitized['borrower.mobile']).toBe('9999999999');
  });
});
