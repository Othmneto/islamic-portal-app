// Cache Management for Force Empty Cache & Hard Reload
class CacheManager {
    constructor() {
        this.cacheVersion = 'v' + Date.now();
        this.forceReloadKey = 'force-reload';
        this.lastReloadKey = 'last-reload';

        this.init();
    }

    /**
     * Initialize cache management
     */
    init() {
        // Temporarily disabled to prevent infinite loop
        // this.checkForceReload();

        // Setup periodic cache clearing
        this.setupPeriodicCacheClear();

        // Setup visibility change handler
        this.setupVisibilityChangeHandler();

        console.log('🗂️ [CacheManager] Initialized with version:', this.cacheVersion);
    }

    /**
     * Check if force reload is needed
     */
    checkForceReload() {
        const shouldForceReload = localStorage.getItem(this.forceReloadKey) === 'true';
        const lastReload = localStorage.getItem(this.lastReloadKey);
        const now = Date.now();

        // Only check cache version change once per session
        const hasCheckedVersion = sessionStorage.getItem('cache-version-checked') === 'true';

        // Force reload if:
        // 1. Explicitly requested
        // 2. More than 1 hour since last reload
        // 3. Cache version changed (but only check once per session)
        if (shouldForceReload ||
            !lastReload ||
            (now - parseInt(lastReload)) > 3600000 ||
            (!hasCheckedVersion && this.hasCacheVersionChanged())) {

            console.log('🔄 [CacheManager] Force reload triggered');
            this.performForceReload();
        }

        // Mark that we've checked the version for this session
        if (!hasCheckedVersion) {
            sessionStorage.setItem('cache-version-checked', 'true');
        }
    }

    /**
     * Check if cache version has changed
     */
    hasCacheVersionChanged() {
        const storedVersion = localStorage.getItem('cache-version');
        if (storedVersion !== this.cacheVersion) {
            localStorage.setItem('cache-version', this.cacheVersion);
            return true;
        }
        return false;
    }

    /**
     * Perform force reload with cache clearing
     */
    async performForceReload() {
        try {
            console.log('🧹 [CacheManager] Clearing caches and performing hard reload...');

            // Clear various caches
            await this.clearAllCaches();

            // Update last reload timestamp
            localStorage.setItem(this.lastReloadKey, Date.now().toString());

            // Clear force reload flag
            localStorage.removeItem(this.forceReloadKey);

            // Perform hard reload
            this.hardReload();

        } catch (error) {
            console.error('❌ [CacheManager] Error during force reload:', error);
            // Fallback to regular reload
            window.location.reload(true);
        }
    }

    /**
     * Clear all available caches
     */
    async clearAllCaches() {
        try {
            // Clear Service Worker caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
                console.log('✅ [CacheManager] Service Worker caches cleared');
            }

            // Clear IndexedDB if available
            if ('indexedDB' in window) {
                await this.clearIndexedDB();
            }

            // Clear localStorage items that might be cached
            this.clearCachedLocalStorage();

            // Clear sessionStorage
            sessionStorage.clear();

            console.log('✅ [CacheManager] All caches cleared');
        } catch (error) {
            console.error('❌ [CacheManager] Error clearing caches:', error);
        }
    }

    /**
     * Clear IndexedDB
     */
    async clearIndexedDB() {
        try {
            if ('indexedDB' in window) {
                const databases = await indexedDB.databases();
                await Promise.all(
                    databases.map(db => {
                        return new Promise((resolve, reject) => {
                            const deleteReq = indexedDB.deleteDatabase(db.name);
                            deleteReq.onsuccess = () => resolve();
                            deleteReq.onerror = () => reject(deleteReq.error);
                        });
                    })
                );
                console.log('✅ [CacheManager] IndexedDB cleared');
            }
        } catch (error) {
            console.error('❌ [CacheManager] Error clearing IndexedDB:', error);
        }
    }

    /**
     * Clear cached localStorage items
     */
    clearCachedLocalStorage() {
        const keysToKeep = [
            'accessToken',
            'refreshToken',
            'user',
            'userData',
            'last-reload',
            'cache-version'
        ];

        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        });

        console.log('✅ [CacheManager] Cached localStorage items cleared');
    }

    /**
     * Setup periodic cache clearing
     */
    setupPeriodicCacheClear() {
        // Clear caches every 6 hours (much less aggressive)
        setInterval(() => {
            this.clearAllCaches();
        }, 6 * 60 * 60 * 1000);
    }

    /**
     * Setup visibility change handler
     */
    setupVisibilityChangeHandler() {
        let lastVisibilityCheck = 0;
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                const now = Date.now();
                // Only check every 30 minutes when page becomes visible (much less aggressive)
                if (now - lastVisibilityCheck > 30 * 60 * 1000) {
                    lastVisibilityCheck = now;
                    // Only check for force reload, don't automatically trigger it
                    const shouldForceReload = localStorage.getItem(this.forceReloadKey) === 'true';
                    if (shouldForceReload) {
                        console.log('🔄 [CacheManager] Force reload requested via visibility change');
                        this.performForceReload();
                    }
                }
            }
        });
    }

    /**
     * Force a reload on next page load
     */
    requestForceReload() {
        localStorage.setItem(this.forceReloadKey, 'true');
        console.log('🔄 [CacheManager] Force reload requested for next page load');
    }

    /**
     * Perform hard reload
     */
    hardReload() {
        try {
            // Try different methods for hard reload
            if (window.location.reload) {
                window.location.reload(true);
            } else {
                window.location.href = window.location.href;
            }
        } catch (error) {
            console.error('❌ [CacheManager] Error during hard reload:', error);
            // Fallback
            window.location.href = window.location.href;
        }
    }

    /**
     * Add cache-busting parameters to URLs
     */
    addCacheBusting(url) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}v=${this.cacheVersion}&t=${Date.now()}`;
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            const stats = {
                cacheVersion: this.cacheVersion,
                lastReload: localStorage.getItem(this.lastReloadKey),
                forceReloadRequested: localStorage.getItem(this.forceReloadKey) === 'true',
                serviceWorkerCaches: 0,
                indexedDBDatabases: 0,
                localStorageItems: Object.keys(localStorage).length,
                sessionStorageItems: Object.keys(sessionStorage).length
            };

            // Count Service Worker caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                stats.serviceWorkerCaches = cacheNames.length;
            }

            // Count IndexedDB databases
            if ('indexedDB' in window) {
                const databases = await indexedDB.databases();
                stats.indexedDBDatabases = databases.length;
            }

            return stats;
        } catch (error) {
            console.error('❌ [CacheManager] Error getting cache stats:', error);
            return null;
        }
    }

    /**
     * Clear specific cache by name
     */
    async clearCacheByName(cacheName) {
        try {
            if ('caches' in window) {
                await caches.delete(cacheName);
                console.log(`✅ [CacheManager] Cache '${cacheName}' cleared`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ [CacheManager] Error clearing cache '${cacheName}':`, error);
            return false;
        }
    }
}

// Create global instance
window.cacheManager = new CacheManager();

// Global functions for external use
window.requestForceReload = function() {
    if (window.cacheManager) {
        window.cacheManager.requestForceReload();
    }
};

window.clearAllCaches = function() {
    if (window.cacheManager) {
        window.cacheManager.clearAllCaches();
    }
};

window.addCacheBusting = function(url) {
    if (window.cacheManager) {
        return window.cacheManager.addCacheBusting(url);
    }
    return url;
};

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.cacheManager = new CacheManager();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
}
