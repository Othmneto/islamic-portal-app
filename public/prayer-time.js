/* translator-backend/public/prayer-time-v2.js (clean + debug + fixes) */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then(() => console.log("Service Worker registered."))
    .catch((e) => console.error("SW registration failed:", e));
}

document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  console.log("DOM Loaded. Initializing prayer time script...");

  /* -----------------------------------------
   State
  ------------------------------------------*/
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const state = {
    coords: null, // { lat, lon }
    cityLabel: "",
    times: null, // { fajr, dhuhr, asr, maghrib, isha } ISO strings
    dateMeta: { gregorian: "", hijri: "" },
    countdownTimerId: null,
    pushSubscription: null,
    swRegistration: null,
    translations: {},
    settings: {
      calculationMethod: "auto",
      madhab: "auto",
      is24Hour: false,
    },
  };

  /* -----------------------------------------
   DOM
  ------------------------------------------*/
  const $ = (id) => document.getElementById(id);
  const el = {
    // layout
    loading: $("loading-message"),
    content: $("prayer-times-content"),

    // times
    fajr: $("fajr-time"),
    dhuhr: $("dhuhr-time"),
    asr: $("asr-time"),
    maghrib: $("maghrib-time"),
    isha: $("isha-time"),

    // meta
    gregorian: $("gregorian-date"),
    hijri: $("hijri-date"),
    location: $("location-display"),

    // header status
    nextPrayerName: $("next-prayer-name"),
    countdown: $("countdown-timer"),

    // settings controls
    langSel: $("language-selector"),
    notifToggle: $("notification-toggle"),
    adhanToggle: $("adhan-audio-toggle"),
    clock24Toggle: $("clock-format-toggle"),
    methodSel: $("calculation-method-select"),
    madhabSel: $("madhab-select"),

    // monthly
    monthlyBtn: $("view-monthly-btn"),
    monthlyModal: $("monthly-view-modal"),

    // audio
    adhanPlayer: $("adhan-player"),

    // per-prayer toggles
    alertFajr: $("alert-fajr"),
    alertDhuhr: $("alert-dhuhr"),
    alertAsr: $("alert-asr"),
    alertMaghrib: $("alert-maghrib"),
    alertIsha: $("alert-isha"),

    // assistant/test (optional)
    assistantModal: $("assistant-modal"),
    openAssistantBtn: $("open-assistant-btn"),
    closeAssistantBtn: $("close-assistant-btn"),
    assistantSendBtn: $("assistant-send-btn"),
    assistantInput: $("assistant-input"),
    assistantChatWindow: $("assistant-chat-window"),
    testBtn: $("test-notification-btn"),
    testPrayerBtn: $("test-prayer-notification-btn"),
  };

  /* -----------------------------------------
   Utilities
  ------------------------------------------*/
  function toast(msg, type = "info") {
    const n = document.createElement("div");
    n.textContent = msg;
    n.style.cssText =
      "position:fixed;top:20px;right:20px;padding:12px 14px;border-radius:8px;color:#fff;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.12);animation:slideIn .2s ease-out";
    n.style.background =
      type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6";
    document.body.appendChild(n);
    setTimeout(() => {
      n.style.animation = "slideOut .2s ease-in";
      setTimeout(() => n.remove(), 160);
    }, 3800);
  }
  (() => {
    const s = document.createElement("style");
    s.textContent =
      "@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}" +
      "@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}";
    document.head.appendChild(s);
  })();

  const getAuthToken = () =>
    localStorage.getItem("authToken") || localStorage.getItem("token");
  const getCsrf = () =>
    (document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/) || [])[1];

  function defaultLocationByTZ() {
    if (/Africa\/Cairo|Egypt/i.test(tz)) {
      return { lat: 30.5877, lon: 31.1813, label: "Banha, Egypt (Default)" };
    }
    return { lat: 25.2048, lon: 55.2708, label: "Dubai, UAE (Default)" };
  }

  function formatTime(dateISO, fallback = "--:--") {
    if (!dateISO) return fallback;
    const d = new Date(dateISO);
    if (isNaN(d)) return fallback;
    const lang = localStorage.getItem("language") || "en";
    const use24 = el.clock24Toggle?.checked ?? state.settings.is24Hour;
    return d.toLocaleTimeString(lang, {
      hour: "numeric",
      minute: "2-digit",
      hour12: !use24,
    });
  }

  // Accept either {timesRaw:<Adhan.PrayerTimes>} or {times:{...ISO}}
  function normalizeData(data) {
    if (!data) return null;

    if (data.timesRaw && data.timesRaw.fajr) {
      const t = data.timesRaw;
      return {
        times: {
          fajr: new Date(t.fajr).toISOString(),
          dhuhr: new Date(t.dhuhr).toISOString(),
          asr: new Date(t.asr).toISOString(),
          maghrib: new Date(t.maghrib).toISOString(),
          isha: new Date(t.isha).toISOString(),
        },
        dateMeta: {
          gregorian: data.date?.gregorian || "",
          hijri: data.date?.hijri || "",
        },
      };
    }

    const src = data.times || data;
    const keys = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    if (keys.every((k) => src && k in src)) {
      const out = {};
      keys.forEach((k) => (out[k] = new Date(src[k]).toISOString()));
      return {
        times: out,
        dateMeta: {
          gregorian: data.date?.gregorian || "",
          hijri: data.date?.hijri || "",
        },
      };
    }
    return null;
  }

  /* -----------------------------------------
   Language / i18n
  ------------------------------------------*/
  async function setLanguage(lang) {
    localStorage.setItem("language", lang);
    if (el.langSel) el.langSel.value = lang;
    try {
      const r = await fetch(`/locales/${lang}.json`);
      state.translations = r.ok ? await r.json() : {};
    } catch {
      state.translations = {};
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    translateNow();
  }
  function translateNow() {
    const t = state.translations;
    if (!t || !Object.keys(t).length) return;
    document.querySelectorAll("[data-i18n-key]").forEach((node) => {
      const k = node.getAttribute("data-i18n-key");
      if (t[k]) node.textContent = t[k];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const k = node.getAttribute("data-i18n-placeholder");
      if (t[k]) node.placeholder = t[k];
    });
  }

  /* -----------------------------------------
   Preferences (per-prayer + settings)
  ------------------------------------------*/
  function loadPerPrayer() {
    try {
      return JSON.parse(localStorage.getItem("perPrayer")) || null;
    } catch {
      return null;
    }
  }
  function defaultPerPrayer() {
    return { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };
  }
  function savePerPrayer(m) {
    localStorage.setItem("perPrayer", JSON.stringify(m));
  }
  function getPreferences(enabled) {
    const perPrayer = loadPerPrayer() || defaultPerPrayer();
    const method =
      el.methodSel?.value || state.settings.calculationMethod || "auto";
    const madhab = el.madhabSel?.value || state.settings.madhab || "auto";
    return {
      enabled,
      tz,
      perPrayer,
      method,
      madhab,
      highLatRule: "auto",
      audio: { file: "adhan.mp3", volume: 1.0 },
    };
  }

  const SettingsStore = {
    load() {
      state.settings.calculationMethod =
        localStorage.getItem("prayerMethod") || "auto";
      state.settings.madhab =
        localStorage.getItem("prayerMadhab") || "auto";
      const k1 = localStorage.getItem("is24HourFormat");
      const k2 = localStorage.getItem("clockFormat24");
      state.settings.is24Hour = k1 ? JSON.parse(k1) : k2 === "true";

      if (el.methodSel) el.methodSel.value = state.settings.calculationMethod;
      if (el.madhabSel) el.madhabSel.value = state.settings.madhab;
      if (el.clock24Toggle) el.clock24Toggle.checked = state.settings.is24Hour;
      localStorage.setItem(
        "clockFormat24",
        state.settings.is24Hour ? "true" : "false"
      );
    },
    save() {
      localStorage.setItem(
        "prayerMethod",
        state.settings.calculationMethod
      );
      localStorage.setItem("prayerMadhab", state.settings.madhab);
      localStorage.setItem(
        "is24HourFormat",
        JSON.stringify(state.settings.is24Hour)
      );
      localStorage.setItem(
        "clockFormat24",
        state.settings.is24Hour ? "true" : "false"
      );
    },
  };

  /* -----------------------------------------
   Push / SW
  ------------------------------------------*/
  function b64ToU8(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  async function registerSW() {
    if (!("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    state.swRegistration = reg;
    return reg;
  }

  async function ensureSubscribed(reg) {
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      state.pushSubscription = existing;
      return existing;
    }
    const r = await fetch("/api/notifications/vapid-public-key", {
      credentials: "include",
    });
    if (!r.ok) throw new Error("VAPID key error");
    const vapid = await r.text();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToU8(vapid),
    });
    state.pushSubscription = sub;
    return sub;
  }

  // --- DEBUG-ENHANCED ---
  async function sendSubscriptionToServer(enabled) {
    console.log(`[DEBUG] Entering sendSubscriptionToServer. Enabled: ${enabled}`);
    if (!state.pushSubscription) {
      console.error(
        "[DEBUG] CRITICAL: sendSubscriptionToServer called, but state.pushSubscription is null."
      );
      throw new Error("No subscription");
    }

    const prefs = getPreferences(enabled);
    const token = getAuthToken();
    const csrf =
      getCsrf() ||
      (await fetch("/api/auth/csrf", { credentials: "include" })
        .then(() => getCsrf())
        .catch(() => null));

    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(csrf && { "X-CSRF-Token": csrf }),
    };

    const body = {
      subscription: state.pushSubscription,
      tz,
      preferences: prefs,
      location: state.coords
        ? { lat: state.coords.lat, lon: state.coords.lon, city: state.cityLabel }
        : null,
    };

    console.log("[DEBUG] Preparing to send /api/notifications/subscribe");
    console.log("[DEBUG] Headers:", headers);
    console.log("[DEBUG] Body:", body);

    const res = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers,
      credentials: "include", // ALWAYS send cookies
      body: JSON.stringify(body),
    });

    console.log(`[DEBUG] Server responded to subscribe with status: ${res.status}`);

    if (!res.ok) {
      let msg = "Failed to save subscription";
      try {
        const j = await res.json();
        msg = j.error || j.msg || msg;
        console.error("[DEBUG] Server error payload:", j);
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    console.log("[DEBUG] Subscription saved successfully.");
  }

  // --- DEBUG-ENHANCED ---
  async function setupNotifications() {
    console.log("[DEBUG] Starting setupNotifications...");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        toast("Browser does not support push notifications", "error");
        console.warn("[DEBUG] SW/Push not supported.");
        return false;
      }
      console.log("[DEBUG] Requesting Notification permission...");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast("Enable notifications in your browser settings", "error");
        console.warn("[DEBUG] Permission denied.");
        return false;
      }
      console.log("[DEBUG] Permission granted.");
      const reg = (await registerSW()) || state.swRegistration;
      if (!reg) throw new Error("Service Worker failed");
      console.log("[DEBUG] Service Worker ready:", !!reg);
      await ensureSubscribed(reg);
      console.log("[DEBUG] Push subscription ready.");
      await sendSubscriptionToServer(true);
      localStorage.setItem("notificationsEnabled", "true");
      toast("Prayer notifications enabled", "success");
      console.log("[DEBUG] setupNotifications complete.");
      return true;
    } catch (e) {
      console.error("[DEBUG] setupNotifications error:", e);
      toast(`Failed to enable notifications: ${e.message}`, "error");
      return false;
    }
  }

  async function unsubscribePush() {
    try {
      if (state.pushSubscription) await state.pushSubscription.unsubscribe();
      const token = getAuthToken();
      const csrf = getCsrf();
      await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrf && { "X-CSRF-Token": csrf }),
        },
        credentials: "include",
        body: JSON.stringify({ endpoint: state.pushSubscription?.endpoint }),
      }).catch(() => {});
      state.pushSubscription = null;
      localStorage.setItem("notificationsEnabled", "false");
      toast("Notifications disabled", "info");
    } catch {
      toast("Could not unsubscribe", "error");
    }
  }

  async function checkNotificationStatus() {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      if (el.notifToggle) el.notifToggle.checked = false;
      return;
    }
    const sub = await reg.pushManager.getSubscription();
    if (el.notifToggle) el.notifToggle.checked = !!sub;
    if (sub) {
      state.pushSubscription = sub;
      state.swRegistration = reg;
    }
  }

  async function sendTestNotification() {
    try {
      const token = getAuthToken();
      const csrf = getCsrf();
      const r = await fetch("/api/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrf && { "X-CSRF-Token": csrf }),
        },
        credentials: "include",
        body: JSON.stringify({ tz, preferences: getPreferences(true) }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) toast("Test notification sent!", "success");
      else toast(j.error || "Failed to send test", "error");
    } catch {
      toast("Failed to send test", "error");
    }
  }

  async function sendTestPrayerNotification() {
    try {
      const token = getAuthToken();
      const csrf = getCsrf();
      let r = await fetch("/api/notifications/test-prayer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrf && { "X-CSRF-Token": csrf }),
        },
        credentials: "include",
        body: JSON.stringify({ prayer: "next", tz }),
      });
      if (r.status === 404) {
        r = await fetch("/api/notifications/test-prayer-notification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(csrf && { "X-CSRF-Token": csrf }),
          },
          credentials: "include",
        });
      }
      const j = await r.json().catch(() => ({}));
      if (r.ok) toast(j.msg || "Prayer test queued", "success");
      else toast(j.error || "Failed to queue prayer test", "error");
    } catch {
      toast("Failed to queue prayer test", "error");
    }
  }

  /* -----------------------------------------
   Prayer times (server + fallback + cache)
  ------------------------------------------*/
  function resolveAutoClient(method, madhab, tzString) {
    let m = method;
    let md = madhab;
    if (m === "auto") {
      if (/Africa\/Cairo|Egypt/i.test(tzString)) m = "Egyptian";
      else if (/Asia\/Dubai|Dubai/i.test(tzString)) m = "Dubai";
      else if (
        /Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tzString)
      )
        m = "Karachi";
      else if (/America\/|Canada|USA|US|CA/i.test(tzString)) m = "NorthAmerica";
      else m = "MuslimWorldLeague";
    }
    if (md === "auto") {
      if (
        /Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tzString)
      )
        md = "hanafi";
      else md = "shafii";
    }
    return { method: m, madhab: md };
  }

  async function fetchServerTimes(lat, lon) {
    let method = el.methodSel?.value || state.settings.calculationMethod || "auto";
    let madhab = el.madhabSel?.value || state.settings.madhab || "auto";
    ({ method, madhab } = resolveAutoClient(method, madhab, tz));

    const url =
      `/api/prayertimes?lat=${lat}&lon=${lon}` +
      `&method=${encodeURIComponent(method)}` +
      `&madhab=${encodeURIComponent(madhab)}` +
      `&tz=${encodeURIComponent(tz)}`;

    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`Server ${res.status}`);
      err.body = text;
      throw err;
    }
    return res.json();
  }

  function computeLocalTimesFallback(lat, lon) {
    if (!window.adhan) throw new Error("Local fallback requires Adhan.js");
    const methodKey =
      el.methodSel?.value || state.settings.calculationMethod || "MuslimWorldLeague";
    const method =
      methodKey === "auto"
        ? adhan.CalculationMethod.MuslimWorldLeague()
        : adhan.CalculationMethod[methodKey]?.() ||
          adhan.CalculationMethod.MuslimWorldLeague();
    const madhabKey = el.madhabSel?.value || state.settings.madhab || "shafii";
    method.madhab = madhabKey === "hanafi" ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

    const now = new Date();
    const coords = new adhan.Coordinates(lat, lon);
    const pt = new adhan.PrayerTimes(coords, now, method);
    const iso = (d) => new Date(d).toISOString();

    return {
      times: {
        fajr: iso(pt.fajr),
        dhuhr: iso(pt.dhuhr),
        asr: iso(pt.asr),
        maghrib: iso(pt.maghrib),
        isha: iso(pt.isha),
      },
      dateMeta: {
        gregorian: now.toLocaleDateString(undefined, {
          weekday: "long",
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        hijri: new Intl.DateTimeFormat("en-u-ca-islamic", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(now),
      },
    };
  }

  function cacheKey(lat, lon, date = new Date()) {
    return `prayerTimes_${lat.toFixed(2)}_${lon.toFixed(2)}_${
      date.toISOString().split("T")[0]
    }`;
  }

  async function refreshPrayerTimes(latArg, lonArg, cityArg) {
    const lat = Number.isFinite(latArg) ? latArg : state.coords?.lat;
    const lon = Number.isFinite(lonArg) ? lonArg : state.coords?.lon;
    const city = cityArg || state.cityLabel || "";

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    el.loading && (el.loading.style.display = "block");
    el.content && (el.content.style.display = "none");

    // Cache-first paint
    const key = cacheKey(lat, lon);
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const j = JSON.parse(cached);
        const norm = normalizeData(j) || j;
        applyData(norm, city);
      } catch (e) {
        console.warn("[DEBUG] Failed to parse cached data:", e);
      }
    }

    // Fresh fetch
    try {
      const data = await fetchServerTimes(lat, lon);
      const norm = normalizeData(data);
      if (!norm) throw new Error("Invalid data from server");
      applyData(norm, city);
      localStorage.setItem(
        key,
        JSON.stringify({ timesRaw: norm.times, date: norm.dateMeta })
      );
      if (el.notifToggle?.checked) {
        sendSubscriptionToServer(true).catch((e) =>
          console.warn("[DEBUG] sendSubscriptionToServer after refresh failed:", e)
        );
      }
    } catch (err) {
      console.warn(
        "Server failed; using local calculation:",
        err?.message || err
      );
      try {
        const local = computeLocalTimesFallback(lat, lon);
        applyData(local, `${city} (local calc)`);
      } catch {
        toast("Failed to load prayer times", "error");
      }
    }
  }

  /* -----------------------------------------
   UI + Countdown
  ------------------------------------------*/
  function applyData(normalized, cityLabel) {
    if (!normalized || !normalized.times) return;

    state.times = normalized.times;
    state.dateMeta = normalized.dateMeta;
    state.cityLabel = cityLabel || state.cityLabel;

    // Times
    el.fajr && (el.fajr.textContent = formatTime(state.times.fajr));
    el.dhuhr && (el.dhuhr.textContent = formatTime(state.times.dhuhr));
    el.asr && (el.asr.textContent = formatTime(state.times.asr));
    el.maghrib && (el.maghrib.textContent = formatTime(state.times.maghrib));
    el.isha && (el.isha.textContent = formatTime(state.times.isha));

    // Date / Location
    el.gregorian && (el.gregorian.textContent = state.dateMeta?.gregorian || "");
    el.hijri && (el.hijri.textContent = state.dateMeta?.hijri || "");
    el.location && (el.location.textContent = state.cityLabel || "");

    el.loading && (el.loading.style.display = "none");
    el.content && (el.content.style.display = "block");

    // Save user location (best-effort)
    saveUserLocation(state.coords?.lat, state.coords?.lon, state.cityLabel).catch(() => {});

    startCountdown();
  }

  function startCountdown() {
    if (state.countdownTimerId) clearInterval(state.countdownTimerId);
    state.countdownTimerId = setInterval(() => {
      if (!state.times) return;

      const now = new Date();
      const order = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
      let nextName = "fajr";
      let nextTime = null;

      for (const p of order) {
        const t = new Date(state.times[p]);
        if (t > now) {
          nextName = p;
          nextTime = t;
          break;
        }
      }
      if (!nextTime)
        nextTime = new Date(new Date(state.times.fajr).getTime() + 86400000);

      // Determine current prayer
      let currentName = null;
      for (let i = order.length - 1; i >= 0; i--) {
        const t = new Date(state.times[order[i]]);
        if (t < now) {
          currentName = order[i];
          break;
        }
      }
      if (nextName === "fajr" && !currentName) currentName = "isha";

      // TZ-aware day-change check
      const fmt = { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" };
      const todayTz = new Intl.DateTimeFormat("en-CA", fmt).format(now);
      const fajrDayTz = new Intl.DateTimeFormat("en-CA", fmt).format(
        new Date(state.times.fajr)
      );
      if (todayTz !== fajrDayTz) {
        console.log("Date changed (tz-aware) → refreshing prayer times.");
        refreshPrayerTimes(state.coords?.lat, state.coords?.lon, state.cityLabel);
        return;
      }

      // Highlight next/current
      document
        .querySelectorAll(".prayer-time-card")
        .forEach((c) => c.classList.remove("next-prayer"));
      const v2Card = document.querySelector(`.prayer-time-card[data-key="${nextName}"]`);
      if (v2Card) v2Card.classList.add("next-prayer");

      document.querySelectorAll(".prayer-card").forEach((card) => {
        card.classList.remove("next-prayer", "current-prayer");
        const key = card.dataset.key;
        if (key === nextName) card.classList.add("next-prayer");
        if (key === currentName) card.classList.add("current-prayer");
      });

      // Countdown text
      const diff = nextTime - now;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.nextPrayerName &&
        (el.nextPrayerName.textContent =
          nextName[0].toUpperCase() + nextName.slice(1));
      el.countdown &&
        (el.countdown.textContent = `${String(h).padStart(2, "0")}:${String(
          m
        ).padStart(2, "0")}:${String(s).padStart(2, "0")}`);

      // Local audio cue near time
      if (el.adhanToggle?.checked && diff < 800 && diff > -2000) {
        try {
          el.adhanPlayer?.play().catch(() => {});
        } catch {}
      }
    }, 1000);
  }

  /* -----------------------------------------
   Location, Monthly view, Audio check
  ------------------------------------------*/
  function findUserLocation() {
    const fallback = () => {
      const d = defaultLocationByTZ();
      state.coords = { lat: d.lat, lon: d.lon };
      state.cityLabel = d.label;
      refreshPrayerTimes(d.lat, d.lon, d.label);
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          state.coords = { lat: p.coords.latitude, lon: p.coords.longitude };
          state.cityLabel = "Your Location (Detected)";
          refreshPrayerTimes(state.coords.lat, state.coords.lon, state.cityLabel);
        },
        fallback,
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      fallback();
    }
  }

  async function saveUserLocation(lat, lon, city) {
    const token = getAuthToken();
    if (!token || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const [cityName, country] = (city || "").includes(",")
      ? city.split(",").map((s) => s.trim())
      : [city, ""];
    await fetch("/api/user/location", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify({
        city: cityName,
        country: country,
        lat: parseFloat(lat),
        lng: parseFloat(lon), // server used to expect "lng"
      }),
    }).catch(() => {});
  }

  function openMonthlyModal() {
    const modal = el.monthlyModal;
    if (!modal) return;

    if (!window.adhan) {
      modal.innerHTML =
        '<div class="modal-content"><button class="modal-close-btn">&times;</button><p>Monthly view requires Adhan.js</p></div>';
    } else {
      const lat = state.coords?.lat ?? defaultLocationByTZ().lat;
      const lon = state.coords?.lon ?? defaultLocationByTZ().lon;

      const date = new Date();
      const year = date.getFullYear();
      const month = date.getMonth();
      const days = new Date(year, month + 1, 0).getDate();

      const methodKey =
        el.methodSel?.value || state.settings.calculationMethod || "MuslimWorldLeague";
      const method =
        methodKey === "auto"
          ? adhan.CalculationMethod.MuslimWorldLeague()
          : adhan.CalculationMethod[methodKey]?.() ||
            adhan.CalculationMethod.MuslimWorldLeague();
      method.madhab =
        (el.madhabSel?.value || state.settings.madhab || "shafii") === "hanafi"
          ? adhan.Madhab.Hanafi
          : adhan.Madhab.Shafi;

      const rows = [];
      rows.push('<div class="calendar-grid">');
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d) =>
        rows.push(`<div class="calendar-day-name">${d}</div>`)
      );
      const firstDow = new Date(year, month, 1).getDay();
      for (let i = 0; i < firstDow; i++) rows.push('<div class="calendar-day empty"></div>');

      const coords = new adhan.Coordinates(lat, lon);
      for (let d = 1; d <= days; d++) {
        const pt = new adhan.PrayerTimes(coords, new Date(year, month, d), method);
        rows.push(
          `<div class="calendar-day"><div class="day-number">${d}</div><div class="fajr-time">${formatTime(
            new Date(pt.fajr).toISOString()
          )}</div></div>`
        );
      }
      rows.push("</div>");

      modal.innerHTML = `
        <div class="modal-content">
          <button class="modal-close-btn">&times;</button>
          <div class="calendar-header"><h2>${date.toLocaleString(undefined, {
            month: "long",
            year: "numeric",
          })}</h2></div>
          ${rows.join("")}
        </div>`;
    }

    modal.classList.add("active");
    modal.querySelector(".modal-close-btn").onclick = () =>
      modal.classList.remove("active");
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove("active");
    };
  }

  async function ensureAdhanAvailable() {
    const container = document.querySelector(".adhan-toggle-container");
    if (!container) return;
    try {
      const r = await fetch("/audio/adhan.mp3", {
        method: "HEAD",
        cache: "no-store",
      });
      if (!r.ok) throw new Error("not found");
      // keep controls visible
    } catch {
      container.style.display = "none";
      if (el.adhanToggle) el.adhanToggle.checked = false;
      if (el.adhanPlayer) el.adhanPlayer.removeAttribute("src");
      console.info("Adhan audio not found; hiding audio toggle.");
    }
  }

  /* -----------------------------------------
   Events
  ------------------------------------------*/
  el.notifToggle?.addEventListener("change", async (e) => {
    if (e.target.checked) {
      const ok = await setupNotifications();
      if (!ok) e.target.checked = false;
    } else {
      await unsubscribePush();
    }
  });

  ["alertFajr", "alertDhuhr", "alertAsr", "alertMaghrib", "alertIsha"].forEach(
    (k) => {
      el[k]?.addEventListener("change", async () => {
        const model = {
          fajr: !!el.alertFajr?.checked,
          dhuhr: !!el.alertDhuhr?.checked,
          asr: !!el.alertAsr?.checked,
          maghrib: !!el.alertMaghrib?.checked,
          isha: !!el.alertIsha?.checked,
        };
        savePerPrayer(model);
        if (el.notifToggle?.checked) {
          try {
            await sendSubscriptionToServer(true);
            toast("Preferences saved", "success");
          } catch {
            toast("Could not save preferences", "error");
          }
        }
      });
    }
  );

  el.clock24Toggle?.addEventListener("change", () => {
    state.settings.is24Hour = !!el.clock24Toggle.checked;
    SettingsStore.save();
    if (state.times)
      applyData({ times: state.times, dateMeta: state.dateMeta }, state.cityLabel);
  });

  el.methodSel?.addEventListener("change", () => {
    state.settings.calculationMethod = el.methodSel.value;
    SettingsStore.save();
    if (state.coords)
      refreshPrayerTimes(state.coords.lat, state.coords.lon, state.cityLabel);
    if (el.notifToggle?.checked) sendSubscriptionToServer(true).catch(() => {});
  });

  el.madhabSel?.addEventListener("change", () => {
    state.settings.madhab = el.madhabSel.value;
    SettingsStore.save();
    if (state.coords)
      refreshPrayerTimes(state.coords.lat, state.coords.lon, state.cityLabel);
    if (el.notifToggle?.checked) sendSubscriptionToServer(true).catch(() => {});
  });

  el.langSel?.addEventListener("change", (e) => setLanguage(e.target.value));
  el.monthlyBtn?.addEventListener("click", openMonthlyModal);
  el.testBtn?.addEventListener("click", sendTestNotification);
  el.testPrayerBtn?.addEventListener("click", sendTestPrayerNotification);

  el.openAssistantBtn?.addEventListener("click", () =>
    el.assistantModal?.classList.add("active")
  );
  el.closeAssistantBtn?.addEventListener("click", () =>
    el.assistantModal?.classList.remove("active")
  );
  el.assistantSendBtn?.addEventListener("click", () => {
    const input = el.assistantInput;
    if (!input || !input.value.trim()) return;
    const userDiv = document.createElement("div");
    userDiv.className = "message user";
    userDiv.textContent = input.value.trim();
    el.assistantChatWindow?.appendChild(userDiv);
    input.value = "";
  });

  /* -----------------------------------------
   Init
  ------------------------------------------*/
  SettingsStore.load();

  const initialLang =
    localStorage.getItem("language") ||
    (navigator.language.slice(0, 2) === "ar" ? "ar" : "en");
  await setLanguage(initialLang);

  const pp = loadPerPrayer() || defaultPerPrayer();
  if (el.alertFajr) el.alertFajr.checked = pp.fajr;
  if (el.alertDhuhr) el.alertDhuhr.checked = pp.dhuhr;
  if (el.alertAsr) el.alertAsr.checked = pp.asr;
  if (el.alertMaghrib) el.alertMaghrib.checked = pp.maghrib;
  if (el.alertIsha) el.alertIsha.checked = pp.isha;

  await ensureAdhanAvailable();
  await checkNotificationStatus();

  if (
    localStorage.getItem("notificationsEnabled") === "true" &&
    !el.notifToggle?.checked
  ) {
    setupNotifications().catch(() => {});
  }

  findUserLocation();

  // Public debug helpers
  window.__PrayerTimesApp = {
    refreshPrayerTimes,
    sendTestNotification,
    sendTestPrayerNotification,
    setupNotifications,
  };
});
