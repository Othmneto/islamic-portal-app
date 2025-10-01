/**
 * Simple Text Translator - Working Version
 * Handles text translation without complex features
 */

// Simple toast function
function toast(message, type = 'info') {
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

class SimpleTextTranslator {
    constructor() {
        this.isInitialized = false;
        this.isConnected = true; // Always connected for HTTP API
        this.isTranslating = false;
        this.translationHistory = [];
        this.elements = {};
        
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
        
        // Translate button
        if (this.elements.translateBtn) {
            this.elements.translateBtn.addEventListener('click', () => {
                console.log('🖱️ [SimpleTextTranslator] Translate button clicked');
                this.translateText();
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

        // Source text input
        if (this.elements.sourceText) {
            this.elements.sourceText.addEventListener('input', (e) => {
                console.log('📝 [SimpleTextTranslator] Source text input:', e.target.value);
            });
        } else {
            console.error('❌ [SimpleTextTranslator] Source text not found!');
        }
    }

    async translateText() {
        console.log('🚀 [SimpleTextTranslator] translateText() called');
        
        const text = this.elements.sourceText?.value?.trim();
        console.log('📝 [SimpleTextTranslator] Source text:', text);
        
        if (!text) {
            console.warn('⚠️ [SimpleTextTranslator] No text to translate');
            toast('Please enter text to translate', 'warning');
            return;
        }

        if (!this.isConnected) {
            console.error('❌ [SimpleTextTranslator] Not connected to server');
            toast('Not connected to server', 'error');
            return;
        }

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
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('authToken') || ''}`
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
            } else {
                console.error('❌ [SimpleTextTranslator] Translation failed:', data.error);
                this.handleTranslationError({ message: data.error });
            }

        } catch (error) {
            console.error('❌ [SimpleTextTranslator] Translation error:', error);
            console.error('❌ [SimpleTextTranslator] Error details:', error.message);
            toast('Translation failed', 'error');
            this.updateTranslateButton(false);
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
            original: data.original,
            translated: data.translatedText,
            confidence: data.confidence || 0,
            timestamp: new Date(),
            favorite: false
        };
        
        console.log('📊 [SimpleTextTranslator] Created translation data:', translationData);

        // Add to history
        this.addToHistory(translationData);

        // Show success message
        toast('Translation completed successfully!', 'success');
    }

    handleTranslationError(error) {
        console.error('❌ [SimpleTextTranslator] Translation error:', error);
        
        this.isTranslating = false;
        this.updateTranslateButton(false);
        
        toast('Translation failed. Please try again.', 'error');
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
                </div>
                <div class="history-item-content">
                    <div class="original-text">${item.original}</div>
                    <div class="translated-text">${item.translated}</div>
                </div>
                <div class="history-item-actions">
                    <button class="btn btn-sm btn-primary" onclick="textTranslator.reuseTranslation(${item.id})">
                        <i class="fas fa-recycle"></i> Reuse
                    </button>
                </div>
            `;
            this.elements.historyContainer.appendChild(historyItem);
        });
    }

    reuseTranslation(translationId) {
        const item = this.translationHistory.find(t => t.id === translationId);
        if (!item) {
            toast('Translation not found', 'error');
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
        
        toast('Translation loaded', 'info');
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
                    </div>
                    <div class="history-item-content">
                        <div class="original-text">${item.original}</div>
                        <div class="translated-text">${item.translated}</div>
                    </div>
                    <div class="history-item-actions">
                        <button class="btn btn-sm btn-primary" onclick="textTranslator.reuseTranslation(${item.id})">
                            <i class="fas fa-recycle"></i> Reuse
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
        
        toast('Text cleared', 'info');
    }

    swapLanguages() {
        const sourceLang = this.elements.sourceLanguage?.value;
        const targetLang = this.elements.targetLanguage?.value;
        
        if (sourceLang && targetLang) {
            this.elements.sourceLanguage.value = targetLang;
            this.elements.targetLanguage.value = sourceLang;
            toast('Languages swapped', 'info');
        }
    }

    updateTranslateButton(isTranslating) {
        if (this.elements.translateBtn) {
            if (isTranslating) {
                this.elements.translateBtn.disabled = true;
                this.elements.translateBtn.textContent = 'Translating...';
            } else {
                this.elements.translateBtn.disabled = false;
                this.elements.translateBtn.textContent = 'Translate';
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

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
