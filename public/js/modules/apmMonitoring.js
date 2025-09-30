// Application Performance Monitoring (APM) System
class APMMonitoring {
    constructor() {
        this.metrics = {
            performance: {},
            errors: [],
            userInteractions: [],
            networkRequests: [],
            memoryUsage: [],
            customEvents: []
        };
        
        this.thresholds = {
            pageLoadTime: 3000, // 3 seconds
            apiResponseTime: 2000, // 2 seconds
            memoryUsage: 100 * 1024 * 1024, // 100MB
            errorRate: 0.05 // 5%
        };
        
        this.isMonitoring = false;
        this.performanceObserver = null;
        this.errorObserver = null;
        this.memoryObserver = null;
        
        this.initializeMonitoring();
    }

    // Initialize all monitoring systems
    initializeMonitoring() {
        this.startPerformanceMonitoring();
        this.startErrorMonitoring();
        this.startMemoryMonitoring();
        this.startUserInteractionMonitoring();
        this.startNetworkMonitoring();
        this.startCustomEventMonitoring();
        
        this.isMonitoring = true;
        console.log('APM Monitoring initialized');
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        // Core Web Vitals
        this.observeCoreWebVitals();
        
        // Navigation timing
        this.observeNavigationTiming();
        
        // Resource timing
        this.observeResourceTiming();
        
        // Long tasks
        this.observeLongTasks();
    }

