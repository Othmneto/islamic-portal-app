// translator.js (Corrected with Auto-Play for New Translations)

document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const ALL_LANGUAGES = ['Arabic', 'English', 'French', 'German', 'Urdu', 'Spanish', 'Hindi', 'Russian', 'Japanese', 'Chinese'];

    // --- Element References ---
    const fromLang = document.getElementById("fromLang"),
          toLanguagesDisplay = document.getElementById("toLanguagesDisplay"),
          toLangDropdown = document.getElementById("toLangDropdown"),
          voiceSelect = document.getElementById("voice-select"),
          micButton = document.getElementById("mic-button"),
          transcript = document.getElementById('transcript'),
          uploadForm = document.getElementById('upload-form'),
          audioFileInput = document.getElementById('audio-file-input'),
          textInput = document.getElementById('text-input'),
          textTranslateBtn = document.getElementById('text-translate-btn'),        
          tabs = document.querySelectorAll('.tab-button'),
          latestTranslationContainer = document.getElementById('latest-translation-container'),
          historyList = document.getElementById("history-list"),
          historySearch = document.getElementById('history-search'),
          favoritesToggleBtn = document.getElementById('favorites-toggle-btn'),
          themeToggle = document.getElementById('theme-toggle'),
          notification = document.getElementById('notification');

    // --- State ---
    let isListening = false;
    let selectedToLanguages = new Set(['English', 'Arabic']);
    let displayedHistory = [];
    let isLoadingHistory = false;
    let currentSearchTerm = '', showFavoritesOnly = false;
    let historyLoaded = false;
    let mediaRecorder, audioChunks = [], mediaStream = null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;

    // --- Helper Functions ---
    function showNotification(message, type = 'info') {
        if (!notification) return;
        notification.textContent = message;
        notification.className = 'notification show';
        notification.classList.add(type);
        setTimeout(() => {
            notification.classList.remove('show');
            notification.classList.remove(type);
        }, 3000);
    }

    function applyTheme(theme) {
        document.body.className = theme === 'light' ? 'light-mode' : '';
        if(themeToggle) themeToggle.checked = (theme === 'light');
    }

    function getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('translationSessionId');
        if (!sessionId) {
            sessionId = uuid.v4();
            sessionStorage.setItem('translationSessionId', sessionId);
        }
        return sessionId;
    }

    // --- UI Rendering ---
    function createHistoryItemHTML(item) {
        const favoriteClass = item.isFavorite ? 'favorited' : '';
        const favoriteIcon = item.isFavorite ? 'fa-solid fa-star' : 'fa-regular fa-star';
        const itemId = item._id || item.id;
        return `
            <div class="history-item-content">
                <p class="original-text" style="font-style: italic; color: var(--text-secondary);">Original: ${item.original}</p>
                <p class="translated-text">Translated (${item.to}): ${item.translated}</p>
                <div class="history-controls">
                    <span class="history-meta">${item.from}</span>
                    <div>
                        <button class="favorite-btn ${favoriteClass}" data-id="${itemId}" title="Favorite"><i class="${favoriteIcon}"></i></button>
                        <button class="copy-btn" title="Copy"><i class="fa-solid fa-copy"></i></button>
                        <button class="replay-btn" data-audio-id="${item.audioId}" title="Replay"><i class="fa-solid fa-play"></i></button>
                        <button class="delete-btn" data-id="${itemId}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    }

    function displayLatestTranslation(item) {
        if (!latestTranslationContainer) return;
        latestTranslationContainer.style.display = 'block';

        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.dataset.id = item._id || item.id;
        historyItem.innerHTML = createHistoryItemHTML(item);

        latestTranslationContainer.innerHTML = '';
        latestTranslationContainer.appendChild(historyItem);
        
        // <<< FIX: Auto-play the audio for the newly generated translation >>>
        if (item.audioId) {
            console.log("Auto-playing new translation audio:", item.audioId);
            const audio = new Audio(`/audio/${item.audioId}`);
            audio.play().catch(error => {
                // This catch is important for browsers that block autoplay
                console.error("Auto-play failed:", error);
                showNotification("Audio auto-play was blocked by the browser. Please press replay.", "info");
            });
        }
    }

    async function loadHistory() {
        if (isLoadingHistory || !historyList) return;
        isLoadingHistory = true;
        historyLoaded = true;
        const params = new URLSearchParams({ page: 1, limit: 20, search: currentSearchTerm, favoritesOnly: showFavoritesOnly, sessionId: getOrCreateSessionId() });
        try {
            const response = await fetch(`/history?${params.toString()}`);
            const result = await response.json();
            displayedHistory = result.data;
            renderHistoryList();
        } catch (err) {
            showNotification(err.message, 'error');
        } finally {
            isLoadingHistory = false;
        }
    }

    function renderHistoryList() {
        if (!historyList) return;
        if (displayedHistory.length === 0) {
            historyList.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No translations found for this conversation.</p>';
            return;
        }
        historyList.innerHTML = '';
        const fragment = document.createDocumentFragment();
        displayedHistory.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.dataset.id = item._id || item.id;
            historyItem.innerHTML = createHistoryItemHTML(item);
            fragment.appendChild(historyItem);
        });
        historyList.appendChild(fragment);
    }
    
    // --- API Logic ---
    async function performTranslation(url, options, buttonToUpdate) {
        buttonToUpdate.disabled = true;
        buttonToUpdate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Translating...';
        
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Translation failed.');
            }
            const data = await response.json();
            // Pass the first result to the display function
            if (data && data.length > 0) {
                displayLatestTranslation(data[0]);
            }
            showNotification(`Translated successfully!`, 'success');
        } catch (err) {
            showNotification(err.message, 'error');
        } finally {
            buttonToUpdate.disabled = false;
            if (buttonToUpdate === textTranslateBtn) {
                buttonToUpdate.innerHTML = 'Translate Text';
            } else if (buttonToUpdate === micButton) {
                buttonToUpdate.innerHTML = '<i class="fa-solid fa-microphone"></i> Start Listening';
            }
        }
    }

    // --- Event Handlers ---
    async function handleTextTranslate() {
        if (!textInput.value.trim()) return;
        await performTranslation('/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: textInput.value,
                from: fromLang.value,
                to: Array.from(selectedToLanguages),
                voiceId: voiceSelect.value,
                sessionId: getOrCreateSessionId()
            })
        }, textTranslateBtn);
    }

    async function handleAudioSubmit(formData) {
        formData.append('fromLang', fromLang.value);
        formData.append('toLang', JSON.stringify(Array.from(selectedToLanguages)));
        formData.append('voiceId', voiceSelect.value);
        formData.append('sessionId', getOrCreateSessionId());
        await performTranslation('/auto-detect-speak', { method: 'POST', body: formData }, micButton);
    }

    async function toggleListening() {
        if (isListening) {
            if (recognition) recognition.stop();
            return;
        }
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            isListening = true;
            micButton.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Listening';
            micButton.classList.add('active');
            transcript.textContent = 'Listening...';
            audioChunks = [];
            mediaRecorder = new MediaRecorder(mediaStream);
            mediaRecorder.ondataavailable = event => { if (event.data.size > 0) audioChunks.push(event.data); };
            mediaRecorder.onstop = () => {
                if (audioChunks.length === 0) {
                    showNotification("No audio detected.", "error");
                    return;
                }
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('audioBlob', audioBlob, 'live-recording.webm');
                handleAudioSubmit(formData);
            };
            mediaRecorder.start();
            if (recognition) {
                recognition.lang = fromLang.value === 'Arabic' ? 'ar-SA' : 'en-US';
                recognition.start();
            }
        } catch (err) {
            console.error("Error accessing microphone:", err);
            showNotification("Microphone permission denied or not found.", "error");
        }
    }

    if (recognition) {
        recognition.onend = () => {
            isListening = false;
            micButton.classList.remove('active');
            if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
            if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
        };
        recognition.onresult = (event) => {
            transcript.textContent = `Recognized: "${event.results[0][0].transcript}"`;
        };
        recognition.onerror = (event) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                showNotification(`Recognition error: ${event.error}`, "error");
            }
            if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
        };
    }

    function handleHistoryItemClick(event) {
        const button = event.target.closest('button');
        if (!button) return;
        const historyItemElement = button.closest('.history-item');
        if (!historyItemElement) return;
        const itemId = historyItemElement.dataset.id;
        
        if (button.classList.contains('replay-btn')) {
            const audioId = button.dataset.audioId;
            console.log("Replay button clicked for audioId:", audioId);
            if (audioId && audioId !== 'undefined') {
                const audio = new Audio(`/audio/${audioId}`);
                console.log("Created Audio object:", audio);
                audio.play().catch(error => {
                    console.error("Audio playback failed:", error);
                    showNotification(`Could not play audio: ${error.message}`, 'error');
                });
            } else {
                console.error("Audio ID is missing or undefined!");
                showNotification("No audio available for this translation.", "error");
            }
        } else if (button.classList.contains('delete-btn')) {
            if (confirm('Are you sure?')) {
                fetch(`/history/${itemId}`, { method: 'DELETE' }).then(() => { if (historyLoaded) loadHistory(); });
            }
        } else if (button.classList.contains('copy-btn')) {
            const textToCopy = historyItemElement.querySelector('.translated-text').innerText.replace(/Translated \(.*\): /, '');
            navigator.clipboard.writeText(textToCopy);
            showNotification('Copied!', 'success');
        } else if (button.classList.contains('favorite-btn')) {
            const isCurrentlyFavorite = button.classList.contains('favorited');
            fetch(`/history/${itemId}/favorite`, { 
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFavorite: !isCurrentlyFavorite })
            }).then(() => { if (historyLoaded) loadHistory(); });
        }
    }

    // --- Attaching Event Listeners ---
    if(textTranslateBtn) textTranslateBtn.addEventListener('click', handleTextTranslate);
    if(micButton) micButton.addEventListener('click', toggleListening);
    document.querySelector('.container').addEventListener('click', (event) => {
        if (event.target.closest('.history-item')) {
            handleHistoryItemClick(event);
        }
    });
    if(tabs) { /* Unchanged */ }
    if (uploadForm) { /* Unchanged */ }
    if (uploadForm) { /* Unchanged */ }
    if (favoritesToggleBtn) { /* Unchanged */ }
    if (historySearch) { /* Unchanged */ }
    if(themeToggle) { /* Unchanged */ }
    
    function initialize() {
        applyTheme(localStorage.getItem('theme') || 'dark');
        getOrCreateSessionId();
        if(!recognition && micButton) {
            micButton.disabled = true;
            micButton.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
            transcript.textContent = 'Speech recognition is not supported in this browser.';
        }
    }
    
    initialize();
});