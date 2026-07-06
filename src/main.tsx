import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { setupErrorHandlers } from './utils/errorTracker.js';
import { registerServiceWorker } from './lib/pwa/registerServiceWorker';
import './index.css';

// Setup global error handlers
setupErrorHandlers();
void registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
