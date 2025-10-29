/**
 * Simple Text Translator - Enhanced Version with Complex Features
 * Handles text translation with retry logic, debouncing, and fallback mechanisms
 */

class SimpleTextTranslator {
    constructor() {
        this.isInitialized = false;
        this.isConnected = true; // Always connected for HTTP API
        this.isTranslating = false;
        this.translationHistory = [];
        this.elements = {};
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000; // Start with 1 second
        this.lastTranslationTime = 0;
        this.debounceTimer = null;

        this.init();
    }

    async init() {
        console.log('🚀 [SimpleTextTranslator] Initializing...');

        try {
            this.initializeUIElements();
            this.setupEventListeners();
            this.loadTranslationHistory();

            this.isInitialized = true;
            console.log('✅ [SimpleTextTranslator] Initialized successfully');

            // Make globally available
            window.textTranslator = this;

        } catch (error) {
            console.error('❌ [SimpleTextTranslator] Initialization failed:', error);
        }
    }

    initializeUIElements() {
        console.log('🎨 [SimpleTextTranslator] Initializing UI elements...');

        this.elements = {
            sourceText: document.getElementById('source-text'),
            targetText: document.getElementById('target-text'),
            sourceLanguage: document.getElementById('source-language'),
            targetLanguage: document.getElementById('target-language'),
            translateBtn: document.getElementById('translate-btn'),
            clearBtn: document.getElementById('clear-text'),
            swapBtn: document.getElementById('swap-languages'),
            historyContainer: document.getElementById('history-list'),
            historySearch: document.getElementById('history-search')
        };

        // Debug: Check which elements were found
        console.log('🔍 [SimpleTextTranslator] UI Elements found:');
        Object.entries(this.elements).forEach(([key, element]) => {
            if (element) {
                console.log(`✅ [SimpleTextTranslator] ${key}:`, element);
            } else {
                console.error(`❌ [SimpleTextTranslator] ${key}: NOT FOUND`);
            }
        });
    }

