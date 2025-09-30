// Service Worker for Islamic Portal PWA
const CACHE_NAME = 'islamic-portal-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';

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
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from Islamic Portal',
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
  
  event.waitUntil(
    self.registration.showNotification('Islamic Portal', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('👆 [Service Worker] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

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