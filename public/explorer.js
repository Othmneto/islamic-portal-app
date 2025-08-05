document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-content');
    const quranControls = document.getElementById('quran-controls');
    const hadithControls = document.getElementById('hadith-controls');
    const quranContentArea = document.getElementById('quran-content-area');
    const hadithContentArea = document.getElementById('hadith-content-area');
    const bookmarksContentArea = document.getElementById('bookmarks-content-area');
    const surahSelect = document.getElementById('surah-select');
    const hadithCollectionSelect = document.getElementById('hadith-collection-select');
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('explorer-search-input');
    const searchTypeSelect = document.getElementById('search-type-select');
    const qariSelect = document.getElementById('qari-select');
    const recitationPlayer = document.getElementById('recitation-player');
    let currentlyPlayingButton = null;

    // --- State ---
    let userBookmarks = new Set();

    // --- Tab Switching Logic ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const targetPanelId = tab.dataset.tab;
            const targetPanel = document.getElementById(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }

            if (targetPanelId === 'quran-panel') {
                quranControls.style.display = 'flex';
                hadithControls.style.display = 'none';
            } else if (targetPanelId === 'hadith-panel') {
                quranControls.style.display = 'none';
                hadithControls.style.display = 'flex';
            } else {
                quranControls.style.display = 'none';
                hadithControls.style.display = 'none';
            }

            if (targetPanelId === 'bookmarks-panel') {
                loadBookmarks();
            }
        });
    });

    // --- API & Helper Functions ---
    function getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('translationSessionId');
        if (!sessionId) {
            sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            sessionStorage.setItem('translationSessionId', sessionId);
        }
        return sessionId;
    }

    async function apiFetch(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `API Error: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API call failed for ${url}:`, error);
            return [];
        }
    }

    // --- RENDER FUNCTIONS ---
    function renderVerses(verses, container) {
        container.innerHTML = '';
        if (verses.length === 0) {
            container.innerHTML = '<p>No matching items found.</p>';
            return;
        }
        verses.forEach(verse => {
            const verseElement = document.createElement('div');
            verseElement.className = 'verse-item';
            const verseId = verse._id || verse.refId;
            const isBookmarked = userBookmarks.has(verseId);

            const surahId = verse.surah_id || (verseId ? verseId.split(':')[0] : '');
            const verseNum = verse.verse_id || (verseId ? verseId.split(':')[1] : '');
            const arabicText = verse.text_arabic;
            const englishText = verse.translations ? verse.translations.find(t => t.lang === 'en')?.text : verse.text_english;
            const audioUrl = `https://cdn.islamic.network/quran/audio/128/${qariSelect.value}/${verseId}.mp3`;

            let tafsirHTML = '';
            if (verse.tafsirs && verse.tafsirs.length > 0) {
                const firstTafsir = verse.tafsirs[0];
                tafsirHTML = `
                    <details class="tafsir-details">
                        <summary>Show Tafsir (${firstTafsir.author})</summary>
                        <p class="tafsir-text">${firstTafsir.text}</p>
                    </details>
                `;
            }

            verseElement.innerHTML = `
                <p><strong>Verse ${surahId}:${verseNum}</strong></p>
                <p class="verse-arabic">${arabicText}</p>
                <p class="verse-translation">${englishText || ''}</p>
                ${tafsirHTML}
                <div class="verse-controls">
                    <button class="bookmark-btn ${isBookmarked ? 'bookmarked' : ''}" data-ref-id="${verseId}" title="Toggle Bookmark">
                        <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-bookmark"></i>
                    </button>
                    <button class="play-btn" data-audio-url="${audioUrl}" title="Play Recitation">
                        <i class="fa-solid fa-play"></i>
                    </button>
                </div>
            `;
            container.appendChild(verseElement);
        });
    }

    function renderHadiths(hadiths, container) {
        container.innerHTML = '';
        if (hadiths.length === 0) {
            container.innerHTML = '<p>No matching hadiths found.</p>';
            return;
        }
        hadiths.forEach(hadith => {
            const hadithElement = document.createElement('div');
            hadithElement.className = 'hadith-item';

            hadithElement.innerHTML = `
                <p><strong>${hadith.collection_name} - #${hadith.hadith_number}</strong></p>
                <p class="hadith-arabic" style="text-align: right; font-size: 1.2rem;">${hadith.text_arabic || ''}</p>
                <p class="hadith-english" style="font-style: normal;">${hadith.text_english || ''}</p>
                <p class="hadith-explanation" style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 1rem;"><em>${hadith.explanation || ''}</em></p>
            `;
            container.appendChild(hadithElement);
        });
    }

    // --- DATA LOADING FUNCTIONS ---
    async function loadChapters() {
        const chapters = await apiFetch('/api/explorer/quran/chapters');
        surahSelect.innerHTML = '<option value="">Select a Surah</option>';
        chapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter.id;
            option.textContent = `${chapter.id}. ${chapter.name_english} (${chapter.name_arabic})`;
            surahSelect.appendChild(option);
        });
    }

    async function loadHadithCollections() {
        const collections = await apiFetch('/api/explorer/hadith/collections');
        hadithCollectionSelect.innerHTML = '<option value="">Select a Collection</option>';
        collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.id;
            option.textContent = collection.name;
            hadithCollectionSelect.appendChild(option);
        });
    }

    async function loadSurahContent(surahId) {
        if (!surahId) {
            quranContentArea.innerHTML = '';
            return;
        }
        quranContentArea.innerHTML = '<p>Loading verses...</p>';
        const verses = await apiFetch(`/api/explorer/quran/chapter/${surahId}`);
        renderVerses(verses, quranContentArea);
    }

    async function loadHadithContent(collectionId) {
        if (!collectionId) {
            hadithContentArea.innerHTML = '';
            return;
        }
        hadithContentArea.innerHTML = '<p>Loading hadiths...</p>';
        const hadiths = await apiFetch(`/api/explorer/hadith/collection/${collectionId}`);
        renderHadiths(hadiths, hadithContentArea);
    }

    async function performSearch() {
        const query = searchInput.value;
        if (!query) return alert("Please enter a search term.");
        const type = searchTypeSelect.value;
        const source = document.querySelector('.tab-button.active').dataset.tab.includes('hadith') ? 'hadith' : 'quran';
        const contentArea = source === 'quran' ? quranContentArea : hadithContentArea;

        contentArea.innerHTML = `<p>Searching for "${query}"...</p>`;
        const results = await apiFetch(`/api/explorer/search?q=${encodeURIComponent(query)}&type=${type}&source=${source}`);

        if (source === 'quran') {
            renderVerses(results, contentArea);
        } else {
            renderHadiths(results, contentArea);
        }
    }

    async function loadBookmarks() {
        bookmarksContentArea.innerHTML = '<p>Loading bookmarks...</p>';
        const sessionId = getOrCreateSessionId();
        const bookmarks = await apiFetch(`/api/explorer/bookmarks?sessionId=${sessionId}`);
        userBookmarks = new Set(bookmarks.map(b => b.refId));
        if (bookmarks.length === 0) {
            bookmarksContentArea.innerHTML = '<p>You have no saved bookmarks.</p>';
        } else {
            renderVerses(bookmarks, bookmarksContentArea);
        }
    }

    // --- EVENT HANDLERS ---
    async function handleBookmarkClick(button) {
        const verseItem = button.closest('.verse-item');
        const refId = button.dataset.refId;
        const text_arabic = verseItem.querySelector('.verse-arabic').textContent;
        const text_english = verseItem.querySelector('.verse-translation').textContent;

        const response = await apiFetch('/api/explorer/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: getOrCreateSessionId(), type: 'quran', refId, text_arabic, text_english })
        });

        if (response) {
            if (response.bookmarked) {
                userBookmarks.add(refId);
            } else {
                userBookmarks.delete(refId);
            }
            // Re-render the view after a bookmark change to keep icons in sync
            const activeTab = document.querySelector('.tab-button.active').dataset.tab;
            if (activeTab === 'quran-panel' && surahSelect.value) {
                loadSurahContent(surahSelect.value);
            } else if (activeTab === 'bookmarks-panel') {
                loadBookmarks();
            }
        }
    }

    function handlePlayClick(button) {
        const audioUrl = button.dataset.audioUrl;
        const isPlaying = button === currentlyPlayingButton;

        if (currentlyPlayingButton) {
            currentlyPlayingButton.innerHTML = '<i class="fa-solid fa-play"></i>';
            recitationPlayer.pause();
        }

        if (isPlaying) {
            currentlyPlayingButton = null;
        } else {
            recitationPlayer.src = audioUrl;
            recitationPlayer.play();
            button.innerHTML = '<i class="fa-solid fa-pause"></i>';
            currentlyPlayingButton = button;
        }
    }

    // --- ATTACH EVENT LISTENERS (No conflicts!) ---
    // 1. Static, direct listeners for controls
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    surahSelect.addEventListener('change', (e) => loadSurahContent(e.target.value));
    hadithCollectionSelect.addEventListener('change', (e) => loadHadithContent(e.target.value));
    qariSelect.addEventListener('change', () => {
        if (surahSelect.value) {
            loadSurahContent(surahSelect.value);
        }
    });

    // 2. Scoped delegation for dynamic verse controls only
    function setupContentAreaListeners(container) {
        container.addEventListener('click', (event) => {
            const target = event.target;
            const bookmarkButton = target.closest('.bookmark-btn');
            const playButton = target.closest('.play-btn');

            if (bookmarkButton) {
                handleBookmarkClick(bookmarkButton);
            } else if (playButton) {
                handlePlayClick(playButton);
            }
        });
    }

    setupContentAreaListeners(quranContentArea);
    setupContentAreaListeners(bookmarksContentArea);
    // Uncomment next line if/when you add "bookmark" or "play" features to hadiths
    // setupContentAreaListeners(hadithContentArea);

    recitationPlayer.onended = () => {
        if (currentlyPlayingButton) {
            currentlyPlayingButton.innerHTML = '<i class="fa-solid fa-play"></i>';
            currentlyPlayingButton = null;
        }
    };

    // --- INITIAL LOAD ---
    async function initialize() {
        console.log("Explorer page initialized.");
        quranControls.style.display = 'flex';
        hadithControls.style.display = 'none';

        await loadBookmarks();
        loadChapters();
        loadHadithCollections();
    }

    initialize();
});