    setupEventListeners() {
        console.log('👂 [SimpleTextTranslator] Setting up event listeners...');

        // Translate button with debouncing
        if (this.elements.translateBtn) {
            this.elements.translateBtn.addEventListener('click', () => {
                console.log('🖱️ [SimpleTextTranslator] Translate button clicked');
                this.debouncedTranslate();
            });
        } else {
            console.error('❌ [SimpleTextTranslator] Translate button not found!');
        }

        // Clear button
        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => {
                console.log('🖱️ [SimpleTextTranslator] Clear button clicked');
                this.clearAllText();
            });
        } else {
            console.error('❌ [SimpleTextTranslator] Clear button not found!');
        }

        // Swap languages button
        if (this.elements.swapBtn) {
            this.elements.swapBtn.addEventListener('click', () => {
                console.log('🖱️ [SimpleTextTranslator] Swap button clicked');
                this.swapLanguages();
            });
        } else {
            console.error('❌ [SimpleTextTranslator] Swap button not found!');
        }

        // History search
        if (this.elements.historySearch) {
            this.elements.historySearch.addEventListener('input', (e) => {
                console.log('🔍 [SimpleTextTranslator] History search input:', e.target.value);
                this.searchHistory(e.target.value);
            });
        } else {
            console.error('❌ [SimpleTextTranslator] History search not found!');
        }

        // Source text input with debouncing
        if (this.elements.sourceText) {
            this.elements.sourceText.addEventListener('input', (e) => {
                console.log('📝 [SimpleTextTranslator] Source text input:', e.target.value);
                // Auto-translate on input with debouncing
                this.debouncedTranslate();
            });
        } else {
            console.error('❌ [SimpleTextTranslator] Source text not found!');
        }

        // Enter key support
        if (this.elements.sourceText) {
            this.elements.sourceText.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.debouncedTranslate();
                }
            });
        }
    }

    // Debounced translate function to prevent rapid-fire requests
    debouncedTranslate() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.translateText();
        }, 500); // 500ms delay
    }

    async translateText() {
        console.log('🚀 [SimpleTextTranslator] translateText() called');

        const text = this.elements.sourceText?.value?.trim();
        console.log('📝 [SimpleTextTranslator] Source text:', text);

        if (!text) {
            console.warn('⚠️ [SimpleTextTranslator] No text to translate');
            this.showToast('Please enter text to translate', 'warning');
            return;
        }

        if (!this.isConnected) {
            console.error('❌ [SimpleTextTranslator] Not connected to server');
            this.showToast('Not connected to server', 'error');
            return;
        }

        // Rate limiting check
        const now = Date.now();
        if (now - this.lastTranslationTime < 1000) { // 1 second between requests
            console.log('⏱️ [SimpleTextTranslator] Rate limiting: too soon since last translation');
            this.showToast('Please wait a moment before translating again', 'warning');
            return;
        }
        this.lastTranslationTime = now;

        try {
            console.log('🔄 [SimpleTextTranslator] Starting translation process...');
            this.isTranslating = true;
            this.updateTranslateButton(true);

            const sourceLang = this.elements.sourceLanguage?.value || 'auto';
            const targetLang = this.elements.targetLanguage?.value || 'en';

            console.log('🌐 [SimpleTextTranslator] Translation params:', {
                sourceLang,
                targetLang,
                textLength: text.length
            });

            // Send translation request via HTTP API
            console.log('📡 [SimpleTextTranslator] Sending request to /api/text-translation/translate');
            const response = await fetch('/api/text-translation/translate', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sourceText: text,
                    sourceLanguage: sourceLang,
                    targetLanguage: targetLang,
                    sessionId: this.generateSessionId()
                })
            });

            console.log('📡 [SimpleTextTranslator] Response status:', response.status);
            console.log('📡 [SimpleTextTranslator] Response ok:', response.ok);

            const data = await response.json();
            console.log('📦 [SimpleTextTranslator] Response data:', data);

            if (data.success) {
                console.log('✅ [SimpleTextTranslator] Translation successful');
                this.handleTranslationResult(data);
                this.retryCount = 0; // Reset retry count on success
            } else {
                console.error('❌ [SimpleTextTranslator] Translation failed:', data.error);
                this.handleTranslationError({ message: data.error, status: response.status });
            }

        } catch (error) {
            console.error('❌ [SimpleTextTranslator] Translation error:', error);
            console.error('❌ [SimpleTextTranslator] Error details:', error.message);
            this.handleTranslationError({ message: error.message });
        }
    }

    handleTranslationResult(data) {
        console.log('✅ [SimpleTextTranslator] handleTranslationResult called with:', data);

        this.isTranslating = false;
        this.updateTranslateButton(false);

        // Display the result in the target text area
        if (this.elements.targetText) {
            this.elements.targetText.value = data.translatedText;
            console.log('✅ [SimpleTextTranslator] Result displayed in target text area');
        } else {
            console.log('❌ [SimpleTextTranslator] Target text area not found');
        }

        // Create translation item for history
        const translationData = {
            id: Date.now(),
            from: data.from || 'auto',
            to: data.to || 'en',
            original: data.original || this.elements.sourceText?.value || '',
            translated: data.translatedText,
            confidence: data.confidence || 0,
            timestamp: new Date(),
            favorite: false,
            source: data.source || 'api'
        };

        console.log('📊 [SimpleTextTranslator] Created translation data:', translationData);

        // Add to history
        this.addToHistory(translationData);

        // Show success message
        this.showToast('Translation completed successfully!', 'success');
    }

    handleTranslationError(error) {
        console.error('❌ [SimpleTextTranslator] Translation error:', error);

        this.isTranslating = false;
        this.updateTranslateButton(false);

        // Handle specific error types
        if (error.status === 429) {
            console.log('⏱️ [SimpleTextTranslator] Rate limit error, will retry...');
            this.handleRateLimitRetry();
        } else if (error.message && error.message.includes('quota')) {
            console.log('💳 [SimpleTextTranslator] Quota exceeded, using fallback...');
            this.handleQuotaError(error.message);
        } else {
            this.showToast('Translation failed. Please try again.', 'error');
        }
    }

    handleRateLimitRetry() {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // Exponential backoff

            console.log(`🔄 [SimpleTextTranslator] Retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
            this.showToast(`Rate limited. Retrying in ${Math.ceil(delay/1000)} seconds...`, 'warning');

            setTimeout(() => {
                this.translateText();
            }, delay);
        } else {
            console.error('❌ [SimpleTextTranslator] Max retries exceeded');
            this.showToast('Translation failed after multiple attempts. Please try again later.', 'error');
            this.retryCount = 0;
        }
    }

    handleQuotaError(errorMessage) {
        console.log('💳 [SimpleTextTranslator] Handling quota error:', errorMessage);
        this.showToast('Translation service quota exceeded. Using fallback translation.', 'warning');

        // Try to provide a basic fallback translation
        const text = this.elements.sourceText?.value?.trim();
        if (text) {
            const fallbackTranslation = this.getBasicFallbackTranslation(text);
            if (fallbackTranslation) {
                this.elements.targetText.value = fallbackTranslation;
                this.showToast('Using fallback translation - accuracy may be limited', 'info');
            } else {
                this.showToast('Translation service unavailable. Please try again later.', 'error');
            }
        }
    }

    getBasicFallbackTranslation(text) {
        // Simple fallback translations for common phrases
        const fallbackTranslations = {
            'السلام عليكم': 'Peace be upon you',
            'مرحبا': 'Hello',
            'شكرا': 'Thank you',
            'أنا أحبك': 'I love you',
            'كيف حالك': 'How are you',
            'صباح الخير': 'Good morning',
            'مساء الخير': 'Good evening',
            'مع السلامة': 'Goodbye',
            'أهلا وسهلا': 'Welcome',
            'عفوا': 'You\'re welcome'
        };

        return fallbackTranslations[text] || null;
    }

    addToHistory(translationData) {
        console.log('📚 [SimpleTextTranslator] addToHistory called with:', translationData);

        this.translationHistory.unshift(translationData);
        console.log('📚 [SimpleTextTranslator] History length:', this.translationHistory.length);

        // Limit history to 100 items
        if (this.translationHistory.length > 100) {
            this.translationHistory = this.translationHistory.slice(0, 100);
        }

        this.renderHistory();
        this.saveHistoryToStorage();
    }

    renderHistory() {
        console.log('🎨 [SimpleTextTranslator] renderHistory called');

        if (!this.elements.historyContainer) {
            console.error('❌ [SimpleTextTranslator] History container not found!');
            return;
        }

        console.log('📚 [SimpleTextTranslator] Rendering', this.translationHistory.length, 'history items');
        this.elements.historyContainer.innerHTML = '';

        if (this.translationHistory.length === 0) {
            this.elements.historyContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history" aria-hidden="true"></i>
                    <h4>No history yet</h4>
                    <p>Your translations will be saved here</p>
                </div>
            `;
            return;
        }

        // Render history items
        this.translationHistory.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.setAttribute('data-translation-id', item.id);
            historyItem.innerHTML = `
                <div class="history-item-header">
                    <div class="lang-badge">${item.from} → ${item.to}</div>
                    <div class="history-item-meta">${new Date(item.timestamp).toLocaleString()}</div>
                    ${item.source ? `<div class="source-badge">${item.source}</div>` : ''}
                </div>
                <div class="history-item-content">
                    <div class="original-text">${item.original}</div>
                    <div class="translated-text">${item.translated}</div>
                </div>
                <div class="history-item-actions">
                    <button class="btn btn-sm btn-primary" onclick="textTranslator.reuseTranslation(${item.id})">
                        <i class="fas fa-recycle"></i> Reuse
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="textTranslator.copyTranslation(${item.id})">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="textTranslator.deleteTranslation(${item.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;
            this.elements.historyContainer.appendChild(historyItem);
        });
    }

    reuseTranslation(translationId) {
        const item = this.translationHistory.find(t => t.id === translationId);
        if (!item) {
            this.showToast('Translation not found', 'error');
            return;
        }

        if (this.elements.sourceText) {
            this.elements.sourceText.value = item.original;
        }
        if (this.elements.sourceLanguage) {
            this.elements.sourceLanguage.value = item.from;
        }
        if (this.elements.targetLanguage) {
            this.elements.targetLanguage.value = item.to;
        }

        this.showToast('Translation loaded', 'info');
    }

    copyTranslation(translationId) {
        const item = this.translationHistory.find(t => t.id === translationId);
        if (!item) {
            this.showToast('Translation not found', 'error');
            return;
        }

        navigator.clipboard.writeText(item.translated).then(() => {
            this.showToast('Translation copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy text:', err);
            this.showToast('Failed to copy text', 'error');
        });
    }

    deleteTranslation(translationId) {
        const itemIndex = this.translationHistory.findIndex(t => t.id === translationId);
        if (itemIndex === -1) {
            this.showToast('Translation not found', 'error');
            return;
        }

        this.translationHistory.splice(itemIndex, 1);
        this.renderHistory();
        this.saveHistoryToStorage();
        this.showToast('Translation deleted', 'info');
    }

    searchHistory(query) {
        if (!query.trim()) {
            this.renderHistory();
            return;
        }

        const filtered = this.translationHistory.filter(item =>
            item.original.toLowerCase().includes(query.toLowerCase()) ||
            item.translated.toLowerCase().includes(query.toLowerCase())
        );

        if (this.elements.historyContainer) {
            this.elements.historyContainer.innerHTML = '';

            if (filtered.length === 0) {
                this.elements.historyContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-search" aria-hidden="true"></i>
                        <h4>No results found</h4>
                        <p>Try a different search term</p>
                    </div>
                `;
                return;
            }

            filtered.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <div class="history-item-header">
                        <div class="lang-badge">${item.from} → ${item.to}</div>
                        <div class="history-item-meta">${new Date(item.timestamp).toLocaleString()}</div>
                        ${item.source ? `<div class="source-badge">${item.source}</div>` : ''}
                    </div>
                    <div class="history-item-content">
                        <div class="original-text">${item.original}</div>
                        <div class="translated-text">${item.translated}</div>
                    </div>
                    <div class="history-item-actions">
                        <button class="btn btn-sm btn-primary" onclick="textTranslator.reuseTranslation(${item.id})">
                            <i class="fas fa-recycle"></i> Reuse
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="textTranslator.copyTranslation(${item.id})">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="textTranslator.deleteTranslation(${item.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                `;
                this.elements.historyContainer.appendChild(historyItem);
            });
        }
    }

    clearAllText() {
        if (this.elements.sourceText) {
            this.elements.sourceText.value = '';
        }

        if (this.elements.targetText) {
            this.elements.targetText.value = '';
        }

        this.showToast('Text cleared', 'info');
    }

    swapLanguages() {
        const sourceLang = this.elements.sourceLanguage?.value;
        const targetLang = this.elements.targetLanguage?.value;

        if (sourceLang && targetLang) {
            this.elements.sourceLanguage.value = targetLang;
            this.elements.targetLanguage.value = sourceLang;
            this.showToast('Languages swapped', 'info');
        }
    }

    updateTranslateButton(isTranslating) {
        if (this.elements.translateBtn) {
            if (isTranslating) {
                this.elements.translateBtn.disabled = true;
                this.elements.translateBtn.textContent = 'Translating...';
                this.elements.translateBtn.classList.add('loading');
            } else {
                this.elements.translateBtn.disabled = false;
                this.elements.translateBtn.textContent = 'Translate';
                this.elements.translateBtn.classList.remove('loading');
            }
        }
    }

    loadTranslationHistory() {
        try {
            const saved = localStorage.getItem('translationHistory');
            if (saved) {
                this.translationHistory = JSON.parse(saved);
                console.log('📚 [SimpleTextTranslator] Loaded', this.translationHistory.length, 'items from localStorage');
            }
            this.renderHistory();
        } catch (error) {
            console.error('Error loading translation history:', error);
            this.translationHistory = [];
        }
    }

    saveHistoryToStorage() {
        try {
            localStorage.setItem('translationHistory', JSON.stringify(this.translationHistory));
            console.log('💾 [SimpleTextTranslator] Saved', this.translationHistory.length, 'items to localStorage');
        } catch (error) {
            console.error('Error saving translation history:', error);
        }
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Enhanced toast function with better styling
    showToast(message, type = 'info') {
        console.log(`[Toast ${type.toUpperCase()}] ${message}`);

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        switch(type) {
            case 'success':
                toast.style.backgroundColor = '#10b981';
                break;
            case 'error':
                toast.style.backgroundColor = '#ef4444';
                break;
            case 'warning':
                toast.style.backgroundColor = '#f59e0b';
                break;
            default:
                toast.style.backgroundColor = '#3b82f6';
        }

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 [SimpleTextTranslator] DOM loaded, initializing...');
    new SimpleTextTranslator();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 [SimpleTextTranslator] DOM loaded, initializing...');
        new SimpleTextTranslator();
    });
} else {
    console.log('📄 [SimpleTextTranslator] DOM already loaded, initializing...');
    new SimpleTextTranslator();
}