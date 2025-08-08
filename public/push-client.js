// public/push-client.js

// Renamed to 'logPush' to avoid conflicts.
const logPush = (msg, cls = '') => {
  const el = document.getElementById('log');
  if (el) {
    const p = document.createElement('div');
    if (cls) p.className = cls;
    p.textContent = `[Push] ${msg}`;
    el.prepend(p);
  }
  console.log(`[Push] ${msg}`);
};

// This relies on getCookie() being loaded from admin.js, which is already on the page.
function getLocalCookie(name) {
  const parts = document.cookie.split(';').map(s => s.trim());
  for (const p of parts) if (p.startsWith(name + '=')) return decodeURIComponent(p.slice(name.length + 1));
  return null;
}

async function sendSubscriptionToServer(subscription) {
  const csrfToken = getLocalCookie('XSRF-TOKEN');
  if (!csrfToken) {
    throw new Error('CSRF token not found. Cannot send subscription.');
  }

  const response = await fetch('/api/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include', // ESSENTIAL for sending the session cookie
    body: JSON.stringify(subscription),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ msg: response.statusText }));
    throw new Error(`Save subscription failed: ${errorData.msg || 'Unknown error'}`);
  }
  return response.json();
}

async function initPushNotifications() {
  if (!('serviceWorker' in navigator && 'PushManager' in window)) {
    logPush('Push messaging is not supported', 'warn');
    return;
  }
  
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (subscription === null) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      logPush('Notification permission was not granted.', 'warn');
      return;
    }

    const response = await fetch('/api/notifications/vapid-public-key');
    const vapidPublicKey = await response.text();
    
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey,
    });
    
    logPush('New subscription created. Sending to server...');
    await sendSubscriptionToServer(subscription);
  } else {
    logPush('User is already subscribed. Syncing with server...');
    // Good practice to re-sync on every load to catch potential server-side changes.
    await sendSubscriptionToServer(subscription);
  }
}

async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return { ok: true, message: 'User was not subscribed.' };
  }
  
  const csrfToken = getLocalCookie('XSRF-TOKEN');
  if (!csrfToken) {
    throw new Error('CSRF token not found. Cannot unsubscribe.');
  }

  await fetch('/api/unsubscribe', {
    method: 'POST',
    credentials: 'include',
    headers: { 
        'Content-Type': 'application/json', 
        'X-CSRF-Token': csrfToken 
    },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
  logPush('Successfully unsubscribed.', 'ok');
  return { ok: true, message: 'Successfully unsubscribed.' };
}

// Expose functions to be called from admin.js
window.initPushNotifications = initPushNotifications;
window.unsubscribeFromPush = unsubscribeFromPush;