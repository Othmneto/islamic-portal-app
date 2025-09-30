/**
 * Voice Input Module
 * Handles speech recognition and voice input functionality
 */

export class VoiceInput {
    constructor(textTranslator) {
        this.textTranslator = textTranslator;
        this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        this.isListening = false;
        this.isPaused = false;
        this.recognition = null;
        this.currentLanguage = 'en-US';
        this.continuousMode = false;
        this.interimResults = true;
        this.maxAlternatives = 3;
        
        // Voice input state
        this.voiceInputHistory = [];
        this.currentTranscript = '';
        this.finalTranscript = '';
        this.interimTranscript = '';
        
        // Audio feedback
        this.audioContext = null;
        this.audioFeedback = true;
        this.visualFeedback = true;
        
        // Language mapping
        this.languageMap = {
            'en': 'en-US',
            'ar': 'ar-SA',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'es': 'es-ES',
            'ur': 'ur-PK',
            'hi': 'hi-IN',
            'ru': 'ru-RU',
            'zh': 'zh-CN',
            'ja': 'ja-JP',
            'tr': 'tr-TR',
            'fa': 'fa-IR',
            'bn': 'bn-BD',
            'id': 'id-ID',
            'ms': 'ms-MY',
            'sw': 'sw-TZ',
            'ha': 'ha-NG',
            'ber': 'ber-DZ'
        };
        
        this.init();
    }

    /**
     * Initialize voice input
     */
    init() {
        console.log('🎤 [VoiceInput] Initializing voice input...');
        
        if (!this.isSupported) {
            console.warn('🎤 [VoiceInput] Speech recognition not supported in this browser');
            this.showUnsupportedMessage();
            return;
        }

        this.setupSpeechRecognition();
        this.setupAudioFeedback();
        this.setupEventListeners();
        
        console.log('🎤 [VoiceInput] Voice input initialized successfully');
    }

    /**
     * Setup speech recognition
     */
    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition settings
        this.recognition.continuous = this.continuousMode;
        this.recognition.interimResults = this.interimResults;
        this.recognition.maxAlternatives = this.maxAlternatives;
        this.recognition.lang = this.currentLanguage;
        
