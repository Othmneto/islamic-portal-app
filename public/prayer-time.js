/* ------------------------------------------------------------------
   Prayer Times Page Script
   - Registers Service Worker and handles PLAY_ADHAN messages
   - Location search (backend-first geocoding + Nominatim fallback)
   - Fetches prayer times (server with local Adhan.js fallback)
   - Push subscription management (sends preferences to backend)
   - Countdown + UI updates + optional test buttons
------------------------------------------------------------------- */

(() => {
  // Service Worker registration is now handled inside init()

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    "use strict";

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    const state = {
      tz,
      coords: null,         // { lat, lon }
      cityLabel: "",
      times: null,          // { fajr, dhuhr, asr, maghrib, isha } ISO
      dateMeta: { gregorian: "", hijri: "" },
      countdownTimerId: null,
      pushSubscription: null,
      swRegistration: null,
      translations: {},
      settings: { calculationMethod: "auto", madhab: "auto", is24Hour: false },
    };

    const $ = (id) => document.getElementById(id);
    const el = {
      // Shell
      loading: $("loading-message"),
      content: $("prayer-times-content"),

      // Times
      fajr: $("fajr-time"),
      dhuhr: $("dhuhr-time"),
      asr: $("asr-time"),
      maghrib: $("maghrib-time"),
      isha: $("isha-time"),

      // Meta
      gregorian: $("gregorian-date"),
      hijri: $("hijri-date"),
      location: $("location-display"),

      // Header widgets
      nextPrayerName: $("next-prayer-name"),
      countdown: $("countdown-timer"),

      // Settings
      langSel: $("language-selector"),
      methodSel: $("calculation-method-select"),
      madhabSel: $("madhab-select"),
      clock24Toggle: $("clock-format-toggle"),
      notifToggle: $("notification-toggle"),
      adhanToggle: $("adhan-audio-toggle"),

      // Monthly modal
      monthlyBtn: $("view-monthly-btn"),
      monthlyModal: $("monthly-view-modal"),

      // Audio element
      adhanPlayer: $("adhan-player"),

      // Per-prayer toggles
      alertFajr: $("alert-fajr"),
      alertDhuhr: $("alert-dhuhr"),
      alertAsr: $("alert-asr"),
      alertMaghrib: $("alert-maghrib"),
      alertIsha: $("alert-isha"),

      // Assistant + test buttons
      assistantModal: $("assistant-modal"),
      openAssistantBtn: $("open-assistant-btn"),
      closeAssistantBtn: $("close-assistant-btn"),
      assistantSendBtn: $("assistant-send-btn"),
      assistantInput: $("assistant-input"),
      assistantChatWindow: $("assistant-chat-window"),
      testBtn: $("test-notification-btn"),
      testPrayerBtn: $("test-prayer-notification-btn"),

      // Location search
      locInput: $("location-search-input"),
      locResults: $("search-results"),
    };

    /* -------------------- tiny helpers -------------------- */
    function toast(msg, type = "info") {
      const n = document.createElement("div");
      n.textContent = msg;
      n.style.cssText =
        "position:fixed;top:20px;right:20px;padding:12px 14px;border-radius:10px;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.12);animation:slideIn .2s ease-out;z-index:99999";
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

    const debounce = (fn, ms = 300) => {
      let t;
      return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
      };
    };

    /* -------------------- audio -------------------- */
    function playAdhan(src) {
      try {
        if (!el.adhanPlayer) return;
        const enabled = el.adhanToggle?.checked ?? true;
        localStorage.setItem("adhanEnabled", enabled ? "true" : "false");
        if (!enabled) return;

        if (src && el.adhanPlayer.getAttribute("src") !== src) {
          el.adhanPlayer.setAttribute("src", src);
          el.adhanPlayer.load();
        }
        el.adhanPlayer.volume = 1.0;
        el.adhanPlayer.play().catch((e) => {
          console.debug("[Audio] Play blocked:", e?.message || e);
        });
      } catch (e) {
        console.warn("[Audio] Failed to play adhan:", e);
      }
    }

    // 🔓 One-time audio unlock on first click (let future programmatic play() succeed)
    document.addEventListener("click", unlockAudioOnce, { once: true });
    function unlockAudioOnce() {
      if (!el.adhanPlayer) return;
      try {
        el.adhanPlayer.muted = true;
        el.adhanPlayer.play().then(() => {
          el.adhanPlayer.pause();
          el.adhanPlayer.currentTime = 0;
          el.adhanPlayer.muted = false;
          console.log("[Audio] Unlocked by user gesture.");
        }).catch(() => {});
      } catch {}
    }

    /* --- ✅ Service Worker registration + message bridge (inside init) --- */
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        state.swRegistration = reg;
        console.log("[SW] Registered");
      } catch (e) {
        console.error("[SW] Registration failed:", e);
      }

      navigator.serviceWorker.addEventListener("message", (evt) => {
        if (evt.data?.type === "PLAY_ADHAN") {
          playAdhan(evt.data.audioFile || "/audio/adhan.mp3");
        }
      });
    }

    /* -------------------- language / i18n -------------------- */
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

    /* -------------------- settings store -------------------- */
    const SettingsStore = {
      load() {
        state.settings.calculationMethod =
          localStorage.getItem("prayerMethod") || "auto";
        state.settings.madhab =
          localStorage.getItem("prayerMadhab") || "auto";
        state.settings.is24Hour =
          JSON.parse(localStorage.getItem("is24HourFormat") || "false");

        if (el.methodSel) el.methodSel.value = state.settings.calculationMethod;
        if (el.madhabSel) el.madhabSel.value = state.settings.madhab;
        if (el.clock24Toggle) el.clock24Toggle.checked = state.settings.is24Hour;

        if (el.adhanToggle) {
          const saved = localStorage.getItem("adhanEnabled");
          el.adhanToggle.checked = saved === null ? true : saved === "true";
        }

        localStorage.setItem(
          "clockFormat24",
          state.settings.is24Hour ? "true" : "false"
        );
      },
      save() {
        localStorage.setItem("prayerMethod", state.settings.calculationMethod);
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

    /* -------------------- geocoding (backend-first) -------------------- */
    async function geocodeSearch(q) {
      const lang =
        (localStorage.getItem("language") ||
          document.documentElement.lang ||
          "en")
          .split("-")[0];

      // Try backend first
      try {
        const r = await fetch(
          `/api/geocode?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`,
          { headers: { Accept: "application/json" }, credentials: "include" }
        );
        if (r.ok) {
          const j = await r.json();
          if (Array.isArray(j) && j.length) return j;
          if (Array.isArray(j.results)) return j.results;
        }
      } catch {
        /* ignore and fallback */
      }

      // Fallback to Nominatim
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(
        q
      )}&accept-language=${encodeURIComponent(lang)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const list = await res.json();
      return Array.isArray(list) ? list : [];
    }

    function renderSearchResults(items) {
      const box = el.locResults;
      if (!box) return;
      if (!items.length) {
        box.innerHTML = "";
        box.style.display = "none";
        return;
      }
      box.innerHTML = items
        .map((it, idx) => {
          const lat = it.lat ?? it.latitude;
          const lon = it.lon ?? it.longitude;
          const label = it.display_name || it.label || `${lat}, ${lon}`;
          return `<div class="search-result-item" data-idx="${idx}" role="option" tabindex="0">${label}</div>`;
        })
        .join("");
      box.style.display = "block";
      box.querySelectorAll(".search-result-item").forEach((node) => {
        node.addEventListener("click", () =>
          applyResult(items[Number(node.dataset.idx)])
        );
        node.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ")
            applyResult(items[Number(node.dataset.idx)]);
        });
      });
    }

    function applyResult(it) {
      const lat = parseFloat(it.lat ?? it.latitude);
      const lon = parseFloat(it.lon ?? it.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const label = it.display_name || it.label || "Selected location";
      state.coords = { lat, lon };
      state.cityLabel = label;
      localStorage.setItem("lastLocation", JSON.stringify({ lat, lon, label }));
      if (el.locInput) el.locInput.value = label;
      if (el.locResults) el.locResults.style.display = "none";
      refreshPrayerTimes(lat, lon, label);
    }

    function setupLocationSearch() {
      if (!el.locInput) return;
      const run = debounce(async () => {
        const q = el.locInput.value.trim();
        if (q.length < 2) {
          renderSearchResults([]);
          return;
        }
        try {
          const res = await geocodeSearch(q);
          renderSearchResults(res);
        } catch (e) {
          console.warn("[Geocode] error:", e?.message || e);
          renderSearchResults([]);
        }
      }, 350);
      el.locInput.addEventListener("input", run);
      document.addEventListener("click", (e) => {
        if (!el.locResults) return;
        if (!el.locResults.contains(e.target) && e.target !== el.locInput)
          el.locResults.style.display = "none";
      });
    }

    /* -------------------- prayer times helpers -------------------- */
    function defaultLocationByTZ() {
      if (/Africa\/Cairo|Egypt/i.test(state.tz)) {
        return { lat: 30.5877, lon: 31.1813, label: "Banha, Egypt (Default)" };
      }
      return { lat: 25.2048, lon: 55.2708, label: "Dubai, UAE (Default)" };
    }

    function formatTime(dateISO, fallback = "--:--") {
      if (!dateISO) return fallback;
      const d = new Date(dateISO);
      if (isNaN(d)) return fallback;
      const use24 =
        !!(el.clock24Toggle?.checked ||
        localStorage.getItem("clockFormat24") === "true");
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: !use24,
      });
    }

    function normalizeData(data) {
      if (!data) return null;

      if (data.timesRaw?.fajr) {
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
        return {
          times: {
            fajr: src.fajr,
            dhuhr: src.dhuhr,
            asr: src.asr,
            maghrib: src.maghrib,
            isha: src.isha,
          },
          dateMeta: data.date || { gregorian: "", hijri: "" },
        };
      }
      return null;
    }

    function resolveAutoClient(method, madhab, tzString) {
      let m = method;
      let md = madhab;
      if (m === "auto") {
        if (/Africa\/Cairo|Egypt/i.test(tzString)) m = "Egyptian";
        else if (/Asia\/Dubai|Dubai/i.test(tzString)) m = "Dubai";
        else if (/Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tzString))
          m = "Karachi";
        else if (/America\/|Canada|USA|US|CA/i.test(tzString)) m = "NorthAmerica";
        else m = "MuslimWorldLeague";
      }
      if (md === "auto") {
        md = /Asia\/(Karachi|Kolkata|Dhaka)|Pakistan|India|Bangladesh/i.test(tzString)
          ? "hanafi"
          : "shafii";
      }
      return { method: m, madhab: md };
    }

    async function fetchServerTimes(lat, lon) {
      const { method, madhab } = resolveAutoClient(
        el.methodSel?.value || "auto",
        el.madhabSel?.value || "auto",
        state.tz
      );

      const url =
        `/api/prayertimes?lat=${lat}&lon=${lon}` +
        `&method=${encodeURIComponent(method)}` +
        `&madhab=${encodeURIComponent(madhab)}` +
        `&tz=${encodeURIComponent(state.tz)}`;

      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 15000);
      const res = await fetch(url, { credentials: "include", signal: ac.signal });
      clearTimeout(to);
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
      method.madhab =
        madhabKey === "hanafi" ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

      const now = new Date();
      const coords = new adhan.Coordinates(lat, lon);
      const pt = new adhan.PrayerTimes(coords, now, method);
      const iso = (d) => new Date(d).toISOString();

      return {
        timesRaw: {
          fajr: pt.fajr,
          dhuhr: pt.dhuhr,
          asr: pt.asr,
          maghrib: pt.maghrib,
          isha: pt.isha,
        },
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
      let city = cityArg || state.cityLabel || "";
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      // Paint from cache first
      const key = cacheKey(lat, lon);
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const j = JSON.parse(cached);
          const norm = normalizeData(j) || j;
          applyData(norm, city);
        } catch (e) {
          console.warn("[Cache] parse failed:", e);
        }
      }

      // Fresh fetch from server with fallback
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
          sendSubscriptionToServer(true).catch(() => {});
        }
      } catch (err) {
        console.warn("[Times] server failed; using local calc:", err?.message || err);
        try {
          const local = computeLocalTimesFallback(lat, lon);
          applyData(normalizeData(local), city);
          localStorage.setItem(key, JSON.stringify(local));
        } catch (e) {
          toast("Failed to compute prayer times", "error");
          console.error("[Times] local compute failed:", e);
        }
      }
    }

    async function saveUserLocation(lat, lon, city) {
      const token = getAuthToken();
      if (!token || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const [cityName, country] =
        (city || "").includes(",") ? city.split(",").map((s) => s.trim()) : [city, ""];
      await fetch("/api/user/location", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          city: cityName,
          country,
          lat: parseFloat(lat),
          lng: parseFloat(lon),
        }),
      }).catch(() => {});
    }

    function applyData(normalized, cityLabel) {
      if (!normalized || !normalized.times) return;

      state.times = normalized.times;
      state.dateMeta = normalized.dateMeta;
      state.cityLabel = cityLabel || state.cityLabel;

      // Times
      if (el.fajr) el.fajr.textContent = formatTime(state.times.fajr);
      if (el.dhuhr) el.dhuhr.textContent = formatTime(state.times.dhuhr);
      if (el.asr) el.asr.textContent = formatTime(state.times.asr);
      if (el.maghrib) el.maghrib.textContent = formatTime(state.times.maghrib);
      if (el.isha) el.isha.textContent = formatTime(state.times.isha);

      // Meta
      if (el.gregorian) el.gregorian.textContent = state.dateMeta?.gregorian || "";
      if (el.hijri) el.hijri.textContent = state.dateMeta?.hijri || "";
      if (el.location) el.location.textContent = state.cityLabel || "";

      // Show app
      if (el.loading) el.loading.style.display = "none";
      if (el.content) el.content.style.display = "block";

      // Persist user location (best-effort) + local cache
      saveUserLocation(state.coords?.lat, state.coords?.lon, state.cityLabel).catch(() => {});
      if (Number.isFinite(state.coords?.lat) && Number.isFinite(state.coords?.lon)) {
        localStorage.setItem(
          "lastLocation",
          JSON.stringify({ lat: state.coords.lat, lon: state.coords.lon, label: state.cityLabel })
        );
      }

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
        if (!nextTime) {
          // Move to tomorrow's fajr
          nextTime = new Date(new Date(state.times.fajr).getTime() + 86400000);
        }

        // Current prayer
        let currentName = null;
        for (let i = order.length - 1; i >= 0; i--) {
          const t = new Date(state.times[order[i]]);
          if (t < now) {
            currentName = order[i];
            break;
          }
        }
        if (nextName === "fajr" && !currentName) currentName = "isha";

        // tz-aware date rollover → refresh
        const fmt = { timeZone: state.tz, year: "numeric", month: "2-digit", day: "2-digit" };
        const todayTz = new Intl.DateTimeFormat("en-CA", fmt).format(now);
        const fajrDayTz = new Intl.DateTimeFormat("en-CA", fmt).format(new Date(state.times.fajr));
        if (todayTz !== fajrDayTz) {
          refreshPrayerTimes(state.coords?.lat, state.coords?.lon, state.cityLabel);
          return;
        }

        // UI highlights
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
        if (el.nextPrayerName)
          el.nextPrayerName.textContent =
            nextName.charAt(0).toUpperCase() + nextName.slice(1);
        if (el.countdown)
          el.countdown.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(
            2,
            "0"
          )}:${String(s).padStart(2, "0")}`;

        // Local audio cue if page open & toggle enabled
        if (el.adhanToggle?.checked && diff < 800 && diff > -2000) {
          playAdhan("/audio/adhan.mp3");
        }
      }, 1000);
    }

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
          () => fallback(),
          { enableHighAccuracy: false, maximumAge: 600000, timeout: 8000 }
        );
      } else fallback();
    }

    /* -------------------- push subscription -------------------- */
    function b64ToU8(base64String) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const rawData = atob(base64);
      const out = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
      return out;
    }

    async function registerSW() {
      if (state.swRegistration) return state.swRegistration;
      if (!("serviceWorker" in navigator)) return null;
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      state.swRegistration = reg;
      return reg;
    }

    async function ensureSubscribed(reg) {
      if (!reg) throw new Error("Service worker registration is missing.");
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

    const getAuthToken = () =>
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("access_token");

    const getCsrf = () =>
      (document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/) || [])[1];

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
      const method = el.methodSel?.value || state.settings.calculationMethod || "auto";
      const madhab = el.madhabSel?.value || state.settings.madhab || "auto";
      return {
        enabled,
        tz: state.tz,
        perPrayer,
        method,
        madhab,
        highLatRule: "auto",
        audio: { file: "adhan.mp3", volume: 1.0 },
      };
    }

    async function sendSubscriptionToServer(enabled) {
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
        tz: state.tz,
        preferences: prefs,
        location: state.coords
          ? { lat: state.coords.lat, lon: state.coords.lon, city: state.cityLabel }
          : null,
      };

      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `Subscribe failed (${res.status})`;
        try {
          const j = await res.json();
          msg = j.error || j.message || msg;
        } catch {}
        throw new Error(msg);
      }
    }

    async function setupNotifications() {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          toast("Browser does not support push notifications", "error");
          return false;
        }
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          toast("Enable notifications in your browser settings", "error");
          return false;
        }
        const reg = (await registerSW()) || state.swRegistration;
        if (!reg) throw new Error("Service Worker failed");
        await ensureSubscribed(reg);
        await sendSubscriptionToServer(true);
        localStorage.setItem("notificationsEnabled", "true");
        toast("Prayer notifications enabled", "success");
        return true;
      } catch (e) {
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
        toast("Notifications disabled", "success");
      } catch (e) {
        toast("Failed to disable notifications", "error");
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
          body: JSON.stringify({ tz: state.tz }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) toast(j.msg || "Test notification queued", "success");
        else toast(j.error || "Failed to queue test notification", "error");
      } catch {
        toast("Failed to queue test notification", "error");
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
          body: JSON.stringify({ prayer: "next", tz: state.tz }),
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

    /* -------------------- events -------------------- */
    el.notifToggle?.addEventListener("change", async (e) => {
      if (e.target.checked) {
        const ok = await setupNotifications();
        if (!ok) e.target.checked = false;
      } else {
        await unsubscribePush();
      }
    });

    ["alertFajr", "alertDhuhr", "alertAsr", "alertMaghrib", "alertIsha"].forEach((k) => {
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
          try { await sendSubscriptionToServer(true); } catch {}
        }
      });
    });

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

    el.openAssistantBtn?.addEventListener("click", () => {
      el.assistantModal?.classList.add("active");
      el.assistantModal?.setAttribute("aria-hidden", "false");
      document.body.setAttribute("inert", ""); // prevent focus bleed
    });
    el.closeAssistantBtn?.addEventListener("click", () => {
      el.assistantModal?.classList.remove("active");
      el.assistantModal?.setAttribute("aria-hidden", "true");
      document.body.removeAttribute("inert");
    });
    el.assistantSendBtn?.addEventListener("click", () => {
      const input = el.assistantInput;
      if (!input || !input.value.trim()) return;
      const userDiv = document.createElement("div");
      userDiv.className = "message user";
      userDiv.textContent = input.value.trim();
      el.assistantChatWindow?.appendChild(userDiv);
      input.value = "";
    });

    /* -------------------- monthly modal (lightweight + ARIA) -------------------- */
    function openMonthlyModal() {
      const modal = el.monthlyModal;
      if (!modal) return;

      if (!window.adhan || !Number.isFinite(state.coords?.lat)) {
        modal.innerHTML =
          `<div class="modal-content">
             <button class="modal-close-btn">&times;</button>
             <p>Monthly view requires Adhan.js and a selected location.</p>
           </div>`;
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.setAttribute("inert", "");
        const close = () => {
          modal.classList.remove("active");
          modal.setAttribute("aria-hidden", "true");
          document.body.removeAttribute("inert");
        };
        modal.querySelector(".modal-close-btn").onclick = close;
        modal.onclick = (e) => { if (e.target === modal) close(); };
        return;
      }

      const lat = state.coords.lat;
      const lon = state.coords.lon;
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
      const madhabKey = el.madhabSel?.value || state.settings.madhab || "shafii";
      method.madhab =
        madhabKey === "hanafi" ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

      const coords = new adhan.Coordinates(lat, lon);
      const rows = [];
      rows.push('<div class="calendar-grid">');
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d) =>
        rows.push(`<div class="calendar-day-name">${d}</div>`)
      );
      const firstDow = new Date(year, month, 1).getDay();
      for (let i = 0; i < firstDow; i++) rows.push('<div class="calendar-day empty"></div>');
      for (let d = 1; d <= days; d++) {
        const pt = new adhan.PrayerTimes(coords, new Date(year, month, d), method);
        rows.push(
          `<div class="calendar-day">
             <div class="day-number">${d}</div>
             <div class="fajr-time">${formatTime(new Date(pt.fajr).toISOString())}</div>
           </div>`
        );
      }
      rows.push("</div>");

      modal.innerHTML =
        `<div class="modal-content">
           <button class="modal-close-btn">&times;</button>
           <div class="calendar-header"><h2>${date.toLocaleString(undefined, {
             month: "long",
             year: "numeric",
           })}</h2></div>
           ${rows.join("")}
         </div>`;
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      document.body.setAttribute("inert", "");
      const close = () => {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        document.body.removeAttribute("inert");
      };
      modal.querySelector(".modal-close-btn").onclick = close;
      modal.onclick = (e) => { if (e.target === modal) close(); };
    }

    /* -------------------- init flow -------------------- */
    SettingsStore.load();
    await setLanguage(
      localStorage.getItem("language") ||
      (navigator.language.slice(0, 2) === "ar" ? "ar" : "en")
    );

    // Ensure audio toggle is visible only if <audio> exists
    if (!el.adhanPlayer) {
      document.querySelector(".adhan-toggle-container")?.classList.add("hidden");
    }

    await checkNotificationStatus();
    setupLocationSearch();

    // Auto-enable push if user opted previously and permission still granted
    if (
      localStorage.getItem("notificationsEnabled") === "true" &&
      Notification.permission === "granted"
    ) {
      setupNotifications().catch(() => {});
    }

    // Saved location or detect
    try {
      const saved = JSON.parse(localStorage.getItem("lastLocation") || "null");
      if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
        state.coords = { lat: saved.lat, lon: saved.lon };
        state.cityLabel = saved.label || "Saved Location";
        refreshPrayerTimes(saved.lat, saved.lon, state.cityLabel);
      } else {
        findUserLocation();
      }
    } catch {
      findUserLocation();
    }

    // Public debug (optional)
    window.__PrayerTimesApp = {
      refreshPrayerTimes,
      setupNotifications,
      sendTestNotification,
      sendTestPrayerNotification,
    };
  }
})();