    observeCoreWebVitals() {
        // Largest Contentful Paint (LCP)
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.recordMetric('lcp', lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay (FID)
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
                this.recordMetric('fid', entry.processingStart - entry.startTime);
            });
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            });
            this.recordMetric('cls', clsValue);
        }).observe({ entryTypes: ['layout-shift'] });
    }

    observeNavigationTiming() {
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            
            this.recordMetric('domContentLoaded', navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart);
            this.recordMetric('loadComplete', navigation.loadEventEnd - navigation.loadEventStart);
            this.recordMetric('totalPageLoad', navigation.loadEventEnd - navigation.fetchStart);
            
            // Check if page load is slow
            if (navigation.loadEventEnd - navigation.fetchStart > this.thresholds.pageLoadTime) {
                this.recordCustomEvent('slow_page_load', {
                    loadTime: navigation.loadEventEnd - navigation.fetchStart,
                    threshold: this.thresholds.pageLoadTime
                });
            }
        });
    }

    observeResourceTiming() {
        this.performanceObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
                if (entry.entryType === 'resource') {
                    this.recordResourceMetric(entry);
                }
            });
        });
        
        this.performanceObserver.observe({ entryTypes: ['resource'] });
    }

    observeLongTasks() {
        if ('PerformanceObserver' in window) {
            try {
                new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        this.recordCustomEvent('long_task', {
                            duration: entry.duration,
                            startTime: entry.startTime,
                            name: entry.name
                        });
                    });
                }).observe({ entryTypes: ['longtask'] });
            } catch (error) {
                console.warn('Long task monitoring not supported:', error);
            }
        }
    }

    // Error monitoring
    startErrorMonitoring() {
        // JavaScript errors
        window.addEventListener('error', (event) => {
            this.recordError({
                type: 'javascript_error',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: Date.now()
            });
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.recordError({
                type: 'unhandled_promise_rejection',
                message: event.reason?.message || event.reason,
                stack: event.reason?.stack,
                timestamp: Date.now()
            });
        });

        // Resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.recordError({
                    type: 'resource_error',
                    element: event.target.tagName,
                    src: event.target.src || event.target.href,
                    timestamp: Date.now()
                });
            }
        }, true);
    }

    // Memory monitoring
    startMemoryMonitoring() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                this.recordMemoryUsage({
                    used: memory.usedJSHeapSize,
                    total: memory.totalJSHeapSize,
                    limit: memory.jsHeapSizeLimit,
                    timestamp: Date.now()
                });

                // Check if memory usage is high
                if (memory.usedJSHeapSize > this.thresholds.memoryUsage) {
                    this.recordCustomEvent('high_memory_usage', {
                        used: memory.usedJSHeapSize,
                        limit: memory.jsHeapSizeLimit,
                        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
                    });
                }
            }, 5000); // Check every 5 seconds
        }
    }

    // User interaction monitoring
    startUserInteractionMonitoring() {
        const interactionTypes = ['click', 'scroll', 'keydown', 'mousemove', 'touchstart'];
        
        interactionTypes.forEach(type => {
            document.addEventListener(type, (event) => {
                this.recordUserInteraction({
                    type,
                    target: event.target.tagName,
                    timestamp: Date.now(),
                    x: event.clientX,
                    y: event.clientY
                });
            }, { passive: true });
        });
    }

    // Network monitoring
    startNetworkMonitoring() {
        // Override fetch to monitor API calls
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const startTime = performance.now();
            const url = args[0];
            
            try {
                const response = await originalFetch(...args);
                const endTime = performance.now();
                
                this.recordNetworkRequest({
                    url,
                    method: 'GET', // Default, could be extracted from args
                    status: response.status,
                    duration: endTime - startTime,
                    timestamp: Date.now(),
                    success: response.ok
                });

                // Check if API response is slow
                if (endTime - startTime > this.thresholds.apiResponseTime) {
                    this.recordCustomEvent('slow_api_response', {
                        url,
                        duration: endTime - startTime,
                        threshold: this.thresholds.apiResponseTime
                    });
                }

                return response;
            } catch (error) {
                const endTime = performance.now();
                this.recordNetworkRequest({
                    url,
                    method: 'GET',
                    status: 0,
                    duration: endTime - startTime,
                    timestamp: Date.now(),
                    success: false,
                    error: error.message
                });
                throw error;
            }
        };
    }

    // Custom event monitoring
    startCustomEventMonitoring() {
        // This will be used for application-specific events
        window.addEventListener('customEvent', (event) => {
            this.recordCustomEvent(event.detail.type, event.detail.data);
        });
    }

    // Record methods
    recordMetric(name, value) {
        if (!this.metrics.performance[name]) {
            this.metrics.performance[name] = [];
        }
        
        this.metrics.performance[name].push({
            value,
            timestamp: Date.now()
        });

        // Keep only last 1000 entries
        if (this.metrics.performance[name].length > 1000) {
            this.metrics.performance[name] = this.metrics.performance[name].slice(-1000);
        }
    }

    recordError(error) {
        this.metrics.errors.push(error);
        
        // Keep only last 500 errors
        if (this.metrics.errors.length > 500) {
            this.metrics.errors = this.metrics.errors.slice(-500);
        }

        // Send critical errors immediately
        if (this.isCriticalError(error)) {
            this.sendErrorReport(error);
        }
    }

    recordResourceMetric(entry) {
        this.metrics.networkRequests.push({
            name: entry.name,
            duration: entry.duration,
            size: entry.transferSize,
            type: entry.initiatorType,
            timestamp: Date.now()
        });
    }

    recordMemoryUsage(usage) {
        this.metrics.memoryUsage.push(usage);
        
        // Keep only last 100 entries
        if (this.metrics.memoryUsage.length > 100) {
            this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
        }
    }

    recordUserInteraction(interaction) {
        this.metrics.userInteractions.push(interaction);
        
        // Keep only last 1000 interactions
        if (this.metrics.userInteractions.length > 1000) {
            this.metrics.userInteractions = this.metrics.userInteractions.slice(-1000);
        }
    }

    recordNetworkRequest(request) {
        this.metrics.networkRequests.push(request);
        
        // Keep only last 500 requests
        if (this.metrics.networkRequests.length > 500) {
            this.metrics.networkRequests = this.metrics.networkRequests.slice(-500);
        }
    }

    recordCustomEvent(type, data) {
        this.metrics.customEvents.push({
            type,
            data,
            timestamp: Date.now()
        });
        
        // Keep only last 1000 events
        if (this.metrics.customEvents.length > 1000) {
            this.metrics.customEvents = this.metrics.customEvents.slice(-1000);
        }
    }

    // Utility methods
    isCriticalError(error) {
        const criticalTypes = ['javascript_error', 'unhandled_promise_rejection'];
        return criticalTypes.includes(error.type) || error.message?.includes('Critical');
    }

    sendErrorReport(error) {
        // Send error to monitoring service
        fetch('/api/monitoring/error', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error,
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: Date.now()
            })
        }).catch(err => console.warn('Failed to send error report:', err));
    }

    // Get performance summary
    getPerformanceSummary() {
        const summary = {
            pageLoadTime: this.getAverageMetric('totalPageLoad'),
            lcp: this.getAverageMetric('lcp'),
            fid: this.getAverageMetric('fid'),
            cls: this.getAverageMetric('cls'),
            errorCount: this.metrics.errors.length,
            memoryUsage: this.getCurrentMemoryUsage(),
            networkRequests: this.metrics.networkRequests.length,
            userInteractions: this.metrics.userInteractions.length
        };

        return summary;
    }

    getAverageMetric(metricName) {
        const values = this.metrics.performance[metricName];
        if (!values || values.length === 0) return 0;
        
        const sum = values.reduce((acc, entry) => acc + entry.value, 0);
        return sum / values.length;
    }

    getCurrentMemoryUsage() {
        if ('memory' in performance) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    // Get error rate
    getErrorRate() {
        const totalInteractions = this.metrics.userInteractions.length;
        const totalErrors = this.metrics.errors.length;
        
        if (totalInteractions === 0) return 0;
        return totalErrors / totalInteractions;
    }

    // Check if performance is within thresholds
    isPerformanceGood() {
        const summary = this.getPerformanceSummary();
        const errorRate = this.getErrorRate();
        
        return {
            pageLoad: summary.pageLoadTime <= this.thresholds.pageLoadTime,
            memory: !summary.memoryUsage || summary.memoryUsage.used <= this.thresholds.memoryUsage,
            errors: errorRate <= this.thresholds.errorRate,
            overall: summary.pageLoadTime <= this.thresholds.pageLoadTime && 
                    errorRate <= this.thresholds.errorRate
        };
    }

    // Export metrics
    exportMetrics() {
        return {
            ...this.metrics,
            summary: this.getPerformanceSummary(),
            thresholds: this.thresholds,
            isGood: this.isPerformanceGood()
        };
    }

    // Clear metrics
    clearMetrics() {
        this.metrics = {
            performance: {},
            errors: [],
            userInteractions: [],
            networkRequests: [],
            memoryUsage: [],
            customEvents: []
        };
        console.log('APM metrics cleared');
    }

    // Stop monitoring
    stopMonitoring() {
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
        this.isMonitoring = false;
        console.log('APM monitoring stopped');
    }

    // Restart monitoring
    restartMonitoring() {
        this.stopMonitoring();
        this.initializeMonitoring();
    }
}

// Export for use
export default APMMonitoring;
