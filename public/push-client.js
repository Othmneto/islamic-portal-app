// public/push-client.js
// UMD-style wrapper to avoid 'export' errors and expose functions globally.

(function () {
  function logPush(msg, level = 'log') {
    const fn = console[level] || console.log;
    fn(`[push] ${msg}`);
  }

  // Base64URL → Uint8Array for PushManager.subscribe()
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([$()*+./?[\\\]^{|}])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  async function sendSubscriptionToServer(subscription, preferences = null) {
    const csrf = getCookie('XSRF-TOKEN'); // header name can be any case; server reads x-csrf-token
    const body = preferences ? { subscription, preferences } : { subscription };

    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Subscribe failed: ${res.status} ${txt}`);
    }
  }

  async function initPushNotifications(preferences = null) {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      logPush('Push messaging is not supported', 'warn');
      return;
    }
    const registration = await navigator.serviceWorker.ready;

    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        logPush('Notifications permission not granted.', 'warn');
        return;
      }
      const res = await fetch('/api/notifications/vapid-public-key', { credentials: 'include' });
      const vapidPublicKey = (await res.text()).trim();

      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      logPush('New subscription created. Sending to server...');
      await sendSubscriptionToServer(sub, preferences);
      logPush('Subscription saved.');
    } else {
      logPush('Existing subscription found. Syncing to server...');
      await sendSubscriptionToServer(sub, preferences);
    }
  }

  async function unsubscribePush() {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (!sub) return;

    const csrf = getCookie('XSRF-TOKEN');
    await fetch('/api/notifications/unsubscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });

    await sub.unsubscribe();
    logPush('Unsubscribed.');
  }

  // Expose for other pages if needed.
  // The login script looks for `window.initPushNotifications` directly for back-compat.
  window.initPushNotifications = initPushNotifications;
  window.PushClient = { initPushNotifications, unsubscribePush };
})();