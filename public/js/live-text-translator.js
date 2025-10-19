/**
 * Enhanced Live Text Translator
 * Additional features for the live text translator
 */

class EnhancedLiveTranslator {
    constructor() {
        this.translationHistory = [];
        this.autoSaveInterval = null;
        this.lastTranslation = '';
        this.accumulatedText = '';
        this.currentPhrase = '';
        this.isInitialized = false;

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        if (this.isInitialized) return;

        console.log('Initializing Enhanced Live Text Translator...');

        // Wait for the base translator to be available
        this.waitForBaseTranslator().then(() => {
            this.setupEnhancedFeatures();
            this.setupAutoSave();
            this.setupExportFunctions();
            this.setupHistoryManagement();
            this.setupSaveCurrent();
            this.loadTranslationHistory();
            this.isInitialized = true;
            console.log('Enhanced Live Text Translator initialized successfully');
        });
    }

    async waitForBaseTranslator() {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait

        while (attempts < maxAttempts) {
            if (window.realTimeTranslation && window.realTimeTranslation.accumulatedText !== undefined) {
                // Copy accumulated text from base translator
                this.accumulatedText = window.realTimeTranslation.accumulatedText || '';
                this.currentPhrase = window.realTimeTranslation.currentPhrase || '';
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        console.warn('Base translator not found, initializing standalone mode');
    }

    setupEnhancedFeatures() {
        // Override the base translator's displayTranslation method
        if (window.realTimeTranslation) {
            const originalDisplayTranslation = window.realTimeTranslation.displayTranslation.bind(window.realTimeTranslation);

            window.realTimeTranslation.displayTranslation = (data) => {
                // Store the latest translation
                this.lastTranslation = data.translated;
                this.accumulatedText = data.original;

                // Call original method
                originalDisplayTranslation(data);

                // Auto-save to history
                this.saveTranslationToHistory();
            };
        }
    }

    setupAutoSave() {
        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            if (this.accumulatedText.trim()) {
                this.saveTranslationToHistory();
                this.showAutoSaveIndicator();
            }
        }, 30000);
    }

