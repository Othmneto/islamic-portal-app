/**
 * Debounce utility for input handling
 * Provides efficient debouncing with configurable timing
 */

export class DebounceManager {
    constructor() {
        this.timeouts = new Map();
        this.lastCallTimes = new Map();
    }

    /**
     * Debounce a function call
     * @param {string} key - Unique key for this debounced function
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @param {Object} options - Additional options
     */
    debounce(key, func, delay = 500, options = {}) {
        const {
            leading = false,
            trailing = true,
            maxWait = null
        } = options;

        return (...args) => {
            const now = Date.now();
            const lastCallTime = this.lastCallTimes.get(key) || 0;
            const timeSinceLastCall = now - lastCallTime;

            // Performance optimization: skip if called too frequently
            if (timeSinceLastCall < 100) { // Minimum 100ms between calls
                return;
            }

            // Clear existing timeout
            if (this.timeouts.has(key)) {
                clearTimeout(this.timeouts.get(key));
            }

            // Check if we should call immediately (leading edge)
            if (leading && timeSinceLastCall >= delay) {
                this.lastCallTimes.set(key, now);
                return func.apply(this, args);
            }

            // Check maxWait constraint
            if (maxWait && timeSinceLastCall >= maxWait) {
                this.lastCallTimes.set(key, now);
                return func.apply(this, args);
            }

            // Set new timeout
            const timeoutId = setTimeout(() => {
                if (trailing) {
                    this.lastCallTimes.set(key, Date.now());
                    func.apply(this, args);
                }
                this.timeouts.delete(key);
            }, delay);

            this.timeouts.set(key, timeoutId);
        };
    }

    /**
     * Cancel a debounced function
     * @param {string} key - Key of the function to cancel
     */
    cancel(key) {
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
            this.timeouts.delete(key);
        }
    }

    /**
     * Cancel all debounced functions
     */
    cancelAll() {
        this.timeouts.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        this.timeouts.clear();
    }

    /**
     * Check if a function is currently debounced
     * @param {string} key - Key to check
     * @returns {boolean}
     */
    isPending(key) {
        return this.timeouts.has(key);
    }
}

/**
 * Simple debounce function for one-off use
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, delay = 500) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Throttle function to limit function calls
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Throttled function
 */
export function throttle(func, delay = 100) {
    let lastCall = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return func.apply(this, args);
        }
    };
}
