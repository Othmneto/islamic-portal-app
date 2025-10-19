document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const historyList = document.getElementById("history-list"),
          historySearch = document.getElementById('history-search'),
          exportCsvBtn = document.getElementById('export-csv-btn'),
          exportPdfBtn = document.getElementById('export-pdf-btn'),
          favoritesToggleBtn = document.getElementById('favorites-toggle-btn'),
          selectAllCheckbox = document.getElementById('select-all-checkbox'),
          bulkActionsHeader = document.getElementById('bulk-actions-header'),
          bulkDeleteBtn = document.getElementById('bulk-delete-btn'),
          bulkFavoriteBtn = document.getElementById('bulk-favorite-btn'),
          selectedCount = document.getElementById('selected-count'),
          languageSelectionModal = document.getElementById('languageSelectionModal');

    // --- State ---
    let displayedHistory = [], selectedItems = new Set();
    let currentPage = 1, totalHistoryItems = 0, isLoadingHistory = false;
    let currentSearchTerm = '', showFavoritesOnly = false;
    let searchDebounceTimeout;

    // --- Core History Functions ---
    async function loadHistory(page = 1, append = false) {
        if (isLoadingHistory) return;
        isLoadingHistory = true;

        if (!append) {
            displayedHistory = [];
            selectedItems.clear();
        }

        const params = new URLSearchParams({ page, limit: 10, search: currentSearchTerm, favoritesOnly: showFavoritesOnly });
        try {
            const response = await fetch(`/history?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch history.');
            const result = await response.json();

            const newItems = result.data;
            if (append) {
                displayedHistory.push(...newItems);
            } else {
                displayedHistory = newItems;
            }
            totalHistoryItems = result.total;
            currentPage = result.page;

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
            historyList.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No translations found.</p>';
            return;
        }

        historyList.innerHTML = '';
        let lastDate = null;
        const fragment = document.createDocumentFragment();

        displayedHistory.forEach(item => {
            const itemDate = new Date(item.timestamp).toDateString();
            if (itemDate !== lastDate) {
                const dateHeader = document.createElement('div');
                dateHeader.className = 'history-date-header';
                dateHeader.textContent = formatDateHeader(new Date(item.timestamp));
                fragment.appendChild(dateHeader);
                lastDate = itemDate;
            }
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.dataset.id = item.id;
            historyItem.innerHTML = createHistoryItemHTML(item);
            fragment.appendChild(historyItem);
        });
        historyList.appendChild(fragment);
    }

    function createHistoryItemHTML(item) {
        const favoriteClass = item.isFavorite ? 'favorited' : '';
        const favoriteIcon = item.isFavorite ? 'fa-solid fa-star' : 'fa-regular fa-star';
        return `
            <input type="checkbox" class="history-item-checkbox" data-id="${item.id}" ${selectedItems.has(item.id) ? 'checked' : ''}>
            <div class="history-item-content">
                <p class="original-text" style="font-style: italic; color: var(--text-secondary);">Original: ${item.original}</p>
                <p class="translated-text">Translated (${item.to}): ${item.translated}</p>
                <div class="history-controls">
                    <span class="history-meta">${item.from}</span>
                    <div>
                        <button class="favorite-btn ${favoriteClass}" data-id="${item.id}" title="Favorite"><i class="${favoriteIcon}"></i></button>
                        <button class="edit-btn" data-id="${item.id}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                        <button class="copy-btn" data-id="${item.id}" title="Copy"><i class="fa-solid fa-copy"></i></button>
                        <button class="replay-btn" data-id="${item.id}" data-audio-id="${item.audioId}" title="Replay"><i class="fa-solid fa-play"></i></button>
                        <button class="delete-btn" data-id="${item.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>`;
    }

    function formatDateHeader(date) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // --- Event Handlers ---
    historyList.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const historyItemElement = event.target.closest('.history-item');
        const itemId = historyItemElement.dataset.id;
        const item = displayedHistory.find(i => i.id === itemId) || {};

        if (button.classList.contains('delete-btn')) {
            if (confirm('Are you sure?')) {
                fetch(`/history/${itemId}`, { method: 'DELETE' }).then(res => {
                    if (res.ok) {
                        showNotification('Deleted.', 'success');
                        historyItemElement.remove();
                        displayedHistory = displayedHistory.filter(i => i.id !== itemId);
                    }
                });
            }
        } else if (button.classList.contains('replay-btn')) {
            new Audio(`/audio/${item.audioId}`).play();
        } else if (button.classList.contains('copy-btn')) {
            navigator.clipboard.writeText(item.translated);
            showNotification('Copied to clipboard!', 'success');
        } else if (button.classList.contains('edit-btn')) {
            // Redirect to the main page to edit
            window.location.href = `/index.html?text=${encodeURIComponent(item.original)}`;
        } else if (button.classList.contains('favorite-btn')) {
            fetch(`/history/${itemId}/favorite`, { method: 'PATCH' })
                .then(res => res.json())
                .then(updatedItem => {
                    const icon = button.querySelector('i');
                    button.classList.toggle('favorited', updatedItem.isFavorite);
                    icon.classList.toggle('fa-solid', updatedItem.isFavorite);
                    icon.classList.toggle('fa-regular', !updatedItem.isFavorite);

                    // Update the item in the local array
                    const localItem = displayedHistory.find(i => i.id === itemId);
                    if (localItem) {
                        localItem.isFavorite = updatedItem.isFavorite;
                    }

                    // If we're in favorites-only mode and it's no longer a favorite, remove it
                    if (showFavoritesOnly && !updatedItem.isFavorite) {
                        historyItemElement.remove();
                    }
                });
        }
    });

    favoritesToggleBtn.addEventListener('click', () => {
        showFavoritesOnly = !showFavoritesOnly;
        favoritesToggleBtn.classList.toggle('active', showFavoritesOnly);
        favoritesToggleBtn.style.color = showFavoritesOnly ? 'var(--favorite-color)' : 'var(--text-secondary)';
        loadHistory(1);
    });

    historySearch.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            currentSearchTerm = e.target.value;
            loadHistory(1);
        }, 300);
    });

    // --- Initial Load ---
    function initialize() {
        if (typeof applyTheme === 'function') {
            applyTheme(localStorage.getItem('theme') || 'dark');
        }
        loadHistory(1);
    }

    initialize();
});
