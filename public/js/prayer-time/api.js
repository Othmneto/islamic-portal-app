// Enhanced API wrapper with sliding renewal and 401 auto-retry
class PrayerTimeAPI {
    constructor() {
        this.baseURL = '/api';
        this.isRefreshing = false;
        this.refreshPromise = null;
    }

    /**
     * Enhanced fetch with session-based authentication
     * NO JWT TOKENS - Pure session-based authentication
     */
    async apiFetchWithSlidingRenewalHeader(endpoint, options = {}) {
        // Session-based: No Authorization header needed
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        const requestOptions = {
            ...options,
            headers,
            credentials: 'include' // Always include session cookies
        };

        try {
            const response = await fetch(endpoint, requestOptions);

            // Session-based: No token handling needed

            // Handle 401 with auto-retry
            if (response.status === 401) {
                console.log('🔄 [API] 401 received, attempting token refresh...');

                // Session-based: No token refresh needed, just redirect to login
                console.log('🔐 [API] Session expired, redirecting to login...');
                window.location.href = '/login.html';
                throw new Error('Session expired');
            }

            return response;
        } catch (error) {
            console.error('❌ [API] Request failed:', error);
            throw error;
        }
    }

    /**
     * Get prayer times for a location
     */
    async getPrayerTimes(location) {
        try {
            const response = await this.apiFetchWithSlidingRenewalHeader(`${this.baseURL}/prayer-times`, {
                method: 'POST',
                body: JSON.stringify({ location })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to get prayer times');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ [PrayerTimeAPI] Error getting prayer times:', error);
            throw error;
        }
    }

    /**
     * Get user profile
     */
    async getUserProfile() {
        try {
            const response = await this.apiFetchWithSlidingRenewalHeader(`${this.baseURL}/user/profile`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to get user profile');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ [PrayerTimeAPI] Error getting user profile:', error);
            throw error;
        }
    }

    /**
     * Update user preferences
     */
    async updateUserPreferences(preferences) {
        try {
            const response = await this.apiFetchWithSlidingRenewalHeader(`${this.baseURL}/user/preferences`, {
                method: 'PUT',
                body: JSON.stringify(preferences)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to update preferences');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ [PrayerTimeAPI] Error updating preferences:', error);
            throw error;
        }
    }

    /**
     * Get notification settings
     */
    async getNotificationSettings() {
        try {
            const response = await this.apiFetchWithSlidingRenewalHeader(`${this.baseURL}/notifications/settings`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to get notification settings');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ [PrayerTimeAPI] Error getting notification settings:', error);
            throw error;
        }
    }

    /**
     * Update notification settings
     */
    async updateNotificationSettings(settings) {
        try {
            const response = await this.apiFetchWithSlidingRenewalHeader(`${this.baseURL}/notifications/settings`, {
                method: 'PUT',
                body: JSON.stringify(settings)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to update notification settings');
            }

            return await response.json();
        } catch (error) {
            console.error('❌ [PrayerTimeAPI] Error updating notification settings:', error);
            throw error;
        }
    }

    /**
     * Generic API fetch method with session-based authentication
     * NO JWT TOKENS - Pure session-based authentication
     */
    async apiFetch(endpoint, options = {}) {
        // Add CSRF token for write operations
        const csrfToken = this.getCsrfToken();
        if (csrfToken && options.method && options.method !== 'GET') {
            options.headers = {
                ...options.headers,
                'X-CSRF-Token': csrfToken
            };
        }

        // Set default content type
        if (options.body && !options.headers?.['Content-Type']) {
            options.headers = {
                ...options.headers,
                'Content-Type': 'application/json'
            };
        }

        // Always include credentials for session cookies
        options.credentials = 'include';

        try {
            const response = await fetch(endpoint, options);

            // Handle 401 - redirect to login
            if (response.status === 401) {
                console.log('🔐 [API] Session expired, redirecting to login...');
                window.location.href = '/login.html';
                throw new Error('Session expired');
            }

            return response;
        } catch (error) {
            console.error('❌ [API] Fetch error:', error);
            throw error;
        }
    }

    /**
     * Get CSRF token from cookies
     */
    getCsrfToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'XSRF-TOKEN') {
                return decodeURIComponent(value);
            }
        }
        return null;
    }

    /**
     * Get CSRF token (alias for compatibility)
     */
    getCsrf() {
        return this.getCsrfToken();
    }

    /**
     * Save user location (placeholder for compatibility)
     */
    async saveUserLocation(lat, lon, display, tz) {
        try {
            // Session-based: Let server handle authentication
            console.log('🔐 [PrayerTimeAPI] Attempting to save location with session authentication');

            const body = {
                lat,
                lng: lon,
                city: display || undefined,
                country: undefined,
                timezone: tz || undefined
            };
            const response = await this.apiFetch('/api/user/location', {
                method: 'PUT',
                body: JSON.stringify(body)
            });
            return response.ok ? response.json() : response;
        } catch (error) {
            console.error('❌ [PrayerTimeAPI] Error saving user location:', error);
            throw error;
        }
    }

    /**
     * Session-based authentication - no tokens needed
     */
    getAuthToken() {
        // Session-based: return null to indicate session authentication
        return null;
    }
}

// Create global instance
window.prayerTimeAPI = new PrayerTimeAPI();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PrayerTimesAPI: PrayerTimeAPI };
} else if (typeof window !== 'undefined') {
    window.PrayerTimesAPI = PrayerTimeAPI;
}