/**
 * Service Worker for Islamic Calendar PWA
 * Provides offline functionality and caching
 * Cross-browser notification support
 * Notification diagnostics included
 */

const CACHE_NAME = 'islamic-calendar-v1.2.2';
const STATIC_CACHE_NAME = 'islamic-calendar-static-v1.2.2';
const DYNAMIC_CACHE_NAME = 'islamic-calendar-dynamic-v1.2.2';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/calendar.html',
  '/calendar.css',
  '/calendar.js',
  '/js/calendar-api.js',
  '/js/calendar-renderers.js',
  '/js/calendar-event-modal.js',
  '/js/calendar-import-modal.js',
  '/manifest.json',
  '/favicon.ico'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/calendar\/events/,
  /\/api\/islamic-calendar\/holidays/,
  /\/api\/islamic-calendar\/prayer-times/,
  /\/api\/search/,
  /\/api\/categories/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 [SW] Installing service worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(async (cache) => {
        console.log('📦 [SW] Caching static assets');
        const results = await Promise.allSettled(
          STATIC_ASSETS.map((url) => cache.add(url))
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed) {
          console.warn(`⚠️ [SW] ${failed} static assets failed to cache (will fallback to network)`);
        }
      })
      .then(() => {
        console.log('✅ [SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ [SW] Error caching static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 [SW] Activating service worker');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('🗑️ [SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ [SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
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
    handleFetch(request)
  );
});

async function handleFetch(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first for API requests
    if (isAPIRequest(url)) {
      return await networkFirstStrategy(request);
    }
    
    // Cache first for static assets
    if (isStaticAsset(url)) {
      return await cacheFirstStrategy(request);
    }
    
    // Default to network first
    return await networkFirstStrategy(request);
    
  } catch (error) {
    console.error('❌ [SW] Fetch error:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return await getOfflinePage();
    }
    
    // Return cached version if available
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') || 
         API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isStaticAsset(url) {
  // Never cache login.js - always fetch fresh for auth
  if (url.pathname.includes('login.js')) {
    return false;
  }
  // Avoid caching frequently-updated calendar/prayer scripts to prevent stale UI
  if (
    url.pathname === '/calendar.html' ||
    url.pathname === '/calendar.js' ||
    url.pathname === '/calendar.css' ||
    url.pathname === '/prayertimes.html' ||
    url.pathname === '/prayer-time.html' ||
    url.pathname.startsWith('/js/calendar')
  ) {
    return false;
  }
  
  return url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.html') ||
         url.pathname.endsWith('.png') ||
         url.pathname.endsWith('.jpg') ||
         url.pathname.endsWith('.jpeg') ||
         url.pathname.endsWith('.gif') ||
         url.pathname.endsWith('.svg') ||
         url.pathname.endsWith('.ico') ||
         url.pathname.endsWith('.woff') ||
         url.pathname.endsWith('.woff2') ||
         url.pathname.endsWith('.ttf');
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('📦 [SW] Serving from cache:', request.url);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful, complete responses (not partial content)
    if (networkResponse.ok && networkResponse.status !== 206) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      try {
        await cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        console.warn('⚠️ [SW] Failed to cache response:', cacheError);
        // Continue without caching
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ [SW] Network error for static asset:', error);
    throw error;
  }
}

async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Only cache successful, complete responses (not partial content)
    if (networkResponse.ok && networkResponse.status !== 206) {
      try {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        console.warn('⚠️ [SW] Failed to cache response:', cacheError);
        // Continue without caching
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🌐 [SW] Network failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📦 [SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

async function getOfflinePage() {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const offlinePage = await cache.match('/calendar.html');
  
  if (offlinePage) {
    return offlinePage;
  }
  
  // Return a basic offline page
  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - Islamic Calendar</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 40px 20px;
          background: #1a1a1a;
          color: #ffffff;
          text-align: center;
        }
        .offline-container {
          max-width: 400px;
          margin: 0 auto;
        }
        .offline-icon {
          font-size: 4em;
          margin-bottom: 20px;
          color: #6366f1;
        }
        h1 {
          margin-bottom: 16px;
          color: #ffffff;
        }
        p {
          color: #9ca3af;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .retry-btn {
          background: #6366f1;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          transition: background 0.2s;
        }
        .retry-btn:hover {
          background: #4f46e5;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1>You're Offline</h1>
        <p>It looks like you're not connected to the internet. Some features may not be available, but you can still view your cached calendar data.</p>
        <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
      </div>
    </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html'
    }
  });
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 [SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'calendar-sync') {
    event.waitUntil(syncCalendarData());
  }
});

