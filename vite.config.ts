import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { demoVideos } from './vite-plugin-demo-videos';
import { serviceWorkerCacheVersion } from './vite-plugin-service-worker';

function engineProxy(target: string) {
  return {
    target,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/engine/, ''),
  };
}

const DEFAULT_ENGINE_BASE = 'https://n8n-fvmj.srv1499064.hstgr.cloud/webhook';
// airtable + qualify live on the dashboard n8n (fixrrahul), not the tools host.
const DATA_ENGINE_BASE = 'https://fixrrahul.app.n8n.cloud/webhook';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
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
      '/engine/airtable_get': engineProxy(DATA_ENGINE_BASE),
      '/engine/airtable_write': engineProxy(DATA_ENGINE_BASE),
      '/engine/qualify': engineProxy(DATA_ENGINE_BASE),
      '/engine': engineProxy(env.VITE_ENGINE_BASE || DEFAULT_ENGINE_BASE),
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
