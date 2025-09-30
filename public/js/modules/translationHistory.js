/**
 * Translation History Module
 * Handles translation history management and storage
 */

export class TranslationHistory {
    constructor() {
        this.history = [];
        this.autoSaveInterval = null;
        this.setupAutoSave();
        this.loadHistory();
    }

    setupAutoSave() {
        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            this.saveToStorage();
        }, 30000);
    }

    addTranslation(translation) {
        const historyItem = {
            id: Date.now(),
            original: translation.original,
            translated: translation.translated,
            timestamp: translation.timestamp || new Date().toISOString(),
            fromLanguage: translation.fromLanguage || 'ar-SA',
            toLanguage: translation.toLanguage || 'en',
            confidence: translation.confidence || 0.9
        };

        // Check if this translation already exists (avoid duplicates)
        const exists = this.history.some(item => 
            item.original === historyItem.original && 
            item.translated === historyItem.translated
        );

        if (!exists) {
            this.history.unshift(historyItem);
            this.updateDisplay();
            this.saveToStorage();
        }
    }

    searchHistory(query) {
        if (!query.trim()) {
            this.updateDisplay();
            return;
        }

        return this.history.filter(item => 
            item.original.toLowerCase().includes(query.toLowerCase()) ||
            item.translated.toLowerCase().includes(query.toLowerCase())
        );
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all translation history?')) {
            this.history = [];
            this.updateDisplay();
            this.saveToStorage();
            return true;
        }
        return false;
    }

    loadHistoryItem(item) {
        return {
            accumulatedText: item.original,
            lastTranslation: item.translated,
            fromLanguage: item.fromLanguage,
            toLanguage: item.toLanguage,
            timestamp: item.timestamp
        };
    }

    updateDisplay() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        
        if (this.history.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h4>No translations yet</h4>
                    <p>Your translation history will appear here</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = this.history.map(item => `
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
                const historyItem = this.history.find(h => h.id === id);
                if (historyItem) {
                    this.onHistoryItemClick(historyItem);
                }
            });
        });
    }

    onHistoryItemClick(item) {
        // This will be set by the main application
        if (this.onItemClick) {
            this.onItemClick(item);
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('translationHistory', JSON.stringify(this.history));
        } catch (error) {
            console.error('Failed to save history:', error);
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('translationHistory');
            if (saved) {
                this.history = JSON.parse(saved);
                this.updateDisplay();
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
    }
}
