/**
 * Translation Core Module
 * Handles basic translation functionality
 */

export class TranslationCore {
    constructor() {
        this.isListening = false;
        this.recognition = null;
        this.socket = null;
        this.sessionId = this.generateSessionId();
        this.currentLanguage = 'ar-SA';
        this.targetLanguage = 'en';
        this.voiceId = 'pNInz6obpgDQGcFmaJgB';
        this.translationCount = 0;
        this.accumulatedText = '';
        this.currentPhrase = '';
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async init() {
        console.log('Initializing Translation Core...');
        this.setupSocketConnection();
        this.setupVoiceRecognition();
        this.setupEventListeners();
        this.updateUI();
        console.log('Translation Core initialized successfully');
    }

    setupSocketConnection() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('translationResult', (data) => {
            console.log('Received translation result:', data);
            this.displayTranslation(data);
        });
    }

    setupVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.currentLanguage;
        this.recognition.maxAlternatives = 3;

        this.recognition.onstart = () => {
            console.log('Voice recognition started');
            this.updateVoiceStatus(true, 'Listening...');
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                console.log('Final transcript:', finalTranscript);
                this.accumulatedText += (this.accumulatedText ? ' ' : '') + finalTranscript.trim();
                this.currentPhrase = finalTranscript.trim();
                this.updateTextCounter();
                this.processTranslation(this.accumulatedText);
            }

            if (interimTranscript) {
                console.log('Interim transcript:', interimTranscript);
                this.updateVoiceStatus(true, `Listening: "${interimTranscript}"`);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            
            if (event.error === 'aborted' || event.error === 'no-speech') {
                console.log('Recoverable error, continuing...');
                if (this.isListening) {
                    setTimeout(() => {
                        if (this.isListening) {
                            try {
                                this.recognition.start();
                                console.log('Restarted voice recognition after error');
                            } catch (e) {
                                console.log('Could not restart recognition:', e);
                            }
                        }
                    }, 1000);
                }
                return;
            }
            
            this.showError(`Voice recognition error: ${event.error}`);
        };

