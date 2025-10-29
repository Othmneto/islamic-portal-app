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
   * Helper for authenticated fetch with session cookies and CSRF token
   * NO JWT TOKENS - Pure session-based authentication
   */
  async authenticatedFetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

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

    // Always use 'include' to send session cookies
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
      return { success: true, event: data.event };
    } catch (error) {
      console.error('[CalendarAPI] Error creating event:', error);
      return { success: false, error: error.message };
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
      return { success: true, event: data.event };
    } catch (error) {
      console.error('[CalendarAPI] Error updating event:', error);
      return { success: false, error: error.message };
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
   * Get prayer times for a specific day
   */
  async getPrayerTimesForDay(date, lat, lon, tz = 'UTC', method = 'auto', madhab = 'auto') {
    const cacheKey = `prayer-times-day-${date}-${lat}-${lon}-${tz}-${method}-${madhab}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log('💾 [CalendarAPI] Using cached daily prayer times');
      return cached;
    }

    try {
      const url = `/api/islamic-calendar/daily-prayer-times?date=${date}&lat=${lat}&lon=${lon}&tz=${encodeURIComponent(tz)}&method=${method}&madhab=${madhab}`;
      console.log('🌐 [CalendarAPI] Requesting:', url);
      
      const data = await this.authenticatedFetch(url);
      
      console.log(`✅ [CalendarAPI] Loaded prayer times for ${date}`);
      this.setCached(cacheKey, data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching daily prayer times:', error);
      return { times: {} };
    }
  }

  /**
   * Get prayer times for a specific month (alias for existing function)
   */
  async getPrayerTimesForMonth(year, month, lat, lon, tz = 'UTC', method = 'auto', madhab = 'auto') {
    return this.getMonthlyPrayerTimes(year, month, lat, lon, tz, method, madhab);
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
   * Get holidays for a specific year
   */
  async getHolidaysForYear(year, country = 'AE') {
    const cacheKey = `holidays-${year}-${country}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log('💾 [CalendarAPI] Using cached holidays for year');
      return cached;
    }

    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      
      const data = await this.authenticatedFetch(
        `/api/islamic-calendar/holidays?startDate=${startDate}&endDate=${endDate}&country=${country}`
      );
      
      console.log(`✅ [CalendarAPI] Loaded holidays for ${year}`);
      this.setCached(cacheKey, data);
      return data;
    } catch (error) {
      console.error('[CalendarAPI] Error fetching holidays for year:', error);
      return { holidays: [] };
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

  /**
   * Get yearly holidays for occasions modal
   */
  async getYearlyHolidays(year, country = 'AE', includeIslamic = true, includeNational = true) {
    const cacheKey = `yearly-holidays-${year}-${country}-${includeIslamic}-${includeNational}`;
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log('💾 [CalendarAPI] Using cached yearly holidays');
      return cached;
    }

    try {
      const url = `/api/islamic-calendar/yearly-holidays/${year}?country=${country}&includeIslamic=${includeIslamic}&includeNational=${includeNational}`;
      console.log('🌐 [CalendarAPI] Requesting:', url);
      
      const data = await this.authenticatedFetch(url);
      
      console.log(`✅ [CalendarAPI] Loaded ${data.holidays?.length || 0} yearly holidays`);
      this.setCached(cacheKey, data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching yearly holidays:', error);
      return { holidays: [] };
    }
  }

  /**
   * Save user occasion preferences
   */
  async saveOccasionPreferences(preferences) {
    try {
      const data = await this.authenticatedFetch('/api/user/occasion-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });
      
      console.log('✅ [CalendarAPI] Occasion preferences saved');
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error saving occasion preferences:', error);
      throw error;
    }
  }

  /**
   * Load user occasion preferences
   */
  async loadOccasionPreferences() {
    try {
      const data = await this.authenticatedFetch('/api/user/occasion-preferences');
      
      console.log('✅ [CalendarAPI] Occasion preferences loaded');
      return data.preferences;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error loading occasion preferences:', error);
      return {
        autoUpdate: false,
        selectedOccasions: [],
        country: 'AE',
        includeIslamic: true,
        includeNational: true,
        lastUpdated: null
      };
    }
  }

  /**
   * Get countries list for holiday selection
   */
  async getCountriesList() {
    try {
      console.log('🌍 [CalendarAPI] Fetching countries list');
      const response = await this.authenticatedFetch('/api/islamic-calendar/countries');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ [CalendarAPI] Countries list fetched:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching countries list:', error);
      throw error;
    }
  }

  /**
   * Get holiday details by ID
   */
  async getHolidayDetails(holidayId) {
    try {
      console.log('📅 [CalendarAPI] Fetching holiday details:', { holidayId });
      const response = await this.authenticatedFetch(`/api/islamic-calendar/holiday/${holidayId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ [CalendarAPI] Holiday details fetched:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching holiday details:', error);
      throw error;
    }
  }

  // ========================================
  // RECURRING EVENTS
  // ========================================

  /**
   * Generate recurring event occurrences
   */
  async generateRecurringOccurrences(event, startDate, endDate) {
    try {
      console.log('🔄 [CalendarAPI] Generating recurring occurrences:', { event, startDate, endDate });
      const response = await this.authenticatedFetch('/api/recurring/generate', {
        method: 'POST',
        body: JSON.stringify({ event, startDate, endDate })
      });
      
      const data = await response.json();
      console.log('✅ [CalendarAPI] Recurring occurrences generated:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error generating recurring occurrences:', error);
      throw error;
    }
  }

  /**
   * Update a recurring event series
   */
  async updateRecurringSeries(parentId, changes) {
    try {
      console.log('🔄 [CalendarAPI] Updating recurring series:', { parentId, changes });
      const response = await this.authenticatedFetch(`/api/recurring/series/${parentId}`, {
        method: 'PUT',
        body: JSON.stringify({ changes })
      });
      
      const data = await response.json();
      console.log('✅ [CalendarAPI] Recurring series updated:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error updating recurring series:', error);
      throw error;
    }
  }

  /**
   * Delete recurring event occurrences
   */
  async deleteRecurringSeries(parentId, scope, occurrenceDate = null) {
    try {
      console.log('🔄 [CalendarAPI] Deleting recurring series:', { parentId, scope, occurrenceDate });
      const response = await this.authenticatedFetch(`/api/recurring/series/${parentId}`, {
        method: 'DELETE',
        body: JSON.stringify({ scope, occurrenceDate })
      });
      
      const data = await response.json();
      console.log('✅ [CalendarAPI] Recurring series deleted:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error deleting recurring series:', error);
      throw error;
    }
  }

  /**
   * Get recurring event occurrences for a date range
   */
  async getRecurringOccurrences(startDate, endDate, parentId = null) {
    try {
      console.log('🔄 [CalendarAPI] Fetching recurring occurrences:', { startDate, endDate, parentId });
      const params = new URLSearchParams({ startDate, endDate });
      if (parentId) params.append('parentId', parentId);
      
      const response = await this.authenticatedFetch(`/api/recurring/occurrences?${params}`);
      const data = await response.json();
      
      console.log('✅ [CalendarAPI] Recurring occurrences fetched:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching recurring occurrences:', error);
      throw error;
    }
  }

  // ========================================
  // ICS IMPORT FUNCTIONALITY
  // ========================================

  /**
   * Upload and preview ICS file
   */
  async uploadICSFile(file) {
    try {
      console.log('📥 [CalendarAPI] Uploading ICS file:', file.name);
      
      const formData = new FormData();
      formData.append('icsFile', file);
      
      const response = await fetch('/api/import/ics', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ [CalendarAPI] ICS file uploaded and parsed:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error uploading ICS file:', error);
      throw error;
    }
  }

  /**
   * Confirm import of parsed events
   */
  async confirmICSImport(importId, selectedEvents) {
    try {
      console.log('✅ [CalendarAPI] Confirming ICS import:', { importId, selectedEvents });
      
      const response = await this.authenticatedFetch('/api/import/ics/confirm', {
        method: 'POST',
        body: JSON.stringify({
          importId,
          selectedEvents
        })
      });
      
      const data = await response.json();
      console.log('✅ [CalendarAPI] ICS import confirmed:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error confirming ICS import:', error);
      throw error;
    }
  }

  /**
   * Get import history
   */
  async getImportHistory() {
    try {
      console.log('📋 [CalendarAPI] Fetching import history');
      
      const response = await this.authenticatedFetch('/api/import/history');
      const data = await response.json();
      
      console.log('✅ [CalendarAPI] Import history fetched:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching import history:', error);
      throw error;
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
   * Connect to Google Calendar
   */
  async connectGoogle() {
    try {
      console.log('🔗 [CalendarAPI] Connecting to Google Calendar');
      
      const response = await this.authenticatedFetch('/api/oauth/google/connect');
      const data = await response.json();
      
      if (data.success && data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to get Google OAuth URL');
      }
    } catch (error) {
      console.error('❌ [CalendarAPI] Error connecting to Google:', error);
      throw error;
    }
  }

  /**
   * Connect to Microsoft Calendar
   */
  async connectMicrosoft() {
    try {
      console.log('🔗 [CalendarAPI] Connecting to Microsoft Calendar');
      
      const response = await this.authenticatedFetch('/api/oauth/microsoft/connect');
      const data = await response.json();
      
      if (data.success && data.authUrl) {
        // Redirect to Microsoft OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Failed to get Microsoft OAuth URL');
      }
    } catch (error) {
      console.error('❌ [CalendarAPI] Error connecting to Microsoft:', error);
      throw error;
    }
  }

  /**
   * Sync with Google Calendar
   */
  async syncGoogle() {
    try {
      console.log('🔄 [CalendarAPI] Syncing with Google Calendar');
      
      const response = await this.authenticatedFetch('/api/oauth/google/sync', {
        method: 'POST'
      });
      const data = await response.json();
      
      console.log('✅ [CalendarAPI] Google sync completed:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error syncing with Google:', error);
      throw error;
    }
  }

  /**
   * Sync with Microsoft Calendar
   */
  async syncMicrosoft() {
    try {
      console.log('🔄 [CalendarAPI] Syncing with Microsoft Calendar');
      
      const response = await this.authenticatedFetch('/api/oauth/microsoft/sync', {
        method: 'POST'
      });
      const data = await response.json();
      
      console.log('✅ [CalendarAPI] Microsoft sync completed:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error syncing with Microsoft:', error);
      throw error;
    }
  }

  /**
   * Disconnect Google Calendar
   */
  async disconnectGoogle() {
    try {
      console.log('🔌 [CalendarAPI] Disconnecting Google Calendar');
      
      const response = await this.authenticatedFetch('/api/oauth/google/disconnect', {
        method: 'POST'
      });
      const data = await response.json();
      
      console.log('✅ [CalendarAPI] Google disconnected:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error disconnecting Google:', error);
      throw error;
    }
  }

  /**
   * Disconnect Microsoft Calendar
   */
  async disconnectMicrosoft() {
    try {
      console.log('🔌 [CalendarAPI] Disconnecting Microsoft Calendar');
      
      const response = await this.authenticatedFetch('/api/oauth/microsoft/disconnect', {
        method: 'POST'
      });
      const data = await response.json();
      
      console.log('✅ [CalendarAPI] Microsoft disconnected:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error disconnecting Microsoft:', error);
      throw error;
    }
  }

  // ========================================
  // TIMEZONE DETECTION & MANAGEMENT
  // ========================================

  /**
   * Get user's current timezone
   */
  getCurrentTimezone() {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('🌍 [CalendarAPI] Current timezone:', timezone);
      return timezone;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error getting timezone:', error);
      return 'UTC';
    }
  }

  /**
   * Detect timezone from coordinates
   */
  async detectTimezoneFromLocation(lat, lon) {
    try {
      console.log('🌍 [CalendarAPI] Detecting timezone for coordinates:', { lat, lon });
      
      const response = await this.authenticatedFetch('/api/timezone/detect', {
        method: 'POST',
        body: JSON.stringify({ lat, lon })
      });
      const data = await response.json();
      
      console.log('✅ [CalendarAPI] Timezone detected:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error detecting timezone:', error);
      return { timezone: this.getCurrentTimezone() };
    }
  }

  /**
   * Get user's location and timezone
   */
  async getUserLocation() {
    try {
      console.log('📍 [CalendarAPI] Getting user location');
      
      if (!navigator.geolocation) {
        throw new Error('Geolocation not supported');
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            console.log('📍 [CalendarAPI] Location obtained:', { latitude, longitude });
            
            try {
              const timezoneData = await this.detectTimezoneFromLocation(latitude, longitude);
              resolve({
                lat: latitude,
                lon: longitude,
                timezone: timezoneData.timezone,
                accuracy: position.coords.accuracy
              });
            } catch (error) {
              console.error('❌ [CalendarAPI] Error detecting timezone from location:', error);
              resolve({
                lat: latitude,
                lon: longitude,
                timezone: this.getCurrentTimezone(),
                accuracy: position.coords.accuracy
              });
            }
          },
          (error) => {
            console.error('❌ [CalendarAPI] Geolocation error:', error);
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });
    } catch (error) {
      console.error('❌ [CalendarAPI] Error getting user location:', error);
      throw error;
    }
  }

  /**
   * Update user's timezone preference
   */
  async updateTimezonePreference(timezone, lat, lon) {
    try {
      console.log('🌍 [CalendarAPI] Updating timezone preference:', { timezone, lat, lon });
      
      const response = await this.authenticatedFetch('/api/user/timezone', {
        method: 'PUT',
        body: JSON.stringify({
          timezone,
          latitude: lat,
          longitude: lon
        })
      });
      const data = await response.json();
      
      console.log('✅ [CalendarAPI] Timezone preference updated:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error updating timezone preference:', error);
      throw error;
    }
  }

  /**
   * Get available timezones
   */
  async getAvailableTimezones() {
    try {
      console.log('🌍 [CalendarAPI] Getting available timezones');
      
      const response = await this.authenticatedFetch('/api/timezone/list');
      const data = await response.json();
      
      console.log('✅ [CalendarAPI] Available timezones fetched:', data);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching timezones:', error);
      // Fallback to common timezones
      return {
        success: true,
        timezones: [
          'America/New_York',
          'America/Chicago',
          'America/Denver',
          'America/Los_Angeles',
          'Europe/London',
          'Europe/Paris',
          'Europe/Berlin',
          'Asia/Dubai',
          'Asia/Karachi',
          'Asia/Kolkata',
          'Asia/Tokyo',
          'Australia/Sydney',
          'UTC'
        ]
      };
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
  async syncProvider(provider, events = null) {
    console.log(`🔗 [CalendarAPI] Syncing ${provider}...`);
    try {
      // First, ensure user has OAuth tokens
      const status = await this.getIntegrationStatus();
      const isConnected = status.email?.provider?.includes(provider);
      
      if (!isConnected) {
        throw new Error(`${provider} not connected. Please connect first.`);
      }

      // If no events provided, get all user events
      if (!events) {
        console.log('📅 [CalendarAPI] Fetching user events for sync...');
        events = await this.getUserEvents();
      }
      
      console.log(`📅 [CalendarAPI] Syncing ${events.length} events to ${provider}`);

      const data = await this.authenticatedFetch(`/api/calendar/sync/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events })
      });
      
      console.log(`✅ [CalendarAPI] ${provider} sync completed:`, data);
      return data;
    } catch (error) {
      console.error(`❌ [CalendarAPI] Error syncing ${provider}:`, error);
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

  // ========================================
  // SEARCH & DISCOVERY
  // ========================================

  /**
   * Search across all calendar data
   */
  async searchCalendar(query, options = {}) {
    try {
      const {
        type = 'all', // 'all', 'events', 'prayers', 'occasions'
        year = new Date().getFullYear(),
        limit = 50,
        country = null
      } = options;

      const params = new URLSearchParams({
        q: query,
        type,
        year: year.toString(),
        limit: limit.toString()
      });

      if (country) {
        params.append('country', country);
      }

      console.log(`🔍 [CalendarAPI] Searching for: "${query}"`);
      
      const data = await this.authenticatedFetch(`/api/search/search?${params}`);
      
      console.log(`✅ [CalendarAPI] Search returned ${data.totalCount} results`);
      return data;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error searching calendar:', error);
      return {
        success: false,
        results: [],
        grouped: { userEvents: [], prayerTimes: [], holidays: [] },
        totalCount: 0,
        returnedCount: 0
      };
    }
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSearchSuggestions(query) {
    try {
      if (!query || query.length < 1) {
        return [];
      }

      const data = await this.authenticatedFetch(`/api/search/search/suggest?q=${encodeURIComponent(query)}`);
      return data.suggestions || [];
    } catch (error) {
      console.error('❌ [CalendarAPI] Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Get list of all supported countries
   */
  async getCountriesList() {
    const cacheKey = 'countries-list';
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      console.log('🌐 [CalendarAPI] Fetching countries list');
      
      const data = await this.authenticatedFetch('/api/islamic-calendar/countries');
      
      console.log(`✅ [CalendarAPI] Loaded ${data.countries?.length || 0} countries`);
      this.setCached(cacheKey, data.countries || []);
      return data.countries || [];
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching countries:', error);
      // Return default countries if API fails
      return [
        {code: 'AE', name: 'United Arab Emirates', region: 'Middle East'},
        {code: 'SA', name: 'Saudi Arabia', region: 'Middle East'},
        {code: 'US', name: 'United States', region: 'North America'},
        {code: 'GB', name: 'United Kingdom', region: 'Europe'},
        {code: 'TR', name: 'Turkey', region: 'Middle East'}
      ];
    }
  }

  /**
   * Get holiday details by ID
   */
  async getHolidayDetails(holidayId) {
    try {
      console.log(`🎉 [CalendarAPI] Fetching holiday details: ${holidayId}`);
      
      const data = await this.authenticatedFetch(`/api/islamic-calendar/holiday/${holidayId}`);
      
      console.log('✅ [CalendarAPI] Holiday details loaded');
      return data.holiday;
    } catch (error) {
      console.error('❌ [CalendarAPI] Error fetching holiday details:', error);
      return null;
    }
  }
}

// Export singleton instance
window.calendarAPI = new CalendarAPI();

