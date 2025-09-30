/**
 * Performance Optimizer Module
 * Implements various performance optimizations for the translation interface
 */

export class PerformanceOptimizer {
    constructor() {
        this.observers = new Map();
        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
        this.performanceMetrics = {
            renderTime: 0,
            translationTime: 0,
            cacheHitRate: 0,
            memoryUsage: 0
        };
        
        this.init();
    }
    
    init() {
        this.setupPerformanceMonitoring();
        this.setupLazyLoading();
        this.setupImageOptimization();
        this.setupBundleOptimization();
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor Core Web Vitals
        this.observeLCP();
        this.observeFID();
        this.observeCLS();
        
        // Monitor custom metrics
        this.observeTranslationPerformance();
        this.observeMemoryUsage();
    }
    
    /**
     * Observe Largest Contentful Paint (LCP)
     */
    observeLCP() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                console.log('LCP:', lastEntry.startTime);
            });
            
            observer.observe({ entryTypes: ['largest-contentful-paint'] });
            this.observers.set('lcp', observer);
        }
    }
    
    /**
     * Observe First Input Delay (FID)
     */
    observeFID() {
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    console.log('FID:', entry.processingStart - entry.startTime);
                });
            });
            
            observer.observe({ entryTypes: ['first-input'] });
            this.observers.set('fid', observer);
        }
    }
    
    /**
     * Observe Cumulative Layout Shift (CLS)
     */
    observeCLS() {
        if ('PerformanceObserver' in window) {
            let clsValue = 0;
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach(entry => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                });
                console.log('CLS:', clsValue);
            });
            
            observer.observe({ entryTypes: ['layout-shift'] });
            this.observers.set('cls', observer);
        }
    }
    
    /**
     * Observe translation performance
     */
    observeTranslationPerformance() {
        // Monitor translation API calls
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const start = performance.now();
            const response = await originalFetch(...args);
            const end = performance.now();
            
            if (args[0].includes('/translate')) {
                this.performanceMetrics.translationTime = end - start;
                console.log(`Translation API call took ${end - start}ms`);
            }
            
            return response;
        };
    }
    
    /**
     * Observe memory usage
     */
    observeMemoryUsage() {
        if ('memory' in performance) {
            setInterval(() => {
                this.performanceMetrics.memoryUsage = performance.memory.usedJSHeapSize;
            }, 5000);
        }
    }
    
    /**
     * Setup lazy loading for images and components
     */
    setupLazyLoading() {
        // Lazy load images
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
            
            this.observers.set('images', imageObserver);
        }
        
        // Lazy load components
        this.setupComponentLazyLoading();
    }
    
    /**
     * Setup component lazy loading
     */
    setupComponentLazyLoading() {
        const componentObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const component = entry.target;
                    const moduleName = component.dataset.module;
                    
                    if (moduleName) {
                        this.loadComponent(moduleName, component);
                        componentObserver.unobserve(component);
                    }
                }
            });
        });
        
        document.querySelectorAll('[data-module]').forEach(component => {
            componentObserver.observe(component);
        });
        
        this.observers.set('components', componentObserver);
    }
    
    /**
     * Load component dynamically
     */
    async loadComponent(moduleName, container) {
        try {
            const module = await import(`./${moduleName}.js`);
            const ComponentClass = module.default || module[Object.keys(module)[0]];
            const component = new ComponentClass();
            container.appendChild(component.render());
        } catch (error) {
            console.error(`Failed to load component ${moduleName}:`, error);
        }
    }
    
    /**
     * Setup image optimization
     */
    setupImageOptimization() {
        // Optimize images on load
        document.addEventListener('DOMContentLoaded', () => {
            this.optimizeImages();
        });
    }
    
    /**
     * Optimize images
     */
    optimizeImages() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            // Add loading="lazy" if not present
            if (!img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }
            
            // Add decoding="async" for better performance
            if (!img.hasAttribute('decoding')) {
                img.setAttribute('decoding', 'async');
            }
            
            // Optimize image format based on browser support
            this.optimizeImageFormat(img);
        });
    }
    
    /**
     * Optimize image format
     */
    optimizeImageFormat(img) {
        // Check for WebP support
        if (this.supportsWebP()) {
            const webpSrc = img.src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
            img.src = webpSrc;
        }
        
        // Check for AVIF support
        if (this.supportsAVIF()) {
            const avifSrc = img.src.replace(/\.(jpg|jpeg|png)$/i, '.avif');
            img.src = avifSrc;
        }
    }
    
    /**
     * Check WebP support
     */
    supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    
    /**
     * Check AVIF support
     */
    supportsAVIF() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
    }
    
    /**
     * Setup bundle optimization
     */
    setupBundleOptimization() {
        // Preload critical resources
        this.preloadCriticalResources();
        
        // Setup service worker for caching
        this.setupServiceWorker();
    }
    
    /**
     * Preload critical resources
     */
    preloadCriticalResources() {
        const criticalResources = [
            '/translator/css/text-translator.css',
            '/translator/js/utils/ui-utils.js',
            '/translator/js/text-translator.js'
        ];
        
        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            link.as = resource.endsWith('.css') ? 'style' : 'script';
            document.head.appendChild(link);
        });
    }
    
    /**
     * Setup service worker
     */
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }
    
    /**
     * Debounce function calls
     */
    debounce(func, delay, key) {
        const timerKey = key || func.name;
        
        if (this.debounceTimers.has(timerKey)) {
            clearTimeout(this.debounceTimers.get(timerKey));
        }
        
        const timer = setTimeout(() => {
            func();
            this.debounceTimers.delete(timerKey);
        }, delay);
        
        this.debounceTimers.set(timerKey, timer);
    }
    
    /**
     * Throttle function calls
     */
    throttle(func, delay, key) {
        const timerKey = key || func.name;
        
        if (this.throttleTimers.has(timerKey)) {
            return;
        }
        
        func();
        
        const timer = setTimeout(() => {
            this.throttleTimers.delete(timerKey);
        }, delay);
        
        this.throttleTimers.set(timerKey, timer);
    }
    
    /**
     * Optimize DOM operations
     */
    optimizeDOMOperations(operations) {
        // Use DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();
        
        operations.forEach(operation => {
            const element = operation();
            if (element) {
                fragment.appendChild(element);
            }
        });
        
        return fragment;
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            lcp: this.getLCP(),
            fid: this.getFID(),
            cls: this.getCLS(),
            memoryUsage: this.getMemoryUsage()
        };
    }
    
    /**
     * Get LCP value
     */
    getLCP() {
        const entries = performance.getEntriesByType('largest-contentful-paint');
        return entries[entries.length - 1]?.startTime || 0;
    }
    
    /**
     * Get FID value
     */
    getFID() {
        const entries = performance.getEntriesByType('first-input');
        return entries[0]?.processingStart - entries[0]?.startTime || 0;
    }
    
    /**
     * Get CLS value
     */
    getCLS() {
        let clsValue = 0;
        const entries = performance.getEntriesByType('layout-shift');
        entries.forEach(entry => {
            if (!entry.hadRecentInput) {
                clsValue += entry.value;
            }
        });
        return clsValue;
    }
    
    /**
     * Get memory usage
     */
    getMemoryUsage() {
        if ('memory' in performance) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
    
    /**
     * Cleanup observers and timers
     */
    cleanup() {
        // Cleanup observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        
        // Cleanup timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        this.throttleTimers.forEach(timer => clearTimeout(timer));
        this.throttleTimers.clear();
    }
}

// Global performance optimizer
export const performanceOptimizer = new PerformanceOptimizer();
