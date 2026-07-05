export interface B2cEvGeoPhotoSlot {
  id: string;
  label: string;
  urlKey: string;
  fileNameKey: string;
  latitudeKey: string;
  longitudeKey: string;
  capturedAtKey: string;
}

export const B2C_EV_GEO_PHOTO_SLOTS: B2cEvGeoPhotoSlot[] = [
  {
    id: 'withSupportPerson',
    label: 'Upload geo tagged photo with borrower',
    urlKey: 'geoPhotos.withSupportPerson.url',
    fileNameKey: 'geoPhotos.withSupportPerson.fileName',
    latitudeKey: 'geoPhotos.withSupportPerson.latitude',
    longitudeKey: 'geoPhotos.withSupportPerson.longitude',
    capturedAtKey: 'geoPhotos.withSupportPerson.capturedAt',
  },
  {
    id: 'withVehicle',
    label: 'Upload geo tagged photo of borrower with vehicle',
    urlKey: 'geoPhotos.withVehicle.url',
    fileNameKey: 'geoPhotos.withVehicle.fileName',
    latitudeKey: 'geoPhotos.withVehicle.latitude',
    longitudeKey: 'geoPhotos.withVehicle.longitude',
    capturedAtKey: 'geoPhotos.withVehicle.capturedAt',
  },
  {
    id: 'atResidence',
    label: 'Upload geo tagged photo of borrower at residence location',
    urlKey: 'geoPhotos.atResidence.url',
    fileNameKey: 'geoPhotos.atResidence.fileName',
    latitudeKey: 'geoPhotos.atResidence.latitude',
    longitudeKey: 'geoPhotos.atResidence.longitude',
    capturedAtKey: 'geoPhotos.atResidence.capturedAt',
  },
];

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function isGeoPhotoSlotComplete(
  formData: Record<string, unknown>,
  slot: B2cEvGeoPhotoSlot
): boolean {
  const url = readString(formData[slot.urlKey]);
  const latitude = readString(formData[slot.latitudeKey]);
  const longitude = readString(formData[slot.longitudeKey]);
  if (!url || !latitude || !longitude) return false;
  const lat = Number(latitude);
  const lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon);
}

export function validateGeoPhotosStage(formData: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const slot of B2C_EV_GEO_PHOTO_SLOTS) {
    const url = readString(formData[slot.urlKey]);
    const latitude = readString(formData[slot.latitudeKey]);
    const longitude = readString(formData[slot.longitudeKey]);

    if (!url) {
      errors[slot.urlKey] = `${slot.label} is required`;
      continue;
    }
    if (!latitude || !longitude) {
      errors[slot.latitudeKey] = 'Location must be captured when uploading this photo';
      continue;
    }
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors[slot.latitudeKey] = 'Invalid latitude';
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      errors[slot.longitudeKey] = 'Invalid longitude';
    }
  }
  return errors;
}

export async function captureGeolocation(): Promise<{ latitude: number; longitude: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not supported on this device');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(error.message || 'Unable to capture location'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export async function compressImageFile(file: File, maxWidth = 1280): Promise<string> {
  const blob = await compressImageFileToBlob(file, maxWidth);
  return readBlobAsDataUrl(blob);
}

export async function compressImageFileToBlob(file: File, maxWidth = 1280): Promise<Blob> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = image.width > maxWidth ? maxWidth / image.width : 1;
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to process image');
  }
  context.drawImage(image, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to process image'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.82
    );
  });
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read processed image'));
    reader.readAsDataURL(blob);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Invalid image file'));
    image.src = src;
  });
}
