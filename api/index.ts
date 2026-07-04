/**
 * Vercel serverless entry — mounts the Express app for all /api/* requests.
 * Built backend lives in backend/dist (see vercel.json buildCommand).
 */
import app from '../backend/dist/server.js';

export default app;
