// Advanced Voice Input with Multiple Technology Options
class AdvancedVoiceInput {
    constructor() {
        this.isListening = false;
        this.recognition = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.mediaStream = null;
        this.socket = null;
        this.technology = 'webspeech'; // webspeech, mediarecorder, webrtc
        this.initializeTechnologies();
    }

    initializeTechnologies() {
        this.initializeWebSpeech();
        this.initializeMediaRecorder();
        this.initializeWebRTC();
    }

    // 1. Web Speech API (Browser Native)
    initializeWebSpeech() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;

            this.recognition.onstart = () => {
                console.log('Web Speech API: Voice recognition started');
                this.updateStatus('Web Speech API: Listening...');
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
                    console.log('Web Speech API - Final:', finalTranscript);
                    this.handleFinalResult(finalTranscript);
                } else if (interimTranscript) {
                    console.log('Web Speech API - Interim:', interimTranscript);
                    this.handleInterimResult(interimTranscript);
                }
            };

            this.recognition.onend = () => {
                console.log('Web Speech API: Recognition ended');
                if (this.isListening) {
                    // Auto-restart for continuous listening
                    setTimeout(() => {
                        if (this.isListening) {
                            this.recognition.start();
                        }
                    }, 100);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Web Speech API Error:', event.error);
                this.handleError(event.error);
            };
        }
    }

    // 2. MediaRecorder API (Audio Recording)
    async initializeMediaRecorder() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.mediaStream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    // Send audio chunk to server for processing
                    this.sendAudioChunk(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.processAudioBlob(audioBlob);
            };
        } catch (error) {
            console.error('MediaRecorder initialization failed:', error);
        }
    }

    // 3. WebRTC (Real-time Communication)
    initializeWebRTC() {
        // WebRTC implementation for real-time audio streaming
        this.peerConnection = null;
        this.dataChannel = null;
    }

    // Technology Selection
    setTechnology(tech) {
        this.technology = tech;
        console.log('Switched to technology:', tech);
        this.updateStatus(`Using: ${tech.toUpperCase()}`);
    }

    // Start Voice Input
    async startListening(tech = 'webspeech', language = 'auto') {
        this.technology = tech;
        this.isListening = true;
        this.currentLanguage = language;

        switch (tech) {
            case 'webspeech':
                await this.startWebSpeech(language);
                break;
            case 'mediarecorder':
                await this.startMediaRecorder();
                break;
            case 'webrtc':
                await this.startWebRTC();
                break;
            default:
                console.error('Unknown technology:', tech);
        }
    }

    // Stop Voice Input
    stopListening() {
        this.isListening = false;

        switch (this.technology) {
            case 'webspeech':
                if (this.recognition) {
                    this.recognition.stop();
                }
                break;
            case 'mediarecorder':
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
                break;
            case 'webrtc':
                this.stopWebRTC();
                break;
        }

        this.updateStatus('Voice input stopped');
    }

    // Web Speech Implementation
    async startWebSpeech(language = 'auto') {
        if (!this.recognition) {
            throw new Error('Web Speech API not supported');
        }

        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Set language for recognition
            if (language !== 'auto') {
                this.recognition.lang = language;
            }
            
            this.recognition.start();
            console.log('Web Speech started with language:', language);
        } catch (error) {
            console.error('Web Speech start error:', error);
            throw error;
        }
    }

    // MediaRecorder Implementation
    async startMediaRecorder() {
        if (!this.mediaRecorder) {
            throw new Error('MediaRecorder not initialized');
        }

        try {
            this.audioChunks = [];
            this.mediaRecorder.start(1000); // Record in 1-second chunks
            console.log('MediaRecorder: Started recording');
        } catch (error) {
            console.error('MediaRecorder start error:', error);
            throw error;
        }
    }

    // WebRTC Implementation
    async startWebRTC() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.peerConnection = new RTCPeerConnection();
            
            // Add audio track
            this.mediaStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.mediaStream);
            });

            // Create data channel for audio data
            this.dataChannel = this.peerConnection.createDataChannel('audio');
            this.dataChannel.onopen = () => {
                console.log('WebRTC: Data channel opened');
            };

            console.log('WebRTC: Started streaming');
        } catch (error) {
            console.error('WebRTC start error:', error);
            throw error;
        }
    }

    stopWebRTC() {
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
    }

    // Audio Processing
    sendAudioChunk(audioData) {
        // Send audio chunk to server for processing
        if (this.socket) {
            this.socket.emit('audio-chunk', {
                audio: audioData,
                timestamp: Date.now(),
                technology: this.technology
            });
        }
    }

    async processAudioBlob(audioBlob) {
        // Process complete audio blob
        console.log('Processing audio blob:', audioBlob.size, 'bytes');
        
        // Convert to base64 for server processing
        const reader = new FileReader();
        reader.onload = () => {
            const base64Audio = reader.result.split(',')[1];
            this.sendAudioToServer(base64Audio);
        };
        reader.readAsDataURL(audioBlob);
    }

    sendAudioToServer(base64Audio) {
        // Send audio to server for speech recognition
        fetch('/api/transcribe-audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audio: base64Audio,
                language: 'en-US',
                technology: this.technology
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.transcript) {
                this.handleFinalResult(data.transcript);
            }
        })
        .catch(error => {
            console.error('Audio processing error:', error);
        });
    }

    // Result Handling
    handleFinalResult(text) {
        console.log('Final result:', text);
        this.updateTextInput(text);
        this.triggerTranslation(text);
    }

    handleInterimResult(text) {
        console.log('Interim result:', text);
        this.updateInterimDisplay(text);
    }

    handleError(error) {
        console.error('Voice input error:', error);
        this.updateStatus(`Error: ${error}`);
        
        if (error === 'no-speech' && this.isListening) {
            // Continue listening for no-speech errors
            setTimeout(() => {
                if (this.isListening && this.recognition) {
                    this.recognition.start();
                }
            }, 1000);
        }
    }

    // UI Updates
    updateTextInput(text) {
        const textInput = document.getElementById('text-input');
        if (textInput) {
            textInput.value = textInput.value + (textInput.value ? ' ' : '') + text;
        }
    }

    updateInterimDisplay(text) {
        let display = document.getElementById('interim-voice-display');
        if (!display) {
            display = document.createElement('div');
            display.id = 'interim-voice-display';
            display.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: #00ff00;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                z-index: 1000;
            `;
            document.body.appendChild(display);
        }
        display.textContent = `Listening: ${text}`;
    }

    updateStatus(message) {
        console.log('Status:', message);
        // Update status in UI
        const statusElement = document.getElementById('voice-status-text');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    triggerTranslation(text) {
        // Trigger translation for the text
        if (window.realTimeTranslation) {
            window.realTimeTranslation.handleTextInput(text);
        }
    }

    // Public API
    getSupportedTechnologies() {
        const technologies = [];
        
        if (window.SpeechRecognition || window.webkitSpeechRecognition) {
            technologies.push('webspeech');
        }
        
        if (window.MediaRecorder) {
            technologies.push('mediarecorder');
        }
        
        if (window.RTCPeerConnection) {
            technologies.push('webrtc');
        }
        
        return technologies;
    }

    getTechnologyInfo() {
        return {
            webspeech: {
                name: 'Web Speech API',
                description: 'Browser native speech recognition',
                continuous: true,
                realtime: true,
                serverRequired: false
            },
            mediarecorder: {
                name: 'MediaRecorder API',
                description: 'Audio recording with server processing',
                continuous: true,
                realtime: false,
                serverRequired: true
            },
            webrtc: {
                name: 'WebRTC',
                description: 'Real-time audio streaming',
                continuous: true,
                realtime: true,
                serverRequired: true
            }
        };
    }
}

// Export for use
window.AdvancedVoiceInput = AdvancedVoiceInput;
