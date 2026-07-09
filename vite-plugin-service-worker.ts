import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const pluginDir = dirname(fileURLToPath(import.meta.url));

export function serviceWorkerCacheVersion(): Plugin {
  return {
    name: 'service-worker-cache-version',
    apply: 'build',
    generateBundle() {
      const templatePath = resolve(pluginDir, 'scripts/sw.template.js');
      const buildId =
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
        process.env.GITHUB_SHA?.slice(0, 12) ||
        Date.now().toString();
      const source = readFileSync(templatePath, 'utf8').replace(
        '__SW_CACHE_VERSION__',
        `seven-fincorp-${buildId}`
      );

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source,
      });
    },
  };
}
