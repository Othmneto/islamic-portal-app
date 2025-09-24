/* ------------------------------------------------------------------
   translator-backend/public/sw.js

   Service Worker for Prayer Times
   - Shows notifications on push
   - ✅ Handles interactive notification actions ('snooze', 'mark_prayed')
   - ✅ On 'mark_prayed', opens/focuses page and signals it to log the prayer
   - Broadcasts PLAY_ADHAN to open pages so they can play audio
   - Focuses or opens page on notification click
------------------------------------------------------------------- */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle messages from main thread for real-time updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REALTIME_HEARTBEAT') {
    console.log('📡 Service worker received heartbeat:', event.data);
    
    // Broadcast to all clients
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'REALTIME_UPDATE',
            timestamp: Date.now(),
            source: 'service-worker'
          });
        });
      })
    );
  }
});

// Utility: safe JSON parse of push payload
async function parsePushData(event) {
  if (!event.data) return {};
  try {
    return await event.data.json();
  } catch {
    // fallback: plain text
    try {
      const txt = await event.data.text();
      return { body: txt };
    } catch {
      return {};
    }
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    const payload = await parsePushData(event);
    const title = payload.title || "Prayer Reminder";
    const options = {
      body: payload.body || "",
      icon: payload.icon || "/favicon.ico",
      badge: payload.badge || "/favicon.ico",
      data: payload.data || { url: "/prayer-time.html" }, // may contain { url, prayer }
      tag: payload.tag || "prayer",
      renotify: !!payload.renotify,
      actions: payload.actions || [], // include action buttons from payload
      requireInteraction: true, // Keep notification visible until user interacts
      // Note: custom sounds aren't supported in Web Push. We broadcast to pages instead.
    };

    // Show notification (this works even when browser is closed)
    await self.registration.showNotification(title, options);

    // Also tell open clients to play Adhan unless silenced
    if (!payload.silent) {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clientsList) {
        try {
          c.postMessage({
            type: "PLAY_ADHAN",
            audioFile: payload.audioFile || "/audio/adhan.mp3",
          });
        } catch {}
      }
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  const prayer = data.prayer || "prayer";

  notification.close();

  event.waitUntil((async () => {
    // --- ACTION: Snooze ---
    if (action === "snooze") {
      const snoozeTitle = `Snooze: ${notification.title || "Prayer Reminder"}`;
      const snoozeOptions = {
        body: "Reminder will be sent in 5 minutes.",
        tag: `snooze_${prayer}`,
      };

      try {
        const subscription = await self.registration.pushManager.getSubscription();
        if (subscription) {
          await fetch("/api/notifications/snooze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              originalPayload: {
                title: notification.title,
                body: notification.body,
                icon: notification.icon,
                tag: prayer,
                requireInteraction: true,
                data: notification.data,
                actions: notification.actions,
              },
              endpoint: subscription.endpoint,
            }),
          });
        }
      } catch {}

      // Confirm snooze
      return self.registration.showNotification(snoozeTitle, snoozeOptions);
    }

    // --- ACTION: Mark as prayed ---
    if (action === "mark_prayed" && prayer) {
      try { console.log(`User marked '${prayer}' as prayed.`); } catch {}

      // We open/focus the page and either:
      //  - send a message to it to log the prayer, or
      //  - open the page with ?log=<prayer> so the page can log on load.
      const baseUrl = "/prayer-time.html";
      const urlWithParam = new URL(`${baseUrl}?log=${encodeURIComponent(prayer)}`, self.location.origin).href;

      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // If a prayer-time page is already open, focus it and send a message.
      for (const client of clientList) {
        // Compare path (ignore querystring)
        const clientUrl = new URL(client.url, self.location.origin);
        const baseOnly = new URL(baseUrl, self.location.origin);
        if (clientUrl.href.split("?")[0] === baseOnly.href && "focus" in client) {
          try {
            client.postMessage({ type: "LOG_PRAYER", prayer });
          } catch {}
          return client.focus();
        }
      }

      // Otherwise, open a new tab with a hint param
      if (self.clients.openWindow) {
        await self.clients.openWindow(urlWithParam);
      }

      // Enhanced confirmation notification
      return self.registration.showNotification("✅ Prayer Marked", {
        body: `Great job! You've completed ${prayer} prayer. May Allah accept it.`,
        icon: "/images/actions/check.svg",
        badge: "/images/achievements/achievement-badge.png",
        tag: "mark_prayed_confirmation",
        data: { url: "/profile.html", category: "achievement" }
      });
    }

    // --- ACTION: View Qibla ---
    if (action === "view_qibla") {
      const qiblaUrl = "/qibla.html";
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of clientList) {
        const clientUrl = new URL(client.url, self.location.origin);
        if (clientUrl.pathname === qiblaUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(qiblaUrl);
      }
    }

    // --- ACTION: View Prayer Times ---
    if (action === "view_times") {
      const timesUrl = "/prayer-time.html";
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of clientList) {
        const clientUrl = new URL(client.url, self.location.origin);
        if (clientUrl.pathname === timesUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(timesUrl);
      }
    }

    // --- ACTION: View Profile ---
    if (action === "view_profile") {
      const profileUrl = "/profile.html";
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of clientList) {
        const clientUrl = new URL(client.url, self.location.origin);
        if (clientUrl.pathname === profileUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(profileUrl);
      }
    }

    // --- ACTION: Prepare for Prayer ---
    if (action === "prepare") {
      return self.registration.showNotification("🧘 Prepare for Prayer", {
        body: "Take a moment to prepare your heart and mind for prayer. Find a quiet space and focus on your connection with Allah.",
        icon: "/images/actions/prepare.svg",
        tag: "prepare_reminder",
        data: { url: "/prayer-time.html" }
      });
    }

    // --- DEFAULT CLICK: open/focus app (or provided URL) ---
    const urlToOpen = data.url || "/prayer-time.html";
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const targetUrl = new URL(urlToOpen, self.location.origin).href;

    // Check if prayer-time page is already open
    for (const client of allClients) {
      const clientUrl = new URL(client.url, self.location.origin).href;
      if (clientUrl === targetUrl && "focus" in client) {
        // Page is open, focus it and play adhan
        try { 
          client.postMessage({ 
            type: "PLAY_ADHAN", 
            audioFile: data.audioFile || "/audio/adhan.mp3",
            fromNotification: true 
          }); 
        } catch {}
        return client.focus();
      }
    }

    // Page is not open, open it and play adhan
    if (self.clients.openWindow) {
      const newWindow = await self.clients.openWindow(urlToOpen);
      if (newWindow) {
        // Wait a moment for the page to load, then play adhan
        setTimeout(() => {
          try {
            newWindow.postMessage({ 
              type: "PLAY_ADHAN", 
              audioFile: data.audioFile || "/audio/adhan.mp3",
              fromNotification: true 
            });
          } catch {}
        }, 1000);
      }
      return newWindow;
    }
  })());
});

// (Optional) Basic fetch passthrough; customize if you add caching later
self.addEventListener("fetch", () => {
  // no-op: network handled by the page
});
