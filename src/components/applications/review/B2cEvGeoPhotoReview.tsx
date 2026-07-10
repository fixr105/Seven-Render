import React, { useState } from 'react';
import { B2C_EV_GEO_PHOTO_SLOTS } from '../../../lib/b2cEvGeoPhotos';
import { canEmbedMediaAsImage, getExternalMediaUrl } from '../../../lib/shareableMediaUrl';
import { Button } from '../../ui/Button';
import { ExternalLink } from 'lucide-react';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

interface GeoPhotoReviewImageProps {
  url: string;
  label: string;
}

const GeoPhotoReviewImage: React.FC<GeoPhotoReviewImageProps> = ({ url, label }) => {
  const [embedFailed, setEmbedFailed] = useState(false);
  const externalUrl = getExternalMediaUrl(url);
  const canEmbed = canEmbedMediaAsImage(externalUrl) && !embedFailed;

  return (
    <div className="space-y-2">
      {canEmbed ? (
        <img
          src={externalUrl}
          alt={label}
          className="max-h-64 rounded-lg border border-neutral-200 object-contain bg-neutral-50"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setEmbedFailed(true)}
        />
      ) : (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-600">
          Preview unavailable in the dashboard. Open the image in a new tab to view it.
        </div>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={ExternalLink}
        onClick={() => window.open(externalUrl, '_blank', 'noopener,noreferrer')}
        data-testid="geo-photo-open-external"
      >
        Open image
      </Button>
    </div>
  );
};

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
        const fileName = readString(formData[slot.fileNameKey]);

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
                {fileName && <p className="text-xs text-neutral-500">{fileName}</p>}
                <GeoPhotoReviewImage url={url} label={slot.label} />
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