    showAutoSaveIndicator() {
        const indicator = document.getElementById('autosave-indicator');
        if (indicator) {
            indicator.classList.add('show');
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 2000);
        }
    }

    setupSaveCurrent() {
        const saveCurrentBtn = document.getElementById('save-current');
        const saveStatus = document.getElementById('save-status');

        if (saveCurrentBtn) {
            saveCurrentBtn.addEventListener('click', () => {
                this.saveCurrentTranslation();
            });
        }
    }

    saveCurrentTranslation() {
        if (!this.accumulatedText.trim()) {
            this.updateSaveStatus('No text to save', 'error');
            return;
        }

        const saveStatus = document.getElementById('save-status');

        try {
            this.saveTranslationToHistory();
            this.updateSaveStatus('Translation saved successfully!', 'success');

            // Reset status after 3 seconds
            setTimeout(() => {
                this.updateSaveStatus('Ready to save', 'ready');
            }, 3000);
        } catch (error) {
            console.error('Failed to save translation:', error);
            this.updateSaveStatus('Failed to save translation', 'error');
        }
    }

    updateSaveStatus(message, type) {
        const saveStatus = document.getElementById('save-status');
        if (saveStatus) {
            saveStatus.textContent = message;
            saveStatus.className = `save-status ${type}`;
        }
    }

    setupExportFunctions() {
        const exportPdf = document.getElementById('export-pdf');
        const exportTxt = document.getElementById('export-txt');
        const exportWord = document.getElementById('export-word');

        if (exportPdf) {
            exportPdf.addEventListener('click', () => this.exportToPDF());
        }
        if (exportTxt) {
            exportTxt.addEventListener('click', () => this.exportToTXT());
        }
        if (exportWord) {
            exportWord.addEventListener('click', () => this.exportToWord());
        }
    }

    setupHistoryManagement() {
        const clearHistory = document.getElementById('clear-history');
        const historySearch = document.getElementById('history-search');
        const searchBtn = document.getElementById('search-btn');

        if (clearHistory) {
            clearHistory.addEventListener('click', () => this.clearHistory());
        }
        if (historySearch) {
            historySearch.addEventListener('input', (e) => this.searchHistory(e.target.value));
        }
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = document.getElementById('history-search').value;
                this.searchHistory(query);
            });
        }
    }

    showProgress(percentage, text) {
        const container = document.getElementById('progress-container');
        const fill = document.getElementById('progress-fill');
        const textEl = document.getElementById('progress-text');

        if (container && fill && textEl) {
            container.style.display = 'block';
            fill.style.width = percentage + '%';
            textEl.textContent = text;
        }
    }

    hideProgress() {
        const container = document.getElementById('progress-container');
        if (container) {
            container.style.display = 'none';
        }
    }

    saveTranslationToHistory() {
        if (!this.accumulatedText.trim()) return;

        const historyItem = {
            id: Date.now(),
            original: this.accumulatedText,
            translated: this.lastTranslation || '',
            timestamp: new Date().toISOString(),
            fromLanguage: window.realTimeTranslation?.currentLanguage || 'ar-SA',
            toLanguage: window.realTimeTranslation?.targetLanguage || 'en'
        };

        // Check if this translation already exists (avoid duplicates)
        const exists = this.translationHistory.some(item =>
            item.original === historyItem.original &&
            item.translated === historyItem.translated
        );

        if (!exists) {
            this.translationHistory.unshift(historyItem);
            this.updateHistoryDisplay();
            this.saveHistoryToStorage();
        }
    }

    updateHistoryDisplay() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        if (this.translationHistory.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h4>No translations yet</h4>
                    <p>Your translation history will appear here</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = this.translationHistory.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-header">
                    <span class="history-timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                    <span class="history-languages">${item.fromLanguage} → ${item.toLanguage}</span>
                </div>
                <div class="history-content">
                    <strong>Original:</strong> ${item.original.substring(0, 100)}${item.original.length > 100 ? '...' : ''}<br>
                    <strong>Translated:</strong> ${item.translated.substring(0, 100)}${item.translated.length > 100 ? '...' : ''}
                </div>
            </div>
        `).join('');

        // Add click handlers to history items
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                const historyItem = this.translationHistory.find(h => h.id === id);
                if (historyItem) {
                    this.loadHistoryItem(historyItem);
                }
            });
        });
    }

    loadHistoryItem(item) {
        this.accumulatedText = item.original;
        this.lastTranslation = item.translated;

        // Update base translator if available
        if (window.realTimeTranslation) {
            window.realTimeTranslation.accumulatedText = item.original;
            window.realTimeTranslation.currentPhrase = item.original;
            window.realTimeTranslation.currentLanguage = item.fromLanguage;
            window.realTimeTranslation.targetLanguage = item.toLanguage;
        }

        // Update UI
        const voiceLanguageSelect = document.getElementById('voice-language');
        const targetLanguageSelect = document.getElementById('target-language');

        if (voiceLanguageSelect) {
            voiceLanguageSelect.value = item.fromLanguage;
        }
        if (targetLanguageSelect) {
            targetLanguageSelect.value = item.toLanguage;
        }

        // Update text counter if available
        if (window.realTimeTranslation && window.realTimeTranslation.updateTextCounter) {
            window.realTimeTranslation.updateTextCounter();
        }

        // Update translation display
        if (window.realTimeTranslation && window.realTimeTranslation.displayTranslation) {
            window.realTimeTranslation.displayTranslation({
                original: item.original,
                translated: item.translated,
                language: this.getLanguageName(item.toLanguage),
                timestamp: item.timestamp,
                confidence: 0.9
            });
        }
    }

    searchHistory(query) {
        if (!query.trim()) {
            this.updateHistoryDisplay();
            return;
        }

        const filteredHistory = this.translationHistory.filter(item =>
            item.original.toLowerCase().includes(query.toLowerCase()) ||
            item.translated.toLowerCase().includes(query.toLowerCase())
        );

        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        if (filteredHistory.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h4>No results found</h4>
                    <p>Try a different search term</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = filteredHistory.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-header">
                    <span class="history-timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                    <span class="history-languages">${item.fromLanguage} → ${item.toLanguage}</span>
                </div>
                <div class="history-content">
                    <strong>Original:</strong> ${item.original.substring(0, 100)}${item.original.length > 100 ? '...' : ''}<br>
                    <strong>Translated:</strong> ${item.translated.substring(0, 100)}${item.translated.length > 100 ? '...' : ''}
                </div>
            </div>
        `).join('');

        // Add click handlers to filtered history items
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                const historyItem = this.translationHistory.find(h => h.id === id);
                if (historyItem) {
                    this.loadHistoryItem(historyItem);
                }
            });
        });
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all translation history?')) {
            this.translationHistory = [];
            this.updateHistoryDisplay();
            localStorage.removeItem('translationHistory');
            this.updateSaveStatus('History cleared', 'success');

            setTimeout(() => {
                this.updateSaveStatus('Ready to save', 'ready');
            }, 2000);
        }
    }

    saveHistoryToStorage() {
        try {
            localStorage.setItem('translationHistory', JSON.stringify(this.translationHistory));
        } catch (error) {
            console.error('Failed to save history:', error);
        }
    }

    loadTranslationHistory() {
        try {
            const saved = localStorage.getItem('translationHistory');
            if (saved) {
                this.translationHistory = JSON.parse(saved);
                this.updateHistoryDisplay();
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
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

    // Export functions
    exportToPDF() {
        if (typeof window.jspdf === 'undefined') {
            this.updateSaveStatus('PDF export library not loaded', 'error');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text('Translation Export', 20, 20);

            doc.setFontSize(12);
            doc.text('Original Text:', 20, 40);
            const originalText = this.accumulatedText || 'No text available';
            doc.text(originalText, 20, 50);

            doc.text('Translated Text:', 20, 80);
            const translatedText = this.lastTranslation || 'No translation available';
            doc.text(translatedText, 20, 90);

            doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 120);

            doc.save('translation-export.pdf');
            this.updateSaveStatus('PDF exported successfully!', 'success');
        } catch (error) {
            console.error('PDF export failed:', error);
            this.updateSaveStatus('PDF export failed', 'error');
        }
    }

    exportToTXT() {
        try {
            const content = `Translation Export
Generated: ${new Date().toLocaleString()}

Original Text:
${this.accumulatedText || 'No text available'}

Translated Text:
${this.lastTranslation || 'No translation available'}`;

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'translation-export.txt';
            a.click();
            URL.revokeObjectURL(url);

            this.updateSaveStatus('TXT exported successfully!', 'success');
        } catch (error) {
            console.error('TXT export failed:', error);
            this.updateSaveStatus('TXT export failed', 'error');
        }
    }

    exportToWord() {
        try {
            const content = `
                <html>
                <head><title>Translation Export</title></head>
                <body>
                    <h1>Translation Export</h1>
                    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                    <h2>Original Text:</h2>
                    <p>${this.accumulatedText || 'No text available'}</p>
                    <h2>Translated Text:</h2>
                    <p>${this.lastTranslation || 'No translation available'}</p>
                </body>
                </html>
            `;

            const blob = new Blob([content], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'translation-export.doc';
            a.click();
            URL.revokeObjectURL(url);

            this.updateSaveStatus('Word document exported successfully!', 'success');
        } catch (error) {
            console.error('Word export failed:', error);
            this.updateSaveStatus('Word export failed', 'error');
        }
    }

    // Cleanup method
    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
    }
}

// Initialize enhanced translator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.enhancedTranslator = new EnhancedLiveTranslator();
});