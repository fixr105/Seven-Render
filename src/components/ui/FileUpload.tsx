import React, { useRef, useState } from 'react';
import { Upload, X, File, AlertCircle } from 'lucide-react';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress?: number;
  error?: string;
}

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes?: string[];
  maxSizeInMB?: number;
  maxFiles?: number;
  uploadedFiles?: UploadedFile[];
  onRemoveFile?: (fileId: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  acceptedTypes = [],
  maxSizeInMB = 10,
  maxFiles = 5,
  uploadedFiles = [],
  onRemoveFile,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFiles = (files: FileList | null): File[] => {
    if (!files) return [];

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    setError('');

    if (uploadedFiles.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return [];
    }

    for (const file of fileArray) {
      if (acceptedTypes.length > 0 && !acceptedTypes.some(type => file.type.includes(type))) {
        setError(`File type not accepted: ${file.name}`);
        continue;
      }

      if (file.size > maxSizeInMB * 1024 * 1024) {
        setError(`File too large: ${file.name} (max ${maxSizeInMB}MB)`);
        continue;
      }

      validFiles.push(file);
    }

    return validFiles;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const validFiles = validateFiles(e.dataTransfer.files);
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validFiles = validateFiles(e.target.files);
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${dragActive ? 'border-brand-primary bg-[#332f78]/10' : 'border-neutral-300 hover:border-brand-primary hover:bg-neutral-50'}
        `}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleChange}
          className="hidden"
          accept={acceptedTypes.join(',')}
        />

        <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
        <p className="text-base font-medium text-neutral-700 mb-2">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-neutral-500">
          {acceptedTypes.length > 0 ? `Accepted: ${acceptedTypes.join(', ')}` : 'All file types accepted'}
          {' • '}
          Max {maxSizeInMB}MB per file
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-error">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Uploaded files list */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-white border border-neutral-200 rounded"
            >
              <File className="w-5 h-5 text-neutral-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{file.name}</p>
                <p className="text-xs text-neutral-500">{formatFileSize(file.size)}</p>
                {file.progress !== undefined && file.progress < 100 && (
                  <div className="mt-1 w-full bg-neutral-200 rounded-full h-1.5">
                    <div
                      className="bg-brand-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
                {file.error && (
                  <p className="text-xs text-error mt-1">{file.error}</p>
                )}
              </div>
              {onRemoveFile && (
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="p-1 rounded hover:bg-neutral-100 transition-colors"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
