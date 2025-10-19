// Service Worker for Islamic Portal PWA
const CACHE_NAME = 'islamic-portal-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';
const PRAYER_TIMES_CACHE = 'prayer-times-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/login.html',
  '/translator/text-translator.html',
  '/account-management.html',
  '/profile-management.html',
  '/privacy-settings.html',
  '/mfa-setup.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2'
];

// Install event - cache static files
self.addEventListener('install', event => {
  console.log('🔧 [Service Worker] Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 [Service Worker] Caching static files...');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('✅ [Service Worker] Static files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ [Service Worker] Error caching static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('🚀 [Service Worker] Activating...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ [Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ [Service Worker] Old caches cleaned up');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('📦 [Service Worker] Serving from cache:', request.url);
          return cachedResponse;
        }

        // Otherwise, fetch from network
        return fetch(request)
          .then(response => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache dynamic content
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.log('🌐 [Service Worker] Network error, serving offline page:', error);

            // Return offline page for navigation requests
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }

            // Return cached version of the same file if available
            return caches.match(request);
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('🔄 [Service Worker] Background sync:', event.tag);

  if (event.tag === 'translation-sync') {
    event.waitUntil(syncTranslations());
  } else if (event.tag === 'prayer-log-sync') {
    event.waitUntil(syncPrayerLogs());
  }
});

// Push notifications
self.addEventListener('push', event => {
  console.log('📱 [Service Worker] Push notification received');
  console.log('📱 [Service Worker] Event data:', event.data);
  console.log('📱 [Service Worker] Event data type:', typeof event.data);

  let notificationData = {
    title: 'Islamic Portal',
    body: 'New notification from Islamic Portal',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-72x72.png'
      }
    ]
  };

  // Parse notification data if available
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📱 [Service Worker] Parsed notification data:', data);

      // Use prayer-specific data if available
      if (data.title) notificationData.title = data.title;
      if (data.body) notificationData.body = data.body;
      if (data.icon) notificationData.icon = data.icon;
      if (data.badge) notificationData.badge = data.badge;
      if (data.color) notificationData.color = data.color;
      if (data.tag) notificationData.tag = data.tag;
      if (data.requireInteraction !== undefined) notificationData.requireInteraction = data.requireInteraction;
      if (data.vibrate) notificationData.vibrate = data.vibrate;
      if (data.actions) notificationData.actions = data.actions;
      if (data.data) notificationData.data = { ...notificationData.data, ...data.data };

      // Add prayer-specific actions
      if (data.data && data.data.prayer) {
        notificationData.actions = [
          {
            action: 'mark_prayed',
            title: '✅ Mark as Prayed',
            icon: '/icons/icon-72x72.png'
          },
          {
            action: 'play_adhan',
            title: '🔊 Play Adhan',
            icon: '/icons/icon-72x72.png'
          },
          {
            action: 'view_times',
            title: '🕐 View Times',
            icon: '/icons/icon-72x72.png'
          }
        ];
      }
    } catch (error) {
      console.warn('📱 [Service Worker] Failed to parse notification data:', error);
      // Fallback to text parsing
      const text = event.data.text();
      if (text) {
        notificationData.body = text;
      }
    }
  }

  console.log('📱 [Service Worker] Showing notification:', notificationData);
  console.log('📱 [Service Worker] About to call showNotification...');

  // Auto-play adhan if it's a prayer notification
  if (notificationData.data && notificationData.data.prayer && notificationData.data.audioFile) {
    console.log(`🔊 [ServiceWorker] Auto-playing adhan for ${notificationData.data.prayer}`);
    // Send message to main thread to play adhan
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PLAY_ADHAN',
          audioFile: notificationData.data.audioFile,
          prayer: notificationData.data.prayer,
          fromNotification: true
        });
      });
    });
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .then(() => {
        console.log('✅ [Service Worker] Notification shown successfully');
      })
      .catch(error => {
        console.error('❌ [Service Worker] Failed to show notification:', error);
      })
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('👆 [Service Worker] Notification clicked:', event.action);

  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};

  // Handle notification confirmation
  if (notificationData.notificationId) {
    event.waitUntil(
      this.confirmNotificationDelivery(notificationData.notificationId)
    );
  }

  if (action === 'explore' || action === 'view_times') {
    event.waitUntil(
      clients.openWindow('/prayer-time.html')
    );
  } else if (action === 'play_adhan') {
    // Send message to main thread to play adhan
    event.waitUntil(
      clients.matchAll().then(clientList => {
        const audioFile = notificationData.audioFile || '/audio/adhan.mp3';
        clientList.forEach(client => {
          client.postMessage({
            type: 'PLAY_ADHAN',
            audioFile: audioFile,
            fromNotification: true
          });
        });
        // Also open the prayer times page
        return clients.openWindow('/prayer-time.html');
      })
    );
  } else if (action === 'mark_prayed') {
    // Send message to main thread to mark prayer as completed
    event.waitUntil(
      clients.matchAll().then(clientList => {
        const prayer = notificationData.prayer;
        if (prayer) {
          clientList.forEach(client => {
            client.postMessage({
              type: 'LOG_PRAYER',
              prayer: prayer
            });
          });
        }
        return clients.openWindow('/prayer-time.html');
      })
    );
  } else {
    // Default action - open prayer times page
    event.waitUntil(
      clients.openWindow('/prayer-time.html')
    );
  }
});

