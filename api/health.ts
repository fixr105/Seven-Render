/**
 * Simple health check endpoint for Vercel
 * This is a minimal endpoint to test serverless function execution
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
): void {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
}

