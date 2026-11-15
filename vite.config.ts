import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { demoVideos } from './vite-plugin-demo-videos';
import { serviceWorkerCacheVersion } from './vite-plugin-service-worker';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const engineBase =
    env.VITE_ENGINE_BASE || 'https://fixrrahul.app.n8n.cloud/webhook';
  const toolsBase =
    env.VITE_TOOLS_BASE || 'https://n8n-fvmj.srv1499064.hstgr.cloud/webhook';

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
