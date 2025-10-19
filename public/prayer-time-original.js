/* ------------------------------------------------------------------
   Prayer Times Page Script (Advanced + Audio Command Center + Prayer Logging)

   - Multi-layered location detection:
     1) Saved Location (localStorage, rich object)
     2) IP Geolocation (/api/location/ip-lookup)
     3) High-Accuracy GPS + Reverse Geocode (user-initiated)

   - Server fetch (new endpoint only) with local Adhan.js fallback
   - Push subscription + preferences (incl. pre-prayer reminder)
   - Countdown + UI updates + monthly modal
   - I18N + Safe DOM updates (no innerHTML with user data)
   - Reverse geocode fallback: /api/location/reverse-geocode → /api/reverse-geocode
   - Optional City Search Button (legacy IDs) alongside typeahead
   - Settings migration from "prayerAppSettings"
   - Optional table (#prayer-times-table) population when present

   - Audio Command Center:
     * Master volume, output device routing (setSinkId), sound library + preview
     * Persists: adhanVolume, audioSinkId, selectedAdhanSrc, adhanEnabled

   - Extended Times:
     * Adds Shurūq display
     * Adds worship periods: Imsak, Duha, Tahajjud (start/end)

   - Prayer Logging (Unified auth: JWT OR session cookie)
     * Fetch today's logged prayers and mark cards with a check icon
     * Click a main prayer card to log it (for authenticated users)
     * Handle SW message & URL param to log directly from notification action
------------------------------------------------------------------- */

