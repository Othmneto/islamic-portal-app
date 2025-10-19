// Cross-Tab Synchronization for Authentication State
class CrossTabSync {
    constructor() {
        this.channelName = 'auth-channel';
        this.channel = null;
        this.isInitialized = false;
        this.heartbeatInterval = null;
        this.heartbeatIntervalMs = 30000; // 30 seconds

        this.init();
    }

    /**
     * Initialize cross-tab synchronization
     */
    init() {
        try {
            // Try BroadcastChannel first (modern browsers)
            if (typeof BroadcastChannel !== 'undefined') {
                this.channel = new BroadcastChannel(this.channelName);
                this.setupBroadcastChannel();
                console.log('✅ [CrossTab] BroadcastChannel initialized');
            } else {
                // Fallback to localStorage events
                this.setupStorageEvents();
                console.log('✅ [CrossTab] localStorage events initialized (fallback)');
            }

            // Setup heartbeat to detect tab closure
            this.setupHeartbeat();

            // Setup storage event listener for token changes
            this.setupTokenSync();

            this.isInitialized = true;
            console.log('🔗 [CrossTab] Cross-tab sync initialized');
        } catch (error) {
            console.error('❌ [CrossTab] Failed to initialize cross-tab sync:', error);
        }
    }

    /**
     * Setup BroadcastChannel for instant sync
     */
    setupBroadcastChannel() {
        this.channel.onmessage = (event) => {
            try {
                const { type, data } = event.data || {};

                switch (type) {
                    case 'TOKEN_UPDATE':
                        this.handleTokenUpdate(data);
                        break;
                    case 'LOGOUT':
                        this.handleLogout();
                        break;
                    case 'HEARTBEAT':
                        // Just acknowledge heartbeat
                        break;
                    default:
                        console.log('🔗 [CrossTab] Unknown message type:', type);
                }
            } catch (error) {
                console.error('❌ [CrossTab] Error handling BroadcastChannel message:', error);
            }
        };
    }

    /**
     * Setup localStorage events as fallback
     */
    setupStorageEvents() {
        window.addEventListener('storage', (event) => {
            try {
                if (event.key === 'accessToken') {
                    if (event.newValue === null) {
                        // Token removed - logout
                        this.handleLogout();
                    } else if (event.newValue !== event.oldValue) {
                        // Token updated
                        this.handleTokenUpdate({ token: event.newValue });
                    }
                }
            } catch (error) {
                console.error('❌ [CrossTab] Error handling storage event:', error);
            }
        });
    }

    /**
     * Setup heartbeat mechanism
     */
    setupHeartbeat() {
        // Send heartbeat every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, this.heartbeatIntervalMs);

        // Send heartbeat on page visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.sendHeartbeat();
            }
        });
    }

    /**
     * Send heartbeat to other tabs
     */
    sendHeartbeat() {
        if (this.channel) {
            try {
                this.channel.postMessage({
                    type: 'HEARTBEAT',
                    data: { timestamp: Date.now() }
                });
            } catch (error) {
                console.error('❌ [CrossTab] Error sending heartbeat:', error);
            }
        }
    }

    /**
     * Setup token synchronization
     */
    setupTokenSync() {
        // Listen for token changes in localStorage
        const originalSetItem = localStorage.setItem;
        const originalRemoveItem = localStorage.removeItem;

        const self = this;

        localStorage.setItem = function(key, value) {
            const result = originalSetItem.apply(this, arguments);

            if (key === 'accessToken' && value !== null) {
                // Token was set - broadcast to other tabs
                self.broadcastTokenUpdate(value);
            }

            return result;
        };

        localStorage.removeItem = function(key) {
            const result = originalRemoveItem.apply(this, arguments);

            if (key === 'accessToken') {
                // Token was removed - broadcast logout
                self.broadcastLogout();
            }

            return result;
        };
    }

    /**
     * Handle token update from other tabs
     */
    handleTokenUpdate(data) {
        try {
            const { token } = data || {};

            if (token && token !== localStorage.getItem('accessToken')) {
                console.log('🔗 [CrossTab] Token updated from another tab');
                localStorage.setItem('accessToken', token);

                // Update navbar if available
                if (window.updateNavbarState) {
                    window.updateNavbarState({
                        currentUser: this.getUserFromToken(token),
                        isAuthenticated: true
                    });
                }

                // Update token manager if available
                if (window.tokenManager) {
                    window.tokenManager.loadTokens();
                }
            }
        } catch (error) {
            console.error('❌ [CrossTab] Error handling token update:', error);
        }
    }

    /**
     * Handle logout from other tabs
     */
    handleLogout() {
        try {
            console.log('🔗 [CrossTab] Logout detected from another tab');

            // Clear tokens
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('authToken');
            localStorage.removeItem('token');
            localStorage.removeItem('jwt');

            // Update navbar if available
            if (window.updateNavbarState) {
                window.updateNavbarState({
                    currentUser: null,
                    isAuthenticated: false
                });
            }

            // Update token manager if available
            if (window.tokenManager) {
                window.tokenManager.clearTokens();
            }

            // Redirect to login if not already there
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('❌ [CrossTab] Error handling logout:', error);
        }
    }

    /**
     * Broadcast token update to other tabs
     */
    broadcastTokenUpdate(token) {
        try {
            if (this.channel) {
                this.channel.postMessage({
                    type: 'TOKEN_UPDATE',
                    data: { token }
                });
            }
        } catch (error) {
            console.error('❌ [CrossTab] Error broadcasting token update:', error);
        }
    }

    /**
     * Broadcast logout to other tabs
     */
    broadcastLogout() {
        try {
            if (this.channel) {
                this.channel.postMessage({
                    type: 'LOGOUT',
                    data: {}
                });
            }
        } catch (error) {
            console.error('❌ [CrossTab] Error broadcasting logout:', error);
        }
    }

    /**
     * Extract user info from token
     */
    getUserFromToken(token) {
        try {
            if (!token) return null;

            const parts = token.split('.');
            if (parts.length !== 3) return null;

            const payload = JSON.parse(atob(parts[1]));
            return {
                id: payload.sub || payload.user?.id || payload.userId
            };
        } catch (error) {
            console.error('❌ [CrossTab] Error extracting user from token:', error);
            return null;
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        try {
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
                this.heartbeatInterval = null;
            }

            if (this.channel) {
                this.channel.close();
                this.channel = null;
            }

            console.log('🔗 [CrossTab] Cross-tab sync destroyed');
        } catch (error) {
            console.error('❌ [CrossTab] Error destroying cross-tab sync:', error);
        }
    }
}

// Initialize cross-tab sync
window.crossTabSync = new CrossTabSync();

// Global functions for external use
window.broadcastTokenUpdateCrossTabSync = function(token) {
    if (window.crossTabSync) {
        window.crossTabSync.broadcastTokenUpdate(token);
    }
};

window.broadcastLogoutCrossTabSync = function() {
    if (window.crossTabSync) {
        window.crossTabSync.broadcastLogout();
    }
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.crossTabSync) {
        window.crossTabSync.destroy();
    }
});

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.crossTabSync = new CrossTabSync();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CrossTabSync;
}
