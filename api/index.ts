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
      const importStart = Date.now();
      
      // Try importing the minimal server
      // This should be fast since it doesn't load routes immediately
      let serverModule;
      try {
        serverModule = await Promise.race([
          import('./server-minimal.js'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Import timeout after 20s')), 20000)
          )
        ]);
      } catch (importError: any) {
        console.error('[Serverless] Failed to import server-minimal:', importError);
        // Fallback: try importing the full server directly
        console.log('[Serverless] Trying full server import as fallback...');
        serverModule = await Promise.race([
          import('../backend/src/server.js'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Full server import timeout')), 40000)
          )
        ]);
      }
      
      const expressApp = serverModule.default;
      const importTime = Date.now() - importStart;
      console.log(`[Serverless] Express app imported in ${importTime}ms`);
      
      // Create serverless handler
      const handlerStart = Date.now();
      const handler = serverless(expressApp, {
        binary: ['image/*', 'application/pdf'],
      });
      const handlerTime = Date.now() - handlerStart;
      console.log(`[Serverless] Handler created in ${handlerTime}ms`);
      
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
            // Add CORS headers to allow requests from any origin with credentials (cookies)
            const origin = req.headers.origin || req.headers.referer || '*';
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Allow-Credentials', 'true'); // Required for cookies
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    // Add no-cache headers to prevent edge caching of API responses
    // This ensures users always get the latest code, especially important after deployments
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Normalize the request URL - remove /api prefix
    // Vercel's rewrite rule sends /api/* to this handler
    // The req.url might already have /api stripped, or might still have it
    // We need to check what Vercel actually provides
    
    // Log everything we can about the request
    console.log(`[Serverless] req.url: ${req.url}`);
    console.log(`[Serverless] req.path: ${(req as any).path || 'N/A'}`);
    console.log(`[Serverless] req.query: ${JSON.stringify(req.query)}`);
    console.log(`[Serverless] req.headers.host: ${req.headers.host}`);
    console.log(`[Serverless] req.headers['x-vercel-rewrite']: ${req.headers['x-vercel-rewrite'] || 'N/A'}`);
    
    // Try to get the original path from various sources
    let path = req.url || '/';
    
    // If path doesn't start with /api, it might already be normalized by Vercel
    // But we still need to ensure it starts with /
    if (path.startsWith('/api')) {
      // Remove /api prefix
      path = path.replace(/^\/api/, '') || '/';
    }
    
    // Remove query string
    path = path.split('?')[0];
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    console.log(`[Serverless] Final normalized path: ${path}`);
    
    // Update request URL for Express
    req.url = path;
    if ('originalUrl' in req) {
      (req as any).originalUrl = path;
    }
    // Also update path property if it exists
    if ('path' in req) {
      (req as any).path = path;
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

