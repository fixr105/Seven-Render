import { describe, expect, it } from 'vitest';
import {
  getDocumentDisplayKey,
  isFileAddedToFolder,
  validateB2cEvDocumentsReadyForDo,
  type FormConfigCategory,
} from '../b2cEvDocuments';
import { getDoRequestBlockers, getDoRequestReadiness } from '../b2cEvDoRequestGate';

const formConfig: FormConfigCategory[] = [
  {
    categoryName: 'Documents',
    fields: [
      {
        fieldId: 'panCard',
        label: 'PAN Card',
        type: 'file',
        isRequired: true,
      },
    ],
  },
];

describe('b2cEvDocuments DO readiness', () => {
  it('accepts only yes-added-to-folder values for DO readiness', () => {
    expect(isFileAddedToFolder('Yes, Added to Folder')).toBe(true);
    expect(isFileAddedToFolder('Awaiting, Will Update Folder')).toBe(false);
    expect(isFileAddedToFolder('Not Available')).toBe(false);
  });

  it('requires yes-added-to-folder for required uploads before DO', () => {
    const displayKey = getDocumentDisplayKey('PAN Card', 'Documents');
    const errors = validateB2cEvDocumentsReadyForDo(
      {
        _documentsFolderLink: 'https://drive.google.com/folder/abc',
        '_meta.documentsFolderLink.consumedAt': '2026-01-01T00:00:00.000Z',
        '_meta.documentsFolderLink.consumedLink': 'https://drive.google.com/folder/abc',
        [displayKey]: 'Awaiting, Will Update Folder',
      },
      formConfig
    );

    expect(errors[displayKey]).toMatch(/added to folder/i);
  });
});

describe('b2cEvDoRequestGate', () => {
  it('blocks DO request until compliance and documents are ready', () => {
    const displayKey = getDocumentDisplayKey('PAN Card', 'Documents');
    const readiness = getDoRequestReadiness(
      {
        'geoPhotos.withSupportPerson.url': 'https://cdn.example.com/1.jpg',
        'geoPhotos.withSupportPerson.latitude': '1',
        'geoPhotos.withSupportPerson.longitude': '1',
        'geoPhotos.withVehicle.url': 'https://cdn.example.com/2.jpg',
        'geoPhotos.withVehicle.latitude': '1',
        'geoPhotos.withVehicle.longitude': '1',
        'geoPhotos.atResidence.url': 'https://cdn.example.com/3.jpg',
        'geoPhotos.atResidence.latitude': '1',
        'geoPhotos.atResidence.longitude': '1',
        _documentsFolderLink: 'https://drive.google.com/folder/abc',
        '_meta.documentsFolderLink.consumedAt': '2026-01-01T00:00:00.000Z',
        '_meta.documentsFolderLink.consumedLink': 'https://drive.google.com/folder/abc',
        [displayKey]: 'Yes, Added to Folder',
        'compliance.vkycDone': 'true',
        'compliance.loanAgreementSigned': 'true',
        'compliance.enachDone': 'true',
      },
      formConfig
    );

    expect(readiness.canRequestDo).toBe(true);
    expect(readiness.blockers).toEqual([]);
  });

  it('lists blockers when compliance is pending', () => {
    const blockers = getDoRequestBlockers(
      {
        'geoPhotos.withSupportPerson.url': 'https://cdn.example.com/1.jpg',
        'geoPhotos.withSupportPerson.latitude': '1',
        'geoPhotos.withSupportPerson.longitude': '1',
        'geoPhotos.withVehicle.url': 'https://cdn.example.com/2.jpg',
        'geoPhotos.withVehicle.latitude': '1',
        'geoPhotos.withVehicle.longitude': '1',
        'geoPhotos.atResidence.url': 'https://cdn.example.com/3.jpg',
        'geoPhotos.atResidence.latitude': '1',
        'geoPhotos.atResidence.longitude': '1',
      },
      []
    );

    expect(blockers.some((blocker) => blocker.includes('KAM must approve all compliance items'))).toBe(
      true
    );
  });
});
