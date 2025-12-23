/**
 * Vercel Serverless Function Entry Point
 * Optimized for fast cold starts with proper error handling
 */

// Set Vercel environment flag BEFORE any imports
process.env.VERCEL = '1';

import serverless from 'serverless-http';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cache the handler across invocations (Vercel reuses the module between requests)
let cachedHandler: any = null;
let initializationPromise: Promise<any> | null = null;
let initializationError: Error | null = null;
let initializationStartTime: number = 0;

/**
 * Initialize the Express app and create serverless handler
 * This is done lazily and cached for subsequent requests
 */
async function initializeHandler(): Promise<any> {
  // If already initialized, return cached handler
  if (cachedHandler) {
    return cachedHandler;
  }

  // If initialization is in progress, wait for it (with timeout)
  if (initializationPromise) {
    // Wait for initialization but with a timeout
    try {
      return await Promise.race([
        initializationPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), 25000)
        )
      ]);
    } catch (error: any) {
      if (error.message === 'Initialization timeout') {
        console.error('[Serverless] Initialization timed out after 25s');
        throw new Error('Server initialization is taking too long. Please try again.');
      }
      throw error;
    }
  }

  // Start initialization
  initializationStartTime = Date.now();
  initializationPromise = (async () => {
    try {
      console.log('[Serverless] Starting Express app initialization...');
      
      // Dynamic import to avoid blocking module load
      // This import loads all routes and controllers, which might take time
      const serverModule = await import('../backend/src/server.js');
      const expressApp = serverModule.default;
      
      const initTime = Date.now() - initializationStartTime;
      console.log(`[Serverless] Express app loaded in ${initTime}ms`);
      
      // Create serverless handler
      const handler = serverless(expressApp, {
        binary: ['image/*', 'application/pdf'],
      });
      
      cachedHandler = handler;
      const totalTime = Date.now() - initializationStartTime;
      console.log(`[Serverless] Handler ready (total: ${totalTime}ms)`);
      return handler;
    } catch (error: any) {
      console.error('[Serverless] Initialization error:', error);
      initializationError = error;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * Vercel serverless function handler
 */
export default async function handlerWrapper(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    // Normalize the request URL - remove /api prefix
    let path = req.url || '/';
    if (path.startsWith('/api')) {
      path = path.replace('/api', '') || '/';
    }
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Update request URL for Express
    req.url = path;
    if ('originalUrl' in req) {
      (req as any).originalUrl = path;
    }
    
    // Get handler (lazy loaded and cached)
    const serverlessHandler = await initializeHandler();
    
    // Call the serverless handler
    return serverlessHandler(req, res);
  } catch (error: any) {
    console.error('[Serverless] Handler error:', error);
    
    // If initialization failed, return helpful error
    if (initializationError) {
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Server initialization failed',
          message: initializationError.message,
        });
      }
      return;
    }
    
    // Other errors
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
      });
    }
  }
}