        // Event handlers
        this.recognition.onstart = this.handleStart.bind(this);
        this.recognition.onresult = this.handleResult.bind(this);
        this.recognition.onerror = this.handleError.bind(this);
        this.recognition.onend = this.handleEnd.bind(this);
        this.recognition.onnomatch = this.handleNoMatch.bind(this);
        this.recognition.onsoundstart = this.handleSoundStart.bind(this);
        this.recognition.onsoundend = this.handleSoundEnd.bind(this);
        this.recognition.onspeechstart = this.handleSpeechStart.bind(this);
        this.recognition.onspeechend = this.handleSpeechEnd.bind(this);
        this.recognition.onaudiostart = this.handleAudioStart.bind(this);
        this.recognition.onaudioend = this.handleAudioEnd.bind(this);
    }

    /**
     * Setup audio feedback
     */
    setupAudioFeedback() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('🎤 [VoiceInput] Audio context not supported:', error);
            this.audioFeedback = false;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for language changes
        if (this.textTranslator.elements.sourceLanguage) {
            this.textTranslator.elements.sourceLanguage.addEventListener('change', (e) => {
                this.updateLanguage(e.target.value);
            });
        }
    }

    /**
     * Start voice input
     */
    async startListening(options = {}) {
        console.log('🎤 [VoiceInput] Starting voice input...');
        
        if (!this.isSupported) {
            this.showUnsupportedMessage();
            return false;
        }

        if (this.isListening) {
            console.log('🎤 [VoiceInput] Already listening');
            return true;
        }

        try {
            // Request microphone permission
            await this.requestMicrophonePermission();
            
            // Update language if provided
            if (options.language) {
                this.updateLanguage(options.language);
            }
            
            // Clear previous results
            this.clearTranscripts();
            
            // Start recognition
            this.recognition.start();
            this.isListening = true;
            this.isPaused = false;
            
            // Show visual feedback
            this.showListeningIndicator();
            
            // Play start sound
            this.playStartSound();
            
            console.log('🎤 [VoiceInput] Voice input started');
            return true;
            
        } catch (error) {
            console.error('🎤 [VoiceInput] Failed to start voice input:', error);
            this.handleError({ error: 'start_failed', message: error.message });
            return false;
        }
    }

    /**
     * Stop voice input
     */
    stopListening() {
        console.log('🎤 [VoiceInput] Stopping voice input...');
        
        if (!this.isListening) {
            return;
        }

        this.recognition.stop();
        this.isListening = false;
        this.isPaused = false;
        
        // Hide visual feedback
        this.hideListeningIndicator();
        
        // Play stop sound
        this.playStopSound();
        
        console.log('🎤 [VoiceInput] Voice input stopped');
    }

    /**
     * Pause voice input
     */
    pauseListening() {
        if (!this.isListening || this.isPaused) {
            return;
        }

        console.log('🎤 [VoiceInput] Pausing voice input...');
        this.isPaused = true;
        this.showPausedIndicator();
        this.playPauseSound();
    }

    /**
     * Resume voice input
     */
    resumeListening() {
        if (!this.isListening || !this.isPaused) {
            return;
        }

        console.log('🎤 [VoiceInput] Resuming voice input...');
        this.isPaused = false;
        this.hidePausedIndicator();
        this.playResumeSound();
    }

    /**
     * Toggle voice input
     */
    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    /**
     * Update language
     */
    updateLanguage(languageCode) {
        const speechLang = this.languageMap[languageCode] || languageCode;
        
        if (this.recognition && speechLang !== this.currentLanguage) {
            console.log('🎤 [VoiceInput] Updating language to:', speechLang);
            this.currentLanguage = speechLang;
            this.recognition.lang = speechLang;
        }
    }

    /**
     * Request microphone permission
     */
    async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Stop the stream immediately as we only needed permission
            stream.getTracks().forEach(track => track.stop());
            console.log('🎤 [VoiceInput] Microphone permission granted');
            return true;
        } catch (error) {
            console.error('🎤 [VoiceInput] Microphone permission denied:', error);
            this.showPermissionDeniedMessage();
            throw error;
        }
    }

    /**
     * Clear transcripts
     */
    clearTranscripts() {
        this.currentTranscript = '';
        this.finalTranscript = '';
        this.interimTranscript = '';
    }

    /**
     * Handle recognition start
     */
    handleStart() {
        console.log('🎤 [VoiceInput] Recognition started');
        this.isListening = true;
        this.isPaused = false;
        this.showListeningIndicator();
        this.triggerEvent('voiceStart');
    }

    /**
     * Handle recognition result
     */
    handleResult(event) {
        console.log('🎤 [VoiceInput] Recognition result received');
        
        let interimTranscript = '';
        let finalTranscript = '';
        
        // Process results
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            
            if (result.isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Update transcripts
        this.interimTranscript = interimTranscript;
        this.finalTranscript += finalTranscript;
        this.currentTranscript = this.finalTranscript + this.interimTranscript;
        
        // Update UI
        this.updateTranscriptDisplay();
        
        // Handle final results
        if (finalTranscript) {
            this.handleFinalTranscript(finalTranscript);
        }
        
        // Trigger events
        this.triggerEvent('voiceResult', {
            interim: interimTranscript,
            final: finalTranscript,
            complete: this.currentTranscript
        });
    }

    /**
     * Handle final transcript
     */
    handleFinalTranscript(transcript) {
        console.log('🎤 [VoiceInput] Final transcript:', transcript);
        
        // Add to history
        this.voiceInputHistory.push({
            transcript,
            timestamp: new Date(),
            language: this.currentLanguage
        });
        
        // Trigger event for main translator to handle
        this.triggerEvent('voiceFinal', { transcript });
    }

    /**
     * Handle recognition error
     */
    handleError(event) {
        console.error('🎤 [VoiceInput] Recognition error:', event.error);
        
        this.isListening = false;
        this.isPaused = false;
        this.hideListeningIndicator();
        
        let errorMessage = 'Voice input error occurred';
        
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'No speech detected. Please try again.';
                break;
            case 'audio-capture':
                errorMessage = 'Microphone not found. Please check your microphone.';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone permission denied. Please allow microphone access.';
                break;
            case 'network':
                errorMessage = 'Network error. Please check your connection.';
                break;
            case 'aborted':
                errorMessage = 'Voice input was aborted.';
                break;
            case 'start_failed':
                errorMessage = 'Failed to start voice input.';
                break;
        }
        
        this.showErrorMessage(errorMessage);
        this.triggerEvent('voiceError', { error: event.error, message: errorMessage });
    }

    /**
     * Handle recognition end
     */
    handleEnd() {
        console.log('🎤 [VoiceInput] Recognition ended');
        
        this.isListening = false;
        this.isPaused = false;
        this.hideListeningIndicator();
        
        // Auto-restart if in continuous mode
        if (this.continuousMode && !this.isPaused) {
            setTimeout(() => {
                if (!this.isListening) {
                    this.startListening();
                }
            }, 100);
        }
        
        this.triggerEvent('voiceEnd');
    }

    /**
     * Handle no match
     */
    handleNoMatch() {
        console.log('🎤 [VoiceInput] No speech match found');
        this.showNoMatchMessage();
        this.triggerEvent('voiceNoMatch');
    }

    /**
     * Handle sound start
     */
    handleSoundStart() {
        console.log('🎤 [VoiceInput] Sound detected');
        this.showSoundDetectedIndicator();
        this.triggerEvent('voiceSoundStart');
    }

    /**
     * Handle sound end
     */
    handleSoundEnd() {
        console.log('🎤 [VoiceInput] Sound ended');
        this.hideSoundDetectedIndicator();
        this.triggerEvent('voiceSoundEnd');
    }

    /**
     * Handle speech start
     */
    handleSpeechStart() {
        console.log('🎤 [VoiceInput] Speech detected');
        this.showSpeechDetectedIndicator();
        this.triggerEvent('voiceSpeechStart');
    }

    /**
     * Handle speech end
     */
    handleSpeechEnd() {
        console.log('🎤 [VoiceInput] Speech ended');
        this.hideSpeechDetectedIndicator();
        this.triggerEvent('voiceSpeechEnd');
    }

    /**
     * Handle audio start
     */
    handleAudioStart() {
        console.log('🎤 [VoiceInput] Audio processing started');
        this.triggerEvent('voiceAudioStart');
    }

    /**
     * Handle audio end
     */
    handleAudioEnd() {
        console.log('🎤 [VoiceInput] Audio processing ended');
        this.triggerEvent('voiceAudioEnd');
    }

    /**
     * Update transcript display
     */
    updateTranscriptDisplay() {
        const display = document.getElementById('voice-transcript-display');
        if (display) {
            display.textContent = this.currentTranscript;
            display.className = this.interimTranscript ? 'interim' : 'final';
        }
    }

    /**
     * Show listening indicator
     */
    showListeningIndicator() {
        const indicator = document.getElementById('voice-listening-indicator');
        if (indicator) {
            indicator.classList.add('active');
            indicator.textContent = 'Listening...';
        }
    }

    /**
     * Hide listening indicator
     */
    hideListeningIndicator() {
        const indicator = document.getElementById('voice-listening-indicator');
        if (indicator) {
            indicator.classList.remove('active');
            indicator.textContent = 'Voice Input';
        }
    }

    /**
     * Show paused indicator
     */
    showPausedIndicator() {
        const indicator = document.getElementById('voice-listening-indicator');
        if (indicator) {
            indicator.textContent = 'Paused';
            indicator.classList.add('paused');
        }
    }

    /**
     * Hide paused indicator
     */
    hidePausedIndicator() {
        const indicator = document.getElementById('voice-listening-indicator');
        if (indicator) {
            indicator.classList.remove('paused');
        }
    }

    /**
     * Show sound detected indicator
     */
    showSoundDetectedIndicator() {
        const indicator = document.getElementById('voice-sound-indicator');
        if (indicator) {
            indicator.classList.add('active');
        }
    }

    /**
     * Hide sound detected indicator
     */
    hideSoundDetectedIndicator() {
        const indicator = document.getElementById('voice-sound-indicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
    }

    /**
     * Show speech detected indicator
     */
    showSpeechDetectedIndicator() {
        const indicator = document.getElementById('voice-speech-indicator');
        if (indicator) {
            indicator.classList.add('active');
        }
    }

    /**
     * Hide speech detected indicator
     */
    hideSpeechDetectedIndicator() {
        const indicator = document.getElementById('voice-speech-indicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
    }

    /**
     * Show error message
     */
    showErrorMessage(message) {
        if (this.textTranslator.toast) {
            this.textTranslator.toast.error(message);
        } else {
            alert(message);
        }
    }

    /**
     * Show unsupported message
     */
    showUnsupportedMessage() {
        this.showErrorMessage('Voice input is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.');
    }

    /**
     * Show permission denied message
     */
    showPermissionDeniedMessage() {
        this.showErrorMessage('Microphone permission is required for voice input. Please allow microphone access and try again.');
    }

    /**
     * Show no match message
     */
    showNoMatchMessage() {
        if (this.textTranslator.toast) {
            this.textTranslator.toast.warning('No speech detected. Please speak clearly and try again.');
        }
    }

    /**
     * Play start sound
     */
    playStartSound() {
        if (!this.audioFeedback || !this.audioContext) return;
        
        this.playTone(800, 0.1, 'sine');
    }

    /**
     * Play stop sound
     */
    playStopSound() {
        if (!this.audioFeedback || !this.audioContext) return;
        
        this.playTone(400, 0.1, 'sine');
    }

    /**
     * Play pause sound
     */
    playPauseSound() {
        if (!this.audioFeedback || !this.audioContext) return;
        
        this.playTone(600, 0.05, 'sine');
    }

    /**
     * Play resume sound
     */
    playResumeSound() {
        if (!this.audioFeedback || !this.audioContext) return;
        
        this.playTone(700, 0.05, 'sine');
    }

    /**
     * Play tone
     */
    playTone(frequency, duration, type = 'sine') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    /**
     * Trigger custom event
     */
    triggerEvent(eventName, data = {}) {
        const event = new CustomEvent(`voiceInput:${eventName}`, {
            detail: { voiceInput: this, ...data }
        });
        document.dispatchEvent(event);
    }

    /**
     * Get voice input status
     */
    getStatus() {
        return {
            isSupported: this.isSupported,
            isListening: this.isListening,
            isPaused: this.isPaused,
            currentLanguage: this.currentLanguage,
            continuousMode: this.continuousMode,
            history: this.voiceInputHistory
        };
    }

    /**
     * Clear voice input history
     */
    clearHistory() {
        this.voiceInputHistory = [];
        console.log('🎤 [VoiceInput] History cleared');
    }

    /**
     * Set continuous mode
     */
    setContinuousMode(enabled) {
        this.continuousMode = enabled;
        if (this.recognition) {
            this.recognition.continuous = enabled;
        }
        console.log('🎤 [VoiceInput] Continuous mode:', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Set interim results
     */
    setInterimResults(enabled) {
        this.interimResults = enabled;
        if (this.recognition) {
            this.recognition.interimResults = enabled;
        }
        console.log('🎤 [VoiceInput] Interim results:', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Enable/disable audio feedback
     */
    setAudioFeedback(enabled) {
        this.audioFeedback = enabled;
        console.log('🎤 [VoiceInput] Audio feedback:', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Enable/disable visual feedback
     */
    setVisualFeedback(enabled) {
        this.visualFeedback = enabled;
        console.log('🎤 [VoiceInput] Visual feedback:', enabled ? 'enabled' : 'disabled');
    }
}

// Export for use in other modules
export default VoiceInput;
