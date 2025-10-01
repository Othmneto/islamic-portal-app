// Token Management Service for Frontend
class TokenManager {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.refreshTimer = null;
        this.isRefreshing = false;
        this.refreshPromise = null;
    this.authenticated = false;
        
        // Load tokens from localStorage
        this.loadTokens();
        
        // Start auto-refresh timer
        this.startAutoRefresh();
        
        console.log('🔑 [TokenManager] Initialized');
    }

    /**
     * Load tokens from localStorage
     */
    loadTokens() {
        try {
            // Prefer unified keys; fall back to legacy keys if present
            this.accessToken = localStorage.getItem('accessToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
            this.refreshToken = localStorage.getItem('refreshToken');
            
            // Validate token if it exists
            if (this.accessToken) {
                const tokenInfo = this.getTokenInfo();
                if (tokenInfo && !tokenInfo.isExpired) {
                    this.authenticated = true;
                    console.log('🔑 [TokenManager] Valid tokens loaded from storage');
                    this.updateNavbarState();
                } else {
                    console.log('⚠️ [TokenManager] Token expired or invalid, clearing');
                    this.clearTokens();
                }
            } else {
                this.authenticated = false;
            }
        } catch (error) {
            console.error('❌ [TokenManager] Error loading tokens:', error);
            this.clearTokens();
        }
    }

    /**
     * Save tokens to localStorage
     */
    saveTokens(accessToken, refreshToken) {
        try {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken || localStorage.getItem('refreshToken') || 'session';
            
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', this.refreshToken);
            // Clean up legacy keys for consistency
            localStorage.removeItem('authToken');
            localStorage.removeItem('token');
            localStorage.removeItem('jwt');
            
            console.log('🔑 [TokenManager] Tokens saved to storage');
            this.authenticated = true;
            this.updateNavbarState();
        } catch (error) {
            console.error('❌ [TokenManager] Error saving tokens:', error);
        }
    }

    /**
     * Clear tokens from localStorage
     */
    clearTokens() {
        try {
            this.accessToken = null;
            this.refreshToken = null;
            this.authenticated = false;
            
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('authToken');
            localStorage.removeItem('token');
            localStorage.removeItem('jwt');
            
            console.log('🔑 [TokenManager] Tokens cleared');
            this.updateNavbarState();
        } catch (error) {
            console.error('❌ [TokenManager] Error clearing tokens:', error);
        }
    }

    /**
     * Get current access token
     */
    getAccessToken() {
        return this.accessToken;
    }

    /**
     * Get current refresh token
     */
    getRefreshToken() {
        return this.refreshToken;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.authenticated;
    }

    /**
     * Get token expiry information
     */
    getTokenInfo() {
        if (!this.accessToken) {
            return null;
        }

        try {
            const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = payload.exp;
            const timeUntilExpiry = (expiresAt - now) * 1000;
            
            return {
                expiresAt: new Date(expiresAt * 1000),
                timeUntilExpiry: timeUntilExpiry,
                isExpired: timeUntilExpiry <= 0,
                needsRefresh: timeUntilExpiry <= (15 * 60 * 1000), // 15 minutes
                userId: payload.user?.id || payload.userId
            };
        } catch (error) {
            console.error('❌ [TokenManager] Error parsing token:', error);
            return null;
        }
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        // Prevent multiple simultaneous refresh attempts
        if (this.isRefreshing) {
            return this.refreshPromise;
        }

        this.isRefreshing = true;
        this.refreshPromise = this._performRefresh();

        try {
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    /**
     * Perform the actual refresh
     */
    async _performRefresh() {
        try {
            console.log('🔄 [TokenManager] Refreshing access token...');
            
            const response = await fetch('/api/token/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refreshToken: this.refreshToken
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Token refresh failed');
            }

            // Update tokens
            this.saveTokens(data.data.accessToken, data.data.refreshToken);
            
            console.log('✅ [TokenManager] Access token refreshed successfully');
            
            // Restart auto-refresh timer
            this.startAutoRefresh();
            
            return data.data;
        } catch (error) {
            console.error('❌ [TokenManager] Token refresh failed:', error);
            
            // Clear tokens on refresh failure
            this.clearTokens();
            this.redirectToLogin();
            
            throw error;
        }
    }

    /**
     * Auto-refresh token if needed
     */
    async autoRefreshToken() {
        if (!this.isAuthenticated()) {
            return false;
        }

        const tokenInfo = this.getTokenInfo();
        if (!tokenInfo || !tokenInfo.needsRefresh) {
            return false;
        }

        try {
            await this.refreshAccessToken();
            return true;
        } catch (error) {
            console.error('❌ [TokenManager] Auto-refresh failed:', error);
            return false;
        }
    }

    /**
     * Start auto-refresh timer
     */
    startAutoRefresh() {
        // Clear existing timer
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        if (!this.isAuthenticated()) {
            return;
        }

        // Check every 5 minutes
        this.refreshTimer = setInterval(async () => {
            try {
                await this.autoRefreshToken();
            } catch (error) {
                console.error('❌ [TokenManager] Auto-refresh error:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes

        console.log('⏰ [TokenManager] Auto-refresh timer started');
    }

    /**
     * Stop auto-refresh timer
     */
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            console.log('⏹️ [TokenManager] Auto-refresh timer stopped');
        }
    }

    /**
     * Make authenticated request with automatic token refresh
     */
    async makeAuthenticatedRequest(url, options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        // Try auto-refresh first
        await this.autoRefreshToken();

        // Make the request
        const requestOptions = {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        let response = await fetch(url, requestOptions);

        // If token expired, try to refresh and retry
        if (response.status === 401) {
            console.log('🔄 [TokenManager] Token expired, attempting refresh...');
            
            try {
                await this.refreshAccessToken();
                
                // Retry the request with new token
                requestOptions.headers.Authorization = `Bearer ${this.accessToken}`;
                response = await fetch(url, requestOptions);
            } catch (error) {
                console.error('❌ [TokenManager] Refresh failed, redirecting to login');
                this.redirectToLogin();
                throw error;
            }
        }

        return response;
    }

    /**
     * Update navbar state
     */
    updateNavbarState() {
        if (window.updateNavbarState) {
            const tokenInfo = this.getTokenInfo();
            const user = tokenInfo ? { id: tokenInfo.userId } : null;
            
            window.updateNavbarState({
                currentUser: user,
                isAuthenticated: this.isAuthenticated()
            });
        }
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
        console.log('🔐 [TokenManager] Redirecting to login...');
        window.location.href = '/login.html';
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            // Call logout endpoint if available
            if (this.isAuthenticated()) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('❌ [TokenManager] Logout API call failed:', error);
        } finally {
            // Clear tokens regardless of API call result
            this.clearTokens();
            this.stopAutoRefresh();
            this.redirectToLogin();
        }
    }

    /**
     * Get session statistics
     */
    async getSessionStats() {
        if (!this.isAuthenticated()) {
            return null;
        }

        try {
            const tokenInfo = this.getTokenInfo();
            if (!tokenInfo || !tokenInfo.userId) {
                return null;
            }

            const response = await fetch(`/api/token/session-stats/${tokenInfo.userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to get session stats');
            }

            const data = await response.json();
            return data.data;
        } catch (error) {
            console.error('❌ [TokenManager] Error getting session stats:', error);
            return null;
        }
    }
}

// Create global instance
window.tokenManager = new TokenManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenManager;
}
