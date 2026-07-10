import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { canEmbedMediaAsImage, getExternalMediaUrl } from '../../lib/shareableMediaUrl';
import { Button } from '../ui/Button';

export interface ReviewableMediaImageProps {
  url: string;
  label: string;
  className?: string;
  testId?: string;
}

export const ReviewableMediaImage: React.FC<ReviewableMediaImageProps> = ({
  url,
  label,
  className = 'max-h-64',
  testId = 'reviewable-media-image',
}) => {
  const [embedFailed, setEmbedFailed] = useState(false);
  const externalUrl = getExternalMediaUrl(url);
  const canEmbed = canEmbedMediaAsImage(externalUrl) && !embedFailed;

  return (
    <div className="space-y-2" data-testid={testId}>
      {canEmbed ? (
        <img
          src={externalUrl}
          alt={label}
          className={`rounded-lg border border-neutral-200 object-contain bg-neutral-50 ${className}`}
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
        data-testid={`${testId}-open`}
      >
        Open image
      </Button>
    </div>
  );
};
