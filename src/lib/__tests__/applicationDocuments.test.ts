import { describe, expect, it } from 'vitest';
import {
  normalizeApplicationDocument,
  partitionApplicationDocuments,
} from '../applicationDocuments';

describe('applicationDocuments', () => {
  it('repairs legacy documents parsed with https as fieldId', () => {
    const normalized = normalizeApplicationDocument({
      fieldId: 'https',
      url: '//cdn.example.com/withVehicle.jpg',
      fileName: 'withVehicle.jpg',
    });

    expect(normalized).toEqual({
      fieldId: 'document',
      url: 'https://cdn.example.com/withVehicle.jpg',
      fileName: 'withVehicle.jpg',
    });
  });

  it('partitions folder link from uploaded media documents', () => {
    const result = partitionApplicationDocuments(
      [
        {
          fieldId: '_documentsFolderLink',
          url: 'https://drive.google.com/drive/folders/abc123',
          fileName: 'Documents Folder',
        },
        {
          fieldId: 'withVehicle',
          url: 'https://cdn.example.com/vehicle.jpg',
          fileName: 'vehicle.jpg',
        },
      ],
      'https://drive.google.com/drive/folders/abc123'
    );

    expect(result.folderLink).toBe('https://drive.google.com/drive/folders/abc123');
    expect(result.mediaDocuments).toEqual([
      {
        fieldId: 'withVehicle',
        url: 'https://cdn.example.com/vehicle.jpg',
        fileName: 'vehicle.jpg',
      },
    ]);
  });
});
