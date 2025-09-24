// translator-backend/public/profile.js
"use strict";

/**
 * Profile + Prayer Dashboard script with Gamification
 * - Loads user profile + saved locations (existing features preserved)
 * - Address search → select → fetch timezone → save as saved location
 * - Delete saved location
 * - Prayer Dashboard (monthly calendar of logged prayers + stats)
 * - Prayer Streak Gamification (achievements, badges, progress tracking)
 *
 * Endpoints:
 *   Geocode search:    /api/location/search  → /api/geocode → /api/search-city → Nominatim
 *   Timezone/Reverse:  /api/location/timezone → /api/location/reverse-geocode → fallback to browser TZ
 *   Saved locations:   GET/POST/DELETE /api/user/locations
 *   Profile:           GET /api/user/profile
 *   Dashboard:         GET /api/prayer-log/month?month=YYYY-MM
 */

import { PrayerAchievements } from './js/gamification/achievements.js';
import { GamificationUI } from './js/gamification/gamification-ui.js';

document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------- Logout Functionality -------------------------------
  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', async (event) => {
    event.preventDefault();
    
    // Show confirmation dialog
    if (confirm('Are you sure you want to logout?')) {
      // Show loading state
      const logoutBtn = document.getElementById('logout-btn');
      const originalText = logoutBtn.innerHTML;
      logoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging out...';
      logoutBtn.disabled = true;
      
      try {
        // Call enhanced logout function
        const success = await logout();
        
        if (success) {
          // Show success message
          alert('You have been logged out successfully.');
          
          // Redirect to home page
          window.location.href = 'index.html';
        } else {
          // Show error message but still redirect
          alert('Logout completed with some issues. You have been redirected.');
          window.location.href = 'index.html';
        }
      } catch (error) {
        console.error('Logout error:', error);
        alert('Logout completed with errors. You have been redirected.');
        window.location.href = 'index.html';
      }
    }
  });

  // ------------------------------- State -------------------------------
  let selectedLocation = null;

  // Dashboard state
  const PRAYER_NAMES = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  const PRAYER_LABELS = ["F", "D", "A", "M", "I"]; // Short labels for dots
  let currentMonth = new Date(); // controls visible month in the dashboard
  let userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  
  // Gamification state
  let achievements = null;
  let gamificationUI = null;
  
  // Debug logging
  console.log("[Profile] Initial timezone:", userTz);

  // ------------------------------- Elements -------------------------------
  const $ = (id) => document.getElementById(id);
  const el = {
    // profile
    userEmail: $("user-email"),
    userUsername: $("user-username"),

    // saved locations
    locationsList: $("saved-locations-list"),

    // add location form
    addForm: $("add-location-form"),
    labelInput: $("location-label"),
    searchInput: $("location-search"),
    searchResults: $("location-search-results"),
    latInput: $("location-lat"),
    lonInput: $("location-lon"),
    tzInput: $("location-tz"),
    addressInput: $("location-address"),

    // dashboard
    dashboardRoot: document.querySelector(".dashboard-content"),
    calendar: $("prayer-calendar"),
    monthYear: $("calendar-month-year"),
    prevBtn: $("prev-month-btn"),
    nextBtn: $("next-month-btn"),
    refreshBtn: $("refresh-dashboard-btn"),
    todaysProgress: $("todays-progress"),
    fajrStreak: $("fajr-streak"),
    monthlyConsistency: $("monthly-consistency"),
    weeklyProgress: $("weekly-progress"),
    bestPrayer: $("best-prayer"),
    prayerStreak: $("prayer-streak"),
  };

  // ------------------------------- Utils -------------------------------
  const debounce = (fn, delay = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };
  const lang = (navigator.language || "en").split("-")[0];

  const getCsrfToken = () => {
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };

  // Accept multiple possible localStorage keys for auth (JWT)
  const getAuthToken = () => {
    const authToken = localStorage.getItem("authToken");
    const token = localStorage.getItem("token");
    const jwt = localStorage.getItem("jwt");
    const accessToken = localStorage.getItem("access_token");
    
    // Only log token info in debug mode or when there are issues
    if (window.location.search.includes('debug') || (!authToken && !token && !jwt && !accessToken)) {
      console.log('🔍 Profile: Available tokens in localStorage:', {
        authToken: authToken ? authToken.substring(0, 20) + '...' : 'None',
        token: token ? token.substring(0, 20) + '...' : 'None',
        jwt: jwt ? jwt.substring(0, 20) + '...' : 'None',
        accessToken: accessToken ? accessToken.substring(0, 20) + '...' : 'None'
      });
    }
    
    return authToken || token || jwt || accessToken;
  };

  function setText(node, text) { if (node) node.textContent = text ?? ""; }
  function clearNode(node) { if (!node) return; node.replaceChildren(); }
  function toast(msg, type = "info") {
    const n = document.createElement("div");
    n.textContent = msg;
    n.style.cssText =
      "position:fixed;top:20px;right:20px;padding:10px 12px;border-radius:10px;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.12);z-index:99999";
    n.style.background = type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6";
    document.body.appendChild(n);
    setTimeout(() => { try { n.remove(); } catch {} }, 2400);
  }

  // Helper: make a YYYY-MM-DD key in a target timezone
  function ymdInTimeZone(d = new Date(), tz = userTz) {
    // en-CA locale yields YYYY-MM-DD
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const result = fmt.format(d);
    console.log("[Profile] Date key generated:", result, "for date:", d.toISOString(), "timezone:", tz);
    return result;
  }

  // Helper: convert Arabic numerals to English numerals
  function convertArabicToEnglish(str) {
    const arabicToEnglish = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    return str.replace(/[٠-٩]/g, char => arabicToEnglish[char] || char);
  }

  // Helper: normalize date keys to handle both Arabic and English numerals
  function normalizeDateKeys(logs) {
    const normalized = {};
    Object.keys(logs).forEach(key => {
      const normalizedKey = convertArabicToEnglish(key);
      normalized[normalizedKey] = logs[key];
      console.log("[Profile] Normalized date key:", key, "->", normalizedKey);
    });
    return normalized;
  }

  // ------------------------------- API helpers -------------------------------
  async function apiFetch(url, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };

    // Include Bearer if present, but don't require it (session users work too)
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      // Only log in debug mode
      if (window.location.search.includes('debug')) {
        console.log("[Profile] Using JWT token for API call:", token.substring(0, 20) + '...');
      }
    } else if (window.location.search.includes('debug')) {
      console.log("[Profile] No JWT token, using session cookies");
    }

    // Only log API calls in debug mode
    if (window.location.search.includes('debug')) {
      console.log("[Profile] Making API call to:", url);
      console.log("[Profile] Headers:", headers);
    }

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // <-- send session cookies
    });

    // Only log response status in debug mode or on errors
    if (window.location.search.includes('debug') || res.status !== 200) {
      console.log("[Profile] API response status:", res.status);
    }

    if (res.status === 401) {
      console.error("[Profile] Authentication failed - 401 Unauthorized");
      if (window.location.search.includes('debug')) {
        console.log("[Profile] Available cookies:", document.cookie);
        console.log("[Profile] JWT token present:", !!token);
      }
      
      // Clear any expired tokens from localStorage
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      localStorage.removeItem('jwt');
      localStorage.removeItem('access_token');
      localStorage.removeItem('userData');
      
      // Show login message and redirect after delay
      if (el.dashboardRoot && !el.dashboardRoot.querySelector(".login-needed")) {
        const p = document.createElement("div");
        p.className = "login-needed";
        p.style.cssText = `
          text-align: center; 
          padding: 20px; 
          background: #f8f9fa; 
          border: 1px solid #dee2e6; 
          border-radius: 8px; 
          margin: 20px 0;
        `;
        p.innerHTML = `
          <h3>🔒 Authentication Required</h3>
          <p>You need to log in to view your prayer dashboard.</p>
          <p>Redirecting to login page in <span id="countdown">5</span> seconds...</p>
          <a href="/login.html" class="btn btn-primary" style="margin-top: 10px;">Login Now</a>
        `;
        el.dashboardRoot.appendChild(p);
        
        // Countdown and redirect
        let countdown = 5;
        const countdownEl = p.querySelector('#countdown');
        const timer = setInterval(() => {
          countdown--;
          if (countdownEl) countdownEl.textContent = countdown;
          if (countdown <= 0) {
            clearInterval(timer);
            window.location.href = '/login.html';
          }
        }, 1000);
      }
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.error || j.message || msg; } catch {}
      console.error("[Profile] API call failed:", msg);
      throw new Error(msg);
    }

    try { 
      const result = await res.json();
      // Only log success in debug mode
      if (window.location.search.includes('debug')) {
        console.log("[Profile] API call successful, data received");
      }
      return result;
    } catch { 
      if (window.location.search.includes('debug')) {
        console.log("[Profile] API call successful, no JSON data");
      }
      return {}; 
    }
  }

  async function apiSend(method, url, body) {
    const headers = { "Content-Type": "application/json" };
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
    return apiFetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  }
  const apiGet = (url) => apiFetch(url);
  const apiPost = (url, body) => apiSend("POST", url, body);
  const apiPut = (url, body) => apiSend("PUT", url, body);
  const apiDelete = (url) => apiSend("DELETE", url);

  // ------------------------------- Profile -------------------------------
  async function loadProfile() {
    try {
      const p = await apiGet("/api/user/profile");
      setText(el.userEmail, p.email || "—");
      setText(el.userUsername, p.username || "—");
      const newTz = p.timezone || userTz;
      if (newTz !== userTz) {
        console.log("[Profile] Timezone updated from", userTz, "to", newTz);
        userTz = newTz;
      }
    } catch (error) {
      console.warn("[Profile] Failed to load profile:", error);
      setText(el.userEmail, "—");
      setText(el.userUsername, "—");
    }
  }

  // ------------------------------- Saved Locations -------------------------------
  function renderLocations(locations) {
    const list = el.locationsList;
    clearNode(list);

    if (!Array.isArray(locations) || !locations.length) {
      list.innerHTML = '<p class="muted">You have no saved locations.</p>';
      return;
    }

    locations.forEach((loc) => {
      const item = document.createElement("div");
      item.className = "location-item";

      const left = document.createElement("div");
      left.className = "location-info";
      const title = document.createElement("strong");
      title.textContent = loc.label || "—";
      const addr = document.createElement("small");
      const coords = (Number.isFinite(+loc.lat) && Number.isFinite(+loc.lon))
        ? `(${Number(loc.lat).toFixed(4)}, ${Number(loc.lon).toFixed(4)})`
        : "";
      addr.textContent = (loc.address || coords) + (loc.tz ? ` • ${loc.tz}` : "");
      left.appendChild(title);
      left.appendChild(document.createElement("br"));
      left.appendChild(addr);

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.dataset.label = loc.label;
      del.textContent = "Delete";

      item.appendChild(left);
      item.appendChild(del);
      list.appendChild(item);
    });
  }

  async function loadLocations() {
    try {
      const locations = await apiGet("/api/user/locations");
      renderLocations(locations);
    } catch (e) {
      el.locationsList.innerHTML = '<p class="muted">Failed to load saved locations.</p>';
      console.warn(e);
    }
  }

  async function handleDeleteLocation(e) {
    const btn = e.target;
    if (!btn.classList.contains("delete-btn")) return;

    const label = btn.dataset.label;
    if (!label) return;
    if (!confirm(`Delete saved location "${label}"?`)) return;

    try {
      const updated = await apiDelete(`/api/user/locations/${encodeURIComponent(label)}`);
      renderLocations(updated);
      toast("Location deleted", "success");
    } catch (err) {
      console.error(err);
      toast("Error: Could not delete the location.", "error");
    }
  }

  // ------------------------------- Search & Select -------------------------------
  function normalizeResult(it) {
    // Normalize various search result shapes to a common display + coords
    const lat = parseFloat(it.lat ?? it.latitude);
    const lon = parseFloat(it.lon ?? it.longitude ?? it.lng);
    const name =
      it.name ||
      it.display_name ||
      it.label ||
      [it.city, it.state, it.country].filter(Boolean).join(", ") ||
      (Number.isFinite(lat) && Number.isFinite(lon) ? `${lat}, ${lon}` : "Result");
    return { name, lat, lon, raw: it };
  }

  function renderSearchResults(results) {
    const c = el.searchResults;
    clearNode(c);
    if (!Array.isArray(results) || !results.length) return;

    results.map(normalizeResult).forEach((r) => {
      if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) return;
      const div = document.createElement("div");
      div.className = "search-result-item";
      div.textContent = r.name;
      div.addEventListener("click", () => onSearchResultClick(r));
      c.appendChild(div);
    });
  }

  const handleLocationSearch = debounce(async () => {
    const q = el.searchInput?.value?.trim() || "";
    clearNode(el.searchResults);
    if (q.length < 2) return;

    // Try multiple backends, then fallback to Nominatim
    try {
      // 1) /api/location/search
      let list = await tryGet(`/api/location/search?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`);
      if (!list || !list.length) {
        // 2) /api/geocode
        list = await tryGet(`/api/geocode?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`);
      }
      if (!list || !list.length) {
        // 3) /api/search-city (legacy)
        list = await tryGet(`/api/search-city?query=${encodeURIComponent(q)}`);
      }
      if (!list || !list.length) {
        // 4) Nominatim
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}&accept-language=${encodeURIComponent(lang)}`,
          { headers: { Accept: "application/json" } }
        );
        list = r.ok ? await r.json() : [];
      }
      renderSearchResults(Array.isArray(list) ? list : (list?.results || []));
    } catch (err) {
      console.warn("Search failed:", err);
    }
  }, 300);

  async function tryGet(url) { try { return await apiGet(url); } catch { return null; } }

  async function onSearchResultClick(result) {
    // Hide suggestions
    clearNode(el.searchResults);

    try {
      const info = await getTimezoneAndDisplay(result.lat, result.lon);
      selectedLocation = {
        lat: result.lat,
        lon: result.lon,
        address: info.display || result.name,
        tz: info.tz,
      };

      // populate hidden fields (if used elsewhere)
      el.latInput.value = String(selectedLocation.lat);
      el.lonInput.value = String(selectedLocation.lon);
      el.tzInput.value = selectedLocation.tz;
      el.addressInput.value = selectedLocation.address;

      el.searchInput.value = selectedLocation.address;
      console.log("[Location] Selected:", selectedLocation);
    } catch (e) {
      console.warn("Reverse/TZ lookup failed:", e);
      const fallbackTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      selectedLocation = {
        lat: result.lat,
        lon: result.lon,
        address: result.name,
        tz: fallbackTz,
      };
      el.searchInput.value = selectedLocation.address;
    }
  }

  async function getTimezoneAndDisplay(lat, lon) {
    // Prefer explicit timezone endpoint
    let tz = null, display = null;

    // 1) /api/location/timezone
    try {
      const tzData = await apiGet(`/api/location/timezone?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
      tz = tzData?.timezone || tzData?.tz || tz;
    } catch {}

    // 2) /api/location/reverse-geocode
    try {
      const rg = await apiGet(`/api/location/reverse-geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&lang=${encodeURIComponent(lang)}`);
      if (typeof rg === "string") {
        display = rg;
      } else if (rg && typeof rg === "object") {
        display = rg.display || rg.display_name || [rg.road, rg.city, rg.state, rg.country].filter(Boolean).join(", ");
        tz = tz || rg.tz || rg.timezone || null;
      }
    } catch {}

    if (!tz) tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return { tz, display };
  }

  // ------------------------------- Add new saved location -------------------------------
  async function handleAddLocation(e) {
    e.preventDefault();

    if (!selectedLocation) {
      alert("Please search for and select a location first.");
      return;
    }

    const label = el.labelInput.value.trim();
    if (!label) {
      alert("Please provide a label for the location (e.g., Home).");
      return;
    }

    const payload = {
      label,
      address: selectedLocation.address,
      lat: selectedLocation.lat,
      lon: selectedLocation.lon,
      tz: selectedLocation.tz,
    };

    try {
      const updated = await apiPost("/api/user/locations", payload);
      renderLocations(updated);
      el.addForm.reset();
      selectedLocation = null;
      toast("Location saved", "success");
    } catch (error) {
      console.error("Failed to add location:", error);
      alert(error.message || "Error: Could not save the location. The label might already be in use.");
    }
  }

  // ------------------------------- Prayer Dashboard -------------------------------
  async function fetchMonthlyLogs(date) {
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    console.log("[Profile] Fetching monthly logs for:", monthStr, "timezone:", userTz);
    try {
      const logs = await apiGet(`/api/prayer-log/month?month=${monthStr}`);
      console.log("[Profile] Monthly logs received:", logs);
      return logs;
    } catch (error) {
      console.error("[Profile] Failed to fetch monthly logs:", error.message);
      return {};
    }
  }

  function renderCalendar(date, logs) {
    if (!el.calendar || !el.monthYear) return;

    clearNode(el.calendar);
    el.monthYear.textContent = date.toLocaleString(undefined, { month: "long", year: "numeric" });

    // Normalize the logs to handle Arabic numerals
    const normalizedLogs = normalizeDateKeys(logs);
    console.log("[Profile] Normalized logs:", normalizedLogs);

    const month = date.getMonth();
    const year = date.getFullYear();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Day names
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
      const dayNameCell = document.createElement("div");
      dayNameCell.className = "day-name";
      dayNameCell.textContent = day;
      el.calendar.appendChild(dayNameCell);
    });

    // Padding
    for (let i = 0; i < firstDay; i++) {
      el.calendar.appendChild(document.createElement("div"));
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dayCell = document.createElement("div");
      dayCell.className = "calendar-day";
      
      // Check if this is today
      const isToday = year === today.getFullYear() && 
                     month === today.getMonth() && 
                     d === today.getDate();
      if (isToday) {
        dayCell.classList.add("today");
      }

      const dayNumber = document.createElement("div");
      dayNumber.className = "day-number";
      if (isToday) dayNumber.classList.add("today");
      dayNumber.textContent = d;
      dayCell.appendChild(dayNumber);

      // Prayer labels row
      const labelsContainer = document.createElement("div");
      labelsContainer.className = "prayer-labels";
      PRAYER_LABELS.forEach(label => {
        const labelEl = document.createElement("div");
        labelEl.className = "prayer-label";
        labelEl.textContent = label;
        labelsContainer.appendChild(labelEl);
      });
      dayCell.appendChild(labelsContainer);

      // Prayer dots row
      const dotsContainer = document.createElement("div");
      dotsContainer.className = "prayer-dots";

      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const prayersForDay = normalizedLogs[dateKey] || [];
      
      // Debug logging for today's date
      if (isToday) {
        console.log("[Profile] Today's date key:", dateKey);
        console.log("[Profile] Today's prayers from normalized logs:", prayersForDay);
        console.log("[Profile] Available normalized log keys:", Object.keys(normalizedLogs));
      }

      PRAYER_NAMES.forEach((prayer, index) => {
        const dot = document.createElement("div");
        dot.className = `dot ${prayer}`;
        if (prayersForDay.includes(prayer)) {
          dot.classList.add("prayed");
          dot.textContent = PRAYER_LABELS[index];
        }
        
        // Enhanced tooltip
        const prayerName = prayer[0].toUpperCase() + prayer.slice(1);
        const status = prayersForDay.includes(prayer) ? "✅ Prayed" : "❌ Missed";
        dot.title = `${prayerName} — ${status}`;
        
        dotsContainer.appendChild(dot);
      });

      // Day total with color coding
      const total = document.createElement("div");
      total.className = "day-total";
      const prayerCount = prayersForDay.length;
      total.textContent = `${prayerCount}/5`;
      
      // Color coding based on completion
      if (prayerCount >= 5) {
        total.classList.add("high");
      } else if (prayerCount >= 3) {
        total.classList.add("medium");
      } else if (prayerCount > 0) {
        total.classList.add("low");
      }
      
      dayCell.appendChild(dotsContainer);
      dayCell.appendChild(total);

      // Add click handler for day details
      dayCell.addEventListener("click", () => showDayDetails(dateKey, prayersForDay, d, month, year));

      el.calendar.appendChild(dayCell);
    }
  }

  function calculateStats(logs, date) {
    if (!el.todaysProgress || !el.fajrStreak || !el.monthlyConsistency) return;

    // Normalize the logs to handle Arabic numerals
    const normalizedLogs = normalizeDateKeys(logs);
    console.log("[Profile] Calculating stats with normalized logs:", normalizedLogs);

    const today = new Date();
    const sameMonth =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth();

    // Today's progress (user timezone)
    if (sameMonth) {
      const todayKey = ymdInTimeZone(today, userTz);
      const todaysPrayers = normalizedLogs[todayKey]?.length || 0;
      console.log("[Profile] Today's key:", todayKey, "Prayers:", todaysPrayers);
      el.todaysProgress.textContent = `${todaysPrayers} / 5`;
    } else {
      el.todaysProgress.textContent = "— / 5";
    }

    // Monthly Consistency (up to current day for current month)
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const daysElapsed = sameMonth ? today.getDate() : daysInMonth;
    const totalPossiblePrayers = daysElapsed * 5;

    const totalPrayersLogged = Object.values(normalizedLogs).reduce((sum, prayers) => sum + (Array.isArray(prayers) ? prayers.length : 0), 0);
    const consistency = totalPossiblePrayers > 0
      ? Math.round((totalPrayersLogged / totalPossiblePrayers) * 100)
      : 0;
    el.monthlyConsistency.textContent = `${consistency}%`;

    // Fajr streak (count back from today within the shown month)
    let fajrStreak = 0;
    if (sameMonth) {
      for (let i = today.getDate(); i >= 1; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), i);
        const dateKey = ymdInTimeZone(d, userTz);
        if (normalizedLogs[dateKey] && normalizedLogs[dateKey].includes("fajr")) {
          fajrStreak++;
        } else {
          break;
        }
      }
    } else {
      fajrStreak = 0;
    }
    el.fajrStreak.textContent = `${fajrStreak} days`;

    // Weekly Progress (7-day rolling average)
    const weeklyProgress = calculateWeeklyProgress(normalizedLogs, today, userTz);
    el.weeklyProgress.textContent = `${weeklyProgress}%`;

    // Best Prayer (most consistent prayer)
    const bestPrayer = calculateBestPrayer(normalizedLogs);
    el.bestPrayer.textContent = bestPrayer;

    // Prayer Streak (longest consecutive days with any prayer)
    const prayerStreak = calculatePrayerStreak(normalizedLogs, today, userTz);
    el.prayerStreak.textContent = `${prayerStreak} days`;
  }

  // Helper function to calculate weekly progress
  function calculateWeeklyProgress(logs, today, timezone) {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    
    let weeklyPrayers = 0;
    let weeklyDays = 0;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekAgo);
      date.setDate(weekAgo.getDate() + i);
      const dateKey = ymdInTimeZone(date, timezone);
      
      if (logs[dateKey]) {
        weeklyPrayers += logs[dateKey].length;
        weeklyDays++;
      }
    }
    
    const maxPossible = weeklyDays * 5;
    return maxPossible > 0 ? Math.round((weeklyPrayers / maxPossible) * 100) : 0;
  }

  // Helper function to calculate best prayer
  function calculateBestPrayer(logs) {
    const prayerCounts = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
    const totalDays = Object.keys(logs).length;
    
    if (totalDays === 0) return "--";
    
    Object.values(logs).forEach(prayers => {
      prayers.forEach(prayer => {
        if (prayerCounts.hasOwnProperty(prayer)) {
          prayerCounts[prayer]++;
        }
      });
    });
    
    const bestPrayer = Object.entries(prayerCounts)
      .sort(([,a], [,b]) => b - a)[0];
    
    return bestPrayer ? bestPrayer[0].charAt(0).toUpperCase() + bestPrayer[0].slice(1) : "--";
  }

  // Helper function to calculate prayer streak
  function calculatePrayerStreak(logs, today, timezone) {
    let streak = 0;
    const currentDate = new Date(today);
    
    while (true) {
      const dateKey = ymdInTimeZone(currentDate, timezone);
      if (logs[dateKey] && logs[dateKey].length > 0) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  }

  // Function to show day details when clicking on a calendar day
  function showDayDetails(dateKey, prayersForDay, day, month, year) {
    const date = new Date(year, month, day);
    const dateStr = date.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const prayedCount = prayersForDay.length;
    const missedPrayers = PRAYER_NAMES.filter(prayer => !prayersForDay.includes(prayer));
    
    let message = `📅 ${dateStr}\n\n`;
    message += `✅ Prayed: ${prayedCount}/5 prayers\n`;
    
    if (prayedCount > 0) {
      message += `\n✅ Completed:\n`;
      prayersForDay.forEach(prayer => {
        const prayerName = prayer.charAt(0).toUpperCase() + prayer.slice(1);
        message += `  • ${prayerName}\n`;
      });
    }
    
    if (missedPrayers.length > 0) {
      message += `\n❌ Missed:\n`;
      missedPrayers.forEach(prayer => {
        const prayerName = prayer.charAt(0).toUpperCase() + prayer.slice(1);
        message += `  • ${prayerName}\n`;
      });
    }
    
    alert(message);
  }

  async function updateDashboard() {
    console.log("[Profile] Updating dashboard for month:", currentMonth.toISOString().slice(0, 7));
    const logs = await fetchMonthlyLogs(currentMonth);
    renderCalendar(currentMonth, logs);
    calculateStats(logs, currentMonth);
    
    // Update gamification with prayer data
    updateGamification(logs);
    
    // Debug: Check today's date in different timezones
    const today = new Date();
    const todayUTC = today.toISOString().split('T')[0];
    const todayLocal = ymdInTimeZone(today, userTz);
    console.log("[Profile] Today UTC:", todayUTC, "Today Local:", todayLocal, "Timezone:", userTz);
  }

  function wireDashboardNav() {
    el.prevBtn?.addEventListener("click", () => {
      currentMonth.setMonth(currentMonth.getMonth() - 1);
      updateDashboard();
    });
    el.nextBtn?.addEventListener("click", () => {
      currentMonth.setMonth(currentMonth.getMonth() + 1);
      updateDashboard();
    });
    el.refreshBtn?.addEventListener("click", () => {
      console.log("[Profile] Manual refresh triggered");
      toast("Refreshing dashboard data...", "info");
      updateDashboard();
    });
  }

  // ------------------------------- Gamification -------------------------------
  async function initGamification() {
    try {
      console.log("[Profile] Initializing gamification system");
      
      // Initialize achievements system
      achievements = new PrayerAchievements();
      
      // Initialize gamification UI
      gamificationUI = new GamificationUI(achievements);
      
      // Create and insert gamification section
      const gamificationSection = gamificationUI.createGamificationSection();
      const existingSection = document.getElementById('gamification-section');
      if (existingSection) {
        existingSection.innerHTML = gamificationSection.innerHTML;
      }
      
      // Initialize the UI
      gamificationUI.initialize();
      
      console.log("[Profile] Gamification system initialized successfully");
    } catch (error) {
      console.error("[Profile] Gamification initialization failed:", error);
    }
  }

  // Update gamification when prayer data changes
  function updateGamification(prayerData) {
    if (achievements && gamificationUI) {
      console.log("[Profile] Updating gamification with prayer data");
      gamificationUI.updateAchievements(prayerData);
    }
  }

  // ------------------------------- Init -------------------------------
  async function init() {
    try {
      await Promise.all([loadProfile(), loadLocations()]);
    } catch (e) {
      console.warn("Init issue:", e);
      const root = document.querySelector(".container");
      if (root) {
        root.innerHTML = '<h2>Error</h2><p>Could not load your profile. Please make sure you are logged in.</p>';
      }
      return; // stop here if profile fails hard
    }

    // Initialize gamification system
    await initGamification();

    // listeners (profile & locations)
    el.addForm?.addEventListener("submit", handleAddLocation);
    el.locationsList?.addEventListener("click", handleDeleteLocation);
    el.searchInput?.addEventListener("input", handleLocationSearch);

    // click-away to close search results
    document.addEventListener("click", (ev) => {
      if (!el.searchResults) return;
      if (!el.searchResults.contains(ev.target) && ev.target !== el.searchInput) {
        clearNode(el.searchResults);
      }
    });

    // Dashboard
    wireDashboardNav();
    updateDashboard(); // Initial dashboard load (works for session or JWT)
    
    // Listen for real-time prayer logs updates
    window.addEventListener('prayerLogsUpdated', (event) => {
      console.log('[Profile] Prayer logs updated via real-time service:', event.detail.logs);
      // Refresh the dashboard with new prayer logs data
      const currentDate = new Date();
      renderCalendar(currentDate, event.detail.logs);
      // Note: updateStats function doesn't exist, so we just update the calendar
    });

    // Listen for cross-page prayer log updates
    window.addEventListener('prayerLogUpdated', (event) => {
      console.log('[Profile] Prayer log updated via cross-page sync:', event.detail);
      // Refresh the dashboard immediately
      updateDashboard();
    });

    // Check for stored prayer log updates
    let lastPrayerLogCheck = 0;
    const checkForPrayerLogUpdates = () => {
      try {
        // Check for simple flag first
        const prayerLogChanged = localStorage.getItem('prayerLogChanged');
        if (prayerLogChanged) {
          const changeTime = parseInt(prayerLogChanged);
          if (changeTime > lastPrayerLogCheck) {
            console.log('[Profile] Prayer log changed detected, refreshing dashboard');
            updateDashboard();
            lastPrayerLogCheck = changeTime;
            // Clear the flag after processing
            localStorage.removeItem('prayerLogChanged');
          }
        }
        
        // Also check for detailed update data
        const updateData = localStorage.getItem('prayerLogUpdate');
        if (updateData) {
          const update = JSON.parse(updateData);
          const now = Date.now();
          // Only process updates from the last 5 minutes
          if (now - update.timestamp < 300000) {
            console.log('[Profile] Found recent prayer log update:', update);
            updateDashboard();
            // Clear the update after processing
            localStorage.removeItem('prayerLogUpdate');
          }
        }
      } catch (error) {
        console.error('[Profile] Error checking for prayer log updates:', error);
      }
    };

    // Check for updates every 1 second for faster response
    setInterval(checkForPrayerLogUpdates, 1000);
  }

  init();
});
