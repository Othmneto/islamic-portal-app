/**
 * Pause Detection utility for smart translation triggers
 * Detects when user stops typing and triggers appropriate actions
 */

export class PauseDetector {
    constructor(options = {}) {
        this.options = {
            pauseThreshold: 2000,        // 2 seconds pause threshold
            minInputLength: 3,           // Minimum input length to trigger
            maxPauseTime: 10000,         // Maximum pause time before timeout
            ...options
        };

        this.lastInputTime = 0;
        this.pauseTimeout = null;
        this.isPaused = false;
        this.listeners = new Map();
    }

    /**
     * Start monitoring input for pause detection
     * @param {string} input - Current input text
     */
    startMonitoring(input) {
        const now = Date.now();
        this.lastInputTime = now;

        // Clear existing timeout
        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
        }

        // Only monitor if input meets minimum length
        if (input.length < this.options.minInputLength) {
            return;
        }

        // Set pause detection timeout
        this.pauseTimeout = setTimeout(() => {
            this.handlePause(input);
        }, this.options.pauseThreshold);

        console.log('⏸️ [PauseDetector] Monitoring input for pause...');
    }

    /**
     * Update input and reset pause detection
     * @param {string} input - Updated input text
     */
    updateInput(input) {
        const now = Date.now();
        this.lastInputTime = now;
        this.isPaused = false;

        // Clear existing timeout
        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
        }

        // Only monitor if input meets minimum length
        if (input.length < this.options.minInputLength) {
            return;
        }

        // Set new pause detection timeout
        this.pauseTimeout = setTimeout(() => {
            this.handlePause(input);
        }, this.options.pauseThreshold);

        console.log('📝 [PauseDetector] Input updated, resetting pause detection');
    }

    /**
     * Handle pause detection
     * @param {string} input - Input text when pause was detected
     */
    handlePause(input) {
        const now = Date.now();
        const timeSinceLastInput = now - this.lastInputTime;

        // Double-check that enough time has passed
        if (timeSinceLastInput >= this.options.pauseThreshold) {
            this.isPaused = true;
            console.log('⏸️ [PauseDetector] Pause detected after', timeSinceLastInput, 'ms');

            // Notify all listeners
            this.notifyListeners('pause', {
                input: input,
                pauseDuration: timeSinceLastInput,
                timestamp: now
            });
        }
    }

    /**
     * Add event listener for pause detection
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    addListener(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    removeListener(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Notify all listeners of an event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('❌ [PauseDetector] Listener error:', error);
                }
            });
        }
    }

    /**
     * Check if currently paused
     * @returns {boolean}
     */
    isCurrentlyPaused() {
        return this.isPaused;
    }

    /**
     * Get time since last input
     * @returns {number} Milliseconds since last input
     */
    getTimeSinceLastInput() {
        return Date.now() - this.lastInputTime;
    }

    /**
     * Stop monitoring and clear timeouts
     */
    stop() {
        if (this.pauseTimeout) {
            clearTimeout(this.pauseTimeout);
            this.pauseTimeout = null;
        }
        this.isPaused = false;
        console.log('🛑 [PauseDetector] Stopped monitoring');
    }

    /**
     * Reset pause detection
     */
    reset() {
        this.stop();
        this.lastInputTime = 0;
        console.log('🔄 [PauseDetector] Reset');
    }
}

/**
 * Simple pause detection for one-off use
 * @param {Function} callback - Function to call on pause
 * @param {number} threshold - Pause threshold in milliseconds
 * @returns {Function} - Function to call with input text
 */
export function createPauseDetector(callback, threshold = 2000) {
    let timeoutId;
    let lastInputTime = 0;

    return function(input) {
        const now = Date.now();
        lastInputTime = now;

        // Clear existing timeout
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // Set new timeout
        timeoutId = setTimeout(() => {
            const timeSinceLastInput = Date.now() - lastInputTime;
            if (timeSinceLastInput >= threshold) {
                callback(input, timeSinceLastInput);
            }
        }, threshold);
    };
}
