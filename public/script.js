// script.js (Final Version with Infinite Scroll and Multi-language Output)

// XSS protection function
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const fromLang = document.getElementById("fromLang"),
          // toLang is no longer a direct <select> but managed via display/dropdown
          toLanguagesDisplay = document.getElementById("toLanguagesDisplay"),
          toLangDropdown = document.getElementById("toLangDropdown"),
          voiceSelect = document.getElementById("voice-select"),
          micButton = document.getElementById("mic-button"),
          historyList = document.getElementById("history-list"),
          uploadForm = document.getElementById('upload-form'),
          audioFileInput = document.getElementById('audio-file-input'),
          textInput = document.getElementById('text-input'),
          textTranslateBtn = document.getElementById('text-translate-btn'),
          themeToggle = document.getElementById('theme-toggle'),
          historySearch = document.getElementById('history-search'),
          exportCsvBtn = document.getElementById('export-csv-btn'),
          exportPdfBtn = document.getElementById('export-pdf-btn'),
          notification = document.getElementById('notification'),
          favoritesToggleBtn = document.getElementById('favorites-toggle-btn'),
          historyTitle = document.getElementById('history-title'),
          conversationViewHeader = document.getElementById('conversation-view-header'),
          exitConversationViewBtn = document.getElementById('exit-conversation-view-btn'),
          bulkActionsHeader = document.getElementById('bulk-actions-header'),
          selectAllCheckbox = document.getElementById('select-all-checkbox'),
          selectedCount = document.getElementById('selected-count'),
          bulkFavoriteBtn = document.getElementById('bulk-favorite-btn'),
          bulkDeleteBtn = document.getElementById('bulk-delete-btn'),
          tabs = document.querySelectorAll('.tab-button');

    // --- Modal Elements ---
    const languageSelectionModal = document.getElementById('languageSelectionModal'),
          modalOriginalText = document.getElementById('modalOriginalText'),
          modalLanguageOptions = document.getElementById('modalLanguageOptions'),
          closeModalBtn = languageSelectionModal.querySelector('.close-modal'),
          applyTranslationBtn = languageSelectionModal.querySelector('.apply-translation');

    // --- State & Setup ---
    let isListening = false, final_transcript = '';
    let mediaRecorder, audioChunks = [];
    let displayedHistory = [];
    let selectedItems = new Set();
    let currentPage = 1, totalHistoryItems = 0, isLoadingHistory = false;
    let currentSearchTerm = '', showFavoritesOnly = false, conversationViewSessionId = null;
    let searchDebounceTimeout;
    // New: Storing selected target languages for main translation input
    let selectedToLanguages = new Set(['English', 'Arabic']); // Default selections
    const allLanguages = ['Arabic', 'English', 'French', 'German', 'Urdu', 'Spanish', 'Hindi', 'Russian', 'Japanese', 'Chinese'];
    // New: State for the re-translation modal
    let currentOriginalTextForModal = '';
    let currentOriginalLangForModal = ''; // New: Store original language for the modal
    let currentSessionIdForModal = '';


    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;
    if (recognition) {
        recognition.interimResults = true;
        recognition.continuous = true;
    }

    // --- Helper Functions ---

    function formatDateHeader(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        date.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        yesterday.setHours(0, 0, 0, 0);

        if (date.getTime() === today.getTime()) return 'Today';
        if (date.getTime() === yesterday.getTime()) return 'Yesterday';
        return new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(dateString));
    }

    function showNotification(message, type = 'info', duration = 3000) {
        notification.textContent = message;
        notification.className = '';
        notification.classList.add('show', type);
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    }

    function getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('translationSessionId');
        if (!sessionId) {
            sessionId = uuid.v4();
            sessionStorage.setItem('translationSessionId', sessionId);
        }
        return sessionId;
    }

    // New: Render the selected languages in the display div
    function renderToLanguagesDisplay() {
        toLanguagesDisplay.innerHTML = ''; // Clear current display
        if (selectedToLanguages.size === 0) {
            toLanguagesDisplay.textContent = 'Select target language(s)';
            toLanguagesDisplay.classList.add('placeholder');
        } else {
            toLanguagesDisplay.classList.remove('placeholder');
            selectedToLanguages.forEach(lang => {
                const tag = document.createElement('span');
                tag.className = 'language-tag';
                tag.innerHTML = escapeHtml(lang) + ' <button type="button" class="remove-tag" data-lang="' + escapeHtml(lang) + '">&times;</button>';
                toLanguagesDisplay.appendChild(tag);
            });
        }
    }

    // New: Populate and manage the target language dropdown
    function populateToLangDropdown() {
        toLangDropdown.innerHTML = '';
        allLanguages.forEach(lang => {
            const label = document.createElement('label');
            label.innerHTML = '<input type="checkbox" value="' + escapeHtml(lang) + '" ' + (selectedToLanguages.has(lang) ? 'checked' : '') + '> ' + escapeHtml(lang);
            toLangDropdown.appendChild(label);
        });
    }

    function createHistoryItemHTML(item) {
        const isChecked = selectedItems.has(item.id) ? 'checked' : '';
        const contextIcon = (item.context && item.context.trim().length > 0)
            ? `<i class="fa-solid fa-brain" title="Translated using semantic context"></i>`
            : '';
        const favoriteClass = item.isFavorite ? 'favorited' : '';
        const favoriteIcon = item.isFavorite ? 'fa-solid fa-star' : 'fa-regular fa-star';
        const conversationButton = item.sessionId
            ? `<button class="conversation-view-btn" data-session-id="${item.sessionId}" title="View Conversation"><i class="fa-solid fa-comments"></i></button>`
            : ''; // Keep comments icon for conversation view
        let contextHTML = '';
        if (item.context && item.context.trim().length > 0) {
            const contextItems = item.context.split('\n').map(line => `<li>${line}</li>`).join('');
            contextHTML = `<details class="context-panel"><summary>Translated using semantic context</summary><ul>${contextItems}</ul></details>`;
        }
        const replayCount = item.replayCount || 0;
        const replayCountHTML = `<span class="replay-count" id="replay-count-${item.id}">${replayCount}</span>`;
        const translatedTextId = `translated-text-${item.id}`;

        return `
            <input type="checkbox" class="history-item-checkbox" data-id="${item.id}" ${isChecked}>
            <div class="history-item-content">
                <p class="original-text" style="font-style: italic; color: var(--text-secondary);">Original: ${item.original}</p>
                <p id="${translatedTextId}" class="translated-text" style="font-weight: bold;">Translated (${item.to}): ${item.translated}</p>
                ${contextHTML}
                <div class="history-controls">
                    <span class="history-meta">${item.from} ${contextIcon}</span>
                    <div>
                        ${replayCountHTML}
                        ${conversationButton}
                        <button class="translate-other-lang-btn" data-id="${item.id}" data-original-text="${item.original}" data-original-lang="${item.from}" data-session-id="${item.sessionId}" title="Translate to Other Languages"><i class="fa-solid fa-language"></i></button>
                        <button class="favorite-btn ${favoriteClass}" data-id="${item.id}" title="Toggle Favorite">
                            <i class="${favoriteIcon}"></i>
                        </button>
                        <button class="edit-btn" data-id="${item.id}" title="Edit and Retranslate"><i class="fa-solid fa-pencil"></i></button>
                        <button class="copy-btn" data-target-id="${translatedTextId}" title="Copy"><i class="fa-solid fa-copy"></i></button>
                        <button class="replay-btn" data-id="${item.id}" data-audio-id="${item.audioId}" title="Replay"><i class="fa-solid fa-play"></i></button>
                        <button class="delete-btn" data-id="${item.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    }

    function updateBulkActionsUI() {
        const count = selectedItems.size;
        if (count > 0) {
            bulkActionsHeader.style.display = 'flex';
            selectedCount.textContent = `${count} item${count > 1 ? 's' : ''} selected`;
        } else {
            bulkActionsHeader.style.display = 'none';
        }
        selectAllCheckbox.checked = count > 0 && displayedHistory.length > 0 && count === displayedHistory.length;
    }

    function showSkeletonLoader(show) {
        if (show) {
            historyList.innerHTML = '';
            for (let i = 0; i < 4; i++) {
                const skeletonItem = document.createElement('div');
                skeletonItem.className = 'history-item skeleton';
                skeletonItem.innerHTML = `
                    <div class="history-item-content" style="width:100%">
                        <div class="skeleton-text" style="width: 80%;"></div>
                        <div class="skeleton-text" style="width: 60%; font-weight: bold;"></div>
                        <div class="history-controls" style="margin-top: 15px;">
                            <div class="skeleton-text" style="width: 40%; height: 20px;"></div>
                        </div>
                    </div>
                `;
                historyList.appendChild(skeletonItem);
            }
        }
    }

    // --- Infinite Scroll Setup ---
    const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !isLoadingHistory && displayedHistory.length < totalHistoryItems) {
            loadHistory(currentPage + 1, true); // Load next page and append
        }
    }, { threshold: 1.0 });

    function renderHistory() {
        // Stop observing the old last element before we replace the list's content
        const lastItem = historyList.lastElementChild;
        if (lastItem) {
            observer.unobserve(lastItem);
        }

        const fragment = document.createDocumentFragment();
        if (displayedHistory.length === 0) {
            historyList.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No results found.</p>';
            updateBulkActionsUI();
            return;
        }

        let lastDate = null;
        displayedHistory.forEach(item => {
            const itemDate = new Date(item.timestamp).toDateString();
            if (itemDate !== lastDate) {
                const dateHeader = document.createElement('div');
                dateHeader.className = 'history-date-header';
                dateHeader.textContent = formatDateHeader(item.timestamp);
                fragment.appendChild(dateHeader);
                lastDate = itemDate;
            }
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.dataset.id = item.id;
            historyItem.innerHTML = createHistoryItemHTML(item);
            fragment.appendChild(historyItem);
        });

        historyList.innerHTML = ''; // Clear list before appending new fragment
        historyList.appendChild(fragment);

        // Start observing the new last element for infinite scroll
        const newLastItem = historyList.lastElementChild;
        if (newLastItem) {
            observer.observe(newLastItem);
        }

        updateBulkActionsUI();
    }

    async function loadHistory(page = 1, append = false) {
        if (isLoadingHistory) return;
        isLoadingHistory = true;

        if (!append) {
            displayedHistory = [];
            selectedItems.clear();
            showSkeletonLoader(true);
        }

        const params = new URLSearchParams({ page, limit: 10, search: currentSearchTerm, favoritesOnly: showFavoritesOnly });
        if (conversationViewSessionId) {
            params.append('sessionId', conversationViewSessionId);
        }

        try {
            const response = await fetch(`/history?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch history.');
            const result = await response.json();

            displayedHistory = append ? [...displayedHistory, ...result.data] : result.data;
            renderHistory();

            totalHistoryItems = result.total;
            currentPage = result.page;
        } catch (err) {
            showNotification(err.message, 'error');
            historyList.innerHTML = '<p style="color: var(--danger-color); text-align: center;">' + escapeHtml(err.message) + '</p>';
        } finally {
            isLoadingHistory = false;
        }
    }

    async function processAndDisplayResult(newEntries) { // newEntries is now an array
        if (!currentSearchTerm && !showFavoritesOnly && !conversationViewSessionId) {
            // Add new entries to the beginning of displayed history
            newEntries.reverse().forEach(entry => displayedHistory.unshift(entry));
            renderHistory();
            totalHistoryItems += newEntries.length;

            // Highlight the newly added items and play the first one
            if (newEntries.length > 0) {
                const firstNewEntry = newEntries[0];
                const newItemElement = historyList.querySelector(`[data-id="${firstNewEntry.id}"]`);
                if (newItemElement) {
                    newItemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    newItemElement.classList.add('highlight');
                    setTimeout(() => {
                        newItemElement.classList.remove('highlight');
                    }, 2500);

                    // Auto-play the first new translation
                    const audioSrc = `/audio/${firstNewEntry.audioId}`;
                    new Audio(audioSrc).play();
                }
            }
        }
    }

    async function handleTextTranslate() {
        const text = textInput.value;
        const currentSelectedToLanguages = Array.from(selectedToLanguages); // Convert Set to Array
        if (!text.trim()) {
            showNotification("Please enter some text to translate.", 'error');
            return;
        }
        if (currentSelectedToLanguages.length === 0) {
            showNotification("Please select at least one target language.", 'error');
            return;
        }
        textTranslateBtn.disabled = true;
        try {
            const response = await fetch("/speak", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    from: fromLang.value,
                    to: currentSelectedToLanguages, // Send as an array
                    voiceId: voiceSelect.value,
                    sessionId: getOrCreateSessionId()
                }),
            });
            const results = await response.json(); // Expecting an array
            if (!response.ok) throw new Error(results.error || 'Server error');
            await processAndDisplayResult(results);
        } catch (err) {
            showNotification(err.message, 'error');
        } finally {
            textTranslateBtn.disabled = false;
        }
    }

    async function handleAudioSubmit(formData) {
        const currentSelectedToLanguages = Array.from(selectedToLanguages); // Convert Set to Array
        if (currentSelectedToLanguages.length === 0) {
            showNotification("Please select at least one target language.", 'error');
            return;
        }

        formData.append('toLang', JSON.stringify(currentSelectedToLanguages)); // Send as JSON string
        formData.append('voiceId', voiceSelect.value);
        formData.append('fromLang', fromLang.value);
        formData.append('sessionId', getOrCreateSessionId());

        try {
            const response = await fetch('/auto-detect-speak', { method: 'POST', body: formData });
            const results = await response.json(); // Expecting an array
            if (!response.ok) throw new Error(results.error || 'Server error');
            await processAndDisplayResult(results);
        } catch (err) {
            showNotification(err.message, 'error');
        }
    }


    exitConversationViewBtn.addEventListener('click', () => {
        conversationViewSessionId = null;
        conversationViewHeader.style.display = 'none';
        historyTitle.textContent = 'History';
        loadHistory(1);
    });

    favoritesToggleBtn.addEventListener('click', () => {
        showFavoritesOnly = !showFavoritesOnly;
        favoritesToggleBtn.classList.toggle('active', showFavoritesOnly);
        favoritesToggleBtn.style.borderColor = showFavoritesOnly ? 'var(--favorite-color)' : 'var(--border-color)';
        loadHistory(1);
    });

    historySearch.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            currentSearchTerm = e.target.value;
            loadHistory(1);
        }, 300);
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const visibleCheckboxes = historyList.querySelectorAll('.history-item-checkbox');
        visibleCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const id = checkbox.dataset.id;
            if (isChecked) {
                selectedItems.add(id);
            } else {
                selectedItems.delete(id);
            }
        });
        updateBulkActionsUI();
    });

    bulkDeleteBtn.addEventListener('click', async () => {
        const idsToDelete = Array.from(selectedItems);
        if (idsToDelete.length === 0) return showNotification("No items selected.", "error");

        if (confirm(`Are you sure you want to delete ${idsToDelete.length} item(s)?`)) {
            try {
                const response = await fetch('/history/bulk', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: idsToDelete })
                });
                if (!response.ok) throw new Error((await response.json()).error);
                showNotification("Items deleted successfully.", "success");
                loadHistory(1);
            } catch (err) {
                showNotification(err.message, 'error');
            }
        }
    });

    bulkFavoriteBtn.addEventListener('click', async () => {
        const idsToFavorite = Array.from(selectedItems);
        if (idsToFavorite.length === 0) return showNotification("No items selected.", "error");

        try {
            const response = await fetch('/history/favorites/bulk', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToFavorite, isFavorite: true })
            });
            if (!response.ok) throw new Error((await response.json()).error);
            showNotification("Items added to favorites.", "success");
            loadHistory(currentPage);
        } catch (err) {
            showNotification(err.message, 'error');
        }
    });

    historyList.addEventListener('click', async (event) => {
        const target = event.target;

        if (target.classList.contains('history-item-checkbox')) {
            const id = target.dataset.id;
            if (target.checked) {
                selectedItems.add(id);
            } else {
                selectedItems.delete(id);
            }
            updateBulkActionsUI();
            return;
        }

        const button = target.closest('button');
        if (!button) return;

        const historyItemElement = button.closest('.history-item');
        const itemId = historyItemElement.dataset.id;

        if (button.classList.contains('conversation-view-btn')) {
            conversationViewSessionId = button.dataset.sessionId;
            historyTitle.textContent = 'Conversation History';
            conversationViewHeader.style.display = 'flex';
            loadHistory(1);
        } else if (button.classList.contains('edit-btn')) {
            const originalText = historyItemElement.querySelector('.original-text').innerText.replace('Original: ', ''); // Remove "Original: " prefix
            textInput.value = originalText;
            document.querySelectorAll('.tab-button, .tab-panel').forEach(el => el.classList.remove('active'));
            document.querySelector('.tab-button[data-tab="written-text-panel"]').classList.add('active');
            document.getElementById('written-text-panel').classList.add('active');
            textInput.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (button.classList.contains('favorite-btn')) {
             try {
                const response = await fetch(`/history/${itemId}/favorite`, { method: 'PATCH' });
                const updatedItem = await response.json();
                if (!response.ok) throw new Error(updatedItem.error);

                const itemInHistory = displayedHistory.find(item => item.id === itemId);
                if (itemInHistory) itemInHistory.isFavorite = updatedItem.isFavorite;

                const icon = button.querySelector('i');
                icon.classList.add('popping');
                icon.addEventListener('animationend', () => icon.classList.remove('popping'), { once: true });

                button.classList.toggle('favorited', updatedItem.isFavorite);
                icon.classList.toggle('fa-solid', updatedItem.isFavorite);
                icon.classList.toggle('fa-regular', !updatedItem.isFavorite);

                if (showFavoritesOnly && !updatedItem.isFavorite) {
                    historyItemElement.remove();
                }
            } catch(err) {
                showNotification(err.message, 'error');
            }
        } else if (button.classList.contains('copy-btn')) {
            const textToCopy = historyItemElement.querySelector('.translated-text').innerText.replace(/Translated \(.*\): /, ''); // Remove "Translated (Lang): " prefix
            const icon = button.querySelector('i');
            try {
                await navigator.clipboard.writeText(textToCopy);

                const originalIconClass = icon.className;
                button.disabled = true;
                icon.className = 'fa-solid fa-check';
                showNotification('Translated text copied!', 'success');

                setTimeout(() => {
                    icon.className = originalIconClass;
                    button.disabled = false;
                }, 1500);

            } catch (err) {
                showNotification('Failed to copy text.', 'error');
            }
        } else if (button.classList.contains('replay-btn')) {
            button.disabled = true;
            const audioSrc = `/audio/${button.dataset.audioId}`;
            new Audio(audioSrc).play().finally(() => button.disabled = false);

            fetch(`/history/${itemId}/replay`, { method: 'POST' })
                .then(response => response.json())
                .then(updatedItem => {
                    const countElement = document.getElementById(`replay-count-${updatedItem.id}`);
                    if (countElement) countElement.textContent = updatedItem.replayCount;
                });
        } else if (button.classList.contains('delete-btn')) {
             if (confirm('Are you sure you want to delete this translation?')) {
                try {
                    const response = await fetch(`/history/${itemId}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error((await response.json()).error);

                    displayedHistory = displayedHistory.filter(item => item.id !== itemId);
                    renderHistory();

                    showNotification('Translation deleted.', 'success');
                    totalHistoryItems--;

                } catch (err) {
                    showNotification(err.message, 'error');
                }
            }
        } else if (button.classList.contains('translate-other-lang-btn')) {
            const item = displayedHistory.find(dItem => dItem.id === itemId);
            if (item) {
                currentOriginalTextForModal = item.original;
                currentOriginalLangForModal = item.from; // Store original language
                currentSessionIdForModal = item.sessionId;
                openLanguageSelectionModal(item.original, item.from); // Pass original text and original language
            }
        }
    });

    micButton.addEventListener('click', toggleListening);
    textTranslateBtn.addEventListener('click', handleTextTranslate);
    uploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const file = audioFileInput.files[0];
        if (!file) { showNotification("Please select an audio file.", "error"); return; }
        const formData = new FormData(uploadForm);
        await handleAudioSubmit(formData);
        uploadForm.reset();
    });
    themeToggle.addEventListener('change', () => { const newTheme = themeToggle.checked ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); });
    exportCsvBtn.addEventListener('click', () => { window.location.href = '/export/csv'; });
    exportPdfBtn.addEventListener('click', () => { window.location.href = '/export/pdf'; });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    function applyTheme(theme) {
        if (theme === 'light') { document.body.classList.add('light-mode'); themeToggle.checked = true; }
        else { document.body.classList.remove('light-mode'); themeToggle.checked = false; }
    }

    async function toggleListening() {
        if (isListening) {
            if (recognition) recognition.stop();
            if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
            isListening = false;
        } else {
            const currentSelectedToLanguages = Array.from(selectedToLanguages); // Convert Set to Array
            if (currentSelectedToLanguages.length === 0) {
                showNotification("Please select at least one target language for audio translation.", 'error');
                return;
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                showNotification('Your browser does not support audio recording.', 'error'); return;
            }
            try {
                micButton.disabled = true;
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                isListening = true;
                micButton.textContent = "🔴 Stop Listening";
                transcript.textContent = "Listening..."; final_transcript = '';
                if (recognition) {
                    const recognitionLangMap = { 'English': 'en-US', 'Arabic': 'ar-SA', 'French': 'fr-FR', 'German': 'de-DE', 'Urdu': 'ur-PK' };
                    recognition.lang = (fromLang.value !== 'auto' && recognitionLangMap[fromLang.value]) ? recognitionLangMap[fromLang.value] : 'en-US';
                    recognition.start();
                }
                audioChunks = [];
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
                mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    if (audioBlob.size > 0) {
                        const formData = new FormData();
                        formData.append('audioBlob', audioBlob, 'live-recording.webm');
                        handleAudioSubmit(formData);
                    }
                    stream.getTracks().forEach(track => track.stop());
                };
                mediaRecorder.start();
                micButton.disabled = false;
            } catch (err) {
                console.error("Error accessing microphone:", err);
                showNotification("Could not access the microphone. Please grant permission.", 'error');
                isListening = false;
                micButton.textContent = "🔵 Start Listening";
                micButton.disabled = false;
            }
        }
    }
    if (recognition) {
        recognition.onend = () => {
            isListening = false;
            micButton.textContent = "🔵 Start Listening";
            if (mediaRecorder && mediaRecorder.state === "recording") { mediaRecorder.stop(); }
        };
        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            showNotification(`Speech recognition error: ${event.error}`, 'error');
            if (isListening) { toggleListening(); }
        };
        recognition.onresult = (event) => {
            let interim_transcript = '', final_transcript_agg = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) { final_transcript_agg += event.results[i][0].transcript; }
                else { interim_transcript += event.results[i][0].transcript; }
            }
            final_transcript = final_transcript_agg || final_transcript;
            transcript.textContent = "Transcript: " + final_transcript + interim_transcript;
        };
    } else {
        micButton.disabled = true;
        micButton.textContent = "Recognition N/A";
        showNotification("Speech Recognition is not supported in this browser.", "error");
    }

    // --- Main Target Language Selection Logic (for the primary input fields) ---
    toLanguagesDisplay.addEventListener('click', (event) => {
        // Prevent opening dropdown when clicking on a remove-tag button
        if (event.target.classList.contains('remove-tag')) {
            const langToRemove = event.target.dataset.lang;
            selectedToLanguages.delete(langToRemove);
            renderToLanguagesDisplay();
            // Also uncheck the corresponding checkbox in the dropdown if it's open
            const checkbox = toLangDropdown.querySelector(`input[value="${langToRemove}"]`);
            if (checkbox) {
                checkbox.checked = false;
            }
            event.stopPropagation(); // Stop event propagation to prevent dropdown from opening
            return;
        }
        populateToLangDropdown();
        toLangDropdown.style.display = toLangDropdown.style.display === 'block' ? 'none' : 'block';
    });

    toLangDropdown.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            const lang = event.target.value;
            if (event.target.checked) {
                selectedToLanguages.add(lang);
            } else {
                selectedToLanguages.delete(lang);
            }
            renderToLanguagesDisplay(); // Update the displayed tags immediately
        }
    });

    // Close dropdown if clicked outside
    document.addEventListener('click', (event) => {
        if (!toLanguagesDisplay.contains(event.target) && !toLangDropdown.contains(event.target) && toLangDropdown.style.display === 'block') {
            toLangDropdown.style.display = 'none';
        }
    });

    // --- Modal Language Selection Logic ---
    function openLanguageSelectionModal(originalText, originalLang) { // Added originalLang parameter
        modalOriginalText.textContent = `Original: "${originalText}"`;
        modalLanguageOptions.innerHTML = ''; // Clear previous options

        const modalSelectedLanguages = new Set(); // To track selections in the modal

        // Function to update the "Translate" button state
        const updateTranslateButtonState = () => {
            applyTranslationBtn.disabled = modalSelectedLanguages.size === 0;
        };

        allLanguages.forEach(lang => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = lang;

            // Normalize originalLang for comparison (e.g., "Auto-Detect (Arabic)" to "Arabic")
            const normalizedOriginalLang = originalLang.toLowerCase().includes('auto-detect')
                ? originalLang.toLowerCase().replace('auto-detect (', '').replace(')', '')
                : originalLang.toLowerCase();

            // If the language is the same as the original language of the text, disable it
            if (lang.toLowerCase() === normalizedOriginalLang) { // Compare normalized names
                checkbox.disabled = true;
                checkbox.checked = false; // Ensure it's not checked by default
                label.title = `Cannot translate back to original language: ${originalLang}`;
            }

            label.appendChild(checkbox);
            label.append(lang);
            modalLanguageOptions.appendChild(label);

            // Add change listener for checkboxes in the modal
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    modalSelectedLanguages.add(lang);
                } else {
                    modalSelectedLanguages.delete(lang);
                }
                updateTranslateButtonState(); // Update button state on change
            });
        });

        languageSelectionModal.classList.add('active'); // Show modal
        updateTranslateButtonState(); // Initial button state

        // Handle Apply/Translate button click in modal
        applyTranslationBtn.onclick = async () => {
            const languagesToTranslateTo = Array.from(modalSelectedLanguages);
            if (languagesToTranslateTo.length === 0) {
                showNotification("Please select at least one language.", 'error');
                return;
            }
            applyTranslationBtn.disabled = true;
            closeModalBtn.disabled = true;

            try {
                const response = await fetch("/speak", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: currentOriginalTextForModal,
                        from: originalLang, // Use the original language from the history item
                        to: languagesToTranslateTo,
                        voiceId: voiceSelect.value, // Use the globally selected voice
                        sessionId: currentSessionIdForModal // Use the session ID of the original item
                    }),
                });
                const results = await response.json();
                if (!response.ok) throw new Error(results.error || 'Server error');
                showNotification(`Successfully translated to ${languagesToTranslateTo.join(', ')}!`, 'success');
                loadHistory(1); // Reload history to show new entries
                closeLanguageSelectionModal();
            } catch (err) {
                showNotification(err.message, 'error');
            } finally {
                applyTranslationBtn.disabled = false;
                closeModalBtn.disabled = false;
            }
        };

        // Handle Close/Cancel button click in modal
        closeModalBtn.onclick = () => {
            closeLanguageSelectionModal();
        };

        // Close modal if overlay is clicked
        languageSelectionModal.addEventListener('click', (event) => {
            if (event.target === languageSelectionModal) {
                closeLanguageSelectionModal();
            }
        });
    }

    function closeLanguageSelectionModal() {
        languageSelectionModal.classList.remove('active');
        applyTranslationBtn.onclick = null; // Clear event listener to prevent multiple calls
        closeModalBtn.onclick = null; // Clear event listener
        // It's better to manage the overlay click listener dynamically if it causes issues,
        // but for a simple modal, it's often okay to keep it if it's the only one.
    }


    // --- Initial Load ---
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
    getOrCreateSessionId();
    renderToLanguagesDisplay(); // Initial render of selected languages for main input
    loadHistory(1);
});