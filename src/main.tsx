import './promiseWithResolversPolyfill.ts';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AppErrorBoundary} from './components/AppErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Signal87 root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
