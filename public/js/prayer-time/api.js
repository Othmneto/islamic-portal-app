/* ------------------------------------------------------------------
   API communication and authentication utilities
   - Unified auth helpers (JWT + session cookie)
   - API fetch wrapper
   - CSRF token handling
------------------------------------------------------------------- */

export class PrayerTimesAPI {
  constructor() {
    console.log("[API] Initializing PrayerTimesAPI");
  }

  // Get authentication token from various sources
  getAuthToken() {
    return (
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("access_token")
    );
  }

  // Get CSRF token from cookies
  getCsrf() {
    return (document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/) || [])[1];
  }

  // Unified API fetch with auth and CSRF handling
  async apiFetch(url, options = {}) {
    console.log(`[API] Fetching: ${options.method || "GET"} ${url}`);
    const method = (options.method || "GET").toUpperCase();
    const headers = { Accept: "application/json", ...(options.headers || {}) };

    // Add Bearer if present (JWT users)
    const token = this.getAuthToken();
    if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

    // Add CSRF for mutating requests (session users)
    if (method !== "GET" && !headers["X-CSRF-Token"]) {
      const csrf = this.getCsrf();
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
      console.error(`[API] Request failed: ${msg}`);
      throw new Error(msg);
    }

    console.log(`[API] Request successful: ${res.status}`);
    // Return JSON if possible
    try { 
      return await res.json(); 
    } catch { 
      return {}; 
    }
  }

  // Save user location
  async saveUserLocation(lat, lon, city) {
    const token = this.getAuthToken();
    if (!token || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.log("[API] Skipping location save - no token or invalid coordinates");
      return;
    }
    
    console.log(`[API] Saving user location: ${city} (${lat}, ${lon})`);
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
    }).catch((e) => {
      console.error("[API] Failed to save user location:", e);
    });
  }
}
