// Enhanced API wrapper with sliding renewal and 401 auto-retry
class PrayerTimeAPI {
    constructor() {
        this.baseURL = '/api';
        this.isRefreshing = false;
        this.refreshPromise = null;
    }

    /**
     * Get current auth token
     */
    getAuthToken() {
        return localStorage.getItem('accessToken') || localStorage.getItem('authToken') || localStorage.getItem('token');
    }

    /**
     * Attempt token refresh when stale
     */
    async attemptTokenRefreshWhenStale() {
        if (this.isRefreshing && this.refreshPromise) {
            return this.refreshPromise;
        }

        this.isRefreshing = true;
        this.refreshPromise = this._performTokenRefresh();

        try {
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    /**
     * Perform actual token refresh
     */
    async _performTokenRefresh() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch('/api/token/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const data = await response.json();

            // Update tokens
            localStorage.setItem('accessToken', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);

            console.log('✅ [API] Token refreshed successfully');
            return true;
        } catch (error) {
            console.error('❌ [API] Token refresh failed:', error);
            // Clear tokens and redirect to login
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('authToken');
            localStorage.removeItem('token');
            window.location.href = '/login.html';
            throw error;
        }
    }

    /**
     * Enhanced fetch with sliding renewal header handling and 401 auto-retry
     */
    async apiFetchWithSlidingRenewalHeader(endpoint, options = {}) {
        const token = this.getAuthToken();

        // Add auth header if token exists
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const requestOptions = {
            ...options,
            headers
        };

        try {
            const response = await fetch(endpoint, requestOptions);

            // Handle X-New-Token header (sliding renewal)
            const newToken = response.headers.get('X-New-Token');
            if (newToken) {
                console.log('🔄 [API] Received new token from sliding renewal');
                localStorage.setItem('accessToken', newToken);

                // Broadcast token update to other tabs
                if (window.broadcastTokenUpdateCrossTabSync) {
                    window.broadcastTokenUpdateCrossTabSync(newToken);
                }
            }

            // Handle 401 with auto-retry
            if (response.status === 401) {
                console.log('🔄 [API] 401 received, attempting token refresh...');

                try {
                    const refreshed = await this.attemptTokenRefreshWhenStale();
                    if (refreshed) {
                        // Retry the original request with new token
                        const newToken = this.getAuthToken();
                        if (newToken) {
                            requestOptions.headers['Authorization'] = `Bearer ${newToken}`;
                            return await fetch(endpoint, requestOptions);
                        }
                    }
                } catch (refreshError) {
                    console.error('❌ [API] Token refresh failed, redirecting to login');
                    window.location.href = '/login.html';
                    return response; // Return original 401 response
                }
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
     * Generic API fetch method with sliding renewal and 401 auto-retry
     */
    async apiFetch(endpoint, options = {}) {
        const token = this.getAuthToken();

        // Add authorization header if token is available
        if (token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }

        // Add CSRF token if available
        const csrfToken = this.getCsrfToken();
        if (csrfToken) {
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

        try {
            const response = await fetch(endpoint, options);

            // Handle X-New-Token header for sliding renewal
            const newToken = response.headers.get('X-New-Token');
            if (newToken) {
                localStorage.setItem('accessToken', newToken);
                console.log('🔄 [API] Token renewed via X-New-Token header');
            }

            // Handle 401 with auto-retry
            if (response.status === 401) {
                console.log('🔄 [API] 401 received, attempting token refresh...');
                const refreshed = await this.attemptTokenRefreshWhenStale();
                if (refreshed) {
                    // Retry the original request with new token
                    const newToken = this.getAuthToken();
                    if (newToken) {
                        options.headers = {
                            ...options.headers,
                            'Authorization': `Bearer ${newToken}`
                        };
                        return fetch(endpoint, options);
                    }
                }
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
    async saveUserLocation(location) {
        try {
            const response = await this.apiFetch('/api/user/location', {
                method: 'POST',
                body: JSON.stringify(location)
            });
            return response.json();
        } catch (error) {
            console.error('❌ [PrayerTimeAPI] Error saving user location:', error);
            throw error;
        }
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