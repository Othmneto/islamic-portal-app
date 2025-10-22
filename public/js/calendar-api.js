/**
 * Calendar API Client
 * Centralized API calls for calendar operations, Islamic events, and OAuth integrations
 */

class CalendarAPI {
  constructor() {
    this.baseURL = '';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
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
    try {
      const data = await this.authenticatedFetch('/api/calendar/events');
      return data.events || [];
    } catch (error) {
      console.error('[CalendarAPI] Error fetching user events:', error);
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
    const cacheKey = `islamic-events-${year}-${month}-${lat}-${lon}-${country}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.authenticatedFetch(
        `/api/islamic-calendar/monthly-events/${year}/${month}?latitude=${lat}&longitude=${lon}&country=${country}`
      );
      
      const result = data.events || { holidays: [], prayerEvents: [] };
      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[CalendarAPI] Error fetching Islamic events:', error);
      return { holidays: [], prayerEvents: [] };
    }
  }

  /**
   * Get monthly prayer times (NEW endpoint using monthly service)
   */
  async getMonthlyPrayerTimes(year, month, lat, lon, tz, method = 'auto', madhab = 'auto') {
    const cacheKey = `prayer-times-${year}-${month}-${lat}-${lon}-${tz}-${method}-${madhab}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.authenticatedFetch(
        `/api/islamic-calendar/monthly-prayer-times/${year}/${month}?lat=${lat}&lon=${lon}&tz=${encodeURIComponent(tz)}&method=${method}&madhab=${madhab}`
      );
      
      this.setCached(cacheKey, data);
      return data;
    } catch (error) {
      console.error('[CalendarAPI] Error fetching monthly prayer times:', error);
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
    try {
      const data = await this.authenticatedFetch('/api/calendar-integration/status');
      return data.integrations || { mobile: { connected: false }, email: { connected: false } };
    } catch (error) {
      console.error('[CalendarAPI] Error fetching integration status:', error);
      return { mobile: { connected: false }, email: { connected: false } };
    }
  }

  /**
   * Initiate OAuth connection for a provider
   */
  async connectProvider(provider) {
    try {
      const data = await this.authenticatedFetch(`/api/calendar-integration/connect/${provider}`, {
        method: 'POST'
      });
      
      if (data.authUrl) {
        // Redirect to OAuth flow
        window.location.href = data.authUrl;
      }
      
      return data;
    } catch (error) {
      console.error(`[CalendarAPI] Error connecting ${provider}:`, error);
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
    try {
      const data = await this.authenticatedFetch(`/api/calendar-integration/test/${provider}`, {
        method: 'POST'
      });
      return data;
    } catch (error) {
      console.error(`[CalendarAPI] Error testing ${provider} connection:`, error);
      throw error;
    }
  }

  /**
   * Disconnect OAuth integration
   */
  async disconnectIntegration(type) {
    try {
      const data = await this.authenticatedFetch(`/api/calendar-integration/disconnect/${type}`, {
        method: 'POST'
      });
      return data;
    } catch (error) {
      console.error(`[CalendarAPI] Error disconnecting ${type}:`, error);
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

