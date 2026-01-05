# Deprecated: Vercel Serverless Functions

**This directory is deprecated** as of the migration to Render (server-based deployment).

## Migration Status

The backend has been migrated from Vercel serverless functions to Render (server-based deployment) to resolve data loading issues and enable background jobs.

## Files in this Directory

- `index.ts` - Vercel serverless function handler (deprecated)
- `server-minimal.ts` - Minimal server for Vercel (deprecated)
- `health.ts` - Health check endpoint (deprecated)

## What Changed

1. **Backend Deployment**: Now uses standard Express.js server on Render
2. **Background Jobs**: Enabled (daily summary job)
3. **No Cold Starts**: Server stays warm, consistent performance
4. **No Timeout Limits**: Unlimited execution time

## Current Deployment

- **Frontend**: Vercel (static hosting) - ✅ Still using
- **Backend**: Render (server-based) - ✅ Migrated

## If You Need Vercel Serverless

If you need to revert to Vercel serverless (not recommended):

1. The code in this directory is still present but deprecated
2. You'll need to restore the VERCEL environment checks in `backend/src/server.ts`
3. Background jobs will be disabled again
4. Data loading issues may return

## Migration Documentation

See `RENDER_DEPLOYMENT_GUIDE.md` for Render deployment instructions.




