import { supabase } from './supabase';

export interface UploadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface DocumentMetadata {
  applicationId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
}

const BUCKET_NAME = 'loan-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const ensureBucketExists = async (): Promise<void> => {
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);

  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
    });

    if (error) {
      console.error('Error creating bucket:', error);
    }
  }
};

export const validateFile = (file: File): { valid: boolean; error?: string } => {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    };
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'File type not allowed. Please upload PDF, images, or Office documents.',
    };
  }

  return { valid: true };
};

export const uploadDocument = async (
  file: File,
  metadata: DocumentMetadata
): Promise<UploadResult> => {
  try {
    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    await ensureBucketExists();

    const fileExt = file.name.split('.').pop();
    const fileName = `${metadata.applicationId}/${Date.now()}_${metadata.documentType}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    const { error: dbError } = await supabase.from('documents').insert({
      application_id: metadata.applicationId,
      document_type: metadata.documentType,
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      uploaded_by: metadata.uploadedBy,
    });

    if (dbError) {
      await supabase.storage.from(BUCKET_NAME).remove([fileName]);
      console.error('Database error:', dbError);
      return { success: false, error: 'Failed to save document metadata' };
    }

    return { success: true, filePath: uploadData.path };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: 'Unexpected error during upload' };
  }
};

export const downloadDocument = async (filePath: string): Promise<Blob | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(filePath);

    if (error) {
      console.error('Download error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Download error:', error);
    return null;
  }
};

export const getDocumentUrl = async (filePath: string, expiresIn: number = 3600): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
};

export const deleteDocument = async (filePath: string, documentId: string): Promise<boolean> => {
  try {
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      console.error('Database delete error:', dbError);
      return false;
    }

    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
};

export const getApplicationDocuments = async (applicationId: string) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
};
