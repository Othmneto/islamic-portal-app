/**
 * Real-Time Translation Module
 * Handles live translation with debouncing and partial results
 */

import { DebounceManager } from '../utils/debounce.js';
import { PauseDetector } from '../utils/pauseDetection.js';

export class RealTimeTranslation {
    constructor(textTranslator) {
        this.textTranslator = textTranslator;
        this.isEnabled = false;
        this.isTranslating = false;
        this.currentRequest = null;
        this.partialResults = new Map();

        // Performance optimization - request deduplication
        this.pendingRequests = new Map();
        this.requestCache = new Map();
        this.cacheTimeout = 30000; // 30 seconds cache

        // Initialize utilities with optimized values for accuracy & performance
        this.debounceManager = new DebounceManager();
        this.pauseDetector = new PauseDetector({
            pauseThreshold: 1500,  // 1.5 seconds - optimal for accuracy
            minInputLength: 2,     // Minimum 2 characters - better responsiveness
            maxPauseTime: 8000    // 8 seconds max - prevents excessive waiting
        });

        // Bind methods
        this.handleInput = this.handleInput.bind(this);
        this.handlePause = this.handlePause.bind(this);
        this.translatePartial = this.translatePartial.bind(this);
        this.translateFinal = this.translateFinal.bind(this);

        this.setupEventListeners();
    }

    /**
     * Enable real-time translation
     */
    enable() {
        if (this.isEnabled) return;

        console.log('🚀 [RealTimeTranslation] Enabling real-time translation...');
        this.isEnabled = true;

        // Add pause detection listener
        this.pauseDetector.addListener('pause', this.handlePause);

        // Show real-time status
        this.updateStatus('Real-time translation enabled', 'info');
        this.updateStatusDisplay('Active');
        console.log('✅ [RealTimeTranslation] Real-time translation enabled');
    }

    /**
     * Disable real-time translation
     */
    disable() {
        if (!this.isEnabled) return;

        console.log('🛑 [RealTimeTranslation] Disabling real-time translation...');
        this.isEnabled = false;

        // Cancel any pending translations
        this.cancelCurrentTranslation();

        // Clear partial results
        this.partialResults.clear();

        // Stop pause detection
        this.pauseDetector.stop();

        this.updateStatus('Real-time translation disabled', 'info');
        this.updateStatusDisplay('Ready');
        console.log('✅ [RealTimeTranslation] Real-time translation disabled');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for input changes
        if (this.textTranslator.elements.sourceText) {
            this.textTranslator.elements.sourceText.addEventListener('input', this.handleInput);
        }
    }

    /**
     * Handle input changes
     * @param {Event} event - Input event
     */
    handleInput(event) {
        if (!this.isEnabled) return;

        const text = event.target.value; // Don't trim - preserve spaces
        console.log('📝 [RealTimeTranslation] Input changed:', text);

        // Re-enable pause detection with space input fix
        this.pauseDetector.updateInput(text);

        // Cancel previous translation if still running
        this.cancelCurrentTranslation();

        // Only translate if text meets minimum requirements
        if (text.length < 3) {
            this.clearPartialResults();
            return;
        }

        // Check if content is Islamic before processing
        if (this.textTranslator.languageDetection) {
            const validation = this.textTranslator.languageDetection.validateContent(text);
            if (!validation.valid) {
                this.updateStatusDisplay('Non-Islamic content rejected', 'error');
                this.updateStatus('Content must be Islamic-related', 'error');
                console.log('❌ [RealTimeTranslation] Non-Islamic content rejected:', validation.reason);
                return;
            }
        }

        // Re-enable real-time translation with space input fix
        this.startDebouncedTranslation(text);
        console.log('📝 [RealTimeTranslation] Real-time translation enabled with space input fix');
    }

    /**
     * Start debounced translation
     * @param {string} text - Text to translate
     */
    startDebouncedTranslation(text) {
        console.log('⏱️ [RealTimeTranslation] Starting debounced translation...');

        // Create debounced translation function with optimized timing
        const debouncedTranslate = this.debounceManager.debounce(
            'realtime-translation',
            () => this.translatePartial(text),
            300, // 300ms debounce - optimal for responsiveness
            { leading: false, trailing: true }
        );

        // Execute debounced translation
        debouncedTranslate();
    }