        this.recognition.onend = () => {
            console.log('Voice recognition ended');
            if (this.isListening) {
                setTimeout(() => {
                    if (this.isListening) {
                        try {
                            this.recognition.start();
                            console.log('Restarted voice recognition');
                        } catch (e) {
                            console.log('Could not restart recognition:', e);
                        }
                    }
                }, 100);
            }
        };
    }

    setupEventListeners() {
        const startBtn = document.getElementById('start-voice');
        const stopBtn = document.getElementById('stop-voice');
        const clearBtn = document.getElementById('clear-text');
        const targetLangSelect = document.getElementById('target-language');
        const voiceLangSelect = document.getElementById('voice-language');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startListening());
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopListening());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAccumulatedText());
        }
        if (targetLangSelect) {
            targetLangSelect.addEventListener('change', (e) => {
                this.targetLanguage = e.target.value;
            });
        }
        if (voiceLangSelect) {
            voiceLangSelect.addEventListener('change', (e) => {
                this.currentLanguage = e.target.value;
                if (this.recognition) {
                    this.recognition.lang = e.target.value;
                }
            });
        }
    }

    async startListening() {
        if (this.isListening) return;

        try {
            this.isListening = true;
            this.accumulatedText = '';
            this.currentPhrase = '';
            this.updateUI();
            this.recognition.start();
            console.log('Started voice recognition');
        } catch (error) {
            console.error('Error starting voice recognition:', error);
            this.showError('Failed to start voice recognition');
            this.isListening = false;
            this.updateUI();
        }
    }

    stopListening() {
        if (!this.isListening) return;

        this.isListening = false;
        this.recognition.stop();
        this.updateUI();
        console.log('Stopped voice recognition');
    }

    clearAccumulatedText() {
        this.accumulatedText = '';
        this.currentPhrase = '';
        console.log('Cleared accumulated text');
        this.updateTextCounter();
        this.showSuccess('Text cleared - ready for new conversation');
        
        const translationList = document.getElementById('translation-list');
        if (translationList) {
            translationList.innerHTML = '<div class="empty-state">No translations yet. Start speaking to see results here.</div>';
        }
    }

    async processTranslation(text) {
        if (!text || text.trim() === '') return;

        console.log('Processing translation for:', text);

        try {
            const response = await fetch('/api/translation/speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    from: this.detectLanguage(text),
                    to: [this.targetLanguage],
                    voiceId: this.voiceId,
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`Translation failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('Translation response:', data);

            if (data && data.length > 0) {
                const result = data[0];
                if (result.translated && result.translated.trim() !== '') {
                    this.displayTranslation({
                        original: text,
                        translated: result.translated,
                        language: this.getLanguageName(this.targetLanguage),
                        timestamp: result.timestamp || new Date().toISOString(),
                        confidence: result.confidence || 0.9
                    });
                } else {
                    console.log('Translation returned empty result, skipping display');
                }
            } else {
                this.showError('No translation data received');
            }
        } catch (error) {
            console.error('Translation error:', error);
            this.showError(`Translation failed: ${error.message}`);
        }
    }

    // Process partial translation for real-time typing
    async processPartialTranslation(text, fromLang, toLang) {
        if (!text || text.trim().length < 2) return null;

        try {
            // Check if partial translation service is available
            if (window.partialTranslation) {
                const partialResult = await window.partialTranslation.getDebouncedPartialTranslation(
                    text,
                    fromLang,
                    toLang,
                    this.getUserId(),
                    this.sessionId,
                    300 // 300ms debounce
                );

                if (partialResult) {
                    this.displayPartialTranslation({
                        original: text,
                        translated: partialResult.translated,
                        language: this.getLanguageName(toLang),
                        timestamp: new Date().toISOString(),
                        confidence: partialResult.confidence || 0.7,
                        isPartial: true,
                        source: partialResult.source || 'partial'
                    });
                    return partialResult;
                }
            }
        } catch (error) {
            console.error('Partial translation error:', error);
        }

        return null;
    }

    // Display partial translation
    displayPartialTranslation(data) {
        console.log('Displaying partial translation:', data);
        
        const translationList = document.getElementById('translation-list');
        if (!translationList) return;
        
        // Remove existing partial translations
        const existingPartial = translationList.querySelector('.translation-item.partial');
        if (existingPartial) {
            existingPartial.remove();
        }

        const translationItem = document.createElement('div');
        translationItem.className = 'translation-item partial';
        translationItem.innerHTML = `
            <div class="translation-header">
                <span class="language-badge partial">${data.language} (Partial)</span>
                <span class="timestamp">${new Date(data.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="translated-text partial-text">${data.translated}</div>
            <div class="original-text">
                <div class="current-phrase">Current: "${this.currentPhrase}"</div>
                <div class="full-conversation">Full: "${data.original}"</div>
            </div>
            <div class="confidence-score">Confidence: ${Math.round((data.confidence || 0.7) * 100)}% (${data.source})</div>
        `;

        translationList.insertBefore(translationItem, translationList.firstChild);
    }

    // Get user ID for partial translations
    getUserId() {
        // Try to get user ID from various sources
        return localStorage.getItem('userId') || 
               sessionStorage.getItem('userId') || 
               this.getUserIdFromToken();
    }

    // Extract user ID from JWT token
    getUserIdFromToken() {
        try {
            const token = this.getAuthToken();
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                return payload.userId;
            }
        } catch (error) {
            console.error('Error extracting user ID from token:', error);
        }
        return null;
    }

    // Get authentication token
    getAuthToken() {
        return localStorage.getItem('authToken') || 
               sessionStorage.getItem('authToken') || 
               this.getTokenFromCookie();
    }

    // Get token from cookie
    getTokenFromCookie() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'authToken') {
                return value;
            }
        }
        return null;
    }

    displayTranslation(data) {
        console.log('Displaying translation:', data);
        
        const translationList = document.getElementById('translation-list');
        if (!translationList) return;
        
        const emptyState = translationList.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        const translationItem = document.createElement('div');
        translationItem.className = 'translation-item';
        translationItem.innerHTML = `
            <div class="translation-header">
                <span class="language-badge">${data.language}</span>
                <span class="timestamp">${new Date(data.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="translated-text">${data.translated}</div>
            <div class="original-text">
                <div class="current-phrase">Current: "${this.currentPhrase}"</div>
                <div class="full-conversation">Full: "${data.original}"</div>
            </div>
            <div class="confidence-score">Confidence: ${Math.round((data.confidence || 0.9) * 100)}%</div>
        `;

        translationList.insertBefore(translationItem, translationList.firstChild);

        const items = translationList.querySelectorAll('.translation-item');
        if (items.length > 10) {
            items[items.length - 1].remove();
        }

        translationItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.translationCount++;
    }

    detectLanguage(text) {
        const arabicRegex = /[\u0600-\u06FF]/;
        const englishRegex = /[a-zA-Z]/;
        
        if (arabicRegex.test(text)) return 'ar';
        if (englishRegex.test(text)) return 'en';
        return 'auto';
    }

    getLanguageName(code) {
        const languages = {
            'en': 'English',
            'ar': 'Arabic',
            'fr': 'French',
            'de': 'German',
            'es': 'Spanish',
            'ur': 'Urdu',
            'hi': 'Hindi'
        };
        return languages[code] || code;
    }

    updateUI() {
        const startBtn = document.getElementById('start-voice');
        const stopBtn = document.getElementById('stop-voice');
        const statusText = document.getElementById('status-text');

        if (startBtn && stopBtn) {
            startBtn.style.display = this.isListening ? 'none' : 'inline-block';
            stopBtn.style.display = this.isListening ? 'inline-block' : 'none';
        }

        if (statusText) {
            statusText.textContent = this.isListening ? 'Listening...' : 'Ready to translate';
        }
    }

    updateVoiceStatus(isListening, message) {
        const voiceIndicator = document.getElementById('voice-indicator');
        const voiceStatusText = document.getElementById('voice-status-text');

        if (voiceIndicator) {
            voiceIndicator.className = `voice-indicator ${isListening ? 'listening' : ''}`;
        }

        if (voiceStatusText) {
            voiceStatusText.textContent = message;
        }
    }

    updateTextCounter() {
        const counter = document.getElementById('counter-value');
        const counterContainer = document.getElementById('text-counter');
        
        if (counter) {
            counter.textContent = `${this.accumulatedText.length} characters`;
        }
        
        if (counterContainer) {
            counterContainer.style.display = this.accumulatedText.length > 0 ? 'flex' : 'none';
        }
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');

        if (statusDot) {
            statusDot.style.background = connected ? '#10b981' : '#ef4444';
        }

        if (statusText) {
            statusText.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }

    showError(message) {
        console.error('Error:', message);
        // You can implement a toast notification system here
    }

    showSuccess(message) {
        console.log('Success:', message);
        // You can implement a toast notification system here
    }
}
