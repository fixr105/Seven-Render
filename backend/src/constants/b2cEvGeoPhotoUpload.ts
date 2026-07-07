/** Keep in sync with src/lib/b2cEvGeoPhotos.ts */

export const B2C_EV_GEO_PHOTO_SLOT_IDS = [
  'withSupportPerson',
  'withVehicle',
  'atResidence',
] as const;

export type B2cEvGeoPhotoSlotId = (typeof B2C_EV_GEO_PHOTO_SLOT_IDS)[number];

export const B2C_EV_GEO_PHOTO_UPLOAD_WEBHOOK_PATHS: Record<B2cEvGeoPhotoSlotId, string> = {
  withSupportPerson: 'UPL1',
  withVehicle: 'UPL2',
  atResidence: 'UPL3',
};

export function isB2cEvGeoPhotoSlotId(fieldId: string): fieldId is B2cEvGeoPhotoSlotId {
  return (B2C_EV_GEO_PHOTO_SLOT_IDS as readonly string[]).includes(fieldId);
}
