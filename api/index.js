/**
 * Vercel serverless entry (ESM — root package.json has "type": "module").
 * Loads the pre-bundled CJS Express app from express.cjs (built in vercel buildCommand).
 */
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

let app;
try {
  const bundlePath = join(__dirname, 'express.cjs');
  if (!existsSync(bundlePath)) {
    throw new Error(
      `API bundle missing at ${bundlePath}. Files in api/: ${readdirSync(__dirname).join(', ')}`
    );
  }
  const mod = require(bundlePath);
  app = mod.default || mod;
  if (typeof app !== 'function') {
    throw new Error(`Express app export is ${typeof app}, expected function`);
  }
} catch (err) {
  console.error('[api/index] Failed to load Express app:', err);
  app = (req, res) => {
    res.status(500).json({
      success: false,
      error: 'API failed to start',
      detail: err && err.message ? err.message : String(err),
    });
  };
}

export default app;
