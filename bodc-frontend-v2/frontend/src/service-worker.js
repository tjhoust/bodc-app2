/* eslint-disable no-restricted-globals */
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

clientsClaim();

// Precache all build assets
precacheAndRoute(self.__WB_MANIFEST);

// SPA fallback — all navigation requests serve index.html
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
  ({ request, url }) => {
    if (request.mode !== 'navigate') return false;
    if (url.pathname.startsWith('/_')) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// ── API caching strategies ────────────────────────────────────

// Auth endpoints — always network (never cache credentials)
registerRoute(
  ({ url }) => url.pathname.includes('/api/auth'),
  new NetworkFirst({ cacheName: 'api-auth' })
);

// Read-only reference data — stale while revalidate (fast + fresh)
registerRoute(
  ({ url }) => url.pathname.match(/\/api\/(sites|work-codes|checklists)/),
  new StaleWhileRevalidate({
    cacheName: 'api-reference-data',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 24 * 60 * 60, maxEntries: 50 }),
    ],
  })
);

// Notifications — network first with cache fallback
registerRoute(
  ({ url }) => url.pathname.includes('/api/notifications'),
  new NetworkFirst({
    cacheName: 'api-notifications',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 5 * 60 }),
    ],
  })
);

// ── Background sync — offline time entry queue ────────────────
const bgSyncPlugin = new BackgroundSyncPlugin('bodc-offline-queue', {
  maxRetentionTime: 72 * 60, // retry for up to 72 hours
  onSync: async ({ queue }) => {
    let entry;
    const failed = [];
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request);
        // Notify clients that sync succeeded
        const clients = await self.clients.matchAll();
        clients.forEach(c => c.postMessage({ type: 'SYNC_SUCCESS', url: entry.request.url }));
      } catch (err) {
        await queue.unshiftRequest(entry);
        failed.push(entry);
        break;
      }
    }
  },
});

// POST to entries — queue for background sync when offline
registerRoute(
  ({ url, request }) => url.pathname.includes('/api/entries') && request.method === 'POST',
  new NetworkFirst({
    cacheName: 'api-entries-post',
    plugins: [bgSyncPlugin],
    networkTimeoutSeconds: 10,
  }),
  'POST'
);

// GET entries — network first, cache fallback for offline viewing
registerRoute(
  ({ url }) => url.pathname.includes('/api/entries'),
  new NetworkFirst({
    cacheName: 'api-entries',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 30 * 60, maxEntries: 100 }),
    ],
    networkTimeoutSeconds: 5,
  })
);

// Static assets — cache first
registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 30 * 24 * 60 * 60, maxEntries: 60 }),
    ],
  })
);

// ── Push notifications ────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data: data.url,
      actions: data.actions || [],
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// ── Skip waiting ─────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
