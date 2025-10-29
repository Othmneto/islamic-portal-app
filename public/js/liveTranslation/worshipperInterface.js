/**
 * Worshipper Interface - Live Translation Frontend
 * Handles joining sessions and receiving dual-mode translations (text + voice)
 */

class WorshipperInterface {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.targetLanguage = null;
        this.audioContext = null;
        this.audioQueue = [];
        this.isPlayingAudio = false;
        this.volume = 0.8;
        this.translationData = []; // Translation history data array

        // Session-based auth: no client-side token needed
        this.token = null;

        // Initialize UI elements
        this.initializeElements();

        // Check for session ID in URL
        this.checkURLParams();

        // Setup event listeners
        this.setupEventListeners();

        // Initialize Audio Context
        this.initializeAudioContext();

        console.log('✅ [WorshipperInterface] Initialized');
    }

    initializeElements() {
        // Join section
        this.joinSection = document.getElementById('joinSection');
        this.sessionIdInput = document.getElementById('sessionId');
        this.targetLanguageSelect = document.getElementById('targetLanguage');
        this.sessionPasswordInput = document.getElementById('sessionPassword');
        this.joinBtn = document.getElementById('joinBtn');

        console.log('🔍 [WorshipperInterface] Join button found:', this.joinBtn);

        // Active session section
        this.activeSession = document.getElementById('activeSession');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.qualityIndicator = document.getElementById('qualityIndicator');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.translationContent = document.getElementById('translationContent');
        this.originalText = document.getElementById('originalText');
        this.translatedText = document.getElementById('translatedText');
        this.audioIndicator = document.getElementById('audioIndicator');
        this.translationHistoryElement = document.getElementById('translationHistory'); // DOM element
        this.leaveSessionBtn = document.getElementById('leaveSessionBtn');
    }

    checkURLParams() {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session');

        if (sessionId) {
            this.sessionIdInput.value = sessionId;
        }
    }

    setupEventListeners() {
        console.log('👂 [WorshipperInterface] Setting up event listeners...');
        console.log('👂 [WorshipperInterface] Join button:', this.joinBtn);

        if (this.joinBtn) {
            this.joinBtn.addEventListener('click', () => {
                console.log('🖱️ [WorshipperInterface] Join button clicked!');
                this.joinSession();
            });
            console.log('✅ [WorshipperInterface] Join button listener added');
        } else {
            console.error('❌ [WorshipperInterface] Join button not found!');
        }

        if (this.leaveSessionBtn) {
            this.leaveSessionBtn.addEventListener('click', () => this.leaveSession());
        }

        // Volume control
        this.volumeSlider.addEventListener('input', (e) => {
            this.volume = e.target.value / 100;
            this.volumeValue.textContent = e.target.value + '%';
        });

        // Enter key to join
        this.sessionIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinSession();
            }
        });
    }

    /**
     * Initialize Audio Context
     */
    initializeAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('🎵 [WorshipperInterface] Audio context initialized');
    }

    /**
     * Connect to WebSocket
     */
    connectWebSocket() {
        console.log('🔌 [WorshipperInterface] Connecting to WebSocket...');

        // Check if Socket.IO is loaded
        if (typeof io === 'undefined') {
            console.error('❌ [WorshipperInterface] Socket.IO not loaded!');
            alert('Socket.IO library not loaded. Please refresh the page.');
            return;
        }

        console.log('✅ [WorshipperInterface] Socket.IO is available');

        this.socket = io({
            auth: {
                token: this.token
            }
        });

        this.socket.on('connect', () => {
            console.log('✅ [WorshipperInterface] WebSocket connected');
            this.updateConnectionStatus(true);

            // Join the session after connection
            this.sendJoinRequest();
        });

        this.socket.on('disconnect', () => {
            console.log('❌ [WorshipperInterface] WebSocket disconnected');
            this.updateConnectionStatus(false);
            this.showNotification('Connection lost. Reconnecting...', 'warning');
        });

        // Authentication error
        this.socket.on('connect_error', (error) => {
            console.error('❌ [WorshipperInterface] Connection error:', error.message);
            if (error.message.includes('jwt expired') || error.message.includes('Authentication failed')) {
                alert('Your session has expired. Please login again.');
                localStorage.clear();
                window.location.href = '/login.html';
            } else {
                alert('Connection error: ' + error.message);
                this.joinBtn.disabled = false;
            }
        });

        // Join result
        this.socket.on('worshipper:joinResult', (data) => {
            if (data.success) {
                console.log('✅ [WorshipperInterface] Joined session successfully');
                this.showActiveSession();
                this.showNotification('Successfully joined session!');
            } else {
                alert('Failed to join session: ' + data.error);
                this.joinBtn.disabled = false;
            }
        });

        // Personal translation (optimized for this worshipper)
        this.socket.on('personalTranslation', (data) => {
            console.log('📥 [WorshipperInterface] Received personal translation');
            this.handleTranslation(data);
        });

        // General translation broadcast
        this.socket.on('translation', (data) => {
            console.log('📥 [WorshipperInterface] Received translation broadcast');
            // Find translation for our language
            const myTranslation = data.translations.find(t => t.language === this.targetLanguage);
            if (myTranslation) {
                this.handleTranslation({
                    original: data.original,
                    translation: myTranslation,
                    timestamp: data.timestamp
                });
            }
        });

        // Session ended
        this.socket.on('session:ended', (data) => {
            alert('Session has ended by the Imam');
            this.leaveSession();
        });

        // Session status changes
        this.socket.on('session:statusChanged', (data) => {
            console.log('📊 [WorshipperInterface] Session status:', data.status);
            if (data.status === 'paused') {
                this.showNotification('Imam paused broadcasting', 'warning');
            } else if (data.status === 'active') {
                this.showNotification('Imam resumed broadcasting');
            }
        });

        // Imam disconnected
        this.socket.on('session:imamDisconnected', (data) => {
            this.showNotification('Imam disconnected', 'warning');
        });

        // Language changed
        this.socket.on('worshipper:languageChanged', (data) => {
            if (data.success) {
                this.showNotification('Language changed to ' + data.targetLanguage);
            }
        });
    }

    /**
     * Join session
     */
    async joinSession() {
        try {
            this.joinBtn.disabled = true;

            this.sessionId = this.sessionIdInput.value.trim().toUpperCase();
            this.targetLanguage = this.targetLanguageSelect.value;
            const password = this.sessionPasswordInput.value;

            if (!this.sessionId) {
                alert('Please enter a session ID');
                this.joinBtn.disabled = false;
                return;
            }

            console.log('📡 [WorshipperInterface] Joining session:', this.sessionId);

            // Connect WebSocket
            this.connectWebSocket();

        } catch (error) {
            console.error('❌ [WorshipperInterface] Error joining session:', error);
            alert('Error joining session: ' + error.message);
            this.joinBtn.disabled = false;
        }
    }

    /**
     * Send join request via WebSocket
     */
    sendJoinRequest() {
        const targetLanguageName = this.targetLanguageSelect.options[this.targetLanguageSelect.selectedIndex].text.split('(')[0].trim();

        this.socket.emit('worshipper:joinSession', {
            sessionId: this.sessionId,
            targetLanguage: this.targetLanguage,
            targetLanguageName: targetLanguageName,
            password: this.sessionPasswordInput.value || null
        });
    }

    /**
     * Show active session UI
     */
    showActiveSession() {
        this.joinSection.classList.add('hidden');
        this.activeSession.classList.remove('hidden');

        // Monitor connection quality
        setInterval(() => this.updateConnectionQuality(), 5000);
    }

    /**
     * Handle incoming translation
     */
    async handleTranslation(data) {
        try {
            console.log('🎯 [WorshipperInterface] Processing translation:', data);

            // Hide loading, show content
            this.loadingIndicator.classList.add('hidden');
            this.translationContent.classList.remove('hidden');

            // Display original text
            this.originalText.innerHTML = `
                <strong>${data.original.languageName || data.original.language}:</strong> 
                ${data.original.text}
            `;

            // Display translated text
            const translatedText = data.translation.text?.text || data.translation.text;
            this.translatedText.textContent = translatedText;

            // Add to history
            this.addToHistory(data.original.text, translatedText);

            // Play audio if available
            if (data.translation.audioBase64) {
                await this.playTranslationAudio(data.translation.audioBase64);
            } else if (data.translation.audio) {
                await this.playTranslationAudio(data.translation.audio);
            } else {
                // Hide audio indicator if no audio
                this.audioIndicator.classList.add('hidden');
                setTimeout(() => {
                    this.audioIndicator.classList.remove('hidden');
                }, 3000);
            }

        } catch (error) {
            console.error('❌ [WorshipperInterface] Error handling translation:', error);
        }
    }

    /**
     * Play translation audio (DUAL-MODE OUTPUT)
     */
    async playTranslationAudio(audioBase64) {
        try {
            console.log('🔊 [WorshipperInterface] Playing audio...');

            // Show audio indicator
            this.audioIndicator.classList.remove('hidden');

            // Decode base64 to array buffer
            const binaryString = atob(audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Decode audio data
            const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);

            // Create audio source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;

            // Create gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = this.volume;

            // Connect nodes
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // Play audio
            source.start(0);

            // Hide indicator when done
            source.onended = () => {
                setTimeout(() => {
                    this.audioIndicator.classList.add('hidden');
                }, 500);
            };

            console.log('✅ [WorshipperInterface] Audio playing');

        } catch (error) {
            console.error('❌ [WorshipperInterface] Error playing audio:', error);
            this.audioIndicator.classList.add('hidden');

            // Fallback: try using HTML5 Audio
            try {
                const audio = new Audio('data:audio/webm;base64,' + audioBase64);
                audio.volume = this.volume;
                await audio.play();
            } catch (fallbackError) {
                console.error('❌ [WorshipperInterface] Fallback audio also failed:', fallbackError);
            }
        }
    }

    /**
     * Add translation to history
     */
    addToHistory(original, translated) {
        const historyItem = {
            original,
            translated,
            timestamp: new Date()
        };

        this.translationData.unshift(historyItem);

        // Limit history to 50 items
        if (this.translationData.length > 50) {
            this.translationData.pop();
        }

        // Update UI
        this.renderHistory();
    }

    /**
     * Render translation history
     */
    renderHistory() {
        // Clear placeholder
        if (this.translationData.length > 0) {
            this.translationHistoryElement.innerHTML = '';
        }

        this.translationData.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';

            const time = document.createElement('div');
            time.className = 'history-time';
            time.textContent = item.timestamp.toLocaleTimeString();

            const text = document.createElement('div');
            text.className = 'history-text';
            text.textContent = item.translated;

            div.appendChild(time);
            div.appendChild(text);

            this.translationHistoryElement.appendChild(div);
        });

        // Limit displayed items to 20
        const items = this.translationHistoryElement.querySelectorAll('.history-item');
        if (items.length > 20) {
            for (let i = 20; i < items.length; i++) {
                items[i].remove();
            }
        }
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(connected) {
        if (connected) {
            this.connectionStatus.className = 'status-indicator connected';
            this.connectionStatus.innerHTML = '<span class="status-dot"></span><span>Connected</span>';
        } else {
            this.connectionStatus.className = 'status-indicator disconnected';
            this.connectionStatus.innerHTML = '<span class="status-dot"></span><span>Disconnected</span>';
        }
    }

    /**
     * Update connection quality
     */
    updateConnectionQuality() {
        // Simple latency check
        const startTime = Date.now();

        this.socket.emit('ping', { timestamp: startTime });

        this.socket.once('pong', (data) => {
            const latency = Date.now() - startTime;

            let quality = 'excellent';
            let className = 'quality-excellent';

            if (latency > 100) {
                quality = 'good';
                className = 'quality-good';
            }
            if (latency > 300) {
                quality = 'fair';
                className = 'quality-fair';
            }
            if (latency > 500) {
                quality = 'poor';
                className = 'quality-poor';
            }

            this.qualityIndicator.className = className;
            this.qualityIndicator.textContent = `${quality.charAt(0).toUpperCase() + quality.slice(1)} (${latency}ms)`;

            // Send quality report to server
            this.socket.emit('worshipper:connectionQuality', {
                sessionId: this.sessionId,
                quality,
                latency
            });
        });
    }

    /**
     * Leave session
     */
    leaveSession() {
        if (this.socket) {
            this.socket.emit('worshipper:leaveSession', {
                sessionId: this.sessionId
            });
            this.socket.disconnect();
        }

        window.location.reload();
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Load navbar
    fetch('/components/global-navbar.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('navbar-placeholder').innerHTML = html;
            if (window.GlobalNavbar) {
                window.globalNavbar = new window.GlobalNavbar();
            }
        });

    // Initialize Worshipper Interface
    window.worshipperInterface = new WorshipperInterface();
});

