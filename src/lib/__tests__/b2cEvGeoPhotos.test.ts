import { describe, it, expect } from 'vitest';
import {
  B2C_EV_GEO_PHOTO_SLOTS,
  B2C_EV_GEO_PHOTO_UPLOAD_WEBHOOK_PATHS,
  isB2cEvGeoPhotoSlotId,
  isGeoPhotoSlotComplete,
  validateGeoPhotosStage,
} from '../b2cEvGeoPhotos';

describe('b2cEvGeoPhotos', () => {
  it('maps each slot to UPL1/UPL2/UPL3 webhook paths', () => {
    expect(B2C_EV_GEO_PHOTO_UPLOAD_WEBHOOK_PATHS.withSupportPerson).toBe('UPL1');
    expect(B2C_EV_GEO_PHOTO_UPLOAD_WEBHOOK_PATHS.withVehicle).toBe('UPL2');
    expect(B2C_EV_GEO_PHOTO_UPLOAD_WEBHOOK_PATHS.atResidence).toBe('UPL3');
    expect(isB2cEvGeoPhotoSlotId('withVehicle')).toBe(true);
    expect(isB2cEvGeoPhotoSlotId('other')).toBe(false);
  });

  it('requires url and coordinates for each slot', () => {
    const errors = validateGeoPhotosStage({});
    expect(Object.keys(errors).length).toBe(B2C_EV_GEO_PHOTO_SLOTS.length);
  });

  it('passes when all geo photo slots are complete', () => {
    const formData = {
      'geoPhotos.withSupportPerson.url': 'data:image/jpeg;base64,abc',
      'geoPhotos.withSupportPerson.latitude': '28.6139',
      'geoPhotos.withSupportPerson.longitude': '77.2090',
      'geoPhotos.withVehicle.url': 'data:image/jpeg;base64,def',
      'geoPhotos.withVehicle.latitude': '28.6139',
      'geoPhotos.withVehicle.longitude': '77.2090',
      'geoPhotos.atResidence.url': 'data:image/jpeg;base64,ghi',
      'geoPhotos.atResidence.latitude': '28.6139',
      'geoPhotos.atResidence.longitude': '77.2090',
    };

    expect(validateGeoPhotosStage(formData)).toEqual({});
    for (const slot of B2C_EV_GEO_PHOTO_SLOTS) {
      expect(isGeoPhotoSlotComplete(formData, slot)).toBe(true);
    }
  });
});
