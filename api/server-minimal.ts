/**
 * Minimal Express Server for Vercel
 * Only loads essential routes to reduce initialization time
 */

// Set Vercel environment flag
process.env.VERCEL = '1';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check (no auth needed)
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// Lazy load routes only when needed
let routesLoaded = false;
let routesLoading = false;
let routesLoadPromise: Promise<void> | null = null;

async function loadRoutes(): Promise<void> {
  if (routesLoaded) return;
  if (routesLoading && routesLoadPromise) {
    return routesLoadPromise;
  }
  
  routesLoading = true;
  const startTime = Date.now();
  
  routesLoadPromise = (async () => {
    try {
      console.log('[MinimalServer] Starting to load routes...');
      
      // Dynamically import routes to avoid blocking initialization
      // Use .js extension - Vercel compiles TypeScript automatically
      const routesModule = await import('../backend/src/routes/index.js');
      const routes = routesModule.default;
      
      // Type assertion for Router compatibility (using unknown to avoid type conflicts)
      app.use('/', routes as unknown as express.Router);
      routesLoaded = true;
      routesLoading = false;
      
      const loadTime = Date.now() - startTime;
      console.log(`[MinimalServer] Routes loaded successfully in ${loadTime}ms`);
    } catch (error: any) {
      routesLoading = false;
      console.error('[MinimalServer] Error loading routes:', error);
      throw error;
    }
  })();
  
  return routesLoadPromise;
}

// Middleware to load routes on first request (with timeout)
app.use(async (req, res, next) => {
  if (!routesLoaded) {
    try {
      // Load routes with timeout protection
      await Promise.race([
        loadRoutes(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Route loading timeout')), 50000)
        )
      ]);
    } catch (error: any) {
      console.error('[MinimalServer] Failed to load routes:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: 'Failed to load routes',
          message: error.message || 'Route loading timed out',
        });
      }
      return;
    }
  }
  next();
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
});

export default app;

