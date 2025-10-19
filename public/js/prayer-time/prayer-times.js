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

  // Smart auto-detection of calculation method based on location
  getAutoCalculationMethod(lat, lon) {
    // UAE/Saudi Arabia region - use Umm al-Qura (most accurate for the region)
    if (this.isInUAE(lat, lon) || this.isInSaudiArabia(lat, lon)) {
      console.log("[PrayerTimes] Auto-selected Umm al-Qura method for UAE/Saudi region");
      return adhan.CalculationMethod.UmmAlQura();
    }

    // Egypt region - use Egyptian method
    if (this.isInEgypt(lat, lon)) {
      console.log("[PrayerTimes] Auto-selected Egyptian method for Egypt region");
      return adhan.CalculationMethod.Egyptian();
    }

    // Turkey region - use Diyanet method
    if (this.isInTurkey(lat, lon)) {
      console.log("[PrayerTimes] Auto-selected Diyanet method for Turkey region");
      return adhan.CalculationMethod.Turkey();
    }

    // Indonesia/Malaysia region - use Singapore method (similar latitude)
    if (this.isInIndonesiaMalaysia(lat, lon)) {
      console.log("[PrayerTimes] Auto-selected Singapore method for Indonesia/Malaysia region");
      return adhan.CalculationMethod.Singapore();
    }

    // Pakistan region - use Karachi method
    if (this.isInPakistan(lat, lon)) {
      console.log("[PrayerTimes] Auto-selected Karachi method for Pakistan region");
      return adhan.CalculationMethod.Karachi();
    }

    // Default to Muslim World League for other regions
    console.log("[PrayerTimes] Auto-selected Muslim World League method for region");
    return adhan.CalculationMethod.MuslimWorldLeague();
  }

  // Smart auto-detection of madhab based on location
  getAutoMadhab(lat, lon) {
    // Turkey, Pakistan, Bangladesh, parts of India - Hanafi majority regions
    if (this.isInTurkey(lat, lon) || this.isInPakistan(lat, lon) || this.isInBangladesh(lat, lon)) {
      console.log("[PrayerTimes] Auto-selected Hanafi madhab for Hanafi-majority region");
      return adhan.Madhab.Hanafi;
    }

    // Default to Shafi for other regions (including UAE, Saudi Arabia, Egypt, etc.)
    console.log("[PrayerTimes] Auto-selected Shafi madhab for region");
    return adhan.Madhab.Shafi;
  }

  // Location detection helper methods
  isInUAE(lat, lon) {
    // UAE coordinates roughly: 22.5-26.5°N, 51-57°E
    return lat >= 22.5 && lat <= 26.5 && lon >= 51 && lon <= 57;
  }

  isInSaudiArabia(lat, lon) {
    // Saudi Arabia coordinates roughly: 16-32°N, 34-56°E
    return lat >= 16 && lat <= 32 && lon >= 34 && lon <= 56;
  }

  isInEgypt(lat, lon) {
    // Egypt coordinates roughly: 22-32°N, 24-37°E
    return lat >= 22 && lat <= 32 && lon >= 24 && lon <= 37;
  }

  isInTurkey(lat, lon) {
    // Turkey coordinates roughly: 35-42°N, 25-45°E
    return lat >= 35 && lat <= 42 && lon >= 25 && lon <= 45;
  }

  isInIndonesiaMalaysia(lat, lon) {
    // Indonesia/Malaysia coordinates roughly: -11 to 7°N, 95-141°E
    return lat >= -11 && lat <= 7 && lon >= 95 && lon <= 141;
  }

  isInPakistan(lat, lon) {
    // Pakistan coordinates roughly: 23-37°N, 60-78°E
    return lat >= 23 && lat <= 37 && lon >= 60 && lon <= 78;
  }

  isInBangladesh(lat, lon) {
    // Bangladesh coordinates roughly: 20.5-26.5°N, 88-93°E
    return lat >= 20.5 && lat <= 26.5 && lon >= 88 && lon <= 93;
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

  // Fetch fine-tuning adjustments from API
  async fetchFineTuningAdjustments(lat, lon) {
    try {
      const response = await fetch(
        `/api/prayer-times-fine-tuning/region?lat=${lat}&lon=${lon}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        console.warn("[PrayerTimes] Failed to fetch fine-tuning data, using local defaults");
        return null;
      }

      const data = await response.json();
      if (data.success) {
        console.log(`[PrayerTimes] Loaded fine-tuning for ${data.region.name} (${data.region.authority})`);
        return data.adjustments;
      }

      return null;
    } catch (error) {
      console.warn("[PrayerTimes] Error fetching fine-tuning data:", error);
      return null;
    }
  }

  // Apply fine-tuning adjustments to prayer times based on location
  async applyFineTuning(times, lat, lon) {
    if (!times) return times;

    const methodKey = this.core.el.methodSel?.value || this.core.state.settings.calculationMethod || "auto";

    // Only apply fine-tuning when using auto method (region-specific adjustments)
    if (methodKey !== "auto") {
      return times; // User manually selected a method, don't adjust
    }

    // Try to fetch fine-tuning from API first (dynamic, worldwide support)
    const apiAdjustments = await this.fetchFineTuningAdjustments(lat, lon);

    if (apiAdjustments) {
      console.log("[PrayerTimes] Applying API-based fine-tuning adjustments:", apiAdjustments);

      // Apply adjustments from API (in minutes)
      const prayers = ['fajr', 'shuruq', 'dhuhr', 'asr', 'maghrib', 'isha'];
      prayers.forEach(prayer => {
        if (times[prayer] && apiAdjustments[prayer] !== undefined) {
          const date = new Date(times[prayer]);
          date.setMinutes(date.getMinutes() + apiAdjustments[prayer]);
          times[prayer] = date.toISOString();
        }
      });

      return times;
    }

    // Fallback to hardcoded adjustments for UAE (backward compatibility)
    if (this.isInUAE(lat, lon)) {
      console.log("[PrayerTimes] Applying UAE fine-tuning adjustments (fallback)");

      // Adjustments based on comparison with UAE official Islamic Affairs times
      if (times.fajr) {
        const fajrDate = new Date(times.fajr);
        times.fajr = new Date(fajrDate.getTime() - (1 * 60 * 1000)).toISOString();
      }

      if (times.shuruq) {
        const shuruqDate = new Date(times.shuruq);
        times.shuruq = new Date(shuruqDate.getTime() + (3 * 60 * 1000)).toISOString();
      }

      if (times.dhuhr) {
        const dhuhrDate = new Date(times.dhuhr);
        times.dhuhr = new Date(dhuhrDate.getTime() - (3 * 60 * 1000)).toISOString();
      }

      if (times.asr) {
        const asrDate = new Date(times.asr);
        times.asr = new Date(asrDate.getTime() - (2 * 60 * 1000)).toISOString();
      }

      if (times.maghrib) {
        const maghribDate = new Date(times.maghrib);
        times.maghrib = new Date(maghribDate.getTime() - (3 * 60 * 1000)).toISOString();
      }

      if (times.isha) {
        const ishaDate = new Date(times.isha);
        times.isha = new Date(ishaDate.getTime() + (13 * 60 * 1000)).toISOString();
      }
    }

    // Saudi Arabia Region Fine-tuning (Riyadh, Jeddah, Mecca, Medina)
    // Umm al-Qura method is most accurate for Saudi, minimal adjustments needed
    else if (this.isInSaudiArabia(lat, lon)) {
      console.log("[PrayerTimes] Applying Saudi Arabia fine-tuning adjustments");
      // Umm al-Qura is designed for Saudi Arabia, so adjustments are minimal
      // Add any necessary adjustments here based on official Saudi times
    }

    // For other regions, Adhan.js calculations are accurate enough
    // The region-specific calculation methods handle the differences

    return times;
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
      this.core.el.methodSel?.value || this.core.state.settings.calculationMethod || "auto";

    // Smart auto-detection based on location
    const method = methodKey === "auto"
      ? this.getAutoCalculationMethod(lat, lon)
      : adhan.CalculationMethod[methodKey]?.() ||
        this.getAutoCalculationMethod(lat, lon);
    const madhabKey = this.core.el.madhabSel?.value || this.core.state.settings.madhab || "auto";

    // Smart auto-detection of madhab based on location
    method.madhab = madhabKey === "auto"
      ? this.getAutoMadhab(lat, lon)
      : madhabKey === "hanafi" ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

    const now = new Date();
    const coords = new adhan.Coordinates(lat, lon);
    const pt = new adhan.PrayerTimes(coords, now, method);

    // Apply region-specific fine-tuning for accuracy
    if (this.isInUAE(lat, lon) && methodKey === "auto") {
      // UAE fine-tuning adjustments
      pt.fajr = new Date(pt.fajr.getTime() - (1 * 60 * 1000));
      pt.sunrise = new Date(pt.sunrise.getTime() + (3 * 60 * 1000));
      pt.dhuhr = new Date(pt.dhuhr.getTime() - (3 * 60 * 1000));
      pt.asr = new Date(pt.asr.getTime() - (2 * 60 * 1000));
      pt.maghrib = new Date(pt.maghrib.getTime() - (3 * 60 * 1000));
      pt.isha = new Date(pt.isha.getTime() + (13 * 60 * 1000));
    }

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
      const data = await this.fetchServerTimes(loc.lat, loc.lon);
      const norm = this.normalizeData(data);
      if (!norm) throw new Error("Invalid data from server");
      console.log("[PrayerTimes] Server data received successfully");

      // Apply fine-tuning adjustments based on location
      norm.times = await this.applyFineTuning(norm.times, loc.lat, loc.lon);

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

  // Update date display and refresh prayer times for the new day
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

    // Refresh prayer times for the new day
    if (this.core.state.locationData) {
      console.log(`[PrayerTimes] Refreshing prayer times for new day`);
      this.refreshPrayerTimesByLocation(this.core.state.locationData);
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