(() => {
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    "use strict";

    // --- Early: handle actions from SW + URL param (LOG_PRAYER / PLAY_ADHAN) ---
    if (navigator.serviceWorker && typeof navigator.serviceWorker.addEventListener === "function") {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "LOG_PRAYER" && event.data.prayer) {
          logPrayerAsCompleted(event.data.prayer);
        } else if (event.data?.type === "PLAY_ADHAN") {
          playAdhan(event.data.audioFile || "/audio/adhan.mp3");
        }
      });
    }
    {
      const urlParams = new URLSearchParams(window.location.search);
      const prayerToLog = urlParams.get("log");
      if (prayerToLog) {
        logPrayerAsCompleted(prayerToLog);
        history.replaceState(null, "", window.location.pathname); // prevent repeat
      }
    }
    // --------------------------------------------------------------------------

    const initialTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    // ---------------------- STATE ----------------------
    const state = {
      tz: initialTZ,               // IANA tz (updated from rich location if available)
      coords: null,                // { lat, lon }
      cityLabel: "",               // display string in UI
      locationData: null,          // rich location: { lat, lon, display, tz, ... }
      times: null,                 // { fajr, dhuhr, asr, maghrib, isha, shuruq? } ISO
      periods: null,               // { imsak:{start,end}, duha:{start,end}, tahajjud:{start,end} } ISO
      dateMeta: { gregorian: "", hijri: "" },
      countdownTimerId: null,
      pushSubscription: null,
      swRegistration: null,
      translations: {},
      settings: {
        calculationMethod: "auto",
        madhab: "auto",
        is24Hour: false,
        reminderMinutes: 0,
      },
    };

    // ---------------------- ELEMENTS ----------------------
    const $ = (id) => document.getElementById(id);
    const el = {
      // Shell
      loading: $("loading-message"),
      content: $("prayer-times-content"),

      // Times (main)
      fajr: $("fajr-time"),
      dhuhr: $("dhuhr-time"),
      asr: $("asr-time"),
      maghrib: $("maghrib-time"),
      isha: $("isha-time"),

      // Extended timepoints
      shuruq: $("shuruq-time"),

      // Worship periods
      imsakStart: $("imsak-start-time"),
      imsakEnd: $("imsak-end-time"),
      duhaStart: $("duha-start-time"),
      duhaEnd: $("duha-end-time"),
      tahajjudStart: $("tahajjud-start-time"),
      tahajjudEnd: $("tahajjud-end-time"),

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
      reminderSel: $("reminder-select"),
      clock24Toggle: $("clock-format-toggle"),
      notifToggle: $("notification-toggle"),
      adhanToggle: $("adhan-audio-toggle"),

      // Monthly modal
      monthlyBtn: $("view-monthly-btn"),
      monthlyModal: $("monthly-view-modal"),

      // Audio
      adhanPlayer: $("adhan-player"),
      volumeSlider: $("adhan-volume-slider"),
      audioOutputSelect: $("audio-output-select"),
      soundLibrary: $("sound-library"),

      // Per-prayer toggles
      alertFajr: $("alert-fajr"),
      alertDhuhr: $("alert-dhuhr"),
      alertAsr: $("alert-asr"),
      alertMaghrib: $("alert-maghrib"),
      alertIsha: $("alert-isha"),

      // Assistant + tests
      assistantModal: $("assistant-modal"),
      openAssistantBtn: $("open-assistant-btn"),
      closeAssistantBtn: $("close-assistant-btn"),
      assistantSendBtn: $("assistant-send-btn"),
      assistantInput: $("assistant-input"),
      assistantChatWindow: $("assistant-chat-window"),
      testBtn: $("test-notification-btn"),
      testPrayerBtn: $("test-prayer-notification-btn"),

      // Typeahead Location search
      locInput: $("location-search-input"),
      locResults: $("search-results"),

      // Optional legacy/manual elems
      locMsgBox: $("location-message-container"),
      manualLocContainer: $("manual-location-container"),
      legacyCityInput: $("city-input"),
      legacySearchBtn: $("search-button"),

      // Optional table
      prayerTimesTableBody: document.querySelector("#prayer-times-table tbody"),
    };

    // ---------------------- HELPERS ----------------------
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

    function clearNode(node) {
      if (!node) return;
      node.replaceChildren();
    }

    function showLocationMessage(text, type = "info") {
      if (el.locMsgBox) {
        el.locMsgBox.style.display = "block";
        clearNode(el.locMsgBox);
        const p = document.createElement("p");
        p.className = type;
        p.textContent = text;
        el.locMsgBox.appendChild(p);
      } else {
        if (el.loading && el.loading.style.display !== "none") {
          clearNode(el.loading);
          const p = document.createElement("p");
          p.textContent = text;
          el.loading.appendChild(p);
        } else {
          toast(text, type === "error" ? "error" : type === "success" ? "success" : "info");
        }
      }
    }

    const debounce = (fn, ms = 300) => {
      let t;
      return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
      };
    };

    // ---------------------- UNIFIED AUTH HELPERS ----------------------
    const getAuthToken = () =>
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("access_token");

    const getCsrf = () => (document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/) || [])[1];

    async function apiFetch(url, options = {}) {
      const method = (options.method || "GET").toUpperCase();
      const headers = { Accept: "application/json", ...(options.headers || {}) };

      // Add Bearer if present (JWT users)
      const token = getAuthToken();
      if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

      // Add CSRF for mutating requests (session users)
      if (method !== "GET" && !headers["X-CSRF-Token"]) {
        const csrf = getCsrf();
        if (csrf) headers["X-CSRF-Token"] = csrf;
      }

      // Default Content-Type for JSON bodies
      if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

      const res = await fetch(url, { ...options, headers, credentials: "include" });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          msg = j.error || j.message || msg;
        } catch {}
        throw new Error(msg);
      }

      // Return JSON if possible
      try { return await res.json(); } catch { return {}; }
    }

    // ---------------------- AUDIO COMMAND CENTER ----------------------
    async function populateAudioDevices() {
      if (!el.audioOutputSelect) return;
      const sinkSupported = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
      if (!sinkSupported) {
        el.audioOutputSelect.parentElement?.style && (el.audioOutputSelect.parentElement.style.display = "none");
        return;
      }

      if (!navigator.mediaDevices?.enumerateDevices) {
        console.warn("[Audio] enumerateDevices() not supported.");
        el.audioOutputSelect.parentElement?.style && (el.audioOutputSelect.parentElement.style.display = "none");
        return;
      }
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(() => {});

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter((d) => d.kind === "audiooutput");

        el.audioOutputSelect.innerHTML = '<option value="default">Default Device</option>';
        audioOutputs.forEach((device, idx) => {
          const option = document.createElement("option");
          option.value = device.deviceId;
          option.textContent = device.label || `Speaker ${idx + 1}`;
          el.audioOutputSelect.appendChild(option);
        });

        const savedSinkId = localStorage.getItem("audioSinkId");
        if (savedSinkId) el.audioOutputSelect.value = savedSinkId;
      } catch (err) {
        console.error("[Audio] Could not list audio devices:", err);
      }
    }

    function renderSoundLibrary() {
      if (!el.soundLibrary) return;

      const sounds = [
        { name: "Adhan of Makkah",  reciter: "Sheikh Ali Ahmad Mulla", src: "/audio/adhan.mp3" },
        { name: "Adhan of Madinah", reciter: "Sheikh Abdul-Majid",     src: "/audio/adhan_madinah.mp3" },
        { name: "Mishary Alafasy",  reciter: "Adhan Recitation",       src: "/audio/adhan_alafasy.mp3" },
        { name: "Simple Beep",      reciter: "Alert Tone",             src: "/audio/beep.mp3" },
      ];

      el.soundLibrary.replaceChildren();
      const currentSoundSrc = localStorage.getItem("selectedAdhanSrc") || sounds[0].src;

      sounds.forEach((sound) => {
        const card = document.createElement("div");
        card.className = "sound-card";
        if (sound.src === currentSoundSrc) card.classList.add("active");
        card.dataset.soundSrc = sound.src;

        const info = document.createElement("div");
        info.className = "sound-info";
        info.innerHTML = `<strong>${sound.name}</strong><span>${sound.reciter}</span>`;

        const button = document.createElement("button");
        button.className = "play-preview-btn";
        button.innerHTML = '<i class="fa-solid fa-play"></i>';
        button.setAttribute("aria-label", `Preview ${sound.name}`);

        button.addEventListener("click", (e) => {
          e.stopPropagation();
          playAdhan(sound.src, true);
        });

        card.addEventListener("click", async () => {
          document.querySelectorAll(".sound-card.active").forEach((c) => c.classList.remove("active"));
          card.classList.add("active");
          localStorage.setItem("selectedAdhanSrc", sound.src);
          if (el.adhanPlayer) {
            el.adhanPlayer.src = sound.src;
            try { await el.adhanPlayer.load(); } catch {}
          }
          if (el.notifToggle?.checked) {
            sendSubscriptionToServer(true).catch(() => {});
          }
        });

        card.appendChild(info);
        card.appendChild(button);
        el.soundLibrary.appendChild(card);
      });
    }

    async function playAdhan(src, isPreview = false) {
      try {
        if (!el.adhanPlayer) return;

        if (!isPreview) {
          const enabled = el.adhanToggle?.checked ?? true;
          localStorage.setItem("adhanEnabled", enabled ? "true" : "false");
          if (!enabled) return;
        }

        const selectedSrc = src || localStorage.getItem("selectedAdhanSrc") || "/audio/adhan.mp3";
        if (el.adhanPlayer.getAttribute("src") !== selectedSrc) {
          el.adhanPlayer.setAttribute("src", selectedSrc);
          el.adhanPlayer.load();
        }

        const vol = parseFloat(localStorage.getItem("adhanVolume") || (el.volumeSlider?.value ?? "1"));
        el.adhanPlayer.volume = Number.isFinite(vol) ? vol : 1;

        if (typeof el.adhanPlayer.setSinkId === "function" && el.audioOutputSelect) {
          const sinkId = el.audioOutputSelect.value;
          if (sinkId && sinkId !== "default" && el.adhanPlayer.sinkId !== sinkId) {
            try { await el.adhanPlayer.setSinkId(sinkId); } catch (e) {
              console.warn("[Audio] setSinkId failed:", e?.message || e);
            }
          }
        }

        await el.adhanPlayer.play();
      } catch (e) {
        console.warn("[Audio] Failed to play adhan:", e);
      }
    }

    // Unlock audio on first user gesture
    document.addEventListener("click", unlockAudioOnce, { once: true });
    function unlockAudioOnce() {
      if (!el.adhanPlayer) return;
      try {
        el.adhanPlayer.muted = true;
        el.adhanPlayer.play().then(() => {
          el.adhanPlayer.pause();
          el.adhanPlayer.currentTime = 0;
          el.adhanPlayer.muted = false;
        }).catch(() => {});
      } catch {}
    }

    // ---------------------- SERVICE WORKER ----------------------
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
        } else if (evt.data?.type === "LOG_PRAYER" && evt.data.prayer) {
          logPrayerAsCompleted(evt.data.prayer);
        }
      });
    }

    // ---------------------- I18N ----------------------
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

    // ---------------------- SETTINGS STORE ----------------------
    const SettingsStore = {
      load() {
        state.settings.calculationMethod =
          localStorage.getItem("prayerMethod") || "auto";
        state.settings.madhab =
          localStorage.getItem("prayerMadhab") || "auto";
        state.settings.is24Hour =
          JSON.parse(localStorage.getItem("is24HourFormat") || "false");
        state.settings.reminderMinutes =
          parseInt(localStorage.getItem("reminderMinutes") || "0", 10);

        if (el.methodSel) el.methodSel.value = state.settings.calculationMethod;
        if (el.madhabSel) el.madhabSel.value = state.settings.madhab;
        if (el.reminderSel) el.reminderSel.value = String(state.settings.reminderMinutes);
        if (el.clock24Toggle) el.clock24Toggle.checked = state.settings.is24Hour;

        if (el.adhanToggle) {
          const saved = localStorage.getItem("adhanEnabled");
          el.adhanToggle.checked = saved === null ? true : saved === "true";
        }

        localStorage.setItem("clockFormat24", state.settings.is24Hour ? "true" : "false");

        // Migration support
        try {
          const legacy = JSON.parse(localStorage.getItem("prayerAppSettings") || "null");
          if (legacy && typeof legacy === "object") {
            if (legacy.calculationMethod && legacy.calculationMethod !== state.settings.calculationMethod) {
              state.settings.calculationMethod = legacy.calculationMethod;
              if (el.methodSel) el.methodSel.value = legacy.calculationMethod;
            }
            if (legacy.madhab && legacy.madhab !== state.settings.madhab) {
              state.settings.madhab = legacy.madhab;
              if (el.madhabSel) el.madhabSel.value = legacy.madhab;
            }
            if (typeof legacy.use24HourFormat === "boolean") {
              state.settings.is24Hour = legacy.use24HourFormat;
              if (el.clock24Toggle) el.clock24Toggle.checked = legacy.use24HourFormat;
              localStorage.setItem("clockFormat24", legacy.use24HourFormat ? "true" : "false");
            }
            const hasLast = !!localStorage.getItem("lastLocation");
            if (!hasLast && Number.isFinite(legacy.latitude) && Number.isFinite(legacy.longitude)) {
              const display = legacy.city || "Saved Location";
              const migrate = { lat: legacy.latitude, lon: legacy.longitude, display, tz: state.tz };
              localStorage.setItem("lastLocation", JSON.stringify(migrate));
            }
          }
        } catch {}
      },
      save() {
        localStorage.setItem("prayerMethod", state.settings.calculationMethod);
        localStorage.setItem("prayerMadhab", state.settings.madhab);
        localStorage.setItem("is24HourFormat", JSON.stringify(state.settings.is24Hour));
        localStorage.setItem("reminderMinutes", String(state.settings.reminderMinutes));
        localStorage.setItem("clockFormat24", state.settings.is24Hour ? "true" : "false");
      },
    };

    // ---------------------- LOCATION + GEOCODE ----------------------
    async function geocodeSearch(q) {
      const lang =
        (localStorage.getItem("language") || document.documentElement.lang || "en").split("-")[0];

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
      } catch {}

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
        clearNode(box);
        box.style.display = "none";
        return;
      }
      clearNode(box);
      items.forEach((it, idx) => {
        const lat = it.lat ?? it.latitude;
        const lon = it.lon ?? it.longitude;
        const label = it.display_name || it.label || `${lat}, ${lon}`;
        const itemDiv = document.createElement("div");
        itemDiv.className = "search-result-item";
        itemDiv.dataset.idx = String(idx);
        itemDiv.setAttribute("role", "option");
        itemDiv.tabIndex = 0;
        itemDiv.textContent = label;
        itemDiv.addEventListener("click", () => applyResult(items[Number(itemDiv.dataset.idx)]));
        itemDiv.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            applyResult(items[Number(itemDiv.dataset.idx)]);
          }
        });
        box.appendChild(itemDiv);
      });
      box.style.display = "block";
    }

    async function fetchReverseGeocode(lat, lon, lang = "en") {
      try {
        const r = await fetch(
          `/api/location/reverse-geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&lang=${encodeURIComponent(lang)}`
        );
        if (r.ok) return r.json();
      } catch {}
      try {
        const r = await fetch(
          `/api/reverse-geocode?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`
        );
        if (r.ok) return r.json();
      } catch {}
      return null;
    }

    async function getRichLocationFromCoords(lat, lon, lang = "en") {
      const j = await fetchReverseGeocode(lat, lon, lang);
      if (j) {
        return {
          lat,
          lon,
          display: j.display || [j.city, j.state, j.country].filter(Boolean).join(", "),
          tz: j.tz || j.timezone || initialTZ,
          city: j.city || null,
          country: j.country || null,
          countryCode: j.countryCode || null,
          source: j.source || "gps",
          confidence: typeof j.confidence === "number" ? j.confidence : 0.95,
        };
      }
      return { lat, lon, display: "Selected location", tz: initialTZ, source: "manual", confidence: 0.5 };
    }

    async function applyResult(it) {
      const lat = parseFloat(it.lat ?? it.latitude);
      const lon = parseFloat(it.lon ?? it.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const lang = (localStorage.getItem("language") || "en").split("-")[0];
      const rich = await getRichLocationFromCoords(lat, lon, lang);
      await refreshPrayerTimesByLocation(rich);
      if (el.locInput) el.locInput.value = rich.display || "";
      if (el.locResults) el.locResults.style.display = "none";
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

    async function fetchCityGeocode(city) {
      try {
        const r = await fetch(`/api/geocode?city=${encodeURIComponent(city)}`);
        if (r.ok) return r.json();
      } catch {}
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`);
        if (r.ok) return r.json();
      } catch {}
      const list = await geocodeSearch(city);
      if (Array.isArray(list) && list.length) {
        const it = list[0];
        return {
          latitude: parseFloat(it.lat),
          longitude: parseFloat(it.lon),
          name: it.display_name || city,
        };
      }
      throw new Error("City not found");
    }

    if (el.legacySearchBtn && el.legacyCityInput) {
      el.legacySearchBtn.addEventListener("click", async () => {
        const city = el.legacyCityInput.value.trim();
        if (!city) return;
        showLocationMessage(`Searching for ${city}…`, "info");
        try {
          const data = await fetchCityGeocode(city);
          const lat = data.latitude ?? data.lat;
          const lon = data.longitude ?? data.lon;
          const name = data.name || data.display || city;
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Invalid coords");
          const rich = await getRichLocationFromCoords(lat, lon);
          rich.display = name || rich.display;
          await refreshPrayerTimesByLocation(rich);
          if (el.manualLocContainer) el.manualLocContainer.style.display = "none";
        } catch (err) {
          showLocationMessage(`Could not find "${city}". Please try again.`, "error");
        }
      });
    }

    // ---------------------- PRAYER TIMES HELPERS ----------------------
    function defaultLocationByTZ() {
      if (/Africa\/Cairo|Egypt/i.test(state.tz)) {
        return { lat: 30.5877, lon: 31.1813, display: "Banha, Egypt (Default)", tz: state.tz };
      }
      return { lat: 25.2048, lon: 55.2708, display: "Dubai, UAE (Default)", tz: state.tz };
    }

    function formatTime(dateISO, fallback = "--:--") {
      if (!dateISO) return fallback;
      const d = new Date(dateISO);
      if (isNaN(d)) return fallback;
      const use24 = !!(el.clock24Toggle?.checked || localStorage.getItem("clockFormat24") === "true");
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
            shuruq: t.shuruq ? new Date(t.shuruq).toISOString() : (t.sunrise ? new Date(t.sunrise).toISOString() : undefined),
          },
          periods: data.periods || null,
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
            shuruq: src.shuruq || src.sunrise || undefined,
          },
          periods: data.periods || null,
          dateMeta: data.date || data.dateMeta || { gregorian: "", hijri: "" },
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
        `/api/prayer-times?latitude=${lat}&longitude=${lon}` +
        `&method=${encodeURIComponent(method)}` +
        `&madhab=${encodeURIComponent(madhab)}`;

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Server failed (${res.status}): ${t}`);
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

      let sunriseISO;
      try { sunriseISO = pt.sunrise ? iso(pt.sunrise) : undefined; } catch { sunriseISO = undefined; }

      let tahStart, tahEnd;
      try {
        if (adhan.SunnahTimes) {
          const st = new adhan.SunnahTimes(pt);
          const l3 = st.lastThirdOfTheNight || st.lastThirdOfTheNightStart || st.lastThird;
          tahStart = l3 ? iso(l3) : undefined;
          tahEnd = iso(pt.fajr);
        } else {
          const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          const pt2 = new adhan.PrayerTimes(coords, tomorrow, method);
          const maghrib = new Date(pt.maghrib).getTime();
          const fajrNext = new Date(pt2.fajr).getTime();
          const night = fajrNext - maghrib;
          const start = maghrib + (2 * night) / 3;
          tahStart = new Date(start).toISOString();
          tahEnd = iso(pt2.fajr);
        }
      } catch {
        tahStart = undefined;
        tahEnd = undefined;
      }

      const addMinutes = (d, m) => new Date(new Date(d).getTime() + m * 60000).toISOString();
      const subMinutes = (d, m) => new Date(new Date(d).getTime() - m * 60000).toISOString();

      const duhaStart = sunriseISO ? addMinutes(sunriseISO, 15) : undefined;
      const duhaEnd = pt.dhuhr ? subMinutes(iso(pt.dhuhr), 10) : undefined;

      const imsakEnd = iso(pt.fajr);
      const imsakStart = subMinutes(imsakEnd, 10);

      return {
        timesRaw: {
          fajr: pt.fajr,
          dhuhr: pt.dhuhr,
          asr: pt.asr,
          maghrib: pt.maghrib,
          isha: pt.isha,
          shuruq: pt.sunrise || undefined,
          sunrise: pt.sunrise || undefined,
        },
        times: {
          fajr: iso(pt.fajr),
          dhuhr: iso(pt.dhuhr),
          asr: iso(pt.asr),
          maghrib: iso(pt.maghrib),
          isha: iso(pt.isha),
          shuruq: sunriseISO,
        },
        periods: {
          imsak: { start: imsakStart, end: imsakEnd },
          duha: { start: duhaStart, end: duhaEnd },
          tahajjud: { start: tahStart, end: tahEnd },
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
      return `prayerTimes_${lat.toFixed(2)}_${lon.toFixed(2)}_${date.toISOString().split("T")[0]}`;
    }

    async function refreshPrayerTimesByLocation(loc) {
      if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) return;

      const tzStr = loc.tz || loc.timezone || state.tz || initialTZ;

      state.locationData = loc;
      state.coords = { lat: loc.lat, lon: loc.lon };
      state.cityLabel = loc.display || state.cityLabel || "";
      state.tz = tzStr;

      if (el.location) el.location.textContent = state.cityLabel || "";

      if (el.loading) el.loading.style.display = "block";
      if (el.content) el.content.style.display = "none";

      const key = cacheKey(loc.lat, loc.lon);
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const j = JSON.parse(cached);
          const norm = normalizeData(j) || j;
          applyData(norm, state.cityLabel);
        } catch (e) {
          console.warn("[Cache] parse failed:", e);
        }
      }

      try {
        const data = await fetchServerTimes(loc.lat, loc.lon, tzStr);
        const norm = normalizeData(data);
        if (!norm) throw new Error("Invalid data from server");
        applyData(norm, state.cityLabel);
        localStorage.setItem(key, JSON.stringify(norm));
        localStorage.setItem(
          "lastLocation",
          JSON.stringify({ lat: loc.lat, lon: loc.lon, display: state.cityLabel, tz: tzStr })
        );
        if (el.notifToggle?.checked) {
          sendSubscriptionToServer(true).catch(() => {});
        }
      } catch (err) {
        console.warn("[Times] server failed; using local calc:", err?.message || err);
        try {
          const local = computeLocalTimesFallback(loc.lat, loc.lon);
          applyData(normalizeData(local), state.cityLabel);
          localStorage.setItem(key, JSON.stringify(local));
        } catch (e) {
          showLocationMessage("Failed to compute prayer times", "error");
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

    function populateTableIfExists(timesISO) {
      if (!el.prayerTimesTableBody) return;
      el.prayerTimesTableBody.replaceChildren();
      const order = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
      order.forEach((prayer) => {
        const tr = el.prayerTimesTableBody.insertRow();
        const nameCell = tr.insertCell(0);
        const timeCell = tr.insertCell(1);
        nameCell.textContent = prayer.charAt(0).toUpperCase() + prayer.slice(1);
        timeCell.textContent = formatTime(timesISO[prayer]);
      });
    }

    function applyData(normalized, displayLabel) {
      if (!normalized || !normalized.times) return;

      state.times = normalized.times;
      state.periods = normalized.periods || null;
      state.dateMeta = normalized.dateMeta;
      state.cityLabel = displayLabel || state.cityLabel;

      if (el.fajr) el.fajr.textContent = formatTime(state.times.fajr);
      if (el.dhuhr) el.dhuhr.textContent = formatTime(state.times.dhuhr);
      if (el.asr) el.asr.textContent = formatTime(state.times.asr);
      if (el.maghrib) el.maghrib.textContent = formatTime(state.times.maghrib);
      if (el.isha) el.isha.textContent = formatTime(state.times.isha);

      if (el.shuruq) el.shuruq.textContent = formatTime(state.times.shuruq);

      if (state.periods) {
        if (el.imsakStart) el.imsakStart.textContent = formatTime(state.periods?.imsak?.start);
        if (el.imsakEnd) el.imsakEnd.textContent = formatTime(state.periods?.imsak?.end);
        if (el.duhaStart) el.duhaStart.textContent = formatTime(state.periods?.duha?.start);
        if (el.duhaEnd) el.duhaEnd.textContent = formatTime(state.periods?.duha?.end);
        if (el.tahajjudStart) el.tahajjudStart.textContent = formatTime(state.periods?.tahajjud?.start);
        if (el.tahajjudEnd) el.tahajjudEnd.textContent = formatTime(state.periods?.tahajjud?.end);
      }

      if (el.gregorian) el.gregorian.textContent = state.dateMeta?.gregorian || "";
      if (el.hijri) el.hijri.textContent = state.dateMeta?.hijri || "";
      if (el.location) el.location.textContent = state.cityLabel || "";

      populateTableIfExists(state.times);

      if (el.loading) el.loading.style.display = "none";
      if (el.content) el.content.style.display = "block";

      saveUserLocation(state.coords?.lat, state.coords?.lon, state.cityLabel).catch(() => {});
      if (Number.isFinite(state.coords?.lat) && Number.isFinite(state.coords?.lon)) {
        localStorage.setItem(
          "lastLocation",
          JSON.stringify({ lat: state.coords.lat, lon: state.coords.lon, display: state.cityLabel, tz: state.tz })
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
          if (el.nextPrayerName) el.nextPrayerName.textContent = "Isha";
          if (el.countdown) el.countdown.textContent = "Finished for today";
          return;
        }

        let currentName = null;
        for (let i = order.length - 1; i >= 0; i--) {
          const t = new Date(state.times[order[i]]);
          if (t < now) { currentName = order[i]; break; }
        }
        if (nextName === "fajr" && !currentName) currentName = "isha";

        const fmt = { timeZone: state.tz, year: "numeric", month: "2-digit", day: "2-digit" };
        const todayTz = new Intl.DateTimeFormat("en-CA", fmt).format(now);
        const fajrDayTz = new Intl.DateTimeFormat("en-CA", fmt).format(new Date(state.times.fajr));
        if (todayTz !== fajrDayTz) {
          if (state.locationData) refreshPrayerTimesByLocation(state.locationData);
          return;
        }

        document.querySelectorAll(".prayer-card").forEach((card) => {
          card.classList.remove("next-prayer", "current-prayer");
          const key = card.dataset.key;
          if (key === nextName) card.classList.add("next-prayer");
          if (key === currentName) card.classList.add("current-prayer");
        });

        const diff = nextTime - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (el.nextPrayerName)
          el.nextPrayerName.textContent = nextName.charAt(0).toUpperCase() + nextName.slice(1);
        if (el.countdown)
          el.countdown.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(
            2, "0"
          )}:${String(s).padStart(2, "0")}`;

        if (el.adhanToggle?.checked && diff < 800 && diff > -2000) {
          playAdhan(localStorage.getItem("selectedAdhanSrc") || "/audio/adhan.mp3");
        }
      }, 1000);
    }

    function showCorrectionPrompt(city) {
      if (!el.location) return;
      const existing = document.getElementById("correction-prompt");
      if (existing) return;

      const span = document.createElement("span");
      span.id = "correction-prompt";
      span.style.marginLeft = "8px";

      const btn = document.createElement("button");
      btn.id = "correct-location-btn";
      btn.className = "btn-link";
      btn.type = "button";
      btn.textContent = `Not in ${city}?`;
      btn.addEventListener("click", () => {
        if (el.locInput) el.locInput.focus();
        span.remove();
      });

      span.appendChild(btn);
      el.location.insertAdjacentElement("afterend", span);
    }

    function ensurePreciseButton() {
      if (!el.location) return;
      const existing = document.getElementById("precise-location-btn");
      if (existing) return;

      const btn = document.createElement("button");
      btn.id = "precise-location-btn";
      btn.type = "button";
      btn.className = "btn-link";
      btn.style.marginLeft = "8px";
      btn.textContent = "Use precise location";
      btn.addEventListener("click", usePreciseLocation);

      el.location.insertAdjacentElement("afterend", btn);
    }

    async function usePreciseLocation() {
      if (!navigator.geolocation) {
        showLocationMessage("Geolocation not supported on this device", "error");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          const lat = p.coords.latitude;
          const lon = p.coords.longitude;
          const lang = (localStorage.getItem("language") || "en").split("-")[0];
          const rich = await getRichLocationFromCoords(lat, lon, lang);
          await refreshPrayerTimesByLocation(rich);
          showLocationMessage("Location found! Fetching prayer times...", "success");
        },
        (err) => {
          console.warn("[Geo] precise failed:", err?.message || err);
          showLocationMessage("Could not get precise location", "error");
          if (el.manualLocContainer) el.manualLocContainer.style.display = "block";
          if (el.loading) el.loading.style.display = "none";
        },
        { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
      );
    }

    async function findLocationOnStartup() {
      try {
        const saved = JSON.parse(localStorage.getItem("lastLocation") || "null");
        if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
          const loc = {
            lat: saved.lat,
            lon: saved.lon,
            display: saved.display || saved.label || "Saved Location",
            tz: saved.tz || state.tz,
            source: "saved",
            confidence: 0.9,
          };
          await refreshPrayerTimesByLocation(loc);
          ensurePreciseButton();
          return;
        }
      } catch {}

      try {
        if (el.loading) {
          el.loading.style.display = "block";
          clearNode(el.loading);
          const p = document.createElement("p");
          p.textContent = "Detecting your city…";
          el.loading.appendChild(p);
        }
        const r = await fetch("/api/location/ip-lookup", { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          const display = [data.city, data.country].filter(Boolean).join(", ") || "Detected City";
          const tzStr = data.tz || data.timezone || state.tz;
          const loc = {
            lat: Number(data.lat),
            lon: Number(data.lon),
            display,
            tz: tzStr,
            city: data.city || null,
            country: data.country || null,
            countryCode: data.countryCode || null,
            source: data.source || "ip",
            confidence: typeof data.confidence === "number" ? data.confidence : 0.6,
          };
          await refreshPrayerTimesByLocation(loc);
          ensurePreciseButton();
          if (data.city) showCorrectionPrompt(data.city);
          return;
        }
        throw new Error(`IP lookup ${r.status}`);
      } catch (e) {
        console.warn("[IP] geolocation failed:", e?.message || e);
      }

      if (el.loading) {
        clearNode(el.loading);
        el.loading.style.display = "block";
        const p = document.createElement("p");
        p.textContent = "Could not detect your location automatically. Please search for your city.";
        el.loading.appendChild(p);
      }
      if (el.locInput?.parentElement) el.locInput.parentElement.style.display = "block";

      const def = defaultLocationByTZ();
      await refreshPrayerTimesByLocation(def);
      ensurePreciseButton();
    }

    // ---------------------- PUSH / NOTIFICATIONS ----------------------
    function b64ToU8(base64String) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
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
      const r = await fetch("/api/notifications/vapid-public-key", { credentials: "include" });
      if (!r.ok) throw new Error("VAPID key error");
      const vapid = await r.text();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToU8(vapid),
      });
      state.pushSubscription = sub;
      return sub;
    }

    function loadPerPrayer() {
      try { return JSON.parse(localStorage.getItem("perPrayer")) || null; } catch { return null; }
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
      const reminderMinutes =
        parseInt(el.reminderSel?.value ?? state.settings.reminderMinutes ?? 0, 10);

      const src = localStorage.getItem("selectedAdhanSrc") || "/audio/adhan.mp3";
      const volume = parseFloat(localStorage.getItem("adhanVolume") || "1") || 1;
      const file = src.split("/").pop();

      return {
        enabled,
        tz: state.tz,
        perPrayer,
        method,
        madhab,
        reminderMinutes,
        highLatRule: "auto",
        audio: { file, volume, path: src },
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
          showLocationMessage("Browser does not support push notifications", "error");
          return false;
        }
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          showLocationMessage("Enable notifications in your browser settings", "error");
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
          r = await fetch("/api/notifications/test-prayer", {
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

    // ---------------------- PRAYER LOGGING (Unified auth) ----------------------
    async function fetchAndUpdatePrayerLog() {
      try {
        const prayedToday = await apiFetch("/api/prayer-log/today");

        document.querySelectorAll('.prayer-card[data-key]').forEach((card) => {
          const prayerName = card.dataset.key;
          const icon = card.querySelector('.prayer-status-icon');
          if (Array.isArray(prayedToday) && prayedToday.includes(prayerName)) {
            card.classList.add('prayed');
            if (icon) icon.innerHTML = '<i class="fa-solid fa-check"></i>';
          } else {
            card.classList.remove('prayed');
            if (icon) icon.innerHTML = '';
          }
        });
      } catch (error) {
        // Silently ignore for unauthenticated sessions; log others.
        if (!/401|Unauthorized/i.test(error.message)) {
          console.error("[PrayerLog] Failed to fetch today's log:", error);
        }
      }
    }

    async function logPrayerAsCompleted(prayerName) {
      const validNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
      if (!validNames.includes(prayerName)) return;

      const card = document.querySelector(`.prayer-card[data-key="${prayerName}"]`);

      try {
        // Optimistic UI
        card?.classList.add('prayed');
        const icon = card?.querySelector('.prayer-status-icon');
        if (icon) icon.innerHTML = '<i class="fa-solid fa-check"></i>';

        await apiFetch("/api/prayer-log", {
          method: "POST",
          body: JSON.stringify({
            prayerName,
            date: new Date().toISOString().split("T")[0],
          }),
        });

        toast(`${prayerName.charAt(0).toUpperCase() + prayerName.slice(1)} prayer logged!`, "success");

        // Ensure other tabs/pages reflect the change (e.g., Profile dashboard)
        fetchAndUpdatePrayerLog().catch(() => {});
      } catch (error) {
        console.error("[PrayerLog] Failed to log prayer:", error);
        const msg = /401|Unauthorized/i.test(error.message)
          ? "Please log in to track your prayers."
          : "Could not log prayer. Please try again.";
        toast(msg, "error");

        // Revert UI on failure
        card?.classList.remove('prayed');
        const icon = card?.querySelector('.prayer-status-icon');
        if (icon) icon.innerHTML = '';
      }
    }

    // ---------------------- EVENTS ----------------------
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
        applyData({ times: state.times, periods: state.periods, dateMeta: state.dateMeta }, state.cityLabel);
    });

    el.methodSel?.addEventListener("change", () => {
      state.settings.calculationMethod = el.methodSel.value;
      SettingsStore.save();
      if (state.locationData)
        refreshPrayerTimesByLocation(state.locationData);
      if (el.notifToggle?.checked) sendSubscriptionToServer(true).catch(() => {});
    });

    el.madhabSel?.addEventListener("change", () => {
      state.settings.madhab = el.madhabSel.value;
      SettingsStore.save();
      if (state.locationData)
        refreshPrayerTimesByLocation(state.locationData);
      if (el.notifToggle?.checked) sendSubscriptionToServer(true).catch(() => {});
    });

    el.reminderSel?.addEventListener("change", () => {
      state.settings.reminderMinutes = parseInt(el.reminderSel.value, 10) || 0;
      SettingsStore.save();
      if (el.notifToggle?.checked) {
        sendSubscriptionToServer(true).catch(() => {});
      }
    });

    el.langSel?.addEventListener("change", (e) => setLanguage(e.target.value));
    el.monthlyBtn?.addEventListener("click", openMonthlyModal);
    el.testBtn?.addEventListener("click", sendTestNotification);
    el.testPrayerBtn?.addEventListener("click", sendTestPrayerNotification);

    el.openAssistantBtn?.addEventListener("click", () => {
      el.assistantModal?.classList.add("active");
      el.assistantModal?.setAttribute("aria-hidden", "false");
      document.body.setAttribute("inert", "");
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

    el.volumeSlider?.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      localStorage.setItem("adhanVolume", String(v));
      if (el.adhanPlayer) el.adhanPlayer.volume = Number.isFinite(v) ? v : 1;
      if (el.notifToggle?.checked) sendSubscriptionToServer(true).catch(() => {});
    });

    el.audioOutputSelect?.addEventListener("change", async (e) => {
      localStorage.setItem("audioSinkId", e.target.value);
      if (el.adhanPlayer && typeof el.adhanPlayer.setSinkId === "function") {
        try { await el.adhanPlayer.setSinkId(e.target.value); } catch {}
      }
      playAdhan(localStorage.getItem("selectedAdhanSrc") || "/audio/adhan.mp3", true);
    });

    // Click-to-log the five main prayers
    document.querySelectorAll('.prayer-card[data-key]').forEach((card) => {
      const prayerName = card.dataset.key;
      if (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(prayerName)) {
        card.addEventListener('click', () => {
          if (!card.classList.contains('prayed')) {
            logPrayerAsCompleted(prayerName);
          }
        });
      }
    });

    // ---------------------- MONTHLY MODAL ----------------------
    function openMonthlyModal() {
      const modal = el.monthlyModal;
      if (!modal) return;

      const attachCloseHandlers = () => {
        const close = () => {
          modal.classList.remove("active");
          modal.setAttribute("aria-hidden", "true");
          document.body.removeAttribute("inert");
        };
        const closeBtn = modal.querySelector(".modal-close-btn");
        if (closeBtn) closeBtn.onclick = close;
        modal.onclick = (e) => { if (e.target === modal) close(); };
      };

      if (!window.adhan || !Number.isFinite(state.coords?.lat)) {
        clearNode(modal);
        const content = document.createElement("div");
        content.className = "modal-content";

        const closeBtn = document.createElement("button");
        closeBtn.className = "modal-close-btn";
        closeBtn.textContent = "×";

        const p = document.createElement("p");
        p.textContent = "Monthly view requires Adhan.js and a selected location.";

        content.appendChild(closeBtn);
        content.appendChild(p);

        modal.appendChild(content);
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.setAttribute("inert", "");

        attachCloseHandlers();
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

      clearNode(modal);

      const content = document.createElement("div");
      content.className = "modal-content";

      const closeBtn = document.createElement("button");
      closeBtn.className = "modal-close-btn";
      closeBtn.textContent = "×";

      const header = document.createElement("div");
      header.className = "calendar-header";

      const h2 = document.createElement("h2");
      h2.textContent = date.toLocaleString(undefined, { month: "long", year: "numeric" });
      header.appendChild(h2);

      const grid = document.createElement("div");
      grid.className = "calendar-grid";

      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((dname) => {
        const dn = document.createElement("div");
        dn.className = "calendar-day-name";
        dn.textContent = dname;
        grid.appendChild(dn);
      });

      const firstDow = new Date(year, month, 1).getDay();
      for (let i = 0; i < firstDow; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day empty";
        grid.appendChild(empty);
      }

      for (let d = 1; d <= days; d++) {
        const pt = new adhan.PrayerTimes(coords, new Date(year, month, d), method);

        const dayDiv = document.createElement("div");
        dayDiv.className = "calendar-day";

        const dayNumber = document.createElement("div");
        dayNumber.className = "day-number";
        dayNumber.textContent = String(d);

        const fajrDiv = document.createElement("div");
        fajrDiv.className = "fajr-time";
        fajrDiv.textContent = formatTime(new Date(pt.fajr).toISOString());

        dayDiv.appendChild(dayNumber);
        dayDiv.appendChild(fajrDiv);
        grid.appendChild(dayDiv);
      }

      content.appendChild(closeBtn);
      content.appendChild(header);
      content.appendChild(grid);

      modal.appendChild(content);
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      document.body.setAttribute("inert", "");

      attachCloseHandlers();
    }

    // ---------------------- INIT FLOW ----------------------
    SettingsStore.load();
    await setLanguage(
      localStorage.getItem("language") || (navigator.language.slice(0, 2) === "ar" ? "ar" : "en")
    );

    await populateAudioDevices();
    renderSoundLibrary();

    const savedVolume = localStorage.getItem("adhanVolume");
    if (savedVolume && el.volumeSlider) {
      el.volumeSlider.value = savedVolume;
      if (el.adhanPlayer) el.adhanPlayer.volume = parseFloat(savedVolume);
    }

    if (el.adhanPlayer) {
      el.adhanPlayer.src = localStorage.getItem("selectedAdhanSrc") || "/audio/adhan.mp3";
      const sinkId = localStorage.getItem("audioSinkId");
      if (typeof el.adhanPlayer.setSinkId === "function" && sinkId && sinkId !== "default") {
        try { await el.adhanPlayer.setSinkId(sinkId); } catch {}
      }
    }

    if (!el.adhanPlayer) {
      document.querySelector(".adhan-toggle-container")?.classList.add("hidden");
    }

    await checkNotificationStatus();
    setupLocationSearch();

    if (
      localStorage.getItem("notificationsEnabled") === "true" &&
      Notification.permission === "granted"
    ) {
      setupNotifications().catch(() => {});
    }

    await findLocationOnStartup();

    // Fetch today's logged prayers on load (if authenticated)
    await fetchAndUpdatePrayerLog();

    // Public debug
    window.__PrayerTimesApp = {
      refreshPrayerTimesByLocation,
      usePreciseLocation,
      setupNotifications,
      sendTestNotification,
      sendTestPrayerNotification,
      playAdhan,
      fetchAndUpdatePrayerLog,
      logPrayerAsCompleted,
    };
  }
})();
