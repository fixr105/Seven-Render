import React from 'react';
import { B2C_EV_GEO_PHOTO_SLOTS } from '../../../lib/b2cEvGeoPhotos';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export interface B2cEvGeoPhotoReviewProps {
  formData: Record<string, unknown>;
}

export const B2cEvGeoPhotoReview: React.FC<B2cEvGeoPhotoReviewProps> = ({ formData }) => {
  return (
    <div className="space-y-4" data-testid="b2c-geo-photo-review">
      {B2C_EV_GEO_PHOTO_SLOTS.map((slot) => {
        const url = readString(formData[slot.urlKey]);
        const latitude = readString(formData[slot.latitudeKey]);
        const longitude = readString(formData[slot.longitudeKey]);
        const capturedAt = readString(formData[slot.capturedAtKey]);

        return (
          <div
            key={slot.id}
            className="rounded-xl border border-neutral-200 p-4"
            data-testid={`geo-photo-review-${slot.id}`}
          >
            <p className="text-sm font-medium text-neutral-900">{slot.label}</p>
            {!url ? (
              <p className="mt-2 text-sm text-neutral-500">Not uploaded</p>
            ) : (
              <div className="mt-3 space-y-2">
                <img
                  src={url}
                  alt={slot.label}
                  className="max-h-48 rounded-lg border border-neutral-200 object-contain"
                />
                {(latitude || longitude) && (
                  <p className="text-xs text-neutral-600">
                    Location: {latitude || '—'}, {longitude || '—'}
                  </p>
                )}
                {capturedAt && (
                  <p className="text-xs text-neutral-500">
                    Captured: {new Date(capturedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
