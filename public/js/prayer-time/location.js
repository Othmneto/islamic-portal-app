/* ------------------------------------------------------------------
   Location services and geocoding
   - Location detection (saved, IP, GPS)
   - Geocoding search
   - Reverse geocoding
   - Location search UI
------------------------------------------------------------------- */

export class PrayerTimesLocation {
  constructor(core, api) {
    console.log("[Location] Initializing PrayerTimesLocation");
    this.core = core;
    this.api = api;
  }

  // Geocode search
  async geocodeSearch(q) {
    console.log(`[Location] Searching for: ${q}`);
    const lang =
      (localStorage.getItem("language") || document.documentElement.lang || "en").split("-")[0];

    try {
      const r = await fetch(
        `/api/geocode?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`,
        { headers: { Accept: "application/json" }, credentials: "include" }
      );
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j) && j.length) {
          console.log(`[Location] Found ${j.length} results from API`);
          return j;
        }
        if (Array.isArray(j.results)) {
          console.log(`[Location] Found ${j.results.length} results from API`);
          return j.results;
        }
      }
    } catch (e) {
      console.warn("[Location] API geocode failed:", e);
    }

    console.log("[Location] Trying OpenStreetMap geocoding");
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(
      q
    )}&accept-language=${encodeURIComponent(lang)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.warn("[Location] OpenStreetMap geocode failed:", res.status);
      return [];
    }
    const list = await res.json();
    console.log(`[Location] Found ${Array.isArray(list) ? list.length : 0} results from OpenStreetMap`);
    return Array.isArray(list) ? list : [];
  }

  // Render search results
  renderSearchResults(items) {
    const box = this.core.el.locResults;
    if (!box) return;
    if (!items.length) {
      this.core.clearNode(box);
      box.style.display = "none";
      return;
    }
    this.core.clearNode(box);
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
      itemDiv.addEventListener("click", () => this.applyResult(items[Number(itemDiv.dataset.idx)]));
      itemDiv.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          this.applyResult(items[Number(itemDiv.dataset.idx)]);
        }
      });
      box.appendChild(itemDiv);
    });
    box.style.display = "block";
  }

  // Fetch reverse geocode
  async fetchReverseGeocode(lat, lon, lang = "en") {
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

  // Get rich location from coordinates
  async getRichLocationFromCoords(lat, lon, lang = "en") {
    const j = await this.fetchReverseGeocode(lat, lon, lang);
    if (j) {
      return {
        lat,
        lon,
        display: j.display || [j.city, j.state, j.country].filter(Boolean).join(", "),
        tz: j.tz || j.timezone || this.core.initialTZ,
        city: j.city || null,
        country: j.country || null,
        countryCode: j.countryCode || null,
        source: j.source || "gps",
        confidence: typeof j.confidence === "number" ? j.confidence : 0.95,
      };
    }
    return { lat, lon, display: "Selected location", tz: this.core.initialTZ, source: "manual", confidence: 0.5 };
  }

  // Apply search result
  async applyResult(it) {
    const lat = parseFloat(it.lat ?? it.latitude);
    const lon = parseFloat(it.lon ?? it.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.warn("[Location] Invalid coordinates in search result");
      return;
    }

    console.log(`[Location] Applying search result: ${lat}, ${lon}`);
    const lang = (localStorage.getItem("language") || "en").split("-")[0];
    const rich = await this.getRichLocationFromCoords(lat, lon, lang);
    console.log(`[Location] Rich location data:`, rich);
    await this.refreshPrayerTimesByLocation(rich);
    if (this.core.el.locInput) this.core.el.locInput.value = rich.display || "";
    if (this.core.el.locResults) this.core.el.locResults.style.display = "none";
  }

  // Setup location search
  setupLocationSearch() {
    if (!this.core.el.locInput) return;
    const run = this.core.debounce(async () => {
      const q = this.core.el.locInput.value.trim();
      if (q.length < 2) {
        this.renderSearchResults([]);
        return;
      }
      try {
        const res = await this.geocodeSearch(q);
        this.renderSearchResults(res);
      } catch (e) {
        console.warn("[Geocode] error:", e?.message || e);
        this.renderSearchResults([]);
      }
    }, 350);
    this.core.el.locInput.addEventListener("input", run);
    document.addEventListener("click", (e) => {
      if (!this.core.el.locResults) return;
      if (!this.core.el.locResults.contains(e.target) && e.target !== this.core.el.locInput)
        this.core.el.locResults.style.display = "none";
    });
  }

  // Fetch city geocode
  async fetchCityGeocode(city) {
    try {
      const r = await fetch(`/api/geocode?city=${encodeURIComponent(city)}`);
      if (r.ok) return r.json();
    } catch {}
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`);
      if (r.ok) return r.json();
    } catch {}
    const list = await this.geocodeSearch(city);
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

  // Setup legacy search button
  setupLegacySearch() {
    if (this.core.el.legacySearchBtn && this.core.el.legacyCityInput) {
      this.core.el.legacySearchBtn.addEventListener("click", async () => {
        const city = this.core.el.legacyCityInput.value.trim();
        if (!city) return;
        this.core.showLocationMessage(`Searching for ${city}…`, "info");
        try {
          const data = await this.fetchCityGeocode(city);
          const lat = data.latitude ?? data.lat;
          const lon = data.longitude ?? data.lon;
          const name = data.name || data.display || city;
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Invalid coords");
          const rich = await this.getRichLocationFromCoords(lat, lon);
          rich.display = name || rich.display;
          await this.refreshPrayerTimesByLocation(rich);
          if (this.core.el.manualLocContainer) this.core.el.manualLocContainer.style.display = "none";
        } catch (err) {
          this.core.showLocationMessage(`Could not find "${city}". Please try again.`, "error");
        }
      });
    }
  }

  // Default location by timezone
  defaultLocationByTZ() {
    if (/Africa\/Cairo|Egypt/i.test(this.core.state.tz)) {
      return { lat: 30.5877, lon: 31.1813, display: "Banha, Egypt (Default)", tz: this.core.state.tz };
    }
    return { lat: 25.2048, lon: 55.2708, display: "Dubai, UAE (Default)", tz: this.core.state.tz };
  }

  // Show correction prompt
  showCorrectionPrompt(city) {
    if (!this.core.el.location) return;
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
      if (this.core.el.locInput) this.core.el.locInput.focus();
      span.remove();
    });

    span.appendChild(btn);
    this.core.el.location.insertAdjacentElement("afterend", span);
  }

  // Ensure precise button
  ensurePreciseButton() {
    if (!this.core.el.location) return;
    const existing = document.getElementById("precise-location-btn");
    if (existing) return;

    const btn = document.createElement("button");
    btn.id = "precise-location-btn";
    btn.type = "button";
    btn.className = "btn-link";
    btn.style.marginLeft = "8px";
    btn.textContent = "Use precise location";
    btn.addEventListener("click", this.usePreciseLocation.bind(this));

    this.core.el.location.insertAdjacentElement("afterend", btn);
  }

  // Use precise location
  async usePreciseLocation() {
    if (!navigator.geolocation) {
      this.core.showLocationMessage("Geolocation not supported on this device", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lon = p.coords.longitude;
        const lang = (localStorage.getItem("language") || "en").split("-")[0];
        const rich = await this.getRichLocationFromCoords(lat, lon, lang);
        await this.refreshPrayerTimesByLocation(rich);
        this.core.showLocationMessage("Location found! Fetching prayer times...", "success");
      },
      (err) => {
        console.warn("[Geo] precise failed:", err?.message || err);
        this.core.showLocationMessage("Could not get precise location", "error");
        if (this.core.el.manualLocContainer) this.core.el.manualLocContainer.style.display = "block";
        if (this.core.el.loading) this.core.el.loading.style.display = "none";
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
    );
  }

  // Find location on startup
  async findLocationOnStartup() {
    console.log("[Location] Starting location detection");
    try {
      const saved = JSON.parse(localStorage.getItem("lastLocation") || "null");
      if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) {
        console.log("[Location] Using saved location:", saved);
        const loc = {
          lat: saved.lat,
          lon: saved.lon,
          display: saved.display || saved.label || "Saved Location",
          tz: saved.tz || this.core.state.tz,
          source: "saved",
          confidence: 0.9,
        };
        await this.refreshPrayerTimesByLocation(loc);
        this.ensurePreciseButton();
        return;
      }
    } catch (e) {
      console.warn("[Location] Failed to load saved location:", e);
    }

    try {
      console.log("[Location] Trying IP-based geolocation");
      if (this.core.el.loading) {
        this.core.el.loading.style.display = "block";
        this.core.clearNode(this.core.el.loading);
        const p = document.createElement("p");
        p.textContent = "Detecting your city…";
        this.core.el.loading.appendChild(p);
      }
      const r = await fetch("/api/location/ip-lookup", { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        console.log("[Location] IP geolocation data:", data);
        const display = [data.city, data.country].filter(Boolean).join(", ") || "Detected City";
        const tzStr = data.tz || data.timezone || this.core.state.tz;
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
        await this.refreshPrayerTimesByLocation(loc);
        this.ensurePreciseButton();
        if (data.city) this.showCorrectionPrompt(data.city);
        return;
      }
      throw new Error(`IP lookup ${r.status}`);
    } catch (e) {
      console.warn("[Location] IP geolocation failed:", e?.message || e);
    }

    console.log("[Location] Falling back to default location");
    if (this.core.el.loading) {
      this.core.clearNode(this.core.el.loading);
      this.core.el.loading.style.display = "block";
      const p = document.createElement("p");
      p.textContent = "Could not detect your location automatically. Please search for your city.";
      this.core.el.loading.appendChild(p);
    }
    if (this.core.el.locInput?.parentElement) this.core.el.locInput.parentElement.style.display = "block";

    const def = this.defaultLocationByTZ();
    console.log("[Location] Using default location:", def);
    await this.refreshPrayerTimesByLocation(def);
    this.ensurePreciseButton();
  }

  // This method will be set by the main module
  refreshPrayerTimesByLocation = null;
}
