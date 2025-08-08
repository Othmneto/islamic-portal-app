// public/admin.js

// Renamed to 'logAdmin' to avoid conflicts with other scripts.
const logAdmin = (msg, cls = '') => {
  const el = document.getElementById('log');
  const p = document.createElement('div');
  if (cls) p.className = cls;
  p.textContent = msg;
  el.prepend(p);
  console.log(`[Admin] ${msg}`);
};
const $ = (id) => document.getElementById(id);

function getCookie(name) {
  const parts = document.cookie.split(';').map(s => s.trim());
  for (const p of parts) if (p.startsWith(name + '=')) return decodeURIComponent(p.slice(name.length + 1));
  return null;
}

async function ensureCsrfToken() {
  let t = getCookie('XSRF-TOKEN');
  if (t) return t;
  try {
    const res = await fetch('/api/auth/csrf', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    return data?.csrfToken || getCookie('XSRF-TOKEN');
  } catch {
    return null;
  }
}

async function checkStatuses() {
  // SW
  if (!('serviceWorker' in navigator)) {
    $('swStatus').textContent = 'unsupported ❌';
  } else {
    const reg = await navigator.serviceWorker.getRegistration('/');
    $('swStatus').textContent = reg ? 'registered ✅' : 'not registered ❌';
  }

  // Subscription
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg || !reg.pushManager) {
      $('subStatus').textContent = 'unavailable ❌';
    } else {
      const sub = await reg.pushManager.getSubscription();
      $('subStatus').textContent = sub ? 'active ✅' : 'not subscribed ❌';
    }
  } catch (e) {
    $('subStatus').textContent = 'error ❌';
    logAdmin('Subscription check failed: ' + e.message, 'err');
  }
}

async function subscribeNow() {
  if (typeof window.initPushNotifications === 'function') {
    try { await window.initPushNotifications(); } catch (e) { logAdmin('Init failed: ' + e.message, 'err'); }
  } else {
    logAdmin('push-client.js not loaded or init not exposed.', 'err');
  }
  await checkStatuses();
  await listSubs();
}

async function unsubscribeNow() {
  try {
    const res = await (window.unsubscribeFromPush && window.unsubscribeFromPush());
    logAdmin(res?.message || 'Unsubscribe attempted.', res?.ok ? 'ok' : 'warn');
  } catch (e) {
    logAdmin('Unsubscribe failed: ' + e.message, 'err');
  }
  await checkStatuses();
  await listSubs();
}

async function sendTest() {
  const csrf = await ensureCsrfToken();
  if (!csrf) { logAdmin('No CSRF token. Cannot send test.', 'err'); return; }

  try {
    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrf }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || res.statusText);
    logAdmin('Queued test notification: ' + JSON.stringify(data), 'ok');
  } catch (e) {
    logAdmin('Test push failed: ' + e.message, 'err');
  }
}

async function listSubs() {
  try {
    const res = await fetch('/api/notifications/list', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || res.statusText);

    const lines = (data.subscriptions || []).map((s, i) =>
      `${i+1}. endpoint: ${s.endpoint.slice(0, 40)}...\n   updatedAt: ${new Date(s.updatedAt).toLocaleString()}`
    );
    $('subs').textContent = lines.length ? lines.join('\n') : 'No subscriptions found.';
  } catch (e) {
    $('subs').textContent = 'Failed to list subscriptions: ' + e.message;
  }
}

document.getElementById('btnSubscribe').onclick = subscribeNow;
document.getElementById('btnUnsub').onclick = unsubscribeNow;
document.getElementById('btnTest').onclick = sendTest;
document.getElementById('btnList').onclick = listSubs;

(async () => {
  await ensureCsrfToken();
  await checkStatuses();
  await listSubs();
})();