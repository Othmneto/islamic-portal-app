// Session Management Service for Frontend - Session-based authentication
class TokenManager {
    constructor() {
        this.authenticated = false;
        this.checkInterval = null;

        // Clear legacy tokens (migration shim - one-time cleanup)
        ['token', 'authToken', 'jwt', 'access_token', 'accessToken', 'refreshToken'].forEach(key => {
            if (localStorage.getItem(key)) {
                console.warn(`🔄 [TokenManager] Clearing legacy token: ${key}`);
                localStorage.removeItem(key);
            }
        });

        // Check session status
        this.checkSessionStatus();

        // Check session periodically (every 5 minutes)
        this.checkInterval = setInterval(() => {
            this.checkSessionStatus();
        }, 5 * 60 * 1000);

        console.log('🔑 [TokenManager] Initialized with session-based authentication');
    }

    /**
     * Check session status with server
     */
    async checkSessionStatus() {
        try {
            const response = await fetch('/api/auth/session', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.authenticated = data.authenticated || false;
                console.log('🔑 [TokenManager] Session check:', this.authenticated ? 'authenticated' : 'not authenticated');
            } else {
                this.authenticated = false;
            }

            this.updateNavbarState();
        } catch (error) {
            console.error('❌ [TokenManager] Error checking session:', error);
            this.authenticated = false;
        }
    }

    /**
     * Clear session (no-op for compatibility, session managed server-side)
     */
    clearTokens() {
        this.authenticated = false;
        console.log('🔑 [TokenManager] Session cleared');
        this.updateNavbarState();
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.authenticated;
    }

    /**
     * Get session info (compatibility method)
     */
    getTokenInfo() {
        return null; // Session info managed server-side
    }

    /**
     * Make authenticated request with session
     */
    async makeAuthenticatedRequest(url, options = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('User not authenticated');
        }

        // Make the request with credentials
        const requestOptions = {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const response = await fetch(url, requestOptions);

        // If session expired, redirect to login
        if (response.status === 401) {
            console.log('🔐 [TokenManager] Session expired, redirecting to login...');
            this.redirectToLogin();
            throw new Error('Session expired');
        }

        return response;
    }

    /**
     * Update navbar state
     */
    updateNavbarState() {
        if (window.updateNavbarState) {
            window.updateNavbarState({
                // Do not overwrite currentUser; allow navbar to retain cached user
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
            // Call logout endpoint
            if (this.isAuthenticated()) {
                await fetch('/api/auth-cookie/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('❌ [TokenManager] Logout API call failed:', error);
        } finally {
            // Clear state regardless of API call result
            this.clearTokens();
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
            this.redirectToLogin();
        }
    }

    /**
     * Clean up intervals
     */
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}

// Create global instance
window.tokenManager = new TokenManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenManager;
}