    /**
     * Handle pause detection
     * @param {Object} data - Pause data
     */
    handlePause(data) {
        if (!this.isEnabled) return;

        console.log('⏸️ [RealTimeTranslation] Pause detected, triggering final translation...');

        // Check if content is Islamic before processing
        if (this.textTranslator.languageDetection) {
            const validation = this.textTranslator.languageDetection.validateContent(data.input);
            if (!validation.valid) {
                this.updateStatusDisplay('Non-Islamic content rejected', 'error');
                this.updateStatus('Content must be Islamic-related', 'error');
                console.log('❌ [RealTimeTranslation] Non-Islamic content rejected on pause:', validation.reason);
                return;
            }
        }

        this.translateFinal(data.input);
    }

    /**
     * Translate partial text (intermediate result)
     * @param {string} text - Text to translate
     */
    async translatePartial(text) {
        if (!this.isEnabled || this.isTranslating) return;

        console.log('🔄 [RealTimeTranslation] Translating partial text...');

        try {
            this.isTranslating = true;
            this.updateStatus('Translating...', 'info');
            this.updateStatusDisplay('Translating...', 'translating');

            // Show partial translation indicator
            this.showPartialIndicator();

            // Make translation request
            const result = await this.makeTranslationRequest(text, true);

            if (result && result.success) {
                this.displayPartialResult(result);
                console.log('✅ [RealTimeTranslation] Partial translation completed');
            }

        } catch (error) {
            console.error('❌ [RealTimeTranslation] Partial translation failed:', error);
            this.updateStatus('Translation failed', 'error');
        } finally {
            this.isTranslating = false;
        }
    }

    /**
     * Translate final text (complete result)
     * @param {string} text - Text to translate
     */
    async translateFinal(text) {
        if (!this.isEnabled) return;

        console.log('🎯 [RealTimeTranslation] Translating final text...');

        try {
            this.isTranslating = true;
            this.updateStatus('Finalizing translation...', 'info');
            this.updateStatusDisplay('Finalizing...', 'translating');

            // Make final translation request
            const result = await this.makeTranslationRequest(text, false);

            if (result && result.success) {
                this.displayFinalResult(result);
                console.log('✅ [RealTimeTranslation] Final translation completed');
            }

        } catch (error) {
            console.error('❌ [RealTimeTranslation] Final translation failed:', error);
            this.updateStatus('Translation failed', 'error');

            // Handle the error gracefully without throwing
            try {
                // Try to display a fallback result
                const fallbackResult = {
                    success: false,
                    error: 'Translation service temporarily unavailable',
                    fallback: true,
                    originalText: text,
                    message: 'Translation service is temporarily unavailable. Please try again later.'
                };
                this.displayFinalResult(fallbackResult);
            } catch (displayError) {
                console.error('❌ [RealTimeTranslation] Failed to display fallback result:', displayError);
            }
        } finally {
            this.isTranslating = false;
            this.hidePartialIndicator();
        }
    }

    /**
     * Make translation request
     * @param {string} text - Text to translate
     * @param {boolean} isPartial - Whether this is a partial translation
     * @returns {Object} Translation result
     */
    async makeTranslationRequest(text, isPartial = false) {
        const sourceLang = this.textTranslator.elements.sourceLanguage?.value || 'auto';
        const targetLang = this.textTranslator.elements.targetLanguage?.value || 'en';
        const requestKey = `${text}-${sourceLang}-${targetLang}-${isPartial}`;

        // Check cache first
        if (this.requestCache.has(requestKey)) {
            const cached = this.requestCache.get(requestKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log('📦 [RealTimeTranslation] Using cached result');
                return cached.data;
            }
            this.requestCache.delete(requestKey);
        }

        // Check if request is already pending
        if (this.pendingRequests.has(requestKey)) {
            console.log('📦 [RealTimeTranslation] Request already pending, waiting...');
            return this.pendingRequests.get(requestKey);
        }

        console.log('📡 [RealTimeTranslation] Making translation request:', {
            text: text.substring(0, 50) + '...',
            sourceLang,
            targetLang,
            isPartial
        });

        // Create new request
        const requestPromise = this.executeTranslationRequest(text, sourceLang, targetLang, isPartial);
        this.pendingRequests.set(requestKey, requestPromise);

        try {
            const result = await requestPromise;

            // Cache successful results
            if (result.success) {
                this.requestCache.set(requestKey, {
                    data: result,
                    timestamp: Date.now()
                });
            }

            return result;
        } finally {
            // Clean up pending request
            this.pendingRequests.delete(requestKey);
        }
    }

