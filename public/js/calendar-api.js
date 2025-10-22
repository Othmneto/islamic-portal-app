/**
 * Calendar API Client
 * Centralized API calls for calendar operations, Islamic events, and OAuth integrations
 */

class CalendarAPI {
  constructor() {
    console.log('🗓️ [CalendarAPI] Initializing Calendar API client');
    this.baseURL = '';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    console.log('✅ [CalendarAPI] Calendar API client initialized');
  }

  /**
   * Get authentication token from storage or cookie
   */
  getAuthToken() {
    // Try localStorage first
    const token = localStorage.getItem('accessToken') || localStorage.getItem('authToken');
    if (token) return token;
    
    // Try cookies as fallback
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'accessToken' || name === 'authToken') {
        return value;
      }
    }
    return null;
  }

  /**
   * Helper for authenticated fetch with CSRF token
   */
  async authenticatedFetch(url, options = {}) {
    const token = this.getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Get CSRF token for write operations
    if (options.method && options.method !== 'GET') {
      try {
        const csrfResponse = await fetch('/api/csrf-token', {
          credentials: 'include'
        });
        if (csrfResponse.ok) {
          const { csrfToken } = await csrfResponse.json();
          headers['X-CSRF-Token'] = csrfToken;
        }
      } catch (e) {
        console.warn('[CalendarAPI] CSRF token fetch failed:', e);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cache helper with TTL
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // ========================================
  // USER EVENTS (CRUD)
  // ========================================

  /**
   * Get all user calendar events
   */
  async getUserEvents() {
    console.log('📅 [CalendarAPI] Fetching user events...');
    try {
      const data = await this.authenticatedFetch('/api/calendar/events');
      console.log(`✅ [CalendarAPI] Loaded ${data.events?.length || 0} user events`);
      return data.events || [];
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching user events:', error);
      return [];
    }
  }

  /**
   * Create a new event
   */
  async createEvent(event) {
    try {
      const data = await this.authenticatedFetch('/api/calendar/events', {
        method: 'POST',
        body: JSON.stringify(event)
      });
      return data.event;
    } catch (error) {
      console.error('[CalendarAPI] Error creating event:', error);
      throw error;
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(eventId, updates) {
    try {
      const data = await this.authenticatedFetch(`/api/calendar/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      return data.event;
    } catch (error) {
      console.error('[CalendarAPI] Error updating event:', error);
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId) {
    try {
      await this.authenticatedFetch(`/api/calendar/events/${eventId}`, {
        method: 'DELETE'
      });
      return true;
    } catch (error) {
      console.error('[CalendarAPI] Error deleting event:', error);
      throw error;
    }
  }

  // ========================================
  // ISLAMIC CALENDAR & PRAYER TIMES
  // ========================================

  /**
   * Get monthly Islamic events (holidays + prayer times)
   */
  async getMonthlyIslamicEvents(year, month, lat, lon, country = 'AE') {
    console.log('🕌 [CalendarAPI] Fetching monthly Islamic events:', { year, month, lat, lon, country });
    
    const cacheKey = `islamic-events-${year}-${month}-${lat}-${lon}-${country}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log('💾 [CalendarAPI] Using cached Islamic events');
      return cached;
    }

    try {
      const url = `/api/islamic-calendar/monthly-events/${year}/${month}?latitude=${lat}&longitude=${lon}&country=${country}`;
      console.log('🌐 [CalendarAPI] Requesting:', url);
      
      const data = await this.authenticatedFetch(url);
      
      const result = data.events || { holidays: [], prayerEvents: [] };
      console.log(`✅ [CalendarAPI] Loaded ${result.holidays?.length || 0} holidays, ${result.prayerEvents?.length || 0} prayer events`);
      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching Islamic events:', error);
      return { holidays: [], prayerEvents: [] };
    }
  }

  /**
   * Get monthly prayer times (NEW endpoint using monthly service)
   */
  async getMonthlyPrayerTimes(year, month, lat, lon, tz, method = 'auto', madhab = 'auto') {
    console.log('🕌 [CalendarAPI] Fetching monthly prayer times:', { year, month, lat, lon, tz, method, madhab });
    
    const cacheKey = `prayer-times-${year}-${month}-${lat}-${lon}-${tz}-${method}-${madhab}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log('💾 [CalendarAPI] Using cached prayer times');
      return cached;
    }

    try {
      const url = `/api/islamic-calendar/monthly-prayer-times/${year}/${month}?lat=${lat}&lon=${lon}&tz=${encodeURIComponent(tz)}&method=${method}&madhab=${madhab}`;
      console.log('🌐 [CalendarAPI] Requesting:', url);
      
      const data = await this.authenticatedFetch(url);
      
      console.log(`✅ [CalendarAPI] Loaded ${data.days?.length || 0} days of prayer times`);
      this.setCached(cacheKey, data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching monthly prayer times:', error);
      return { days: [] };
    }
  }

  /**
   * Get Islamic holidays for a date range
   */
  async getIslamicHolidays(startDate, endDate, country = 'AE') {
    try {
      const data = await this.authenticatedFetch(
        `/api/islamic-calendar/holidays?startDate=${startDate}&endDate=${endDate}&country=${country}`
      );
      return data.holidays || [];
    } catch (error) {
      console.error('[CalendarAPI] Error fetching Islamic holidays:', error);
      return [];
    }
  }

  /**
   * Get current Hijri date
   */
  async getCurrentHijri() {
    try {
      const data = await this.authenticatedFetch('/api/islamic-calendar/current-hijri');
      return data.hijri;
    } catch (error) {
      console.error('[CalendarAPI] Error fetching current Hijri date:', error);
      return null;
    }
  }

  // ========================================
  // OAUTH INTEGRATION (Google/Microsoft)
  // ========================================

  /**
   * Get OAuth integration status
   */
  async getIntegrationStatus() {
    console.log('🔗 [CalendarAPI] Fetching OAuth integration status...');
    try {
      const data = await this.authenticatedFetch('/api/calendar/status');
      console.log('✅ [CalendarAPI] OAuth status:', data);
      return data.integrations || { mobile: { connected: false }, email: { connected: false } };
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching integration status:', error);
      return { mobile: { connected: false }, email: { connected: false } };
    }
  }

  /**
   * Initiate OAuth connection for a provider
   */
  async connectProvider(provider) {
    console.log(`🔗 [CalendarAPI] Connecting ${provider}...`);
    try {
      const data = await this.authenticatedFetch(`/api/calendar/connect/${provider}`, {
        method: 'POST'
      });
      
      console.log(`✅ [CalendarAPI] ${provider} connect response:`, data);
      
      if (data.authUrl) {
        console.log(`🌐 [CalendarAPI] Redirecting to OAuth: ${data.authUrl}`);
        // Redirect to OAuth flow
        window.location.href = data.authUrl;
      }
      
      return data;
    } catch (error) {
      console.error(`❌ [CalendarAPI] Error connecting ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Sync events with external provider
   */
  async syncProvider(provider) {
    try {
      // First, ensure user has OAuth tokens
      const status = await this.getIntegrationStatus();
      const isConnected = status.email?.provider?.includes(provider);
      
      if (!isConnected) {
        throw new Error(`${provider} not connected. Please connect first.`);
      }

      const data = await this.authenticatedFetch(`/api/calendar/sync/${provider}`, {
        method: 'POST'
      });
      
      return data;
    } catch (error) {
      console.error(`[CalendarAPI] Error syncing ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Test OAuth connection
   */
  async testConnection(provider) {
    console.log(`🔗 [CalendarAPI] Testing ${provider} connection...`);
    try {
      const data = await this.authenticatedFetch(`/api/calendar/test/${provider}`, {
        method: 'POST'
      });
      console.log(`✅ [CalendarAPI] ${provider} test result:`, data);
      return data;
    } catch (error) {
      console.error(`❌ [CalendarAPI] Error testing ${provider} connection:`, error);
      throw error;
    }
  }

  /**
   * Disconnect OAuth integration
   */
  async disconnectIntegration(type) {
    console.log(`🔗 [CalendarAPI] Disconnecting ${type}...`);
    try {
      const data = await this.authenticatedFetch(`/api/calendar/disconnect/${type}`, {
        method: 'POST'
      });
      console.log(`✅ [CalendarAPI] ${type} disconnected`);
      return data;
    } catch (error) {
      console.error(`❌ [CalendarAPI] Error disconnecting ${type}:`, error);
      throw error;
    }
  }

  // ========================================
  // LOCATION & PREFERENCES
  // ========================================

  /**
   * Get user location (if stored)
   */
  getUserLocation() {
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
      try {
        return JSON.parse(savedLocation);
      } catch (e) {
        console.error('[CalendarAPI] Error parsing saved location:', e);
      }
    }
    
    // Default to Dubai (as used in the app)
    return {
      lat: 25.2048,
      lon: 55.2708,
      tz: 'Asia/Dubai',
      country: 'AE',
      city: 'Dubai'
    };
  }

  /**
   * Save user location
   */
  saveUserLocation(location) {
    localStorage.setItem('userLocation', JSON.stringify(location));
  }

  /**
   * Get user prayer calculation preferences
   */
  getPrayerPreferences() {
    const prefs = localStorage.getItem('prayerPreferences');
    if (prefs) {
      try {
        return JSON.parse(prefs);
      } catch (e) {
        console.error('[CalendarAPI] Error parsing prayer preferences:', e);
      }
    }
    
    return {
      method: 'auto',
      madhab: 'auto'
    };
  }

  /**
   * Save prayer calculation preferences
   */
  savePrayerPreferences(prefs) {
    localStorage.setItem('prayerPreferences', JSON.stringify(prefs));
  }
}

// Export singleton instance
window.calendarAPI = new CalendarAPI();

