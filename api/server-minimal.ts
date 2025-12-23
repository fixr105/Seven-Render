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

async function loadRoutes() {
  if (routesLoaded) return;
  
  try {
    // Dynamically import routes to avoid blocking initialization
    const routesModule = await import('../backend/src/routes/index.js');
    const routes = routesModule.default;
    app.use('/', routes);
    routesLoaded = true;
    console.log('[MinimalServer] Routes loaded successfully');
  } catch (error: any) {
    console.error('[MinimalServer] Error loading routes:', error);
    throw error;
  }
}

// Middleware to load routes on first request
app.use(async (req, res, next) => {
  if (!routesLoaded) {
    try {
      await loadRoutes();
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load routes',
        message: error.message,
      });
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

