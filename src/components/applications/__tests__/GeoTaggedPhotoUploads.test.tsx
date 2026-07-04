import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GeoTaggedPhotoUploads } from '../GeoTaggedPhotoUploads';
import { createInitialB2cEvFormData } from '../../../config/forms/b2cEvFormSchema';

describe('GeoTaggedPhotoUploads', () => {
  it('renders three geo photo upload slots', () => {
    render(
      <GeoTaggedPhotoUploads
        formData={createInitialB2cEvFormData()}
        fieldErrors={{}}
        onBatchChange={vi.fn()}
        requestingComplianceItemId={null}
        onComplianceCheckboxChange={vi.fn()}
        onRequestFromKam={vi.fn()}
      />
    );

    expect(screen.getByTestId('geo-photo-slot-withSupportPerson')).toBeInTheDocument();
    expect(screen.getByTestId('geo-photo-slot-withVehicle')).toBeInTheDocument();
    expect(screen.getByTestId('geo-photo-slot-atResidence')).toBeInTheDocument();
    expect(screen.getByTestId('geo-photo-upload-withSupportPerson')).toHaveTextContent(
      'Upload photo'
    );
    expect(screen.getByTestId('compliance-checklist')).toBeInTheDocument();
  });
});
