// Register Service Worker for Push Notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(registration => {
    console.log('Service Worker registered successfully.');
  }).catch(error => {
    console.error('Service Worker registration failed:', error);
  });
}

// --- existing code of prayer-time.js continues below ---
document.addEventListener('DOMContentLoaded', async () => {
  // -----------------------------
  // STATE
  // -----------------------------
  let translations = {};
  let currentCoords = null;     // { lat, lon }
  let currentCityName = '';     // "City, Country"
  let countdownInterval = null;
  let searchDebounceTimeout = null;
  let serviceWorkerRegistration = null;
  let pushSubscription = null;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // -----------------------------
  // ELEMENTS
  // -----------------------------
  const $ = (id) => document.getElementById(id);
  const elements = {
    // layout
    loadingMessage: $('loading-message'),
    prayerTimesContent: $('prayer-times-content'),

    // core times
    fajrTime: $('fajr-time'),
    dhuhrTime: $('dhuhr-time'),
    asrTime: $('asr-time'),
    maghribTime: $('maghrib-time'),
    ishaTime: $('isha-time'),

    // info
    gregorianDate: $('gregorian-date'),
    hijriDate: $('hijri-date'),
    locationDisplay: $('location-display'),

    // header status
    nextPrayerName: $('next-prayer-name'),
    countdownTimer: $('countdown-timer'),

    // settings controls
    languageSelector: $('language-selector'),
    notificationToggle: $('notification-toggle'),
    adhanAudioToggle: $('adhan-audio-toggle'),
    clockFormatToggle: $('clock-format-toggle'),
    calculationMethodSelect: $('calculation-method-select'),
    madhabSelect: $('madhab-select'),

    // search
    locationSearchInput: $('location-search-input'),
    searchResultsContainer: $('search-results'),

    // monthly
    monthlyViewBtn: $('view-monthly-btn'),
    monthlyModal: $('monthly-view-modal'),

    // audio
    adhanPlayer: $('adhan-player'),

    // per-prayer toggles (NO OFFSETS)
    alertFajr: $('alert-fajr'),
    alertDhuhr: $('alert-dhuhr'),
    alertAsr: $('alert-asr'),
    alertMaghrib: $('alert-maghrib'),
    alertIsha: $('alert-isha'),

    // assistant (safe no-ops if missing)
    assistantModal: $('assistant-modal'),
    openAssistantBtn: $('open-assistant-btn'),
    closeAssistantBtn: $('close-assistant-btn'),
    assistantSendBtn: $('assistant-send-btn'),
    assistantInput: $('assistant-input'),
    assistantChatWindow: $('assistant-chat-window'),

    // tests
    testBtn: $('test-notification-btn'),
    testPrayerBtn: $('test-prayer-notification-btn'),
  };

  // -----------------------------
  // UTIL
  // -----------------------------
  function toast(msg, type = 'info') {
    const n = document.createElement('div');
    n.textContent = msg;
    n.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 14px;border-radius:8px;color:#fff;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.12)';
    n.style.background = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 4000);
  }
  const getAuthToken = () => localStorage.getItem('authToken') || localStorage.getItem('token');
  const getCsrf = () => (document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/) || [])[1];

  function formatTime(date, fallback = '--:--') {
    if (!date || isNaN(new Date(date))) return fallback;
    const use24 = elements.clockFormatToggle?.checked;
    const lang = localStorage.getItem('language') || 'en';
    return new Date(date).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit', hour12: !use24 });
  }

  // -----------------------------
  // LANGUAGE
  // -----------------------------
  async function setLanguage(lang) {
    localStorage.setItem('language', lang);
    if (elements.languageSelector) elements.languageSelector.value = lang;

    try {
      const r = await fetch(`/locales/${lang}.json`);
      translations = r.ok ? await r.json() : {};
    } catch {
      translations = {};
    }

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    translateNow();
  }

  function translateNow() {
    if (!translations || !Object.keys(translations).length) return;
    document.querySelectorAll('[data-i18n-key]').forEach((node) => {
      const k = node.getAttribute('data-i18n-key');
      if (translations[k]) node.textContent = translations[k];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      const k = node.getAttribute('data-i18n-placeholder');
      if (translations[k]) node.placeholder = translations[k];
    });
  }

  // -----------------------------
  // PREFERENCES (NO OFFSETS)
  // -----------------------------
  function loadPerPrayer() {
    try {
      return JSON.parse(localStorage.getItem('perPrayer')) || null;
    } catch {
      return null;
    }
  }
  function defaultPerPrayer() {
    return { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
  }
  function savePerPrayer(model) {
    localStorage.setItem('perPrayer', JSON.stringify(model));
  }
  function getPreferences(enabled) {
    const perPrayer = loadPerPrayer() || defaultPerPrayer();
    const method = elements.calculationMethodSelect?.value || 'auto';
    const madhab = elements.madhabSelect?.value || 'auto';
    return {
      enabled,
      tz,
      perPrayer,
      method,
      madhab,
      highLatRule: 'auto',
      audio: { file: 'adhan.mp3', volume: 1.0 } // gracefully ignored if file missing
    };
  }

  // -----------------------------
  // SERVICE WORKER / PUSH
  // -----------------------------
  function b64ToU8(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    serviceWorkerRegistration = reg;
    return reg;
  }

  async function ensureSubscribed(reg) {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      pushSubscription = existing;
      return existing;
    }
    const r = await fetch('/api/notifications/vapid-public-key');
    if (!r.ok) throw new Error('VAPID key error');
    const vapid = await r.text();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToU8(vapid)
    });
    pushSubscription = sub;
    return sub;
  }

  async function sendSubscriptionToServer(enabled) {
    if (!pushSubscription) throw new Error('No subscription');

    const prefs = getPreferences(enabled);
    const token = getAuthToken();
    const csrf =
      getCsrf() ||
      (await fetch('/api/auth/csrf', { credentials: 'include' })
        .then(() => getCsrf())
        .catch(() => null));

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(csrf && { 'X-CSRF-Token': csrf })
    };

    const body = {
      subscription: pushSubscription,
      tz,
      preferences: prefs,
      location: currentCoords
        ? { lat: currentCoords.lat, lon: currentCoords.lon, city: currentCityName }
        : null
    };

    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers,
      credentials: token ? 'omit' : 'include', // use cookies only if no bearer token
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      let msg = 'Failed to save subscription';
      try {
        const j = await res.json();
        msg = j.error || j.msg || msg;
      } catch {}
      throw new Error(msg);
    }
  }

  async function setupNotifications() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast('Browser does not support push notifications', 'error');
        return false;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast('Enable notifications in your browser settings', 'error');
        return false;
      }
      const reg = await registerSW();
      if (!reg) throw new Error('Service Worker failed');
      await ensureSubscribed(reg);
      await sendSubscriptionToServer(true);
      localStorage.setItem('notificationsEnabled', 'true');
      toast('Prayer notifications enabled', 'success');
      return true;
    } catch (e) {
      console.error(e);
      toast(`Failed to enable notifications: ${e.message}`, 'error');
      return false;
    }
  }

  async function unsubscribePush() {
    try {
      if (pushSubscription) await pushSubscription.unsubscribe();
      const token = getAuthToken();
      const csrf = getCsrf();
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrf && { 'X-CSRF-Token': csrf })
        },
        credentials: token ? 'omit' : 'include',
        body: JSON.stringify({ endpoint: pushSubscription?.endpoint })
      }).catch(() => {});
      pushSubscription = null;
      localStorage.setItem('notificationsEnabled', 'false');
      toast('Notifications disabled', 'info');
    } catch {
      toast('Could not unsubscribe', 'error');
    }
  }

  async function checkNotificationStatus() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      elements.notificationToggle.checked = false;
      return;
    }
    const sub = await reg.pushManager.getSubscription();
    elements.notificationToggle.checked = !!sub;
    if (sub) {
      pushSubscription = sub;
      serviceWorkerRegistration = reg;
    }
  }

  // -----------------------------
  // TEST ENDPOINTS
  // -----------------------------
  async function sendTestNotification() {
    try {
      const token = getAuthToken();
      const csrf = getCsrf();
      const r = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrf && { 'X-CSRF-Token': csrf })
        },
        credentials: token ? 'omit' : 'include',
        body: JSON.stringify({ tz, preferences: getPreferences(true) })
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) toast('Test notification sent!', 'success');
      else toast(j.error || 'Failed to send test', 'error');
    } catch {
      toast('Failed to send test', 'error');
    }
  }

  async function sendTestPrayerNotification() {
    try {
      const token = getAuthToken();
      const csrf = getCsrf();
      // Prefer new endpoint; fallback to legacy name if 404
      let r = await fetch('/api/notifications/test-prayer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrf && { 'X-CSRF-Token': csrf })
        },
        credentials: token ? 'omit' : 'include',
        body: JSON.stringify({ prayer: 'next', tz })
      });
      if (r.status === 404) {
        r = await fetch('/api/notifications/test-prayer-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(csrf && { 'X-CSRF-Token': csrf })
          },
          credentials: token ? 'omit' : 'include'
        });
      }
      const j = await r.json().catch(() => ({}));
      if (r.ok) toast(j.msg || 'Prayer test queued', 'success');
      else toast(j.error || 'Failed to queue prayer test', 'error');
    } catch {
      toast('Failed to queue prayer test', 'error');
    }
  }

  // -----------------------------
  // PRAYER TIMES
  // -----------------------------
  function startCountdown(times) {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      const now = new Date();
      const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

      let next = 'fajr';
      let t = null;

      for (const name of order) {
        const tt = new Date(times[name]);
        if (tt > now) {
          next = name;
          t = tt;
          break;
        }
      }
      if (!t) t = new Date(new Date(times.fajr).getTime() + 86400000); // tomorrow fajr

      // highlight
      document.querySelectorAll('.prayer-time-card').forEach((c) => c.classList.remove('next-prayer'));
      document.querySelector(`.prayer-time-card[data-key="${next}"]`)?.classList.add('next-prayer');

      // countdown
      const diff = t - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      elements.nextPrayerName.textContent = next[0].toUpperCase() + next.slice(1);
      elements.countdownTimer.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      // local audio cue (if enabled & file present)
      if (elements.adhanAudioToggle?.checked && diff < 800 && diff > -2000) {
        try { elements.adhanPlayer?.play().catch(() => {}); } catch {}
      }
    }, 1000);
  }

  function updateUI(data) {
    if (!data || !data.timesRaw) return;
    elements.fajrTime.textContent = formatTime(data.timesRaw.fajr);
    elements.dhuhrTime.textContent = formatTime(data.timesRaw.dhuhr);
    elements.asrTime.textContent = formatTime(data.timesRaw.asr);
    elements.maghribTime.textContent = formatTime(data.timesRaw.maghrib);
    elements.ishaTime.textContent = formatTime(data.timesRaw.isha);

    elements.gregorianDate.textContent = data.date?.gregorian || '';
    elements.hijriDate.textContent = data.date?.hijri || '';

    elements.loadingMessage.style.display = 'none';
    elements.prayerTimesContent.style.display = 'block';
    startCountdown(data.timesRaw);

    // Save user location to profile if logged in (server expects lng)
    saveUserLocation(currentCoords?.lat, currentCoords?.lon, currentCityName);
  }

  // Resolve "auto" on the client to avoid backend 500s until server supports it
  function resolveAutoClient(method, madhab, tz) {
    let m = method, md = madhab;
    if (m === 'auto') {
      if (/Africa\/Cairo|Egypt/i.test(tz)) m = 'Egyptian';
      else if (/Asia\/Dubai|Dubai/i.test(tz)) m = 'Dubai';
      else if (/Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tz)) m = 'Karachi';
      else if (/America\/|Canada|USA|US|CA/i.test(tz)) m = 'NorthAmerica';
      else m = 'MuslimWorldLeague';
    }
    if (md === 'auto') {
      if (/Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tz)) md = 'hanafi';
      else md = 'shafii';
    }
    return { method: m, madhab: md };
  }

  async function fetchServerTimes(lat, lon, city) {
    let method = elements.calculationMethodSelect?.value || 'auto';
    let madhab = elements.madhabSelect?.value || 'auto';
    ({ method, madhab } = resolveAutoClient(method, madhab, tz));

    const url = `/api/prayertimes?lat=${lat}&lon=${lon}` +
                `&method=${encodeURIComponent(method)}` +
                `&madhab=${encodeURIComponent(madhab)}` +
                `&tz=${encodeURIComponent(tz)}`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`Server ${res.status}`); err.body = text; throw err;
    }
    return res.json();
  }

  function computeLocalTimesFallback(lat, lon) {
    // Fallback using Adhan.js if server route fails
    if (!window.adhan) throw new Error('Local fallback requires Adhan.js');
    const methodKey = elements.calculationMethodSelect?.value || 'MuslimWorldLeague';
    const method =
      methodKey === 'auto'
        ? adhan.CalculationMethod.MuslimWorldLeague()
        : adhan.CalculationMethod[methodKey]?.() || adhan.CalculationMethod.MuslimWorldLeague();

    const madhabKey = elements.madhabSelect?.value || 'shafii';
    method.madhab = madhabKey === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

    const now = new Date();
    const coords = new adhan.Coordinates(lat, lon);
    const pt = new adhan.PrayerTimes(coords, now, method);

    const toIso = (d) => new Date(d).toISOString();

    return {
      timesRaw: {
        fajr: toIso(pt.fajr),
        dhuhr: toIso(pt.dhuhr),
        asr: toIso(pt.asr),
        maghrib: toIso(pt.maghrib),
        isha: toIso(pt.isha)
      },
      date: {
        gregorian: new Date().toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }),
        hijri: '' // left blank in fallback
      }
    };
  }

  function getPrayerTimes(lat, lon, city) {
    elements.loadingMessage.style.display = 'block';
    elements.prayerTimesContent.style.display = 'none';
    currentCoords = { lat, lon };
    currentCityName = city;

    return fetchServerTimes(lat, lon, city)
      .then((data) => {
        elements.locationDisplay.textContent = city;
        updateUI(data);

        // If notifications are enabled, resync subscription with new location
        if (elements.notificationToggle?.checked) {
          sendSubscriptionToServer(true).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('Server prayertimes failed; falling back to local calc:', err?.message || err);
        try {
          const data = computeLocalTimesFallback(lat, lon);
          elements.locationDisplay.textContent = `${city} (local calc)`;
          updateUI(data);
        } catch {
          toast('Failed to load prayer times', 'error');
        }
      });
  }

  function findUserLocation() {
    const fallback = () => getPrayerTimes(25.2048, 55.2708, 'Dubai, UAE (Default)');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => getPrayerTimes(p.coords.latitude, p.coords.longitude, 'Your Location (Detected)'),
        fallback,
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      fallback();
    }
  }

  async function saveUserLocation(lat, lon, city) {
    try {
      const token = getAuthToken();
      if (!token || !Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const [cityName, country] = (city || '').includes(',') ? city.split(',').map((s) => s.trim()) : [city, ''];

      await fetch('/api/user/location', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          city: cityName,
          country: country,
          lat: parseFloat(lat),
          lng: parseFloat(lon) // NOTE: server used to expect "lng"
        })
      });
    } catch (e) {
      // silent — best-effort
    }
  }

  // -----------------------------
  // MONTHLY VIEW (mini)
  // -----------------------------
  function openMonthlyModal() {
    const modal = elements.monthlyModal;
    if (!modal) return;

    if (!window.adhan) {
      modal.innerHTML =
        '<div class="modal-content"><button class="modal-close-btn">&times;</button><p>Monthly view requires Adhan.js</p></div>';
    } else {
      const lat = currentCoords?.lat ?? 25.2048;
      const lon = currentCoords?.lon ?? 55.2708;

      const date = new Date();
      const year = date.getFullYear();
      const month = date.getMonth();
      const days = new Date(year, month + 1, 0).getDate();

      const methodKey = elements.calculationMethodSelect?.value || 'MuslimWorldLeague';
      const method =
        methodKey === 'auto'
          ? adhan.CalculationMethod.MuslimWorldLeague()
          : adhan.CalculationMethod[methodKey]?.() || adhan.CalculationMethod.MuslimWorldLeague();
      method.madhab = (elements.madhabSelect?.value || 'shafii') === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

      const rows = [];
      rows.push('<div class="calendar-grid">');
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d) =>
        rows.push(`<div class="calendar-day-name">${d}</div>`)
      );
      const firstDow = new Date(year, month, 1).getDay();
      for (let i = 0; i < firstDow; i++) rows.push('<div class="calendar-day empty"></div>');

      const coords = new adhan.Coordinates(lat, lon);
      for (let d = 1; d <= days; d++) {
        const pt = new adhan.PrayerTimes(coords, new Date(year, month, d), method);
        rows.push(
          `<div class="calendar-day"><div class="day-number">${d}</div><div class="fajr-time">${formatTime(
            pt.fajr
          )}</div></div>`
        );
      }
      rows.push('</div>');

      modal.innerHTML = `
        <div class="modal-content">
          <button class="modal-close-btn">&times;</button>
          <div class="calendar-header"><h2>${date.toLocaleString(undefined, {
            month: 'long',
            year: 'numeric'
          })}</h2></div>
          ${rows.join('')}
        </div>`;
    }

    modal.classList.add('active');
    modal.querySelector('.modal-close-btn').onclick = () => modal.classList.remove('active');
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('active');
    };
  }

  // -----------------------------
  // AUDIO: hide controls if /audio/adhan.mp3 is missing
  // -----------------------------
  async function ensureAdhanAvailable() {
    const container = document.querySelector('.adhan-toggle-container');
    if (!container) return;
    try {
      const r = await fetch('/audio/adhan.mp3', { method: 'HEAD', cache: 'no-store' });
      if (!r.ok) throw new Error('not found');
      // file exists -> keep controls visible
    } catch {
      container.style.display = 'none';
      if (elements.adhanAudioToggle) elements.adhanAudioToggle.checked = false;
      if (elements.adhanPlayer) elements.adhanPlayer.removeAttribute('src');
      console.info('Adhan audio not found; hiding audio toggle.');
    }
  }

  // -----------------------------
  // EVENTS
  // -----------------------------
  elements.notificationToggle?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      const ok = await setupNotifications();
      if (!ok) e.target.checked = false;
    } else {
      await unsubscribePush();
    }
  });

  // per-prayer toggles → save & (if subscribed) sync to server
  ['alertFajr', 'alertDhuhr', 'alertAsr', 'alertMaghrib', 'alertIsha'].forEach((k) => {
    elements[k]?.addEventListener('change', async () => {
      const model = {
        fajr: !!elements.alertFajr?.checked,
        dhuhr: !!elements.alertDhuhr?.checked,
        asr: !!elements.alertAsr?.checked,
        maghrib: !!elements.alertMaghrib?.checked,
        isha: !!elements.alertIsha?.checked
      };
      savePerPrayer(model);
      if (elements.notificationToggle?.checked) {
        try {
          await sendSubscriptionToServer(true);
          toast('Preferences saved', 'success');
        } catch {
          toast('Could not save preferences', 'error');
        }
      }
    });
  });

  elements.clockFormatToggle?.addEventListener('change', () => {
    localStorage.setItem('clockFormat24', elements.clockFormatToggle.checked);
    if (currentCoords) getPrayerTimes(currentCoords.lat, currentCoords.lon, currentCityName);
  });

  elements.calculationMethodSelect?.addEventListener('change', () => {
    if (currentCoords) getPrayerTimes(currentCoords.lat, currentCoords.lon, currentCityName);
    if (elements.notificationToggle?.checked) sendSubscriptionToServer(true).catch(() => {});
  });

  elements.madhabSelect?.addEventListener('change', () => {
    if (currentCoords) getPrayerTimes(currentCoords.lat, currentCoords.lon, currentCityName);
    if (elements.notificationToggle?.checked) sendSubscriptionToServer(true).catch(() => {});
  });

  elements.languageSelector?.addEventListener('change', (e) => setLanguage(e.target.value));
  elements.monthlyViewBtn?.addEventListener('click', openMonthlyModal);
  elements.testBtn?.addEventListener('click', sendTestNotification);
  elements.testPrayerBtn?.addEventListener('click', sendTestPrayerNotification);

  elements.openAssistantBtn?.addEventListener('click', () => elements.assistantModal?.classList.add('active'));
  elements.closeAssistantBtn?.addEventListener('click', () => elements.assistantModal?.classList.remove('active'));
  elements.assistantSendBtn?.addEventListener('click', () => {
    const input = elements.assistantInput;
    if (!input || !input.value.trim()) return;
    const userDiv = document.createElement('div');
    userDiv.className = 'message user';
    userDiv.textContent = input.value.trim();
    elements.assistantChatWindow?.appendChild(userDiv);
    input.value = '';
  });

  // -----------------------------
  // INIT
  // -----------------------------
  // toast animations
  (() => {
    const s = document.createElement('style');
    s.textContent =
      '@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}';
    document.head.appendChild(s);
  })();

  const initialLang = localStorage.getItem('language') || (navigator.language.slice(0, 2) === 'ar' ? 'ar' : 'en');
  await setLanguage(initialLang);

  // hydrate per-prayer toggles
  const pp = loadPerPrayer() || defaultPerPrayer();
  if (elements.alertFajr) elements.alertFajr.checked = pp.fajr;
  if (elements.alertDhuhr) elements.alertDhuhr.checked = pp.dhuhr;
  if (elements.alertAsr) elements.alertAsr.checked = pp.asr;
  if (elements.alertMaghrib) elements.alertMaghrib.checked = pp.maghrib;
  if (elements.alertIsha) elements.alertIsha.checked = pp.isha;

  // 24h saved
  const savedClock = localStorage.getItem('clockFormat24') === 'true';
  if (elements.clockFormatToggle) elements.clockFormatToggle.checked = savedClock;

  await ensureAdhanAvailable();           // <— hide audio UI if file is missing
  await checkNotificationStatus();

  // If user had notifications on but sub is gone, re-enable
  if (localStorage.getItem('notificationsEnabled') === 'true' && !elements.notificationToggle.checked) {
    setupNotifications().catch(() => {});
  }

  // get initial location & times
  findUserLocation();
});