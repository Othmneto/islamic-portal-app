/* ------------------------------------------------------------------
   Service Worker for Prayer Times
   - Shows notifications on push
   - Broadcasts PLAY_ADHAN to open pages so they can play audio
   - Focuses or opens page on notification click
------------------------------------------------------------------- */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
      data: payload.data || { url: "/prayer-time.html" },
      tag: payload.tag || "prayer",
      renotify: !!payload.renotify,
      // Custom sounds are not supported in Web Push notifications.
      // We'll play audio inside the page via a postMessage.
    };

    // Show notification
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
  event.notification.close();
  const urlToOpen = event.notification?.data?.url || "/prayer-time.html";

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const targetUrl = new URL(urlToOpen, self.location.origin).href;

    // Try to focus an existing tab with the same path
    for (const client of allClients) {
      const clientUrl = new URL(client.url, self.location.origin).href;
      if (clientUrl === targetUrl && "focus" in client) {
        // As a fallback, ask it to play on click too
        try { client.postMessage({ type: "PLAY_ADHAN", audioFile: "/audio/adhan.mp3" }); } catch {}
        return client.focus();
      }
    }

    // Otherwise open a new tab
    if (self.clients.openWindow) {
      return self.clients.openWindow(urlToOpen);
    }
  })());
});

// (Optional) Basic fetch passthrough; customize if you add caching later
self.addEventListener("fetch", () => {
  // no-op: network handled by the page
});
