import {createRoot} from 'react-dom/client';
import {Analytics} from '@vercel/analytics/react';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const triggerUpdate = () => {
        registration.update().catch(() => {});
      };
      window.addEventListener('focus', triggerUpdate);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          triggerUpdate();
        }
      });
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <Analytics />
  </>
);