    /**
     * Execute the actual translation request
     * @param {string} text - Text to translate
     * @param {string} sourceLang - Source language
     * @param {string} targetLang - Target language
     * @param {boolean} isPartial - Whether this is a partial translation
     * @returns {Promise<Object>} Translation result
     */
    async executeTranslationRequest(text, sourceLang, targetLang, isPartial) {
        try {
            const response = await fetch('/api/text-translation/translate', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sourceText: text,
                    sourceLanguage: sourceLang,
                    targetLanguage: Array.isArray(targetLang) ? targetLang[0] : targetLang,
                    sessionId: this.textTranslator.sessionId,
                    isPartial: isPartial
                })
            });

            const data = await response.json();
            console.log('📦 [RealTimeTranslation] Translation response:', data);

            return data;

        } catch (error) {
            console.error('❌ [RealTimeTranslation] Translation request failed:', error);

            // Return a fallback response instead of throwing
            return {
                success: false,
                error: 'Translation service unavailable',
                fallback: true,
                originalText: text,
                message: 'Translation service is temporarily unavailable. Please try again later.'
            };
        }
    }

    /**
     * Display partial translation result
     * @param {Object} result - Translation result
     */
    displayPartialResult(result) {
        if (result.fallback) {
            // Show fallback message
            const fallbackData = {
                original: this.currentText,
                translated: result.message || 'Translation service unavailable',
                fromLang: 'auto',
                toLang: this.textTranslator.elements.targetLanguage.value,
                confidence: 0,
                isPartial: true,
                isError: true,
                timestamp: new Date()
            };

            this.showPartialTranslation(fallbackData);
            return;
        }

        if (!result.success || !result.translatedText) return;

        const partialData = {
            original: result.original,
            translated: result.translatedText,
            fromLang: result.from,
            toLang: result.to,
            confidence: result.confidence || 0.8,
            isPartial: true,
            timestamp: new Date()
        };

        // Store partial result
        this.partialResults.set('current', partialData);

        // Display in UI
        this.showPartialTranslation(partialData);

        console.log('📝 [RealTimeTranslation] Partial result displayed:', partialData);
    }

    /**
     * Display final translation result
     * @param {Object} result - Translation result
     */
    displayFinalResult(result) {
        console.log('🎯 [RealTimeTranslation] displayFinalResult called with:', result);

        if (result.fallback) {
            // Show fallback message
            const fallbackData = {
                original: this.currentText,
                translated: result.message || 'Translation service unavailable',
                fromLang: 'auto',
                toLang: this.textTranslator.elements.targetLanguage.value,
                confidence: 0,
                isPartial: false,
                isError: true,
                timestamp: new Date()
            };

            this.showFinalTranslation(fallbackData);
            return;
        }

        if (!result.success || !result.translatedText) {
            console.log('❌ [RealTimeTranslation] Invalid result data, returning early');
            return;
        }

        const finalData = {
            original: result.original,
            translated: result.translatedText,
            fromLang: result.from,
            toLang: result.to,
            confidence: result.confidence || 0.8,
            isPartial: false,
            timestamp: new Date()
        };

        // Clear partial results
        this.partialResults.clear();

        // Display final translation
        this.showFinalTranslation(finalData);

        console.log('🎯 [RealTimeTranslation] Final result displayed:', finalData);
    }

    /**
     * Show partial translation in UI
     * @param {Object} data - Translation data
     */
    showPartialTranslation(data) {
        // Create or update partial translation element
        let partialElement = document.getElementById('partial-translation');

        if (!partialElement) {
            partialElement = document.createElement('div');
            partialElement.id = 'partial-translation';
            partialElement.className = 'partial-translation';
            partialElement.innerHTML = `
                <div class="partial-header">
                    <span class="partial-label">Live Translation</span>
                    <span class="partial-status">Translating...</span>
                </div>
                <div class="partial-content">
                    <div class="partial-original">${data.original}</div>
                    <div class="partial-translated">${data.translated}</div>
                </div>
            `;

            // Insert before results container
            const resultsContainer = this.textTranslator.elements.resultsContainer;
            if (resultsContainer) {
                resultsContainer.insertBefore(partialElement, resultsContainer.firstChild);
            }
        } else {
            // Update existing partial translation
            partialElement.querySelector('.partial-original').textContent = data.original;
            partialElement.querySelector('.partial-translated').textContent = data.translated;
        }
    }

    /**
     * Show final translation in UI
     * @param {Object} data - Translation data
     */
    showFinalTranslation(data) {
        // Remove partial translation element
        const partialElement = document.getElementById('partial-translation');
        if (partialElement) {
            partialElement.remove();
        }

        // Create final translation item
        const translationData = {
            id: Date.now(),
            from: data.fromLang,
            to: data.toLang,
            original: data.original,
            translated: data.translated,
            confidence: data.confidence,
            timestamp: data.timestamp,
            favorite: false
        };

        // Use existing translation item creation
        if (this.textTranslator.handleTranslationResult) {
            this.textTranslator.handleTranslationResult(translationData);
        }
    }

    /**
     * Show partial translation indicator
     */
    showPartialIndicator() {
        const statusElement = this.textTranslator.elements.statusText;
        if (statusElement) {
            statusElement.textContent = 'Translating...';
            statusElement.className = 'status-translating';
        }
    }

    /**
     * Hide partial translation indicator
     */
    hidePartialIndicator() {
        const statusElement = this.textTranslator.elements.statusText;
        if (statusElement) {
            statusElement.textContent = 'Ready';
            statusElement.className = 'status-ready';
        }
    }

    /**
     * Clear partial results
     */
    clearPartialResults() {
        const partialElement = document.getElementById('partial-translation');
        if (partialElement) {
            partialElement.remove();
        }
        this.partialResults.clear();
    }

    /**
     * Cancel current translation
     */
    cancelCurrentTranslation() {
        if (this.currentRequest) {
            // Cancel the request if possible
            this.currentRequest.abort();
            this.currentRequest = null;
        }

        // Cancel debounced translation
        this.debounceManager.cancel('realtime-translation');

        this.isTranslating = false;
    }

    /**
     * Update status message
     * @param {string} message - Status message
     * @param {string} type - Status type
     */
    updateStatus(message, type = 'info') {
        console.log(`📊 [RealTimeTranslation] Status: ${message}`);

        // Update status in UI if available
        if (this.textTranslator.updateConnectionStatus) {
            this.textTranslator.updateConnectionStatus(message, type);
        }
    }

    /**
     * Update status display in real-time controls
     * @param {string} status - Status text
     * @param {string} className - CSS class name
     */
    updateStatusDisplay(status, className = '') {
        const statusElement = document.getElementById('realtime-status');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = `realtime-status ${className}`;
        }
    }

    /**
     * Get current partial results
     * @returns {Object} Current partial results
     */
    getPartialResults() {
        return this.partialResults.get('current');
    }

    /**
     * Check if currently translating
     * @returns {boolean}
     */
    isCurrentlyTranslating() {
        return this.isTranslating;
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        this.disable();
        this.debounceManager.cancelAll();
        this.pauseDetector.reset();

        // Remove event listeners
        if (this.textTranslator.elements.sourceText) {
            this.textTranslator.elements.sourceText.removeEventListener('input', this.handleInput);
        }

        console.log('🧹 [RealTimeTranslation] Destroyed');
    }
}