async function syncCalendarData() {
  try {
    console.log('🔄 [SW] Syncing calendar data in background');
    
    // Get pending actions from IndexedDB
    const pendingActions = await getPendingActions();
    
    for (const action of pendingActions) {
      try {
        await processPendingAction(action);
        await removePendingAction(action.id);
      } catch (error) {
        console.error('❌ [SW] Error processing pending action:', error);
      }
    }
    
    console.log('✅ [SW] Background sync completed');
  } catch (error) {
    console.error('❌ [SW] Background sync error:', error);
  }
}

async function getPendingActions() {
  // This would interact with IndexedDB to get pending actions
  // For now, return empty array
  return [];
}

async function processPendingAction(action) {
  // Process the pending action (create, update, delete event)
  console.log('🔄 [SW] Processing pending action:', action);
}

async function removePendingAction(actionId) {
  // Remove the processed action from IndexedDB
  console.log('🗑️ [SW] Removing processed action:', actionId);
}

// Browser detection in Service Worker
function detectBrowserInSW() {
  const ua = self.navigator.userAgent;
  let browserType = 'unknown';
  
  if (/Comet/i.test(ua)) browserType = 'chromium';
  else if (/Edg\//i.test(ua)) browserType = 'chromium';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browserType = 'chromium';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browserType = 'chromium';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browserType = 'safari';
  else if (/Firefox\//i.test(ua)) browserType = 'firefox';
  
  return browserType;
}

// Get browser-adapted notification options
function getAdaptedNotificationOptions(data, browserType) {
  // Base options that work everywhere
  const options = {
    body: data.body || 'Prayer time reminder',
    icon: '/favicon.ico',
    tag: 'prayer-reminder',
    silent: false
  };
  
  // Add browser-specific features
  if (browserType === 'chromium') {
    // Full feature support for Chromium browsers
    options.badge = '/favicon.ico';
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200];
    options.actions = [
      { action: 'prayer-time', title: 'Prayer Time', icon: '/favicon.ico' },
      { action: 'dismiss', title: 'Dismiss' }
    ];
  } else if (browserType === 'firefox') {
    // Firefox-compatible actions (simpler structure)
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200];
    options.actions = [
      {
        action: 'prayer-time',
        title: 'Prayer Time'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ];
    // Remove unsupported options for Firefox
    delete options.badge; // Firefox may not support badge
  } else if (browserType === 'safari') {
    // Safari has very limited support - use minimal options
    // No actions, badge, requireInteraction, or vibrate
  } else {
    // Unknown browser - use safe minimal options
    console.warn('⚠️ [SW] Unknown browser type, using minimal notification options');
  }
  
  return options;
}

// Push notifications for prayer times
self.addEventListener('push', (event) => {
  console.log('🔔 [SW] Push notification received');
  
  const browserType = detectBrowserInSW();
  console.log('🔔 [SW] Detected browser type:', browserType);
  
  if (browserType === 'firefox') {
    console.log('🔔 [SW] Firefox detected - using Mozilla Push compatible options');
  }
  
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('🔔 [SW] Notification data:', data);
      
      // Get browser-adapted notification options
      const options = getAdaptedNotificationOptions(data, browserType);
      
      console.log('🔔 [SW] Showing notification with adapted options for', browserType, ':', options);
      console.log('🔔 [SW] Notification title:', data.title || 'Prayer Time');
      
      if (browserType === 'firefox') {
        console.log('🔔 [SW] Firefox notification options:', JSON.stringify(options));
      }
      
      event.waitUntil((async () => {
        try {
          await self.registration.showNotification(data.title || 'Prayer Time', options);
          console.log('✅ [SW] Notification displayed successfully');

          // DEBUG: Comprehensive payload logging for debugging scheduled prayers
          console.log('🔍 [SW] Payload analysis:', {
            notificationType: data.notificationType,
            type: data.type,
            prayerName: data.prayerName,
            hasAudioFile: !!(data.audioFile || data.data?.audioFile),
            audioFile: data.audioFile,
            dataAudioFile: data.data?.audioFile,
            hasData: !!data.data,
            dataKeys: data.data ? Object.keys(data.data) : []
          });

          // Auto-trigger adhan only for MAIN prayer notifications
          // We rely on payload.notificationType === 'main' (set by backend)
          const isMainPrayer = (data.notificationType === 'main') || (data.type === 'prayer');
          console.log(`🔍 [SW] Is main prayer check: ${isMainPrayer} (notificationType: ${data.notificationType}, type: ${data.type})`);
          
          if (isMainPrayer) {
            try {
              const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
              for (const client of clientsList) {
                // Only message tabs that have the prayer time page loaded
                if (client.url && client.url.includes('/prayer-time.html')) {
                  const playAdhanMessage = {
                    type: 'PLAY_ADHAN',
                    source: 'sw-push',
                    notificationType: 'prayer',
                    prayerName: data.prayerName || (data.data && data.data.prayer) || undefined,
                    audioFile: data.audioFile || (data.data && data.data.audioFile) || undefined,
                    volume: (data.data && data.data.volume) || undefined,
                    fadeInMs: (data.data && data.data.fadeInMs) || undefined,
                    vibrateOnly: (data.data && data.data.vibrateOnly) || false,
                    cooldownSeconds: (data.data && data.data.cooldownSeconds) || undefined
                  };
                  
                  console.log(`🎵 [SW] Sending PLAY_ADHAN message to prayer-time tab:`, playAdhanMessage);
                  client.postMessage(playAdhanMessage);
                }
              }
            } catch (msgErr) {
              console.warn('⚠️ [SW] Failed to post PLAY_ADHAN to clients:', msgErr);
            }
          }
        } catch (error) {
          console.error('❌ [SW] Failed to show notification:', error);
          console.error('❌ [SW] Error details:', error.message, error.stack);
          // Fallback to minimal notification on error
          await self.registration.showNotification(data.title || 'Prayer Time', {
            body: data.body || 'Prayer time reminder',
            icon: '/favicon.ico',
            tag: 'prayer-reminder'
          });
        }
      })());
    } catch (error) {
      console.error('❌ [SW] Error parsing notification data:', error);
      // Fallback notification
      event.waitUntil((async () => {
        await self.registration.showNotification('Prayer Time', {
          body: 'Prayer time reminder',
          icon: '/favicon.ico',
          tag: 'prayer-reminder'
        });
      })());
    }
  } else {
    console.warn('⚠️ [SW] Push event has no data');
    // Fallback notification when no data
    event.waitUntil(
      self.registration.showNotification('Prayer Time', {
        body: 'Prayer time reminder',
        icon: '/favicon.ico',
        tag: 'prayer-reminder'
      })
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'prayer-time') {
    event.waitUntil(
      (async () => {
        // Find all open tabs
        const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        
        // Check if prayer time page is already open
        const prayerTimeTab = allClients.find(client => 
          client.url.includes('/prayer-time.html')
        );
        
        if (prayerTimeTab) {
          // Prayer time page exists - focus it
          await prayerTimeTab.focus();
          console.log('🔔 [SW] Focused existing prayer time tab');
          
          // Send message to check adhan status and start if not playing
          prayerTimeTab.postMessage({
            type: 'CHECK_AND_PLAY_ADHAN',
            source: 'notification-action'
          });
        } else {
          // No prayer time page open - open new tab
          console.log('🔔 [SW] Opening new prayer time tab with autoplay');
          await clients.openWindow('/prayer-time.html?autoplay=true');
        }
      })()
    );
  } else if (event.action === 'dismiss') {
    console.log('🔔 [SW] Notification dismissed');
  }
});

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  console.log('💬 [SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_CALENDAR_DATA') {
    cacheCalendarData(event.data.data);
  }
});

async function cacheCalendarData(data) {
  try {
    console.log('📦 [SW] Caching calendar data');
    
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    
    // Cache events
    if (data.events) {
      const eventsResponse = new Response(JSON.stringify(data.events));
      await cache.put('/api/calendar/events', eventsResponse);
    }
    
    // Cache prayer times
    if (data.prayerTimes) {
      const prayerResponse = new Response(JSON.stringify(data.prayerTimes));
      await cache.put('/api/islamic-calendar/prayer-times', prayerResponse);
    }
    
    // Cache holidays
    if (data.holidays) {
      const holidaysResponse = new Response(JSON.stringify(data.holidays));
      await cache.put('/api/islamic-calendar/holidays', holidaysResponse);
    }
    
    console.log('✅ [SW] Calendar data cached successfully');
  } catch (error) {
    console.error('❌ [SW] Error caching calendar data:', error);
  }
}