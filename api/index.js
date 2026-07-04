/**
 * Vercel serverless entry for the Express API.
 * Loads the pre-bundled app from express.cjs (created in vercel buildCommand).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require('./express.cjs');
module.exports = mod.default || mod;
