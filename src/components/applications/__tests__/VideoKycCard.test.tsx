import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VideoKycCard } from '../VideoKycCard';
import { VKYC_STATUS_CHECK_MESSAGE } from '../../../lib/vkycPollFailures';

describe('VideoKycCard', () => {
  it('shows status-check message on the card when provided', () => {
    render(
      <VideoKycCard
        row={null}
        statusCheckError={VKYC_STATUS_CHECK_MESSAGE}
        onRequest={vi.fn()}
        onRequestAgain={vi.fn()}
      />
    );
    expect(screen.getByTestId('vkyc-status-check-error')).toHaveTextContent(
      /Can't check video KYC status\. Retrying/i
    );
  });
});
