import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { demoVideos } from './vite-plugin-demo-videos';
import { serviceWorkerCacheVersion } from './vite-plugin-service-worker';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const legacyOrigin = (env.VITE_N8N_LEGACY_BASE_URL || env.N8N_LEGACY_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/webhook$/i, '');
  const engineBase = (env.VITE_ENGINE_BASE || '').trim() || (legacyOrigin ? `${legacyOrigin}/webhook` : '');
  if (!engineBase) {
    throw new Error(
      'VITE_N8N_LEGACY_BASE_URL or N8N_LEGACY_BASE_URL is required for the /engine proxy. No fallback to the old n8n host.'
    );
  }
  const lmsOrigin = (env.VITE_N8N_LMS_BASE_URL || env.N8N_LMS_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/webhook$/i, '');
  const toolsBase = (env.VITE_TOOLS_BASE || '').trim() || (lmsOrigin ? `${lmsOrigin}/webhook` : '');
  if (!toolsBase) {
    throw new Error(
      'VITE_TOOLS_BASE or N8N_LMS_BASE_URL is required for the /tools proxy. No fallback host.'
    );
  }

  return {
    plugins: [react(), demoVideos(), serviceWorkerCacheVersion()],
    server: {
      port: 3000,
      host: '0.0.0.0', // Listen on all interfaces
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          // changeOrigin: false so backend sees Host: localhost:3000; cookie is set for same host
          // that receives subsequent API requests, avoiding third-party cookie blocking
          changeOrigin: false,
        },
        '/engine': {
          target: engineBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/engine/, ''),
        },
        '/tools': {
          target: toolsBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/tools/, ''),
        },
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/mockData',
          '**/*.test.{ts,tsx}',
          '**/*.spec.{ts,tsx}',
        ],
      },
    },
  };
});
