import React, { useRef, useState } from 'react';
import { Button } from '../ui/Button';
import {
  B2C_EV_GEO_PHOTO_SLOTS,
  captureGeolocation,
  compressImageFile,
  type B2cEvGeoPhotoSlot,
} from '../../lib/b2cEvGeoPhotos';

function readFieldValue(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value);
}

export interface GeoTaggedPhotoUploadsProps {
  formData: Record<string, unknown>;
  fieldErrors: Record<string, string>;
  onBatchChange: (patch: Record<string, string>) => void;
}

export const GeoTaggedPhotoUploads: React.FC<GeoTaggedPhotoUploadsProps> = ({
  formData,
  fieldErrors,
  onBatchChange,
}) => {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<B2cEvGeoPhotoSlot | null>(null);

  const openFilePicker = (slot: B2cEvGeoPhotoSlot) => {
    pendingSlotRef.current = slot;
    setSlotError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const slot = pendingSlotRef.current;
    event.target.value = '';
    if (!file || !slot) return;

    if (!file.type.startsWith('image/')) {
      setSlotError('Please select an image file');
      return;
    }

    setActiveSlotId(slot.id);
    setSlotError(null);

    try {
      const [location, dataUrl] = await Promise.all([
        captureGeolocation(),
        compressImageFile(file),
      ]);

      onBatchChange({
        [slot.urlKey]: dataUrl,
        [slot.fileNameKey]: file.name,
        [slot.latitudeKey]: String(location.latitude),
        [slot.longitudeKey]: String(location.longitude),
        [slot.capturedAtKey]: new Date().toISOString(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to upload geo tagged photo';
      setSlotError(message);
    } finally {
      setActiveSlotId(null);
      pendingSlotRef.current = null;
    }
  };

  const clearPhoto = (slot: B2cEvGeoPhotoSlot) => {
    onBatchChange({
      [slot.urlKey]: '',
      [slot.fileNameKey]: '',
      [slot.latitudeKey]: '',
      [slot.longitudeKey]: '',
      [slot.capturedAtKey]: '',
    });
  };

  return (
    <div className="space-y-6" data-testid="geo-tagged-photo-uploads">
      <p className="text-sm text-neutral-600">
        Each photo must be captured with location services enabled. Your device location is recorded
        at the time of upload.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="geo-photo-file-input"
        onChange={(event) => void handleFileSelected(event)}
      />

      {slotError && (
        <p className="text-sm text-error" data-testid="geo-photo-slot-error">
          {slotError}
        </p>
      )}

      <div className="space-y-4">
        {B2C_EV_GEO_PHOTO_SLOTS.map((slot) => {
          const url = readFieldValue(formData, slot.urlKey);
          const latitude = readFieldValue(formData, slot.latitudeKey);
          const longitude = readFieldValue(formData, slot.longitudeKey);
          const fileName = readFieldValue(formData, slot.fileNameKey);
          const capturedAt = readFieldValue(formData, slot.capturedAtKey);
          const isUploading = activeSlotId === slot.id;
          const error = fieldErrors[slot.urlKey] || fieldErrors[slot.latitudeKey];

          return (
            <div
              key={slot.id}
              className="rounded-xl border border-neutral-200 p-4"
              data-testid={`geo-photo-slot-${slot.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-neutral-900">{slot.label}</p>
                  {url && (
                    <p className="mt-1 text-xs text-neutral-500">
                      {fileName || 'Photo uploaded'}
                      {latitude && longitude
                        ? ` · ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
                        : ''}
                      {capturedAt ? ` · ${new Date(capturedAt).toLocaleString()}` : ''}
                    </p>
                  )}
                  {error && <p className="mt-1 text-sm text-error">{error}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isUploading}
                    data-testid={`geo-photo-upload-${slot.id}`}
                    onClick={() => openFilePicker(slot)}
                  >
                    {isUploading ? 'Uploading…' : url ? 'Replace photo' : 'Upload photo'}
                  </Button>
                  {url && (
                    <Button
                      type="button"
                      variant="tertiary"
                      disabled={isUploading}
                      data-testid={`geo-photo-clear-${slot.id}`}
                      onClick={() => clearPhoto(slot)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              {url && (
                <img
                  src={url}
                  alt={slot.label}
                  className="mt-4 max-h-48 rounded-lg border border-neutral-200 object-contain"
                  data-testid={`geo-photo-preview-${slot.id}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
