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
  // CRITICAL: Log immediately to verify handler is being called
  console.log(`[HANDLER] Handler called - Method: ${req.method}, URL: ${req.url}`);
  
  try {
    // Handle debug endpoints directly in serverless handler (before Express)
    // This bypasses Express routing to test if the issue is with Express
    if (req.url && (req.url.includes('/debug/test') || req.url.includes('/debug/env'))) {
      console.log(`[HANDLER] Debug endpoint detected, handling directly`);
      const origin = req.headers.origin || req.headers.referer || '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type', 'Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      if (req.url.includes('/debug/test')) {
        res.json({ 
          success: true, 
          message: 'Direct handler works!', 
          timestamp: new Date().toISOString(),
          url: req.url,
        });
        return;
      }
      
      if (req.url.includes('/debug/env')) {
        res.json({
          success: true,
          environment: {
            NODE_ENV: process.env.NODE_ENV || 'not set',
            VERCEL: process.env.VERCEL || 'not set',
            N8N_BASE_URL: process.env.N8N_BASE_URL || 'NOT SET - using default',
          },
          timestamp: new Date().toISOString(),
          url: req.url,
        });
        return;
      }
    }
    
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
    // Based on testing, req.url contains the full path including /api (e.g., /api/debug/test)
    
    // Get the original URL
    let path = req.url || '/';
    
    // Remove query string first
    path = path.split('?')[0];
    
    // Remove /api prefix if present
    if (path.startsWith('/api')) {
      path = path.replace(/^\/api/, '') || '/';
    }
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    console.log(`[Serverless] Original req.url: ${req.url}`);
    console.log(`[Serverless] Normalized path for Express: ${path}`);
    
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
    console.log(`[Serverless] About to initialize/get Express handler for path: ${path}`);
    const serverlessHandler = await initializeHandler();
    console.log(`[Serverless] Express handler ready, calling with path: ${path}`);
    
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

