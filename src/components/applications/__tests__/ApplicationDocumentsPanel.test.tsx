import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApplicationDocumentsPanel } from '../ApplicationDocumentsPanel';

describe('ApplicationDocumentsPanel', () => {
  it('renders a clickable folder link and image preview cards', () => {
    render(
      <ApplicationDocumentsPanel
        documents={[
          {
            fieldId: '_documentsFolderLink',
            url: 'https://drive.google.com/drive/folders/abc123',
            fileName: 'Documents Folder',
          },
          {
            fieldId: 'withVehicle',
            url: 'https://cdn.example.com/vehicle.jpg',
            fileName: 'vehicle.jpg',
          },
        ]}
      />
    );

    const folderLink = screen.getByTestId('application-documents-folder-link-anchor');
    expect(folderLink).toHaveAttribute('href', 'https://drive.google.com/drive/folders/abc123');
    expect(screen.getByTestId('application-document-preview-withVehicle')).toBeInTheDocument();
    expect(screen.queryByText('_documentsFolderLink')).not.toBeInTheDocument();
  });
});
