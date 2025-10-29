/**
 * Imam Interface - Live Translation Frontend
 * Handles session creation, audio capture, and broadcasting
 */

class ImamInterface {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.isRecording = false;
        this.isBroadcasting = false;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.sessionStartTime = null;
        this.durationInterval = null;
        this.translationCount = 0;

        // Session-based auth: no client-side token needed
        this.token = null;

        // Initialize UI elements
        this.initializeElements();

        // Check authentication
        if (!this.token) {
            alert('Please login to create a translation session');
            window.location.href = '/login.html';
            return;
        }

        // Setup event listeners
        this.setupEventListeners();

        console.log('✅ [ImamInterface] Initialized');
    }

    initializeElements() {
        // Setup section
        this.setupSection = document.getElementById('setupSection');
        this.sessionTitle = document.getElementById('sessionTitle');
        this.sourceLanguage = document.getElementById('sourceLanguage');
        this.sessionDescription = document.getElementById('sessionDescription');
        this.sessionPassword = document.getElementById('sessionPassword');
        this.createSessionBtn = document.getElementById('createSessionBtn');

        // Active session section
        this.activeSession = document.getElementById('activeSession');
        this.sessionIdDisplay = document.getElementById('sessionIdDisplay');
        this.copySessionIdBtn = document.getElementById('copySessionId');
        this.qrCodeContainer = document.getElementById('qrCode');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.activeListeners = document.getElementById('activeListeners');
        this.sessionDuration = document.getElementById('sessionDuration');
        this.totalTranslations = document.getElementById('totalTranslations');
        this.waveform = document.getElementById('waveform');
        this.translationFeed = document.getElementById('translationFeed');

        // Control buttons
        this.startBroadcastBtn = document.getElementById('startBroadcastBtn');
        this.pauseBroadcastBtn = document.getElementById('pauseBroadcastBtn');
        this.endSessionBtn = document.getElementById('endSessionBtn');

        // Generate waveform bars
        this.generateWaveformBars();
    }

    generateWaveformBars() {
        this.waveform.innerHTML = '';
        for (let i = 0; i < 50; i++) {
            const bar = document.createElement('div');
            bar.className = 'waveform-bar';
            bar.style.height = '20px';
            this.waveform.appendChild(bar);
        }
    }

    setupEventListeners() {
        this.createSessionBtn.addEventListener('click', () => this.createSession());
        this.copySessionIdBtn.addEventListener('click', () => this.copySessionId());
        this.startBroadcastBtn.addEventListener('click', () => this.startBroadcast());
        this.pauseBroadcastBtn.addEventListener('click', () => this.pauseBroadcast());
        this.endSessionBtn.addEventListener('click', () => this.endSession());
    }

    /**
     * Connect to WebSocket
     */
    connectWebSocket() {
        console.log('🔌 [ImamInterface] Connecting to WebSocket...');

        // Check if Socket.IO is loaded
        if (typeof io === 'undefined') {
            console.error('❌ [ImamInterface] Socket.IO not loaded!');
            throw new Error('Socket.IO library not loaded. Please refresh the page.');
        }

        console.log('✅ [ImamInterface] Socket.IO is available');
        console.log('🔑 [ImamInterface] Using token:', this.token ? 'Present (' + this.token.substring(0, 20) + '...)' : 'Missing');

        this.socket = io({
            auth: {
                token: this.token
            }
        });

        console.log('✅ [ImamInterface] Socket instance created');

        this.socket.on('connect', () => {
            console.log('✅ [ImamInterface] WebSocket connected');
            this.updateConnectionStatus(true);
        });

        this.socket.on('disconnect', () => {
            console.log('❌ [ImamInterface] WebSocket disconnected');
            this.updateConnectionStatus(false);
        });

        // Authentication error
        this.socket.on('connect_error', (error) => {
            console.error('❌ [ImamInterface] Connection error:', error.message);
            if (error.message.includes('jwt expired') || error.message.includes('Authentication failed')) {
                alert('Your session has expired. Please login again.');
                localStorage.clear();
                window.location.href = '/login.html';
            } else {
                alert('Connection error: ' + error.message);
                this.createSessionBtn.disabled = false;
            }
        });

        // Session created
        this.socket.on('imam:sessionCreated', (data) => {
            if (data.success) {
                console.log('✅ [ImamInterface] Session created:', data.sessionId);
                this.sessionId = data.sessionId;
                this.showActiveSession();
            } else {
                alert('Failed to create session: ' + data.error);
                this.createSessionBtn.disabled = false;
            }
        });

        // Broadcast started
        this.socket.on('imam:broadcastStarted', (data) => {
            if (data.success) {
                console.log('✅ [ImamInterface] Broadcast started');
                this.isBroadcasting = true;
                this.updateBroadcastUI();
            }
        });

        // Audio processed
        this.socket.on('imam:audioProcessed', (data) => {
            if (data.success) {
                this.translationCount++;
                this.updateStats();
                console.log(`✅ [ImamInterface] Audio processed in ${data.processingTime}ms`);
            }
        });

        // Worshipper joined
        this.socket.on('imam:worshipperJoined', (data) => {
            console.log(`👥 [ImamInterface] Worshipper joined: ${data.userName} (${data.targetLanguage})`);
            this.showNotification(`${data.userName} joined (${data.targetLanguage})`);
        });

        // Worshipper left
        this.socket.on('imam:worshipperLeft', (data) => {
            console.log('👋 [ImamInterface] Worshipper left');
        });

        // Translation broadcast
        this.socket.on('translation', (data) => {
            this.addTranslationToFeed(data);
        });

        // Errors
        this.socket.on('processingError', (data) => {
            console.error('❌ [ImamInterface] Processing error:', data.error);
            this.showNotification('Error: ' + data.error, 'error');
        });
    }

    /**
     * Create new session
     */
    async createSession() {
        try {
            this.createSessionBtn.disabled = true;

            const sessionData = {
                title: this.sessionTitle.value || 'Live Translation Session',
                sourceLanguage: this.sourceLanguage.value,
                sourceLanguageName: this.sourceLanguage.options[this.sourceLanguage.selectedIndex].text.split('(')[0].trim(),
                description: this.sessionDescription.value,
                password: this.sessionPassword.value || null
            };

            console.log('📡 [ImamInterface] Creating session...', sessionData);

            // Connect WebSocket first
            this.connectWebSocket();

            // Wait for connection
            await new Promise((resolve) => {
                this.socket.on('connect', resolve);
            });

            // Create session via WebSocket
            this.socket.emit('imam:createSession', sessionData);

        } catch (error) {
            console.error('❌ [ImamInterface] Error creating session:', error);
            console.error('❌ [ImamInterface] Error stack:', error.stack);
            console.error('❌ [ImamInterface] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            alert('Error creating session: ' + (error.message || 'Unknown error. Check console for details.'));
            this.createSessionBtn.disabled = false;
        }
    }

    /**
     * Show active session UI
     */
    showActiveSession() {
        this.setupSection.classList.add('hidden');
        this.activeSession.classList.remove('hidden');

        // Display session ID
        this.sessionIdDisplay.textContent = this.sessionId;

        // Generate QR code
        this.generateQRCode();

        // Start duration timer
        this.startDurationTimer();

        // Update stats periodically
        setInterval(() => this.fetchSessionStats(), 5000);
    }

    /**
     * Generate QR code for session
     */
    generateQRCode() {
        const joinUrl = `${window.location.origin}/live-translation-worshipper.html?session=${this.sessionId}`;

        QRCode.toCanvas(
            document.createElement('canvas'),
            joinUrl,
            { width: 200 },
            (error, canvas) => {
                if (error) {
                    console.error('QR code error:', error);
                    return;
                }
                this.qrCodeContainer.innerHTML = '';
                this.qrCodeContainer.appendChild(canvas);
            }
        );
    }

    /**
     * Copy session ID to clipboard
     */
    copySessionId() {
        navigator.clipboard.writeText(this.sessionId).then(() => {
            this.showNotification('Session ID copied to clipboard!');
            this.copySessionIdBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                this.copySessionIdBtn.innerHTML = '<i class="fas fa-copy"></i> Copy ID';
            }, 2000);
        });
    }

    /**
     * Start broadcasting
     */
    async startBroadcast() {
        try {
            console.log('🎤 [ImamInterface] Starting broadcast...');

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Setup audio context for visualization
            this.setupAudioVisualization(stream);

            // Setup media recorder
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            // Accumulate audio chunks for complete WebM file
            const audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && this.isBroadcasting) {
                    audioChunks.push(event.data);
                    console.log(`📦 [ImamInterface] Collected chunk ${audioChunks.length}: ${event.data.size} bytes`);
                }
            };

            // When recording stops (every 3 seconds), combine and send complete WebM
            this.mediaRecorder.onstop = async () => {
                if (audioChunks.length > 0 && this.isBroadcasting) {
                    // Combine all chunks into a single complete WebM file
                    const completeBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
                    console.log(`📤 [ImamInterface] Sending complete WebM: ${completeBlob.size} bytes (from ${audioChunks.length} chunks)`);

                    // Send complete WebM file
                    await this.sendAudioChunk(completeBlob);

                    // Clear chunks for next recording
                    audioChunks.length = 0;

                    // Restart recording immediately
                    if (this.isBroadcasting && this.mediaRecorder) {
                        console.log('▶️ [ImamInterface] Restarting recorder for next chunk...');
                        this.mediaRecorder.start();
                    }
                }
            };

            // Start recording
            this.mediaRecorder.start();

            // Stop and restart every 1.5 seconds for faster processing (optimized for speed)
            this.recordingInterval = setInterval(() => {
                if (this.isBroadcasting && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    console.log('⏹️ [ImamInterface] Stopping recorder to send chunk...');
                    this.mediaRecorder.stop();
                    // onstop will handle sending and restarting
                }
            }, 1500); // Reduced from 3000ms to 1500ms for faster response

            // Notify server
            this.socket.emit('imam:startBroadcast', { sessionId: this.sessionId });

            this.sessionStartTime = Date.now();
            this.isRecording = true;

            console.log('✅ [ImamInterface] Recording started');

        } catch (error) {
            console.error('❌ [ImamInterface] Error starting broadcast:', error);
            alert('Error accessing microphone: ' + error.message);
        }
    }

    /**
     * Setup audio visualization
     */
    setupAudioVisualization(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);

        this.analyser.fftSize = 128;
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const visualize = () => {
            if (!this.isRecording) return;

            requestAnimationFrame(visualize);
            this.analyser.getByteFrequencyData(dataArray);

            const bars = this.waveform.querySelectorAll('.waveform-bar');
            bars.forEach((bar, i) => {
                const value = dataArray[i] || 0;
                const height = (value / 255) * 100;
                bar.style.height = Math.max(height, 5) + 'px';
            });
        };

        visualize();
    }

    /**
     * Send audio chunk to server
     */
    async sendAudioChunk(blob) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = this.arrayBufferToBase64(arrayBuffer);

            this.socket.emit('imam:audioChunk', {
                sessionId: this.sessionId,
                audioData: base64,
                format: 'webm'
            });

            console.log(`📡 [ImamInterface] Sent audio chunk: ${blob.size} bytes`);

        } catch (error) {
            console.error('❌ [ImamInterface] Error sending audio:', error);
        }
    }

    /**
     * Convert ArrayBuffer to Base64
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Pause broadcast
     */
    pauseBroadcast() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.isBroadcasting = false;

            // Clear recording interval
            if (this.recordingInterval) {
                clearInterval(this.recordingInterval);
                this.recordingInterval = null;
            }

            // Stop audio visualization
            if (this.audioContext) {
                this.audioContext.close();
            }

            this.socket.emit('imam:pauseBroadcast', { sessionId: this.sessionId });
            this.updateBroadcastUI();

            console.log('⏸️ [ImamInterface] Broadcast paused');
        }
    }

    /**
     * End session
     */
    async endSession() {
        if (!confirm('Are you sure you want to end this session? All worshippers will be disconnected.')) {
            return;
        }

        // Stop recording
        if (this.isRecording) {
            this.pauseBroadcast();
        }

        // End session
        this.socket.emit('imam:endSession', { sessionId: this.sessionId });

        // Stop duration timer
        if (this.durationInterval) {
            clearInterval(this.durationInterval);
        }

        // Disconnect socket
        if (this.socket) {
            this.socket.disconnect();
        }

        alert('Session ended successfully');
        window.location.reload();
    }

    /**
     * Update broadcast UI
     */
    updateBroadcastUI() {
        if (this.isBroadcasting) {
            this.startBroadcastBtn.classList.add('hidden');
            this.pauseBroadcastBtn.classList.remove('hidden');
        } else {
            this.startBroadcastBtn.classList.remove('hidden');
            this.pauseBroadcastBtn.classList.add('hidden');
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
     * Start duration timer
     */
    startDurationTimer() {
        const startTime = Date.now();
        this.durationInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.sessionDuration.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    /**
     * Fetch session stats
     */
    async fetchSessionStats() {
        try {
            const response = await fetch(`/api/live-translation/session/${this.sessionId}`, {
                credentials: 'include',
                headers: {}
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const activeCount = data.session.worshippers.filter(w => w.isActive).length;
                    this.activeListeners.textContent = activeCount;
                }
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }

    /**
     * Update stats
     */
    updateStats() {
        this.totalTranslations.textContent = this.translationCount;
    }

    /**
     * Add translation to feed
     */
    addTranslationToFeed(data) {
        const item = document.createElement('div');
        item.className = 'translation-item';

        const original = document.createElement('div');
        original.className = 'translation-original';
        original.textContent = `🎤 ${data.original.text}`;

        const targets = document.createElement('div');
        targets.className = 'translation-targets';

        data.translations.forEach(t => {
            const badge = document.createElement('span');
            badge.className = 'translation-target';
            badge.textContent = t.language.toUpperCase();
            targets.appendChild(badge);
        });

        item.appendChild(original);
        item.appendChild(targets);

        // Clear placeholder
        if (this.translationFeed.querySelector('p')) {
            this.translationFeed.innerHTML = '';
        }

        this.translationFeed.insertBefore(item, this.translationFeed.firstChild);

        // Limit to 20 items
        const items = this.translationFeed.querySelectorAll('.translation-item');
        if (items.length > 20) {
            items[items.length - 1].remove();
        }
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
            background: ${type === 'error' ? '#ef4444' : '#10b981'};
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

    // Initialize Imam Interface
    window.imamInterface = new ImamInterface();
});

