/**
 * Minimal Auth-Only Server for Vercel
 * Only loads auth routes to test if route loading is the bottleneck
 */

process.env.VERCEL = '1';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// Load only auth routes
let authRoutesLoaded = false;

app.use(async (req, res, next) => {
  // Only load auth routes for /auth/* paths
  if (req.path.startsWith('/auth') && !authRoutesLoaded) {
    try {
      console.log('[AuthOnly] Loading auth routes...');
      const authRoutesModule = await import('../backend/src/routes/auth.routes.ts');
      const authRoutes = authRoutesModule.default;
      app.use('/auth', authRoutes);
      authRoutesLoaded = true;
      console.log('[AuthOnly] Auth routes loaded');
    } catch (error: any) {
      console.error('[AuthOnly] Error loading auth routes:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to load auth routes',
        message: error.message,
      });
    }
  }
  next();
});

// For non-auth routes, return 404 or load full routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/auth') && req.path !== '/health') {
    // Try to load full routes for other paths
    import('../backend/src/routes/index.ts')
      .then(module => {
        const routes = module.default;
        app.use('/', routes);
        // Retry the request
        next();
      })
      .catch(err => {
        res.status(404).json({
          success: false,
          error: 'Route not found or failed to load',
        });
      });
  } else {
    next();
  }
});

export default app;

