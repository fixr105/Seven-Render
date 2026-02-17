/**
 * Zod Validation Schemas and Input Sanitization
 */

import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

// Auth
export const loginSchema = z.object({
  email: z.string().email().max(255).trim(),
  password: z.string().min(1).max(255),
});

export const validateSchema = z.object({
  username: z.string().min(1).max(255).trim(),
  passcode: z.string().min(1).max(255),
});

// Loan Applications
export const createLoanApplicationSchema = z.object({
  productId: z.string().min(1).max(100),
  borrowerIdentifiers: z.object({
    pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional(),
    name: z.string().max(255).optional(),
  }).optional(),
});

export const updateLoanApplicationFormSchema = z.object({
  formData: z.record(z.any()),
});

// Client Routes
export const createClientSchema = z.object({
  clientName: z.string().min(1).max(255).trim(),
  email: z.string().email().max(255).trim().optional(),
  phone: z.string().max(20).trim().optional(),
  assignedKAM: z.string().max(100).optional(),
});

// Query Routes
export const createQuerySchema = z.object({
  message: z.string().min(1).max(5000).trim(),
  queryType: z.enum(['question', 'clarification', 'issue']).optional(),
});

// File Upload
export const fileUploadSchema = z.object({
  fileName: z.string().min(1).max(255).trim(),
  fieldId: z.string().max(100).optional(),
  folderPath: z.string().max(255).optional(),
});

// Sanitization utility
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove HTML tags and dangerous characters
    return sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

// Validation middleware with sanitization
export const validate = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      // Sanitize input first
      if (req.body) {
        req.body = sanitizeInput(req.body);
      }
      if (req.query) {
        req.query = sanitizeInput(req.query);
      }
      if (req.params) {
        req.params = sanitizeInput(req.params);
      }
      
      // Validate with schema
      schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error.errors) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        res.status(400).json({
          success: false,
          error: error.message || 'Validation error',
        });
      }
    }
  };
};