// Confirm notification delivery
async function confirmNotificationDelivery(notificationId) {
  try {
    // Get token from page
    const token = await getTokenFromPage();
    if (!token) {
      console.warn('⚠️ [Service Worker] No token available for notification confirmation');
      return;
    }

    const response = await fetch('/api/notifications/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        notificationId: notificationId,
        confirmedAt: new Date().toISOString()
      })
    });

    if (response.ok) {
      console.log('✅ [Service Worker] Notification delivery confirmed:', notificationId);
    } else {
      console.error('❌ [Service Worker] Failed to confirm notification delivery');
    }
  } catch (error) {
    console.error('❌ [Service Worker] Error confirming notification delivery:', error);
  }
}

// Get token from page via message passing
async function getTokenFromPage() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null);
    }, 1000);

    clients.matchAll().then(clientList => {
      if (clientList.length === 0) {
        clearTimeout(timeout);
        resolve(null);
        return;
      }

      const client = clientList[0];
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        resolve(event.data.token);
      };

      client.postMessage({
        type: 'GET_TOKEN'
      }, [messageChannel.port2]);
    });
  });
}

// Message handler for communication with main thread
self.addEventListener('message', event => {
  console.log('💬 [Service Worker] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const urlsToCache = event.data.urls;
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          return cache.addAll(urlsToCache);
        })
    );
  }

  // Cache 30 days of prayer times for offline use
  if (event.data && event.data.type === 'CACHE_PRAYER_TIMES_30_DAYS') {
    console.log('📅 [Service Worker] Caching 30 days of prayer times...');
    const { lat, lon, method, madhab } = event.data;

    event.waitUntil(
      fetch(`/api/offline-prayer-times/30-days?lat=${lat}&lon=${lon}&method=${method}&madhab=${madhab}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            return caches.open(PRAYER_TIMES_CACHE).then(cache => {
              const cacheKey = `/prayer-times-30-days-${lat}-${lon}-${method}-${madhab}`;
              return cache.put(cacheKey, new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json' }
              }));
            });
          }
        })
        .then(() => {
          console.log('✅ [Service Worker] 30 days of prayer times cached successfully');
          // Send success message back to client
          event.ports[0].postMessage({ success: true });
        })
        .catch(error => {
          console.error('❌ [Service Worker] Error caching prayer times:', error);
          event.ports[0].postMessage({ success: false, error: error.message });
        })
    );
  }

  // Handle test push notifications
  if (event.data && event.data.type === 'TEST_PUSH') {
    console.log('🧪 [Service Worker] Processing test push notification...');
    
    // Show the test notification immediately
    const notificationData = event.data.data;
    if (notificationData) {
      self.registration.showNotification(notificationData.title, notificationData)
        .then(() => {
          console.log('✅ [Service Worker] Test notification shown successfully');
        })
        .catch(error => {
          console.error('❌ [Service Worker] Failed to show test notification:', error);
        });
    }
  }
});

// Helper functions
async function syncTranslations() {
  console.log('🔄 [Service Worker] Syncing translations...');

  try {
    // Get offline translations from IndexedDB
    const offlineTranslations = await getOfflineTranslations();

    for (const translation of offlineTranslations) {
      try {
        const response = await fetch('/api/translation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${translation.token}`
          },
          body: JSON.stringify(translation.data)
        });

        if (response.ok) {
          // Remove from offline storage
          await removeOfflineTranslation(translation.id);
          console.log('✅ [Service Worker] Translation synced:', translation.id);
        }
      } catch (error) {
        console.error('❌ [Service Worker] Error syncing translation:', error);
      }
    }
  } catch (error) {
    console.error('❌ [Service Worker] Error in syncTranslations:', error);
  }
}

async function syncPrayerLogs() {
  console.log('🔄 [Service Worker] Syncing prayer logs...');

  try {
    // Get offline prayer logs from IndexedDB
    const offlinePrayerLogs = await getOfflinePrayerLogs();

    for (const log of offlinePrayerLogs) {
      try {
        const response = await fetch('/api/prayer-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${log.token}`
          },
          body: JSON.stringify(log.data)
        });

        if (response.ok) {
          // Remove from offline storage
          await removeOfflinePrayerLog(log.id);
          console.log('✅ [Service Worker] Prayer log synced:', log.id);
        }
      } catch (error) {
        console.error('❌ [Service Worker] Error syncing prayer log:', error);
      }
    }
  } catch (error) {
    console.error('❌ [Service Worker] Error in syncPrayerLogs:', error);
  }
}

// IndexedDB helper functions (simplified)
async function getOfflineTranslations() {
  // This would interact with IndexedDB
  // For now, return empty array
  return [];
}

async function removeOfflineTranslation(id) {
  // This would remove from IndexedDB
  console.log('🗑️ [Service Worker] Removing offline translation:', id);
}

async function getOfflinePrayerLogs() {
  // This would interact with IndexedDB
  // For now, return empty array
  return [];
}

async function removeOfflinePrayerLog(id) {
  // This would remove from IndexedDB
  console.log('🗑️ [Service Worker] Removing offline prayer log:', id);
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', event => {
  console.log('⏰ [Service Worker] Periodic sync:', event.tag);

  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});


async function syncContent() {
  console.log('🔄 [Service Worker] Syncing content...');

  try {
    // Sync translations
    await syncTranslations();

    // Sync prayer logs
    await syncPrayerLogs();

    console.log('✅ [Service Worker] Content sync completed');
  } catch (error) {
    console.error('❌ [Service Worker] Error in content sync:', error);
  }
}