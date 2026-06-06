import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// ── Service Worker Registration ─────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.info('[SW] Registered, scope:', reg.scope);

        // Check for SW updates every 60 s when the tab is visible
        setInterval(() => {
          if (document.visibilityState === 'visible') reg.update();
        }, 60_000);
      })
      .catch((err) => console.warn('[SW] Registration failed:', err));

    // Listen for the SW asking us to run a sync (triggered by Background Sync API)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_SYNC_REQUEST') {
        // Dispatch a custom DOM event that SyncContext can listen to
        window.dispatchEvent(new CustomEvent('dreamvault:sw-sync-request'));
      }
    });
  });
}

// ── Register Background Sync tag when we go online ─────────────────────────
window.addEventListener('online', async () => {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
        .sync.register('dreamvault-sync');
    } catch {
      // SyncManager not available in this browser — silent fail
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
