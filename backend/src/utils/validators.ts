/**
 * Zod Validation Schemas
 */

import { z } from 'zod';

// Auth
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Loan Applications
export const createLoanApplicationSchema = z.object({
  productId: z.string().min(1),
  borrowerIdentifiers: z.object({
    pan: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
});

export const updateLoanApplicationFormSchema = z.object({
  formData: z.record(z.any()),
  documentUploads: z.array(z.object({
    fieldId: z.string(),
    fileUrl: z.string().url(),
    fileName: z.string(),
    mimeType: z.string(),
  })).optional(),
});

// Validation middleware
export const validate = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
  };
};

