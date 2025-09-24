/* ------------------------------------------------------------------
   Prayer times calculation and display
   - Server fetch with local Adhan.js fallback
   - Time formatting and display
   - Countdown timer
   - Data normalization
------------------------------------------------------------------- */

export class PrayerTimesCalculator {
  constructor(core, api, location) {
    console.log("[PrayerTimes] Initializing PrayerTimesCalculator");
    this.core = core;
    this.api = api;
    this.location = location;
    this.onAdhanPlay = null;
    this.onSubscriptionUpdate = null;
  }

  // Format time
  formatTime(dateISO, fallback = "--:--") {
    if (!dateISO) return fallback;
    const d = new Date(dateISO);
    if (isNaN(d)) return fallback;
    const use24 = !!(this.core.el.clock24Toggle?.checked || localStorage.getItem("clockFormat24") === "true");
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: !use24,
    });
  }

  // Normalize data
  normalizeData(data) {
    if (!data) return null;
    
    // Generate current date formatting
    const now = new Date();
    const gregorianDate = now.toLocaleDateString(undefined, {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const hijriDate = new Intl.DateTimeFormat("en-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);
    
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
          gregorian: data.date?.gregorian || gregorianDate,
          hijri: data.date?.hijri || hijriDate,
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
        dateMeta: {
          gregorian: data.date?.gregorian || gregorianDate,
          hijri: data.date?.hijri || hijriDate,
        },
      };
    }
    return null;
  }

  // Resolve auto client settings
  resolveAutoClient(method, madhab, tzString) {
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

  // Fetch server times
  async fetchServerTimes(lat, lon) {
    const { method, madhab } = this.resolveAutoClient(
      this.core.el.methodSel?.value || "auto",
      this.core.el.madhabSel?.value || "auto",
      this.core.state.tz
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

  // Compute local times fallback
  computeLocalTimesFallback(lat, lon) {
    if (!window.adhan) throw new Error("Local fallback requires Adhan.js");

    const methodKey =
      this.core.el.methodSel?.value || this.core.state.settings.calculationMethod || "MuslimWorldLeague";
    const method =
      methodKey === "auto"
        ? adhan.CalculationMethod.MuslimWorldLeague()
        : adhan.CalculationMethod[methodKey]?.() ||
          adhan.CalculationMethod.MuslimWorldLeague();
    const madhabKey = this.core.el.madhabSel?.value || this.core.state.settings.madhab || "shafii";
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

  // Cache key
  cacheKey(lat, lon, date = new Date()) {
    return `prayerTimes_${lat.toFixed(2)}_${lon.toFixed(2)}_${date.toISOString().split("T")[0]}`;
  }

  // Refresh prayer times by location
  async refreshPrayerTimesByLocation(loc) {
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) {
      console.warn("[PrayerTimes] Invalid location data:", loc);
      return;
    }

    console.log(`[PrayerTimes] Refreshing prayer times for: ${loc.display} (${loc.lat}, ${loc.lon})`);
    const tzStr = loc.tz || loc.timezone || this.core.state.tz || this.core.initialTZ;

    this.core.updateState({
      locationData: loc,
      coords: { lat: loc.lat, lon: loc.lon },
      cityLabel: loc.display || this.core.state.cityLabel || "",
      tz: tzStr,
    });

    if (this.core.el.location) this.core.el.location.textContent = this.core.state.cityLabel || "";

    if (this.core.el.loading) this.core.el.loading.style.display = "block";
    if (this.core.el.content) this.core.el.content.style.display = "none";

    const key = this.cacheKey(loc.lat, loc.lon);
    const cached = localStorage.getItem(key);
    if (cached) {
      console.log("[PrayerTimes] Using cached prayer times");
      try {
        const j = JSON.parse(cached);
        const norm = this.normalizeData(j) || j;
        this.applyData(norm, this.core.state.cityLabel);
      } catch (e) {
        console.warn("[PrayerTimes] Cache parse failed:", e);
      }
    }

    try {
      console.log("[PrayerTimes] Fetching prayer times from server");
      const data = await this.fetchServerTimes(loc.lat, loc.lon, tzStr);
      const norm = this.normalizeData(data);
      if (!norm) throw new Error("Invalid data from server");
      console.log("[PrayerTimes] Server data received successfully");
      this.applyData(norm, this.core.state.cityLabel);
      localStorage.setItem(key, JSON.stringify(norm));
      localStorage.setItem(
        "lastLocation",
        JSON.stringify({ lat: loc.lat, lon: loc.lon, display: this.core.state.cityLabel, tz: tzStr })
      );
      if (this.core.el.notifToggle?.checked) {
        console.log("[PrayerTimes] Updating subscription");
        this.onSubscriptionUpdate?.();
      }
    } catch (err) {
      console.warn("[PrayerTimes] Server failed; using local calculation:", err?.message || err);
      try {
        console.log("[PrayerTimes] Computing local prayer times");
        const local = this.computeLocalTimesFallback(loc.lat, loc.lon);
        this.applyData(this.normalizeData(local), this.core.state.cityLabel);
        localStorage.setItem(key, JSON.stringify(local));
        console.log("[PrayerTimes] Local calculation successful");
      } catch (e) {
        this.core.showLocationMessage("Failed to compute prayer times", "error");
        console.error("[PrayerTimes] Local calculation failed:", e);
      }
    }
  }

  // Populate table if exists
  populateTableIfExists(timesISO) {
    if (!this.core.el.prayerTimesTableBody) return;
    this.core.el.prayerTimesTableBody.replaceChildren();
    const order = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
    order.forEach((prayer) => {
      const tr = this.core.el.prayerTimesTableBody.insertRow();
      const nameCell = tr.insertCell(0);
      const timeCell = tr.insertCell(1);
      nameCell.textContent = prayer.charAt(0).toUpperCase() + prayer.slice(1);
      timeCell.textContent = this.formatTime(timesISO[prayer]);
    });
  }

  // Apply data to UI
  applyData(normalized, displayLabel) {
    if (!normalized || !normalized.times) {
      console.warn("[PrayerTimes] Invalid data for UI update");
      return;
    }

    console.log("[PrayerTimes] Applying prayer times data to UI");
    this.core.updateState({
      times: normalized.times,
      periods: normalized.periods || null,
      dateMeta: normalized.dateMeta,
      cityLabel: displayLabel || this.core.state.cityLabel,
    });

    if (this.core.el.fajr) this.core.el.fajr.textContent = this.formatTime(this.core.state.times.fajr);
    if (this.core.el.dhuhr) this.core.el.dhuhr.textContent = this.formatTime(this.core.state.times.dhuhr);
    if (this.core.el.asr) this.core.el.asr.textContent = this.formatTime(this.core.state.times.asr);
    if (this.core.el.maghrib) this.core.el.maghrib.textContent = this.formatTime(this.core.state.times.maghrib);
    if (this.core.el.isha) this.core.el.isha.textContent = this.formatTime(this.core.state.times.isha);

    if (this.core.el.shuruq) this.core.el.shuruq.textContent = this.formatTime(this.core.state.times.shuruq);

    if (this.core.state.periods) {
      if (this.core.el.imsakStart) this.core.el.imsakStart.textContent = this.formatTime(this.core.state.periods?.imsak?.start);
      if (this.core.el.imsakEnd) this.core.el.imsakEnd.textContent = this.formatTime(this.core.state.periods?.imsak?.end);
      if (this.core.el.duhaStart) this.core.el.duhaStart.textContent = this.formatTime(this.core.state.periods?.duha?.start);
      if (this.core.el.duhaEnd) this.core.el.duhaEnd.textContent = this.formatTime(this.core.state.periods?.duha?.end);
      if (this.core.el.tahajjudStart) this.core.el.tahajjudStart.textContent = this.formatTime(this.core.state.periods?.tahajjud?.start);
      if (this.core.el.tahajjudEnd) this.core.el.tahajjudEnd.textContent = this.formatTime(this.core.state.periods?.tahajjud?.end);
    }

    if (this.core.el.gregorian) this.core.el.gregorian.textContent = this.core.state.dateMeta?.gregorian || "";
    if (this.core.el.hijri) this.core.el.hijri.textContent = this.core.state.dateMeta?.hijri || "";
    if (this.core.el.location) this.core.el.location.textContent = this.core.state.cityLabel || "";

    this.populateTableIfExists(this.core.state.times);

    if (this.core.el.loading) this.core.el.loading.style.display = "none";
    if (this.core.el.content) this.core.el.content.style.display = "block";

    this.api.saveUserLocation(this.core.state.coords?.lat, this.core.state.coords?.lon, this.core.state.cityLabel).catch(() => {});
    if (Number.isFinite(this.core.state.coords?.lat) && Number.isFinite(this.core.state.coords?.lon)) {
      localStorage.setItem(
        "lastLocation",
        JSON.stringify({ lat: this.core.state.coords.lat, lon: this.core.state.coords.lon, display: this.core.state.cityLabel, tz: this.core.state.tz })
      );
    }

    this.startCountdown();
  }

  // Start countdown timer
  startCountdown() {
    console.log("[PrayerTimes] Starting countdown timer");
    if (this.core.state.countdownTimerId) clearInterval(this.core.state.countdownTimerId);
    this.core.state.countdownTimerId = setInterval(() => {
      if (!this.core.state.times) return;

      const now = new Date();
      const order = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
      let nextName = "fajr";
      let nextTime = null;

      for (const p of order) {
        const t = new Date(this.core.state.times[p]);
        if (t > now) {
          nextName = p;
          nextTime = t;
          break;
        }
      }
      if (!nextTime) {
        if (this.core.el.nextPrayerName) this.core.el.nextPrayerName.textContent = "Isha";
        if (this.core.el.countdown) this.core.el.countdown.textContent = "Finished for today";
        return;
      }

      let currentName = null;
      for (let i = order.length - 1; i >= 0; i--) {
        const t = new Date(this.core.state.times[order[i]]);
        if (t < now) { currentName = order[i]; break; }
      }
      if (nextName === "fajr" && !currentName) currentName = "isha";

      const fmt = { timeZone: this.core.state.tz, year: "numeric", month: "2-digit", day: "2-digit" };
      const todayTz = new Intl.DateTimeFormat("en-CA", fmt).format(now);
      const fajrDayTz = new Intl.DateTimeFormat("en-CA", fmt).format(new Date(this.core.state.times.fajr));
      if (todayTz !== fajrDayTz) {
        if (this.core.state.locationData) this.refreshPrayerTimesByLocation(this.core.state.locationData);
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
      if (this.core.el.nextPrayerName)
        this.core.el.nextPrayerName.textContent = nextName.charAt(0).toUpperCase() + nextName.slice(1);
      if (this.core.el.countdown)
        this.core.el.countdown.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(
          2, "0"
        )}:${String(s).padStart(2, "0")}`;

      if (this.core.el.adhanToggle?.checked && diff < 800 && diff > -2000) {
        // This will be handled by audio module
        this.onAdhanPlay?.();
      }
    }, 1000);
  }

  // Update date display
  updateDateDisplay() {
    const now = new Date();
    const gregorianDate = now.toLocaleDateString(undefined, {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const hijriDate = new Intl.DateTimeFormat("en-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);

    console.log(`[PrayerTimes] Updating date display - Gregorian: ${gregorianDate}, Hijri: ${hijriDate}`);
    
    if (this.core.el.gregorian) {
      this.core.el.gregorian.textContent = gregorianDate;
      console.log(`[PrayerTimes] Gregorian date element found and updated`);
    } else {
      console.warn(`[PrayerTimes] Gregorian date element not found`);
    }
    
    if (this.core.el.hijri) {
      this.core.el.hijri.textContent = hijriDate;
      console.log(`[PrayerTimes] Hijri date element found and updated`);
    } else {
      console.warn(`[PrayerTimes] Hijri date element not found`);
    }
  }

  // Initialize prayer times calculator
  initialize() {
    // Update dates immediately on page load
    this.updateDateDisplay();
    
    // Set up daily date update at midnight
    this.setupDailyDateUpdate();
  }

  // Setup daily date update at midnight
  setupDailyDateUpdate() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    console.log(`[PrayerTimes] Setting up daily date update in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
    
    setTimeout(() => {
      this.updateDateDisplay();
      // Set up recurring daily updates
      setInterval(() => {
        this.updateDateDisplay();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilMidnight);
  }
}
