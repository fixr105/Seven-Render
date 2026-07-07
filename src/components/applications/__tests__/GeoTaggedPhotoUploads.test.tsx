import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GeoTaggedPhotoUploads } from '../GeoTaggedPhotoUploads';
import { createInitialB2cEvFormData } from '../../../config/forms/b2cEvFormSchema';
import { apiService } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  apiService: {
    uploadDocument: vi.fn(),
  },
}));

vi.mock('../../../lib/b2cEvGeoPhotos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/b2cEvGeoPhotos')>();
  return {
    ...actual,
    captureGeolocation: vi.fn().mockResolvedValue({ latitude: 21.17, longitude: 72.83 }),
    compressImageFileToBlob: vi.fn().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' })),
  };
});

describe('GeoTaggedPhotoUploads', () => {
  const baseProps = {
    fieldErrors: {},
    onBatchChange: vi.fn(),
    requestingComplianceItemId: null as const,
    onComplianceCheckboxChange: vi.fn(),
    onRequestFromKam: vi.fn(),
    usedWebhookLinks: new Set<string>(),
    onDocumentFieldChange: vi.fn(),
    onFolderLinkConsumed: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.uploadDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        fieldId: 'withSupportPerson',
        fileName: 'photo.jpg',
        shareLink: 'https://cdn.example.com/with-support.jpg',
        fileId: 'file-1',
        webUrl: 'https://cdn.example.com/with-support.jpg',
      },
    });
  });

  it('renders three geo photo upload slots', () => {
    render(
      <GeoTaggedPhotoUploads
        {...baseProps}
        formData={createInitialB2cEvFormData()}
      />
    );

    expect(screen.getByTestId('geo-photo-slot-withSupportPerson')).toBeInTheDocument();
    expect(screen.getByTestId('geo-photo-slot-withVehicle')).toBeInTheDocument();
    expect(screen.getByTestId('geo-photo-slot-atResidence')).toBeInTheDocument();
    expect(screen.getByTestId('geo-photo-upload-withSupportPerson')).toHaveTextContent(
      'Upload photo'
    );
    expect(screen.getByTestId('compliance-checklist')).toBeInTheDocument();
    expect(screen.getByTestId('b2c-documents-section')).toBeInTheDocument();
  });

  it('uploads photo via documents API and stores share link in form patch', async () => {
    const user = userEvent.setup();
    const onBatchChange = vi.fn();

    render(
      <GeoTaggedPhotoUploads
        {...baseProps}
        formData={createInitialB2cEvFormData()}
        onBatchChange={onBatchChange}
        loanApplicationId="draft-geo"
      />
    );

    const file = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
    await user.click(screen.getByTestId('geo-photo-upload-withSupportPerson'));
    const input = screen.getByTestId('geo-photo-file-input') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(apiService.uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldId: 'withSupportPerson',
          fileName: 'photo.jpg',
          loanApplicationId: 'draft-geo',
        })
      );
    });

    expect(onBatchChange).toHaveBeenCalledWith(
      expect.objectContaining({
        'geoPhotos.withSupportPerson.url': 'https://cdn.example.com/with-support.jpg',
        'geoPhotos.withSupportPerson.latitude': '21.17',
        'geoPhotos.withSupportPerson.longitude': '72.83',
      })
    );
  });

  it('persists geo photo patch to draft immediately after upload', async () => {
    const user = userEvent.setup();
    const onBatchChange = vi.fn();
    const onGeoPhotoPersist = vi.fn().mockResolvedValue(undefined);

    render(
      <GeoTaggedPhotoUploads
        {...baseProps}
        formData={createInitialB2cEvFormData()}
        onBatchChange={onBatchChange}
        onGeoPhotoPersist={onGeoPhotoPersist}
        loanApplicationId="draft-geo"
      />
    );

    const file = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
    await user.click(screen.getByTestId('geo-photo-upload-withSupportPerson'));
    const input = screen.getByTestId('geo-photo-file-input') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(onGeoPhotoPersist).toHaveBeenCalledWith(
        expect.objectContaining({
          'geoPhotos.withSupportPerson.url': 'https://cdn.example.com/with-support.jpg',
        })
      );
    });
  });
});
