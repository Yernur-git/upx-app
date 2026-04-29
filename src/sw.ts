/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// Workbox injects the precache manifest here
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ── Runtime caching ────────────────────────────────────────────────────────
// Supabase — network first, 5-min cache fallback
registerRoute(
  ({ url }) => url.hostname.includes('.supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-api',
    networkTimeoutSeconds: 8,
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 5 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// AI proxy — never cache
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/chat'),
  new NetworkOnly()
);

// Push API endpoints — never cache
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/push'),
  new NetworkOnly()
);

// Google Fonts stylesheets — cache forever
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Google Fonts files — cache forever
registerRoute(
  ({ url }) => url.hostname === 'fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// ── Push Notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data: { title: string; body: string; tag?: string; url?: string };
  try {
    data = event.data.json();
  } catch {
    data = { title: 'UpX', body: event.data.text() };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'upx',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(data.title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url: string })?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing tab if already open
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return (client as WindowClient).focus();
          }
        }
        // Otherwise open new tab
        return self.clients.openWindow(url);
      })
  );
});
