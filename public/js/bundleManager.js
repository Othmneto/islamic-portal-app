// Bundle Manager for Code Splitting and Performance Optimization
class BundleManager {
    constructor() {
        this.loadedModules = new Set();
        this.loadingModules = new Set();
        this.moduleCache = new Map();
        this.performanceMetrics = {
            loadTimes: {},
            bundleSizes: {},
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    // Dynamic module loading with code splitting
    async loadModule(moduleName, options = {}) {
        const startTime = performance.now();
        
        // Check if already loaded
        if (this.loadedModules.has(moduleName)) {
            this.performanceMetrics.cacheHits++;
            return this.moduleCache.get(moduleName);
        }

        // Check if currently loading
        if (this.loadingModules.has(moduleName)) {
            return this.waitForModule(moduleName);
        }

        this.loadingModules.add(moduleName);
        this.performanceMetrics.cacheMisses++;

        try {
            const module = await this.importModule(moduleName, options);
            this.loadedModules.add(moduleName);
            this.moduleCache.set(moduleName, module);
            
            const loadTime = performance.now() - startTime;
            this.performanceMetrics.loadTimes[moduleName] = loadTime;
            
            console.log(`Module ${moduleName} loaded in ${loadTime.toFixed(2)}ms`);
            return module;
        } catch (error) {
            console.error(`Failed to load module ${moduleName}:`, error);
            throw error;
        } finally {
            this.loadingModules.delete(moduleName);
        }
    }

    async importModule(moduleName, options) {
        const moduleMap = {
            // Core modules
            'translator': () => import('./modules/translator.js'),
            'voice-input': () => import('./modules/voiceInput.js'),
            'real-time': () => import('./modules/realTime.js'),
            
            // Feature modules
            'prayer-times': () => import('./modules/prayerTimes.js'),
            'qibla': () => import('./modules/qibla.js'),
            'moon': () => import('./modules/moon.js'),
            'duas': () => import('./modules/duas.js'),
            'names': () => import('./modules/names.js'),
            'zakat': () => import('./modules/zakat.js'),
            
            // Utility modules
            'analytics': () => import('./modules/analytics.js'),
            'notifications': () => import('./modules/notifications.js'),
            'settings': () => import('./modules/settings.js'),
            'i18n': () => import('./modules/i18n.js'),
            
            // Advanced modules
            'ai-assistant': () => import('./modules/aiAssistant.js'),
            'conversation-memory': () => import('./modules/conversationMemory.js'),
            'smart-suggestions': () => import('./modules/smartSuggestions.js'),
            'apm-monitoring': () => import('./modules/apmMonitoring.js'),
            'error-tracking': () => import('./modules/errorTracking.js')
        };

        if (moduleMap[moduleName]) {
            return await moduleMap[moduleName]();
        } else {
            throw new Error(`Module ${moduleName} not found`);
        }
    }

    async waitForModule(moduleName) {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (this.loadedModules.has(moduleName)) {
                    clearInterval(checkInterval);
                    resolve(this.moduleCache.get(moduleName));
                } else if (!this.loadingModules.has(moduleName)) {
                    clearInterval(checkInterval);
                    reject(new Error(`Module ${moduleName} failed to load`));
                }
            }, 50);
        });
    }

    // Preload critical modules
    async preloadCriticalModules() {
        const criticalModules = [
            'translator',
            'voice-input',
            'real-time',
            'i18n'
        ];

        console.log('Preloading critical modules...');
        const preloadPromises = criticalModules.map(module => 
            this.loadModule(module).catch(err => 
                console.warn(`Failed to preload ${module}:`, err)
            )
        );

        await Promise.allSettled(preloadPromises);
        console.log('Critical modules preloaded');
    }

    // Lazy load modules on demand
    async lazyLoadModule(moduleName, triggerElement) {
        if (this.loadedModules.has(moduleName)) {
            return this.moduleCache.get(moduleName);
        }

        // Show loading indicator
        this.showLoadingIndicator(triggerElement);

        try {
            const module = await this.loadModule(moduleName);
            this.hideLoadingIndicator(triggerElement);
            return module;
        } catch (error) {
            this.hideLoadingIndicator(triggerElement);
            this.showErrorIndicator(triggerElement, error.message);
            throw error;
        }
    }

    // Bundle optimization
    optimizeBundles() {
        // Remove unused modules from cache
        const maxCacheSize = 10;
        if (this.moduleCache.size > maxCacheSize) {
            const oldestModule = this.moduleCache.keys().next().value;
            this.moduleCache.delete(oldestModule);
            this.loadedModules.delete(oldestModule);
        }

        // Compress loaded modules
        this.compressModules();
    }

    compressModules() {
        // Simple compression simulation
        this.moduleCache.forEach((module, name) => {
            if (module.compress) {
                module.compress();
            }
        });
    }

    // Performance monitoring
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            loadedModules: Array.from(this.loadedModules),
            cacheSize: this.moduleCache.size,
            loadingModules: Array.from(this.loadingModules)
        };
    }

    // UI helpers
    showLoadingIndicator(element) {
        if (element) {
            element.style.opacity = '0.6';
            element.style.pointerEvents = 'none';
            
            const indicator = document.createElement('div');
            indicator.className = 'bundle-loading-indicator';
            indicator.innerHTML = 'Loading...';
            indicator.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000;
            `;
            element.style.position = 'relative';
            element.appendChild(indicator);
        }
    }

    hideLoadingIndicator(element) {
        if (element) {
            element.style.opacity = '1';
            element.style.pointerEvents = 'auto';
            
            const indicator = element.querySelector('.bundle-loading-indicator');
            if (indicator) {
                indicator.remove();
            }
        }
    }

    showErrorIndicator(element, message) {
        if (element) {
            const errorIndicator = document.createElement('div');
            errorIndicator.className = 'bundle-error-indicator';
            errorIndicator.innerHTML = `Error: ${message}`;
            errorIndicator.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(220, 38, 38, 0.9);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 1000;
            `;
            element.style.position = 'relative';
            element.appendChild(errorIndicator);
            
            setTimeout(() => {
                if (errorIndicator.parentNode) {
                    errorIndicator.remove();
                }
            }, 5000);
        }
    }

    // Cleanup
    cleanup() {
        this.loadedModules.clear();
        this.loadingModules.clear();
        this.moduleCache.clear();
        this.performanceMetrics = {
            loadTimes: {},
            bundleSizes: {},
            cacheHits: 0,
            cacheMisses: 0
        };
    }
}

// Export for global use
window.BundleManager = BundleManager;
