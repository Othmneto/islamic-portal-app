// Real-Time Translation Frontend Implementation
class RealTimeTranslation {
    constructor() {
        this.socket = null;
        this.conversationId = null;
        this.sessionId = null;
        this.isConnected = false;
        this.typingTimeout = null;
        this.isTyping = false;
        this.isListening = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.mediaStream = null;
        this.recognition = null;
        this.listeningStartTime = null;
        this.listeningInterval = null;
        this.setupEventListeners();
        this.initializeSocket();
        this.initializeSpeechRecognition();
    }

    initializeSocket() {
        // Initialize Socket.IO connection
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            this.updateConnectionStatus(false);
        });

        this.socket.on('translationResult', (data) => {
            this.displayTranslationResult(data);
        });

        this.socket.on('partialTranslation', (data) => {
            this.displayPartialTranslation(data);
        });

        this.socket.on('translationError', (data) => {
            this.displayTranslationError(data);
        });

        this.socket.on('userTyping', (data) => {
            this.showTypingIndicator(data);
        });

        this.socket.on('translationComplete', (data) => {
            this.handleTranslationComplete(data);
        });
    }

    setupEventListeners() {
        // Text input real-time translation
        const textInput = document.getElementById('text-input');
        if (textInput) {
            textInput.addEventListener('input', (e) => {
                this.handleTextInput(e.target.value);
            });

            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleTextSubmit();
                }
            });
        }

        // Voice input real-time translation
        const micButton = document.getElementById('mic-button');
        if (micButton) {
            micButton.addEventListener('click', () => {
                this.toggleVoiceInput();
            });
        }

        // Translation mode toggle
        const realtimeToggle = document.getElementById('realtime-toggle');
        if (realtimeToggle) {
            realtimeToggle.addEventListener('change', (e) => {
                this.toggleRealtimeMode(e.target.checked);
            });
        }

    }

    startConversation(sessionId) {
        this.sessionId = sessionId || this.getOrCreateSessionId();
        this.conversationId = this.generateConversationId();

        if (this.socket && this.isConnected) {
            this.socket.emit('joinConversation', {
                conversationId: this.conversationId,
                sessionId: this.sessionId
            });

            console.log('Started conversation:', this.conversationId);
            this.updateConversationStatus(true);
        }
    }

    handleTextInput(text) {
        if (!this.isConnected || !this.conversationId) return;

        if (text.length < 2) {
            this.clearPartialTranslation();
            return;
        }

        // Show typing indicator
        this.showTypingIndicator({ isTyping: true, text });

        // Clear previous timeout
        clearTimeout(this.typingTimeout);

        // Debounce translation requests
        this.typingTimeout = setTimeout(() => {
            this.requestTranslation(text, false); // false = partial translation
            // Also trigger auto-translation
            this.autoTranslateText(text);
        }, 300); // 300ms delay for partial translations
    }

    // Auto-translate text immediately
    autoTranslateText(text) {
        if (!text || text.trim().length < 2) return;

        console.log('Auto-translating text:', text);

        // Clear previous translation timeout
        clearTimeout(this.translationTimeout);

        // Debounce translation calls to avoid duplicates
        this.translationTimeout = setTimeout(() => {
            // Get target languages
            const targetLanguages = window.selectedTargetLanguages || ['English', 'Arabic'];

            // Trigger translation for each target language
            targetLanguages.forEach(targetLang => {
                this.translateToLanguage(text, targetLang);
            });
        }, 500); // 500ms delay to avoid rapid-fire translations
    }

    // Test translation function
    async testTranslation() {
        const testText = "السلام عليكم";
        console.log('Testing translation with:', testText);

        try {
            // Use a valid voice ID - let's try a common one
            const response = await fetch('/api/translation/speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: testText,
                    from: 'ar',
                    to: ['en'],
                    voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice ID
                    sessionId: 'test-session'
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Translation test successful:', data);
                return data[0]; // Return first result
            } else {
                const errorText = await response.text();
                console.error('Translation test failed:', response.status, response.statusText, errorText);
                return null;
            }
        } catch (error) {
            console.error('Translation test error:', error);
            return null;
        }
    }

    // Translate text to specific language
    async translateToLanguage(text, targetLanguage) {
        try {
            // Convert language names to codes
            const languageMap = {
                'English': 'en',
                'Arabic': 'ar',
                'French': 'fr',
                'German': 'de',
                'Spanish': 'es',
                'Urdu': 'ur',
                'Hindi': 'hi',
                'Russian': 'ru',
                'Chinese': 'zh',
                'Japanese': 'ja'
            };

            const fromLang = this.detectLanguage(text) === 'ar-SA' ? 'ar' : 'auto';
            const toCode = languageMap[targetLanguage] || 'en';

            console.log(`Translating "${text}" from ${fromLang} to ${targetLanguage} (${toCode})`);

            // Use the existing /speak endpoint
            const response = await fetch('/api/translation/speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    from: fromLang,
                    to: [toCode],
                    voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice ID
                    sessionId: this.sessionId || 'auto-session'
                })
            });

            if (response.ok) {
                try {
                    const data = await response.json();
                    console.log(`Raw response data for ${targetLanguage}:`, data);

                    if (data && data.length > 0) {
                        const result = data[0];
                        console.log(`Translation successful for ${targetLanguage}:`, result);

                        // Only display if translation is not empty
                        if (result.translated && result.translated.trim() !== '') {
                            this.displayTranslationResult({
                                original: text,
                                translated: result.translated,
                                toLanguage: targetLanguage,
                                confidence: result.confidence || 0.9,
                                timestamp: result.timestamp || new Date().toISOString(),
                                from: result.from || 'ar',
                                to: result.to || 'en'
                            });
                        } else {
                            console.log(`Skipping empty translation for ${targetLanguage}`);
                        }
                    } else {
                        console.log(`No translation data received for ${targetLanguage}`);
                    }
                } catch (jsonError) {
                    console.error(`JSON parsing error for ${targetLanguage}:`, jsonError);
                    const responseText = await response.text();
                    console.error('Response text:', responseText.substring(0, 500));

                    // Check if response is HTML (error page)
                    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
                        console.error('Received HTML instead of JSON - server error');
                        this.displayTranslationResult({
                            original: text,
                            translated: `[Server Error: ${response.status}]`,
                            toLanguage: targetLanguage,
                            confidence: 0.1,
                            timestamp: new Date().toISOString(),
                            from: 'ar',
                            to: 'en'
                        });
                    } else {
                        // Try to display a fallback message
                        this.displayTranslationResult({
                            original: text,
                            translated: `[Translation Error: ${response.status}]`,
                            toLanguage: targetLanguage,
                            confidence: 0.1,
                            timestamp: new Date().toISOString(),
                            from: 'ar',
                            to: 'en'
                        });
                    }
                }
            } else {
                const errorText = await response.text();
                console.error(`Translation failed for ${targetLanguage}:`, response.status, response.statusText, errorText);

                // Display error message
                this.displayTranslationResult({
                    original: text,
                    translated: `[Error: ${response.status} - ${response.statusText}]`,
                    toLanguage: targetLanguage,
                    confidence: 0.1,
                    timestamp: new Date().toISOString(),
                    from: 'ar',
                    to: 'en'
                });
            }
        } catch (error) {
            console.error('Translation error for', targetLanguage, ':', error);
        }
    }

    // Display translation result
    displayTranslationResult(data) {
        console.log(`Displaying translation result:`, data);

        // Validate data structure
        if (!data || typeof data !== 'object') {
            console.error('Invalid data structure:', data);
            return;
        }

        console.log(`Translation to ${data.toLanguage}:`, data.translated);

        // Debug logging
        if (data.translated && data.translated.trim() !== '') {
            console.log('✅ Translation will be displayed:', data.translated);
        } else {
            console.log('❌ Translation is empty or invalid:', data);
        }

        // Don't display empty translations
        if (!data.translated || data.translated.trim() === '') {
            console.log('Skipping empty translation');
            return;
        }

        // Get or create results container
        let resultsContainer = document.getElementById('latest-translation-container');
        console.log('Results container found:', !!resultsContainer);

        if (!resultsContainer) {
            console.log('Creating new results container');
            resultsContainer = this.createResultsContainer();
            document.querySelector('.container').appendChild(resultsContainer);
        }

        // Add header if this is the first translation
        if (resultsContainer.children.length === 0) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'translation-results-header';
            headerDiv.innerHTML = '<h3>🔄 Real-Time Translation Results</h3>';
            resultsContainer.appendChild(headerDiv);
        }

        // Create translation result element
        const resultDiv = document.createElement('div');
        resultDiv.className = 'translation-result';
        resultDiv.innerHTML = `
            <div class="translation-item">
                <div class="translation-header">
                    <div class="language-label">${data.toLanguage}</div>
                    <div class="timestamp">${data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}</div>
                </div>
                <div class="translated-text">${data.translated}</div>
                <div class="translation-footer">
                    <div class="confidence-score">Confidence: ${Math.round((data.confidence || 0.9) * 100)}%</div>
                    <div class="original-text">Original: ${data.original.substring(0, 50)}${data.original.length > 50 ? '...' : ''}</div>
                </div>
            </div>
        `;

        // Add to results container
        console.log('Appending translation result to container');
        resultsContainer.appendChild(resultDiv);

        // Make sure container is visible
        resultsContainer.style.display = 'block';
        console.log('Container display set to:', resultsContainer.style.display);
        console.log('Container children count:', resultsContainer.children.length);

        // Scroll to bottom
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
    }

    // Create results container if it doesn't exist
    createResultsContainer() {
        const container = document.createElement('div');
        container.id = 'latest-translation-container';
        container.className = 'translation-results-container';
        container.style.cssText = `
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            background: #f9fafb;
        `;

        // Insert after the language selection area
        const languageArea = document.querySelector('.language-input-area');
        if (languageArea) {
            languageArea.insertAdjacentElement('afterend', container);
        }

        return container;
    }

    handleTextSubmit() {
        const textInput = document.getElementById('text-input');
        if (!textInput || !textInput.value.trim()) return;

        this.requestTranslation(textInput.value, true); // true = complete translation
        textInput.value = '';
        this.clearPartialTranslation();
    }

    requestTranslation(text, isComplete = false) {
        if (!this.socket || !this.isConnected || !this.conversationId) return;

        const fromLang = document.getElementById('fromLang')?.value || 'auto';
        const toLang = this.getSelectedToLanguages();

        const translationData = {
            text: text.trim(),
            fromLang: fromLang,
            toLang: toLang,
            sessionId: this.sessionId,
            conversationId: this.conversationId,
            isPartial: !isComplete
        };

        this.socket.emit('realTimeTranslation', translationData);

        // Show loading indicator
        this.showLoadingIndicator(isComplete);
    }

    displayTranslationResult(data) {
        const container = this.getOrCreateTranslationContainer();

        // Create translation result element
        const translationElement = document.createElement('div');
        translationElement.className = 'realtime-translation-result';
        translationElement.innerHTML = this.createTranslationHTML(data);

        // Add to container
        container.insertBefore(translationElement, container.firstChild);

        // Auto-scroll to top
        container.scrollTop = 0;

        // Play audio if available
        this.playTranslationAudio(data);

        // Update conversation context
        this.updateConversationContext(data);
    }

    displayPartialTranslation(data) {
        const partialContainer = this.getOrCreatePartialContainer();
        partialContainer.innerHTML = this.createPartialTranslationHTML(data);
        partialContainer.style.display = 'block';
    }

    clearPartialTranslation() {
        const partialContainer = document.getElementById('partial-translation');
        if (partialContainer) {
            partialContainer.style.display = 'none';
        }
    }

    displayTranslationError(data) {
        console.error('[RealTime] Translation error:', data);
        this.showNotification('Translation failed: ' + (data.error || 'Unknown error'), 'error');
    }

    showTypingIndicator(data) {
        const typingContainer = this.getOrCreateTypingContainer();

        if (data.isTyping) {
            typingContainer.innerHTML = `
                <div class="typing-indicator">
                    <span class="typing-text">${data.socketId} is typing...</span>
                    <div class="typing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            `;
            typingContainer.style.display = 'block';
        } else {
            typingContainer.style.display = 'none';
        }
    }

    handleTranslationComplete(data) {
        this.hideLoadingIndicator();

        if (data.success) {
            console.log('[RealTime] Translation completed successfully');
        } else {
            console.error('[RealTime] Translation failed:', data.error);
            this.showNotification('Translation failed: ' + data.error, 'error');
        }
    }

    createTranslationHTML(data) {
        const translations = data.translations || [];
        const timestamp = new Date(data.timestamp).toLocaleTimeString();

        let html = `
            <div class="translation-item">
                <div class="original-text">${data.original}</div>
                <div class="translations">
        `;

        translations.forEach(translation => {
            html += `
                <div class="translation-option">
                    <span class="language-badge">${translation.toLanguage}</span>
                    <span class="translated-text">${translation.translatedText}</span>
                    <span class="confidence-badge">${Math.round(translation.confidence * 100)}%</span>
                    <button class="play-audio-btn" data-audio="${translation.audioId}">
                        <i class="fa-solid fa-play"></i>
                    </button>
                </div>
            `;
        });

        html += `
                </div>
                <div class="translation-meta">
                    <span class="timestamp">${timestamp}</span>
                    <span class="model-badge">GPT-5</span>
                </div>
            </div>
        `;

        return html;
    }

    createPartialTranslationHTML(data) {
        return `
            <div class="partial-translation">
                <span class="partial-label">Preview:</span>
                <span class="partial-text">${data.partial}</span>
            </div>
        `;
    }

    getOrCreateTranslationContainer() {
        let container = document.getElementById('realtime-translations');
        if (!container) {
            container = document.createElement('div');
            container.id = 'realtime-translations';
            container.className = 'realtime-translations-container';

            // Insert after the main translation area
            const mainContainer = document.querySelector('.container');
            if (mainContainer) {
                mainContainer.appendChild(container);
            }
        }
        return container;
    }

    getOrCreatePartialContainer() {
        let container = document.getElementById('partial-translation');
        if (!container) {
            container = document.createElement('div');
            container.id = 'partial-translation';
            container.className = 'partial-translation-container';

            const textInput = document.getElementById('text-input');
            if (textInput && textInput.parentNode) {
                textInput.parentNode.insertBefore(container, textInput.nextSibling);
            }
        }
        return container;
    }

    getOrCreateTypingContainer() {
        let container = document.getElementById('typing-indicators');
        if (!container) {
            container = document.createElement('div');
            container.id = 'typing-indicators';
            container.className = 'typing-indicators-container';

            const mainContainer = document.querySelector('.container');
            if (mainContainer) {
                mainContainer.appendChild(container);
            }
        }
        return container;
    }

    getSelectedToLanguages() {
        const selectedLanguages = new Set();
        const checkboxes = document.querySelectorAll('input[name="toLanguages"]:checked');
        checkboxes.forEach(checkbox => {
            selectedLanguages.add(checkbox.value);
        });
        return Array.from(selectedLanguages);
    }

    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('translationSessionId');
        if (!sessionId) {
            sessionId = this.generateSessionId();
            sessionStorage.setItem('translationSessionId', sessionId);
        }
        return sessionId;
    }

    generateConversationId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connected' : 'Disconnected';
            statusElement.className = connected ? 'status-connected' : 'status-disconnected';
        }
    }

    updateConversationStatus(active) {
        const statusElement = document.getElementById('conversation-status');
        if (statusElement) {
            statusElement.textContent = active ? `Active (${this.conversationId})` : 'Inactive';
            statusElement.className = active ? 'conversation-active' : 'conversation-inactive';
        }
    }

    showLoadingIndicator(isComplete) {
        const loadingElement = document.getElementById('translation-loading');
        if (loadingElement) {
            loadingElement.style.display = 'block';
            loadingElement.textContent = isComplete ? 'Translating...' : 'Processing...';
        }
    }

    hideLoadingIndicator() {
        const loadingElement = document.getElementById('translation-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    playTranslationAudio(data) {
        // Implementation for playing translation audio
        const audioButtons = document.querySelectorAll('.play-audio-btn');
        audioButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const audioId = e.target.dataset.audio;
                if (audioId) {
                    const audio = new Audio(`/audio/${audioId}`);
                    audio.play().catch(error => {
                        console.error('Audio playback failed:', error);
                    });
                }
            });
        });
    }

    updateConversationContext(data) {
        if (this.socket && this.conversationId) {
            this.socket.emit('updateContext', {
                conversationId: this.conversationId,
                context: data.context || ''
            });
        }
    }

    showNotification(message, type = 'info') {
        // Use existing notification system
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    toggleRealtimeMode(enabled) {
        if (enabled) {
            this.startConversation();
        } else {
            this.stopConversation();
        }
    }

    stopConversation() {
        if (this.socket && this.conversationId) {
            this.socket.emit('leaveConversation', {
                conversationId: this.conversationId
            });
        }
        this.conversationId = null;
        this.updateConversationStatus(false);
    }

    initializeSpeechRecognition() {
        // Initialize speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true; // Keep listening continuously
            this.recognition.interimResults = true; // Get interim results
            this.recognition.lang = 'en-US'; // Start with English as default
            this.recognition.maxAlternatives = 1; // Single alternative for better performance
            this.currentLanguage = 'en-US';
            this.languageDetectionEnabled = true;

            this.recognition.onstart = () => {
                console.log('Voice recognition started - continuous listening');
                this.updateVoiceButton(true);
            };

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                let detectedLanguage = this.currentLanguage;

                // Process all results with language detection
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const transcript = result[0].transcript;

                    // Try to detect language from the transcript
                    if (this.languageDetectionEnabled) {
                        detectedLanguage = this.detectLanguage(transcript);
                    }

                    if (result.isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                // Update text input with current transcript
                const textInput = document.getElementById('text-input');
                if (textInput) {
                    // Always update with the latest complete transcript
                    if (finalTranscript) {
                        // Add final results to existing text
                        const currentText = textInput.value;
                        textInput.value = currentText + (currentText ? ' ' : '') + finalTranscript;
                        console.log('Final voice input:', finalTranscript, 'Language:', detectedLanguage);

                        // Trigger real-time translation for the complete text
                        this.handleTextInput(textInput.value);

                        // Trigger immediate translation for Arabic text
                        if (detectedLanguage === 'ar-SA' || this.detectLanguage(finalTranscript) === 'ar-SA') {
                            console.log('Arabic detected - triggering immediate translation');
                            this.autoTranslateText(finalTranscript);
                        }

                        // Check if we need to restart with different language
                        if (detectedLanguage !== this.currentLanguage && detectedLanguage !== 'auto') {
                            this.switchLanguage(detectedLanguage);
                        }
                    } else if (interimTranscript) {
                        // Show interim results in a temporary way (don't save to input yet)
                        console.log('Interim voice input:', interimTranscript, 'Language:', detectedLanguage);

                        // Update a temporary display if needed
                        this.updateInterimDisplay(interimTranscript);
                    }
                }
            };

            this.recognition.onend = () => {
                console.log('Voice recognition ended');
                // Only update button if we're not supposed to be listening
                if (!this.isListening) {
                    this.updateVoiceButton(false);
                } else {
                    // Restart recognition if we're supposed to be listening
                    console.log('Restarting voice recognition...');
                    setTimeout(() => {
                        if (this.isListening) {
                            try {
                                this.recognition.start();
                            } catch (error) {
                                console.error('Error restarting recognition:', error);
                                this.isListening = false;
                                this.updateVoiceButton(false);
                            }
                        }
                    }, 100);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Voice recognition error:', event.error);
                this.isListening = false;
                this.updateVoiceButton(false);

                // Handle specific errors
                if (event.error === 'no-speech') {
                    console.log('No speech detected, continuing to listen...');
                    // Don't stop listening for no-speech errors
                    this.isListening = true;
                    this.updateVoiceButton(true);
                } else if (event.error === 'audio-capture') {
                    alert('Microphone not accessible. Please check your microphone permissions.');
                } else if (event.error === 'not-allowed') {
                    alert('Microphone permission denied. Please allow microphone access.');
                }
            };
        } else {
            console.log('Speech recognition not supported in this browser');
        }
    }

    toggleVoiceInput() {
        if (!this.recognition) {
            console.log('Speech recognition not available');
            return;
        }

        // Voice input always available (real-time mode is always on)
        if (!this.isListening) {
            this.startVoiceInput();
        } else {
            this.stopVoiceInput();
        }
    }

    async startVoiceInput() {
        // Voice input always works (real-time mode is always on)
        console.log('Starting voice input...');

        try {
            // Request microphone permission
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            // Clear text input for fresh start
            const textInput = document.getElementById('text-input');
            if (textInput) {
                textInput.value = '';
            }

            // Set language based on voice recognition language selector
            const voiceRecognitionLang = document.getElementById('voice-recognition-lang')?.value || 'auto';

            if (voiceRecognitionLang !== 'auto') {
                this.recognition.lang = voiceRecognitionLang;
                this.currentLanguage = voiceRecognitionLang;
                this.languageDetectionEnabled = false; // Disable auto-detection when manual language is selected
                console.log('Using manual language selection:', voiceRecognitionLang);
            } else {
                // For auto-detect, start with English but enable detection
                this.recognition.lang = 'en-US';
                this.currentLanguage = 'en-US';
                this.languageDetectionEnabled = true; // Enable auto-detection
                console.log('Using auto-detection mode - starting with English');
            }

            this.isListening = true;
            this.listeningStartTime = new Date();
            this.recognition.start();
            this.startListeningTimer();
            console.log('Voice input started - continuous listening mode');
        } catch (error) {
            console.error('Error starting voice input:', error);
            this.isListening = false;
            this.updateVoiceButton(false);

            if (error.name === 'NotAllowedError') {
                alert('Microphone permission denied. Please allow microphone access to use voice input.');
            } else if (error.name === 'NotFoundError') {
                alert('No microphone found. Please connect a microphone to use voice input.');
            } else {
                alert('Error accessing microphone: ' + error.message);
            }
        }
    }

    stopVoiceInput() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            this.hideInterimDisplay();
            this.stopListeningTimer();
            console.log('Voice input stopped - manual stop');
        }
    }

    startListeningTimer() {
        this.listeningInterval = setInterval(() => {
            if (this.isListening && this.listeningStartTime) {
                const elapsed = Math.floor((new Date() - this.listeningStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                // Update the voice status with listening time
                const voiceStatusText = document.getElementById('voice-status-text');
                if (voiceStatusText) {
                    voiceStatusText.textContent = `Continuous listening... ${timeString}`;
                }
            }
        }, 1000);
    }

    stopListeningTimer() {
        if (this.listeningInterval) {
            clearInterval(this.listeningInterval);
            this.listeningInterval = null;
        }
        this.listeningStartTime = null;
    }

    // Language detection function
    detectLanguage(text) {
        // Arabic script detection
        if (/[\u0600-\u06FF]/.test(text)) {
            return 'ar-SA';
        }

        // Arabic transliteration detection - more comprehensive
        const arabicTransliteration = /(assalamu|alaikum|wa|rahmat|ullah|barakat|bismillah|alhamdulillah|inshallah|mashallah|subhanallah|astaghfirullah|barakallahu|jazakallahu|salam|salaam|akhi|ukhti|habibi|habibti|ya|allah|muhammad|rasul|nabi|quran|hadith|dua|salah|sawm|zakat|hajj|ramadan|eid|jannah|jahannam|shaytan|jinn|malaikah|qiyamah|yawm|deen|islam|muslim|iman|taqwa|tawheed|shirk|kufr|nifaq|fitnah|bida|sunnah|ijtihad|fatwa|mufti|imam|sheikh|ustadh|qari|hafiz|mujahid|shahid|martyr|jihad|dawah|tabligh|tarbiyah|tazkiyah|tasawwuf|sufi|wali|awliya|karamah|barakah|noor|hikmah|fadl|rahmah|maghfirah|tawbah|istighfar|dhikr|tasbih|tahmid|takbir|tahlil|istighfar|dua|supplication|prayer|blessing|mercy|forgiveness|repentance|remembrance|praise|glorification|magnification|purification|supplication)/i;

        if (arabicTransliteration.test(text)) {
            console.log('Arabic transliteration detected in:', text);
            return 'ar-SA';
        }

        // English detection
        if (/^[a-zA-Z\s]+$/.test(text)) {
            return 'en-US';
        }

        // French detection
        if (/[àâäéèêëïîôöùûüÿçñ]/i.test(text)) {
            return 'fr-FR';
        }

        // German detection
        if (/[äöüß]/i.test(text)) {
            return 'de-DE';
        }

        // Spanish detection
        if (/[ñáéíóúü]/i.test(text)) {
            return 'es-ES';
        }

        // Urdu detection (Arabic script)
        if (/[\u0600-\u06FF\u0750-\u077F]/.test(text)) {
            return 'ur-PK';
        }

        // Hindi detection
        if (/[\u0900-\u097F]/.test(text)) {
            return 'hi-IN';
        }

        // Russian detection
        if (/[а-яё]/i.test(text)) {
            return 'ru-RU';
        }

        // Chinese detection
        if (/[\u4e00-\u9fff]/.test(text)) {
            return 'zh-CN';
        }

        // Japanese detection
        if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
            return 'ja-JP';
        }

        // Default to current language
        return this.currentLanguage;
    }

    // Switch recognition language
    switchLanguage(newLanguage) {
        if (newLanguage === this.currentLanguage) {
            return;
        }

        console.log('Switching recognition language from', this.currentLanguage, 'to', newLanguage);

        // Update language
        this.currentLanguage = newLanguage;
        this.recognition.lang = newLanguage;

        // Force restart recognition with new language
        if (this.isListening) {
            this.recognition.stop();
            // The onend handler will restart it automatically
        }
    }

    // Force language change (for manual testing)
    forceLanguage(newLanguage) {
        console.log('Force switching to language:', newLanguage);

        // Update language
        this.currentLanguage = newLanguage;
        this.recognition.lang = newLanguage;
        this.languageDetectionEnabled = false; // Disable auto-detection

        // Force restart recognition
        if (this.isListening) {
            this.recognition.stop();
            // The onend handler will restart it automatically
        }

        console.log('Language forced to:', newLanguage);
    }

    updateInterimDisplay(interimText) {
        // Create or update a temporary display for interim results
        let interimDisplay = document.getElementById('interim-voice-display');
        if (!interimDisplay) {
            interimDisplay = document.createElement('div');
            interimDisplay.id = 'interim-voice-display';
            interimDisplay.className = 'interim-voice-display';
            interimDisplay.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: #00ff00;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 14px;
                z-index: 1000;
                max-width: 300px;
                word-wrap: break-word;
            `;
            document.body.appendChild(interimDisplay);
        }
        interimDisplay.textContent = 'Listening: ' + interimText;
        interimDisplay.style.display = 'block';
    }

    hideInterimDisplay() {
        const interimDisplay = document.getElementById('interim-voice-display');
        if (interimDisplay) {
            interimDisplay.style.display = 'none';
        }
    }

    updateVoiceButton(isListening) {
        const micButton = document.getElementById('mic-button');
        const voiceStatus = document.getElementById('voice-status');
        const voiceStatusText = document.getElementById('voice-status-text');

        if (micButton) {
            if (isListening) {
                micButton.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Listening';
                micButton.classList.add('active');
                micButton.style.background = 'var(--danger-color)';
                micButton.title = 'Click to stop continuous voice input';
            } else {
                micButton.innerHTML = '<i class="fa-solid fa-microphone"></i> Start Listening';
                micButton.classList.remove('active');
                micButton.style.background = '';
                micButton.title = 'Click to start continuous voice input';
                this.hideInterimDisplay();
            }
        }

        if (voiceStatus && voiceStatusText) {
            if (isListening) {
                voiceStatus.style.display = 'flex';
                voiceStatus.classList.add('listening');
                voiceStatusText.textContent = 'Continuous listening... Speak naturally';
            } else {
                voiceStatus.style.display = 'none';
                voiceStatus.classList.remove('listening');
                voiceStatusText.textContent = 'Voice input ready';
            }
        }
    }

}

// Initialize Real-Time Translation when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Bundle Manager
    window.bundleManager = new BundleManager();

    // Initialize Real-Time Translation
    window.realTimeTranslation = new RealTimeTranslation();

    // Initialize Advanced Voice Input
    window.advancedVoiceInput = new AdvancedVoiceInput();

    // Load and initialize all modules
    await initializeAllModules();

    // Setup advanced voice input controls
    setupAdvancedVoiceControls();

    // Setup force language buttons
    setupForceLanguageButtons();

    // Auto-start real-time translation (always enabled)
    console.log('Auto-starting real-time translation...');
    window.realTimeTranslation.startConversation();

    // Auto-setup target languages for immediate translation
    setupAutoTranslation();

    // Test translation on page load
    setTimeout(() => {
        if (window.realTimeTranslation) {
            window.realTimeTranslation.testTranslation();
        }
    }, 2000);
});

// Initialize all modules
async function initializeAllModules() {
    try {
        // Load core modules
        const conversationMemory = await window.bundleManager.loadModule('conversation-memory');
        const smartSuggestions = await window.bundleManager.loadModule('smart-suggestions');
        const apmMonitoring = await window.bundleManager.loadModule('apm-monitoring');
        const errorTracking = await window.bundleManager.loadModule('error-tracking');

        // Initialize modules
        window.conversationMemory = new conversationMemory.default();
        window.smartSuggestions = new smartSuggestions.default(window.conversationMemory);
        window.apmMonitoring = new apmMonitoring.default();
        window.errorTracking = new errorTracking.default();

        // Load memories
        window.conversationMemory.loadMemories();

        console.log('All modules initialized successfully');

        // Show performance metrics
        setTimeout(() => {
            const metrics = window.apmMonitoring.getPerformanceSummary();
            console.log('Performance Summary:', metrics);
        }, 2000);

    } catch (error) {
        console.error('Failed to initialize modules:', error);
        // Fallback to basic functionality
    }
}

function setupAdvancedVoiceControls() {
    const startBtn = document.getElementById('advanced-voice-start');
    const stopBtn = document.getElementById('advanced-voice-stop');
    const techRadios = document.querySelectorAll('input[name="voice-tech"]');

    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            const selectedTech = document.querySelector('input[name="voice-tech"]:checked').value;
            const selectedLanguage = document.getElementById('voice-language').value;

            try {
                await window.advancedVoiceInput.startListening(selectedTech, selectedLanguage);
                startBtn.style.display = 'none';
                stopBtn.style.display = 'inline-flex';

                // Show advanced controls
                document.getElementById('advanced-voice-controls').style.display = 'block';
            } catch (error) {
                console.error('Failed to start advanced voice input:', error);
                alert('Failed to start voice input: ' + error.message);
            }
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            window.advancedVoiceInput.stopListening();
            startBtn.style.display = 'inline-flex';
            stopBtn.style.display = 'none';
        });
    }

    // Show supported technologies
    const supportedTechs = window.advancedVoiceInput.getSupportedTechnologies();
    techRadios.forEach(radio => {
        if (!supportedTechs.includes(radio.value)) {
            radio.disabled = true;
            radio.parentElement.style.opacity = '0.5';
            radio.parentElement.title = 'Not supported in this browser';
        }
    });
}

function setupForceLanguageButtons() {
    const forceArabicBtn = document.getElementById('force-arabic-btn');
    const forceEnglishBtn = document.getElementById('force-english-btn');

    if (forceArabicBtn) {
        forceArabicBtn.addEventListener('click', () => {
            if (window.realTimeTranslation && window.realTimeTranslation.isListening) {
                console.log('Forcing Arabic mode...');
                window.realTimeTranslation.forceLanguage('ar-SA');
            } else {
                alert('Please start voice input first');
            }
        });
    }

    if (forceEnglishBtn) {
        forceEnglishBtn.addEventListener('click', () => {
            if (window.realTimeTranslation && window.realTimeTranslation.isListening) {
                console.log('Forcing English mode...');
                window.realTimeTranslation.forceLanguage('en-US');
            } else {
                alert('Please start voice input first');
            }
        });
    }
}

function setupAutoTranslation() {
    // Set up automatic translation to multiple languages
    const targetLanguages = ['English', 'Arabic']; // Start with just English and Arabic

    // Store selected languages globally
    window.selectedTargetLanguages = targetLanguages;

    // Update the display
    const toLanguagesDisplay = document.getElementById('toLanguagesDisplay');
    if (toLanguagesDisplay) {
        toLanguagesDisplay.textContent = targetLanguages.join(', ');
        toLanguagesDisplay.classList.add('active');
    }

    // Setup target language selector
    setupTargetLanguageSelector();

    console.log('Auto-translation setup complete. Target languages:', targetLanguages);
}

function setupTargetLanguageSelector() {
    const updateBtn = document.getElementById('update-target-langs');
    const testBtn = document.getElementById('test-translation');
    const checkboxes = document.querySelectorAll('.lang-checkbox input[type="checkbox"]');

    if (updateBtn) {
        updateBtn.addEventListener('click', () => {
            const selectedLanguages = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);

            if (selectedLanguages.length === 0) {
                alert('Please select at least one target language');
                return;
            }

            // Update global target languages
            window.selectedTargetLanguages = selectedLanguages;

            // Update display
            const toLanguagesDisplay = document.getElementById('toLanguagesDisplay');
            if (toLanguagesDisplay) {
                toLanguagesDisplay.textContent = selectedLanguages.join(', ');
            }

            console.log('Target languages updated:', selectedLanguages);
        });
    }

    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            if (window.realTimeTranslation) {
                console.log('Testing translation...');
                const result = await window.realTimeTranslation.testTranslation();
                if (result) {
                    alert(`Translation test successful!\n\nArabic: السلام عليكم\nEnglish: ${result.translated}`);
                } else {
                    alert('Translation test failed. Check console for details.');
                }
            }
        });
    }
}
