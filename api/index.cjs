/**
 * Vercel serverless entry for the Express API (.cjs so root "type":"module" does not apply).
 * Loads the pre-bundled app from express.cjs (created in vercel buildCommand).
 */
const path = require('path');
const fs = require('fs');

let app;
try {
  const bundlePath = path.join(__dirname, 'express.cjs');
  if (!fs.existsSync(bundlePath)) {
    throw new Error(
      `API bundle missing at ${bundlePath}. Files in api/: ${fs.readdirSync(__dirname).join(', ')}`
    );
  }
  const mod = require(bundlePath);
  app = mod.default || mod;
  if (typeof app !== 'function') {
    throw new Error(`Express app export is ${typeof app}, expected function`);
  }
} catch (err) {
  console.error('[api/index] Failed to load Express app:', err);
  module.exports = (req, res) => {
    res.status(500).json({
      success: false,
      error: 'API failed to start',
      detail: err && err.message ? err.message : String(err),
    });
  };
  return;
}

module.exports = app;
