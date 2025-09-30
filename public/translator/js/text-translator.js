/**
 * Text Translator - Main Application
 * Handles text translation without voice functionality
 */

import { toast, TranslationItem, ProgressIndicator, SkeletonLoader, TextCounter, LanguageDetector } from './utils/ui-utils.js';

// Debug: Check if TranslationItem is imported correctly
console.log('🔍 [TextTranslator] TranslationItem imported:', typeof TranslationItem);
import { RealTimeTranslation } from './modules/realTimeTranslation.js';
import { LanguageDetection } from './modules/languageDetection.js';
import { TranslationAlternatives } from './modules/translationAlternatives.js';
import { ContextAwareTranslation } from './modules/contextAwareTranslation.js';
import { TranslationMemory } from './modules/translationMemory.js';
import { AdvancedSearch } from './modules/advancedSearch.js';
import { FavoritesSystem } from './modules/favoritesSystem.js';
import { VirtualScroller, TranslationHistoryScroller } from './modules/virtualScrolling.js';
import { rtlSupport } from './modules/rtlSupport.js';
import { accessibilityManager } from './modules/accessibility.js';
import { performanceOptimizer } from './modules/performanceOptimizer.js';
import { securityHardener } from './modules/securityHardening.js';
import { userFeedbackSystem } from './modules/userFeedback.js';
import { helpSystem } from './modules/helpSystem.js';
import { VoiceInput } from './modules/voiceInput.js';

class TextTranslator {
    constructor() {
        this.isInitialized = false;
        this.isConnected = false;
        this.isTranslating = false;
        this.sessionId = this.generateSessionId();
        this.translationHistory = [];
        
        // WebSocket connection
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        
        // UI elements
        this.elements = {
            sourceText: null,
            sourceLanguage: null,
            targetLanguage: null,
            translateBtn: null,
            clearBtn: null,
            swapBtn: null,
            historyContainer: null,
            historySearch: null,
            statusText: null,
            statusDot: null,
            textCounter: null,
            progressContainer: null,
            loadingSpinner: null
        };
        
        // Virtual scrolling
        this.historyScroller = null;
        
        // RTL support
        this.currentLanguage = 'en';
        this.rtlEnabled = false;
        
        // Voice input
        this.voiceInput = null;
        
        // Event handlers
        this.eventHandlers = new Map();
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('🚀 [TextTranslator] Initializing Text Translator...');
        
        try {
            // Initialize API connection
            console.log('🔌 [TextTranslator] Initializing API connection...');
            await this.initializeConnection();
            
            // Initialize UI elements
            console.log('🎨 [TextTranslator] Initializing UI elements...');
            this.initializeUIElements();
            
            // Setup event listeners
            console.log('👂 [TextTranslator] Setting up event listeners...');
            this.setupEventListeners();
            
            // Initialize text counter
            console.log('📊 [TextTranslator] Initializing text counter...');
            this.initializeTextCounter();
            
        // Initialize Phase 2 modules
        console.log('🧠 [TextTranslator] Initializing language detection...');
        this.languageDetection = new LanguageDetection();
        
        console.log('🔄 [TextTranslator] Initializing translation alternatives...');
        this.translationAlternatives = new TranslationAlternatives();
        this.translationAlternatives.loadPreferences();
        
        console.log('🎯 [TextTranslator] Initializing context-aware translation...');
        this.contextAwareTranslation = new ContextAwareTranslation();
        this.contextAwareTranslation.loadContext();
        
        // Initialize Phase 3 modules BEFORE loading history
        console.log('🧠 [TextTranslator] Initializing translation memory...');
        this.translationMemory = new TranslationMemory();
        
        console.log('🔍 [TextTranslator] Initializing advanced search...');
        this.advancedSearch = new AdvancedSearch();
        
        console.log('⭐ [TextTranslator] Initializing favorites system...');
        this.favoritesSystem = new FavoritesSystem();
        
        // Load translation history AFTER favorites system is initialized
        console.log('📚 [TextTranslator] Loading translation history...');
        this.loadTranslationHistory();
        
        // Make textTranslator globally available
        window.textTranslator = this;
        
        // Update existing translation items with favorite buttons
        this.updateExistingTranslationItems();
            
        // Initialize real-time translation
        console.log('🚀 [TextTranslator] Initializing real-time translation...');
        this.realTimeTranslation = new RealTimeTranslation(this);
        
        // Re-enable real-time translation with space input fix
        this.enableRealTimeTranslation();
        console.log('🚀 [TextTranslator] Real-time translation enabled with space input fix');
        
        // Initialize virtual scrolling for history
        this.initializeVirtualScrolling();
        
        // Initialize RTL support
        this.initializeRTLSupport();
        
        // Initialize accessibility
        this.initializeAccessibility();
        
        // Initialize performance optimization
        this.initializePerformanceOptimization();
        
        // Initialize security hardening
        this.initializeSecurityHardening();
        
        // Initialize user feedback system
        this.initializeUserFeedback();
        
        // Initialize help system
        this.initializeHelpSystem();
        
        // Initialize voice input
        console.log('🎤 [TextTranslator] Initializing voice input...');
        this.voiceInput = new VoiceInput(this);
        this.initializeVoiceInput();
        
        // Initialize ultra-enhanced features
        console.log('🚀 [TextTranslator] Initializing ultra-enhanced features...');
        this.initializeUltraEnhancedFeatures();
        console.log('✅ [TextTranslator] Ultra-enhanced features initialized');
        
        // Initialize productivity features
        console.log('🚀 [TextTranslator] Initializing productivity features...');
        this.initializeProductivityFeatures();
        console.log('✅ [TextTranslator] Productivity features initialized');
        
        this.isInitialized = true;
        console.log('✅ [TextTranslator] Text Translator initialized successfully');
            
        } catch (error) {
            console.error('❌ [TextTranslator] Failed to initialize Text Translator:', error);
            console.error('❌ [TextTranslator] Error details:', error.stack);
            toast('Failed to initialize translation system', 'error');
            throw error;
        }
    }

    async initializeConnection() {
        console.log('🔌 [TextTranslator] Testing API connection...');
        
        // Check if user is authenticated
        const authToken = localStorage.getItem('authToken');
        const isAuthenticated = !!authToken;
        
        console.log('🔐 [TextTranslator] Authentication status:', isAuthenticated ? 'Authenticated' : 'Guest');
        
        // Test connection to the API
        try {
            const url = '/api/text-translation/health';
            console.log('🌐 [TextTranslator] Fetching URL:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken || ''}`,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            console.log('📡 [TextTranslator] Response status:', response.status);
            console.log('📡 [TextTranslator] Response ok:', response.ok);
            
            if (response.ok) {
                this.isConnected = true;
                this.isAuthenticated = isAuthenticated;
                this.updateConnectionStatus('Connected', 'success');
                console.log('✅ [TextTranslator] Connected to translation API');
                
                // Initialize user-specific features if authenticated
                if (isAuthenticated) {
                    await this.initializeUserFeatures();
                }
            } else {
                console.error('❌ [TextTranslator] API not available, status:', response.status);
                throw new Error(`API not available: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ [TextTranslator] Connection error:', error);
            console.error('❌ [TextTranslator] Error details:', error.message);
            this.isConnected = false;
            this.isAuthenticated = false;
            this.updateConnectionStatus('Connection Error', 'error');
            throw error;
        }
    }

    /**
     * Initialize user-specific features for authenticated users
     */
    async initializeUserFeatures() {
        console.log('👤 [TextTranslator] Initializing user-specific features...');
        
        try {
            // Load user preferences
            await this.loadUserPreferences();
            
            // Load user's translation history
            await this.loadUserHistory();
            
            // Setup user-specific analytics
            this.setupUserAnalytics();
            
            // Setup user-specific shortcuts
            this.setupUserShortcuts();
            
            console.log('✅ [TextTranslator] User-specific features initialized');
        } catch (error) {
            console.error('❌ [TextTranslator] Failed to initialize user features:', error);
        }
    }

    /**
     * Load user preferences from server
     */
    async loadUserPreferences() {
        try {
            const response = await fetch('/api/user/preferences', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const preferences = await response.json();
                this.userPreferences = preferences;
                console.log('👤 [TextTranslator] User preferences loaded:', preferences);
            }
        } catch (error) {
            console.warn('⚠️ [TextTranslator] Failed to load user preferences:', error);
        }
    }

    /**
     * Load user's translation history from server
     */
    async loadUserHistory() {
        try {
            const response = await fetch('/api/translation-history', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const history = await response.json();
                this.userHistory = history;
                console.log('👤 [TextTranslator] User history loaded:', history.length, 'items');
            }
        } catch (error) {
            console.warn('⚠️ [TextTranslator] Failed to load user history:', error);
        }
    }

    /**
     * Setup user-specific analytics
     */
    setupUserAnalytics() {
        console.log('📊 [TextTranslator] Setting up user analytics...');
        
        // Track user-specific metrics
        this.userAnalytics = {
            translationsCount: 0,
            favoriteLanguages: {},
            averageSessionTime: 0,
            lastActive: new Date(),
            productivityScore: 0
        };
        
        // Load existing analytics
        const saved = localStorage.getItem('userAnalytics');
        if (saved) {
            this.userAnalytics = { ...this.userAnalytics, ...JSON.parse(saved) };
        }
    }

    /**
     * Setup user-specific keyboard shortcuts
     */
    setupUserShortcuts() {
        console.log('⌨️ [TextTranslator] Setting up user shortcuts...');
        
        // Add user-specific shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+S: Save to favorites
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                this.saveToFavorites();
            }
            
            // Ctrl+Shift+H: Open history panel
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
                e.preventDefault();
                this.toggleHistoryPanel();
            }
            
            // Ctrl+Shift+P: Open preferences
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this.openPreferences();
            }
        });
    }

    initializeUIElements() {
        console.log('🎨 [TextTranslator] Initializing UI elements...');
        
        this.elements = {
            sourceText: document.getElementById('source-text'),
            sourceLanguage: document.getElementById('source-language'),
            targetLanguage: document.getElementById('target-language'),
            translateBtn: document.getElementById('translate-btn'),
            clearBtn: document.getElementById('clear-text'),
            swapBtn: document.getElementById('swap-languages'),
            historyContainer: document.getElementById('history-list'),
            historySearch: document.getElementById('history-search'),
            statusText: document.getElementById('status-text'),
            statusDot: document.getElementById('status-dot'),
            textCounter: document.getElementById('counter-value'),
            progressContainer: document.getElementById('progress-container'),
            loadingSpinner: document.getElementById('loading-spinner'),
            autosaveIndicator: document.getElementById('autosave-indicator')
        };
        
        // Debug: Check which elements were found
        console.log('🔍 [TextTranslator] UI Elements found:');
        Object.entries(this.elements).forEach(([key, element]) => {
            if (element) {
                console.log(`✅ [TextTranslator] ${key}:`, element);
            } else {
                // Make progressContainer optional (not critical for functionality)
                if (key === 'progressContainer') {
                    console.log(`ℹ️ [TextTranslator] ${key}: Not found (optional element)`);
                } else {
                    console.error(`❌ [TextTranslator] ${key}: NOT FOUND`);
                }
            }
        });
    }

    setupEventListeners() {
        console.log('👂 [TextTranslator] Setting up event listeners...');
        
        // Translation button
        if (this.elements.translateBtn) {
            console.log('✅ [TextTranslator] Adding click listener to translate button');
            this.elements.translateBtn.addEventListener('click', () => {
                console.log('🖱️ [TextTranslator] Translate button clicked');
                this.translateText();
            });
        } else {
            console.error('❌ [TextTranslator] Translate button not found!');
        }

        // Clear button
        if (this.elements.clearBtn) {
            console.log('✅ [TextTranslator] Adding click listener to clear button');
            this.elements.clearBtn.addEventListener('click', () => {
                console.log('🖱️ [TextTranslator] Clear button clicked');
                this.clearAllText();
            });
        } else {
            console.error('❌ [TextTranslator] Clear button not found!');
        }

        // Swap languages button
        if (this.elements.swapBtn) {
            console.log('✅ [TextTranslator] Adding click listener to swap button');
            this.elements.swapBtn.addEventListener('click', () => {
                console.log('🖱️ [TextTranslator] Swap button clicked');
                this.swapLanguages();
            });
        } else {
            console.error('❌ [TextTranslator] Swap button not found!');
        }

        // History search
        if (this.elements.historySearch) {
            console.log('✅ [TextTranslator] Adding input listener to history search');
            this.elements.historySearch.addEventListener('input', (e) => {
                console.log('🔍 [TextTranslator] History search input:', e.target.value);
                this.searchHistory(e.target.value);
            });
        } else {
            console.error('❌ [TextTranslator] History search not found!');
        }

        // Auto-detect language
        if (this.elements.sourceText) {
            console.log('✅ [TextTranslator] Adding input listener to source text');
            this.elements.sourceText.addEventListener('input', (e) => {
                console.log('📝 [TextTranslator] Source text input:', e.target.value);
                this.handleTextInput(e.target.value);
            });
            
            // Add keydown listener to test space key
            this.elements.sourceText.addEventListener('keydown', (e) => {
                console.log('⌨️ [TextTranslator] Key pressed:', e.key, 'Code:', e.code);
                if (e.key === ' ') {
                    console.log('🔍 [TextTranslator] SPACE KEY DETECTED!');
                    console.log('🔍 [TextTranslator] Textarea attributes:', {
                        readonly: this.elements.sourceText.readOnly,
                        disabled: this.elements.sourceText.disabled,
                        value: this.elements.sourceText.value
                    });
                    
                    // Check if preventDefault is being called
                    console.log('🔍 [TextTranslator] Event details:', {
                        defaultPrevented: e.defaultPrevented,
                        cancelable: e.cancelable,
                        target: e.target.tagName
                    });
                    
                    // Force the space to be added
                    console.log('🔧 [TextTranslator] Forcing space insertion...');
                    const currentValue = this.elements.sourceText.value;
                    const cursorPos = this.elements.sourceText.selectionStart;
                    const newValue = currentValue.slice(0, cursorPos) + ' ' + currentValue.slice(cursorPos);
                    this.elements.sourceText.value = newValue;
                    this.elements.sourceText.setSelectionRange(cursorPos + 1, cursorPos + 1);
                    console.log('🔧 [TextTranslator] Space forced, new value:', this.elements.sourceText.value);
                    
                    // Trigger input event to ensure it's processed
                    this.elements.sourceText.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
            
            // Test if we can programmatically add a space
            setTimeout(() => {
                console.log('🧪 [TextTranslator] Testing programmatic space insertion...');
                const currentValue = this.elements.sourceText.value;
                this.elements.sourceText.value = currentValue + ' ';
                console.log('🧪 [TextTranslator] After adding space:', this.elements.sourceText.value);
            }, 2000);
        } else {
            console.error('❌ [TextTranslator] Source text not found!');
        }

        // Real-time translation controls
        this.setupRealTimeControls();

        // Phase 3: Advanced features
        this.setupAdvancedFeatures();

        // Export buttons
        this.setupExportButtons();



        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    initializeTextCounter() {
        if (this.elements.sourceText && this.elements.textCounter) {
            this.textCounter = new TextCounter(this.elements.sourceText, this.elements.textCounter);
        }
    }

    setupExportButtons() {
        const exportPdf = document.getElementById('export-pdf');
        const exportTxt = document.getElementById('export-txt');
        const exportWord = document.getElementById('export-word');
        const clearHistory = document.getElementById('clear-history');

        if (exportPdf) {
            exportPdf.addEventListener('click', () => {
                this.exportHistory('pdf');
            });
        }

        if (exportTxt) {
            exportTxt.addEventListener('click', () => {
                this.exportHistory('txt');
            });
        }

        if (exportWord) {
            exportWord.addEventListener('click', () => {
                this.exportHistory('word');
            });
        }

        if (clearHistory) {
            clearHistory.addEventListener('click', () => {
                this.clearHistory();
            });
        }
    }



    async translateText() {
        console.log('🚀 [TextTranslator] translateText() called');
        
        const text = this.elements.sourceText?.value?.trim();
        console.log('📝 [TextTranslator] Source text:', text);
        
        if (!text) {
            console.warn('⚠️ [TextTranslator] No text to translate');
            toast('Please enter text to translate', 'warning');
            return;
        }

        // Phase 2: Content validation and language detection
        console.log('🔍 [TextTranslator] Validating content...');
        const validation = this.languageDetection.validateContent(text);
        
        if (!validation.valid) {
            console.log('❌ [TextTranslator] Content validation failed:', validation.reason);
            toast(validation.reason, 'error');
            toast(validation.suggestion, 'info');
            
            // Show visual indicator in the textarea
            this.elements.sourceText.style.borderColor = '#ef4444';
            this.elements.sourceText.style.backgroundColor = '#fef2f2';
            
            // Clear the visual indicator after 3 seconds
            setTimeout(() => {
                this.elements.sourceText.style.borderColor = '';
                this.elements.sourceText.style.backgroundColor = '';
            }, 3000);
            
            return;
        }

        console.log('✅ [TextTranslator] Content validation passed');
        console.log('🧠 [TextTranslator] Detected language:', validation.detectedLanguage, 'Confidence:', validation.confidence);
        
        // Show visual indicator for valid Islamic content
        this.elements.sourceText.style.borderColor = '#10b981';
        this.elements.sourceText.style.backgroundColor = '#f0fdf4';
        
        // Clear the visual indicator after 2 seconds
        setTimeout(() => {
            this.elements.sourceText.style.borderColor = '';
            this.elements.sourceText.style.backgroundColor = '';
        }, 2000);

        if (!this.isConnected) {
            console.error('❌ [TextTranslator] Not connected to server');
            toast('Not connected to server', 'error');
            return;
        }

        try {
            console.log('🔄 [TextTranslator] Starting translation process...');
            this.isTranslating = true;
            this.showProgress('Translating...');
            this.updateTranslateButton(true);

            const sourceLang = this.elements.sourceLanguage?.value || 'auto';
            const targetLang = this.elements.targetLanguage?.value || 'en';
            
            // Auto-detect language if set to auto
            if (sourceLang === 'auto') {
                const detection = this.languageDetection.detectLanguage(text);
                console.log('🎯 [TextTranslator] Auto-detected language:', detection.language, 'Confidence:', detection.confidence);
                
                // Update UI to show detected language
                if (detection.language !== 'auto' && this.elements.sourceLanguage) {
                    this.elements.sourceLanguage.value = detection.language;
                    toast(`Auto-detected language: ${detection.language} (${detection.confidence}% confidence)`, 'info');
                }
            }
            
            console.log('🌐 [TextTranslator] Translation params:', {
                sourceLang,
                targetLang,
                textLength: text.length,
                isIslamic: validation.isIslamic
            });

            // Send translation request via HTTP API
            console.log('📡 [TextTranslator] Sending request to /api/text-translation/translate');
            const response = await fetch('/api/text-translation/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
                },
                body: JSON.stringify({
                    text: text,
                    fromLang: sourceLang,
                    toLang: targetLang,
                    sessionId: this.sessionId,
                    isIslamic: validation.isIslamic,
                    context: this.contextAwareTranslation.getRelevantContext(text, sourceLang, targetLang)
                })
            });

            console.log('📡 [TextTranslator] Response status:', response.status);
            console.log('📡 [TextTranslator] Response ok:', response.ok);
            
            const data = await response.json();
            console.log('📦 [TextTranslator] Response data:', data);
            
            if (data.success) {
                console.log('✅ [TextTranslator] Translation successful');
                
                // Phase 2: Enhance with context and alternatives
                const enhancedResult = this.enhanceTranslationResult({
                    original: data.original,
                    translated: data.results[0].translatedText,
                    fromLang: data.fromLang,
                    toLang: data.toLang,
                    confidence: data.results[0].confidence,
                    model: data.results[0].model
                }, text, sourceLang, targetLang);
                
                this.handleTranslationResult(enhancedResult);
            } else {
                console.error('❌ [TextTranslator] Translation failed:', data.error);
                this.handleTranslationError({ message: data.error });
            }

        } catch (error) {
            console.error('❌ [TextTranslator] Translation error:', error);
            console.error('❌ [TextTranslator] Error details:', error.message);
            console.error('❌ [TextTranslator] Error stack:', error.stack);
            toast('Translation failed', 'error');
            this.hideProgress();
            this.updateTranslateButton(false);
        }
    }

    async enhanceTranslationResult(result, originalText, sourceLang, targetLang) {
        console.log('🎯 [TextTranslator] Enhancing translation result...');
        
        // Add to context
        this.contextAwareTranslation.addToContext({
            original: originalText,
            translated: result.translated,
            fromLang: sourceLang,
            toLang: targetLang
        });
        
        // Get alternatives
        const alternatives = await this.translationAlternatives.getAlternatives(originalText, sourceLang, targetLang);
        console.log('🔄 [TextTranslator] Generated alternatives:', alternatives.length);
        
        // Get cultural context
        const culturalContext = this.translationAlternatives.getCulturalContext(originalText, result.translated);
        console.log('🌍 [TextTranslator] Cultural context:', culturalContext);
        
        // Enhance with context
        const enhancedResult = this.contextAwareTranslation.enhanceWithContext(originalText, sourceLang, targetLang, result);
        console.log('🎯 [TextTranslator] Context enhancement applied');
        
        return {
            ...enhancedResult,
            alternatives: alternatives,
            culturalContext: culturalContext,
            isIslamic: this.languageDetection.isIslamicContent(originalText)
        };
    }

    handleTranslationResult(data) {
        console.log('✅ [TextTranslator] handleTranslationResult called with:', data);
        
        this.isTranslating = false;
        this.hideProgress();
        this.updateTranslateButton(false);

        // Create translation item
        const translationData = {
            id: Date.now(),
            from: data.fromLang || 'auto',
            to: data.toLang || 'en',
            original: data.original,
            translated: data.translated,
            confidence: data.confidence || 0,
            timestamp: new Date(),
            favorite: false,
            // Phase 2 enhancements
            alternatives: data.alternatives || [],
            culturalContext: data.culturalContext || {},
            context: data.context || 'general',
            isIslamic: data.isIslamic || false
        };
        
        console.log('📊 [TextTranslator] Created translation data:', translationData);

        // Add to history (results container removed)
        this.addToHistory(translationData);

        // Phase 3: Add to translation memory
        console.log('🧠 [TextTranslator] Adding to translation memory...');
        this.translationMemory.addToMemory(translationData, 'good');

        // Phase 3: Index for advanced search
        console.log('🔍 [TextTranslator] Indexing for search...');
        this.advancedSearch.indexTranslation(translationData);
        
        // Phase 3: Add favorite button to translation item
        this.addFavoriteButtonToTranslation(translationData.id);

        // Auto-save if enabled
        if (localStorage.getItem('autoSave') !== 'false') {
            this.saveTranslationHistory();
        }

        toast('Translation completed', 'success');
        
        // Show alternatives if available
        if (data.alternatives && data.alternatives.length > 0) {
            this.showAlternatives(data.alternatives, data.original);
        }
    }

    showAlternatives(alternatives, originalText) {
        console.log('🔄 [TextTranslator] Showing alternatives:', alternatives.length);
        
        // Create alternatives modal or panel
        const alternativesContainer = document.createElement('div');
        alternativesContainer.className = 'alternatives-panel';
        alternativesContainer.innerHTML = `
            <div class="alternatives-header">
                <h4>Alternative Translations</h4>
                <button class="close-alternatives" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="alternatives-list">
                ${alternatives.map((alt, index) => `
                    <div class="alternative-item" data-index="${index}">
                        <div class="alternative-text">${alt.text}</div>
                        <div class="alternative-meta">
                            <span class="confidence">${alt.confidence}% confidence</span>
                            <span class="style">${alt.style || 'standard'}</span>
                        </div>
                        <button class="use-alternative" onclick="window.textTranslator.useAlternative('${alt.text}', '${alt.style || 'standard'}')">
                            Use This
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Insert after main content (results container removed)
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.appendChild(alternativesContainer);
        }
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (alternativesContainer.parentNode) {
                alternativesContainer.remove();
            }
        }, 10000);
    }

    useAlternative(alternativeText, style) {
        console.log('🔄 [TextTranslator] Using alternative:', alternativeText);
        
        // Update the last translation in history with the alternative
        if (this.translationHistory.length > 0) {
            this.translationHistory[0].translated = alternativeText;
            this.renderHistory(); // Refresh the history display
        }
        
        // Record user preference
        this.translationAlternatives.recordUserPreference(
            this.elements.sourceText?.value || '',
            alternativeText,
            style
        );
        
        // Remove alternatives panel
        const alternativesPanel = document.querySelector('.alternatives-panel');
        if (alternativesPanel) {
            alternativesPanel.remove();
        }
        
        toast('Alternative translation applied', 'success');
    }

    handleTranslationError(error) {
        this.isTranslating = false;
        this.hideProgress();
        this.updateTranslateButton(false);

        toast('Translation failed: ' + (error.message || 'Unknown error'), 'error');
    }

    addToHistory(translationData) {
        console.log('📚 [TextTranslator] addToHistory called with:', translationData);
        
        this.translationHistory.unshift(translationData);
        console.log('📚 [TextTranslator] History length:', this.translationHistory.length);
        
        // Limit history to 100 items
        if (this.translationHistory.length > 100) {
            console.log('📚 [TextTranslator] Limiting history to 100 items');
            this.translationHistory = this.translationHistory.slice(0, 100);
        }

        console.log('🎨 [TextTranslator] Rendering history...');
        this.renderHistory();
    }

    renderHistory() {
        console.log('🎨 [TextTranslator] renderHistory called');
        
        if (!this.elements.historyContainer) {
            console.error('❌ [TextTranslator] History container not found!');
            return;
        }

        console.log('📚 [TextTranslator] Rendering', this.translationHistory.length, 'history items');
        // Clear existing content
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
                    <div class="history-original">
                        <strong>Original:</strong> ${item.original}
                    </div>
                    <div class="history-translated">
                        <strong>Translated:</strong> ${item.translated}
                    </div>
                </div>
                <div class="history-item-actions">
                    <button class="btn btn-ghost btn-sm reuse-btn" title="Reuse this translation">
                        <i class="fas fa-redo"></i> Reuse
                    </button>
                    <button class="btn btn-ghost btn-sm favorite-btn" title="Add to favorites">
                        <i class="far fa-star"></i> Favorite
                    </button>
                </div>
            `;
            
            // Add click to reuse
            const reuseBtn = historyItem.querySelector('.reuse-btn');
            reuseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.reuseTranslation(item);
            });
            
            // Add favorite button
            const favoriteBtn = historyItem.querySelector('.favorite-btn');
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(item.id);
            });
            
            // Update favorite button state
            this.updateFavoriteButton(item.id, this.isFavorited(item.id));
            
            this.elements.historyContainer.appendChild(historyItem);
        });
    }

    reuseTranslation(item) {
        if (this.elements.sourceText) {
            this.elements.sourceText.value = item.original;
        }
        if (this.elements.sourceLanguage) {
            this.elements.sourceLanguage.value = item.from;
        }
        if (this.elements.targetLanguage) {
            this.elements.targetLanguage.value = item.to;
        }
        
        // Trigger text counter update
        if (this.textCounter) {
            this.textCounter.updateCounter();
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
                        <div class="history-original">
                            <strong>Original:</strong> ${item.original}
                        </div>
                        <div class="history-translated">
                            <strong>Translated:</strong> ${item.translated}
                        </div>
                    </div>
                `;
                
                historyItem.addEventListener('click', () => {
                    this.reuseTranslation(item);
                });
                
                this.elements.historyContainer.appendChild(historyItem);
            });
        }
    }

    clearAllText() {
        if (this.elements.sourceText) {
            this.elements.sourceText.value = '';
        }
        
        if (this.textCounter) {
            this.textCounter.updateCounter();
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

    handleTextInput(text) {
        // Auto-detect language if set to auto
        if (this.elements.sourceLanguage?.value === 'auto' && text.length > 10) {
            const detectedLang = LanguageDetector.detectLanguage(text);
            const langCode = LanguageDetector.getLanguageCode(detectedLang);
            
            // Update language selection if different
            if (langCode !== 'en') {
                this.elements.sourceLanguage.value = langCode;
            }
        }
    }

    showProgress(message) {
        if (this.elements.loadingSpinner) {
            const progressText = this.elements.loadingSpinner.querySelector('div:last-child');
            if (progressText) {
                progressText.textContent = message;
            }
            this.elements.loadingSpinner.classList.add('show');
        }
    }

    hideProgress() {
        if (this.elements.loadingSpinner) {
            this.elements.loadingSpinner.classList.remove('show');
        }
    }

    updateTranslateButton(isTranslating) {
        if (this.elements.translateBtn) {
            this.elements.translateBtn.disabled = isTranslating;
            const icon = this.elements.translateBtn.querySelector('i');
            const text = this.elements.translateBtn.querySelector('span') || this.elements.translateBtn.childNodes[2];
            
            if (isTranslating) {
                if (icon) icon.className = 'fas fa-spinner fa-spin';
                if (text) text.textContent = 'Translating...';
            } else {
                if (icon) icon.className = 'fas fa-language';
                if (text) text.textContent = 'Translate';
            }
        }
    }

    updateConnectionStatus(text, type) {
        if (this.elements.statusText) {
            this.elements.statusText.textContent = text;
        }

        if (this.elements.statusDot) {
            this.elements.statusDot.className = `status-dot ${type}`;
        }
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to translate
        if ((e.ctrlKey || e.metaKey) && e.code === 'Enter') {
            e.preventDefault();
            this.translateText();
        }

        // Escape to clear
        if (e.code === 'Escape') {
            this.clearAllText();
        }

        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
            e.preventDefault();
            this.saveCurrentTranslation();
        }

        // Ctrl/Cmd + E to export
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyE') {
            e.preventDefault();
            this.showExportOptions();
        }
    }

    saveCurrentTranslation() {
        const text = this.elements.sourceText?.value?.trim();
        if (!text) {
            toast('No text to save', 'warning');
            return;
        }

        // Save to localStorage as draft
        localStorage.setItem('draftTranslation', text);
        toast('Translation saved as draft', 'success');
    }

    showExportOptions() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Export Options</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="export-options">
                        <button class="btn btn-primary" id="export-pdf-modal">
                            <i class="fas fa-file-pdf"></i> Export as PDF
                        </button>
                        <button class="btn btn-primary" id="export-txt-modal">
                            <i class="fas fa-file-alt"></i> Export as TXT
                        </button>
                        <button class="btn btn-primary" id="export-word-modal">
                            <i class="fas fa-file-word"></i> Export as Word
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#export-pdf-modal').addEventListener('click', () => {
            this.exportHistory('pdf');
            modal.remove();
        });

        modal.querySelector('#export-txt-modal').addEventListener('click', () => {
            this.exportHistory('txt');
            modal.remove();
        });

        modal.querySelector('#export-word-modal').addEventListener('click', () => {
            this.exportHistory('word');
            modal.remove();
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    exportHistory(format) {
        if (this.translationHistory.length === 0) {
            toast('No translations to export', 'warning');
            return;
        }

        try {
            let content = '';
            let filename = '';

            switch (format) {
                case 'pdf':
                    this.exportToPDF();
                    return;
                case 'txt':
                    content = this.translationHistory.map(item => 
                        `Original: ${item.original}\nTranslated: ${item.translated}\n---\n`
                    ).join('\n');
                    filename = `translations_${new Date().toISOString().split('T')[0]}.txt`;
                    break;
                case 'word':
                    content = this.translationHistory.map(item => 
                        `<p><strong>Original:</strong> ${item.original}</p><p><strong>Translated:</strong> ${item.translated}</p><hr>`
                    ).join('');
                    filename = `translations_${new Date().toISOString().split('T')[0]}.html`;
                    break;
            }

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            toast(`Exported as ${format.toUpperCase()}`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            toast('Export failed', 'error');
        }
    }

    exportToPDF() {
        // This would require a PDF library like jsPDF
        toast('PDF export requires additional setup', 'info');
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all translation history?')) {
            this.translationHistory = [];
            this.renderHistory();
            this.saveTranslationHistory();
            toast('History cleared', 'success');
        }
    }


    loadTranslationHistory() {
        try {
            const saved = localStorage.getItem('translationHistory');
            if (saved) {
                this.translationHistory = JSON.parse(saved);
                this.renderHistory();
            }
        } catch (error) {
            console.error('Error loading translation history:', error);
        }
    }

    saveTranslationHistory() {
        try {
            localStorage.setItem('translationHistory', JSON.stringify(this.translationHistory));
        } catch (error) {
            console.error('Error saving translation history:', error);
        }
    }

    // Connection is now handled via HTTP API, no need for reconnection logic

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API
    getState() {
        return {
            isInitialized: this.isInitialized,
            isConnected: this.isConnected,
            isTranslating: this.isTranslating,
            translationCount: this.translationHistory.length
        };
    }

    /**
     * Setup real-time translation controls
     */
    setupRealTimeControls() {
        console.log('🎛️ [TextTranslator] Setting up real-time controls...');
        
        // Real-time toggle
        const realtimeToggle = document.getElementById('realtime-toggle');
        if (realtimeToggle) {
            realtimeToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.enableRealTimeTranslation();
                } else {
                    this.disableRealTimeTranslation();
                }
            });
            console.log('✅ [TextTranslator] Real-time toggle listener added');
        } else {
            console.error('❌ [TextTranslator] Real-time toggle not found!');
        }
    }

    setupAdvancedFeatures() {
        console.log('🚀 [TextTranslator] Setting up Phase 3 advanced features...');
        
        // Memory suggestions button
        const memoryBtn = document.getElementById('memory-suggestions');
        if (memoryBtn) {
            memoryBtn.addEventListener('click', () => {
                const text = this.elements.sourceText?.value?.trim();
                const fromLang = this.elements.sourceLanguage?.value || 'auto';
                const toLang = this.elements.targetLanguage?.value || 'en';
                
                if (text && text.length > 2) {
                    this.showMemorySuggestions(text, fromLang, toLang);
                } else {
                    toast('Please enter some text to find memory suggestions', 'warning');
                }
            });
            console.log('✅ [TextTranslator] Memory suggestions button listener added');
        }
        
        // Favorites panel button
        const favoritesBtn = document.getElementById('favorites-panel');
        if (favoritesBtn) {
            favoritesBtn.addEventListener('click', () => {
                this.showFavoritesPanel();
            });
            console.log('✅ [TextTranslator] Favorites panel button listener added');
        }
        
        // Search translations button
        const searchBtn = document.getElementById('search-translations');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.showSearchPanel();
            });
            console.log('✅ [TextTranslator] Search translations button listener added');
        }
        
        console.log('✅ [TextTranslator] Phase 3 advanced features setup complete');
    }

    showSearchPanel() {
        console.log('🔍 [TextTranslator] Showing search panel...');
        
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-panel';
        searchContainer.innerHTML = `
            <div class="search-header">
                <h4>Search Translations</h4>
                <button class="close-search" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="search-content">
                <div class="search-input-group">
                    <input type="text" id="search-query" class="input" placeholder="Search translations..." aria-label="Search query">
                    <button id="search-btn" class="btn btn-primary">
                        <i class="fas fa-search"></i> Search
                    </button>
                </div>
                <div class="search-filters">
                    <select id="search-language" class="select">
                        <option value="">All Languages</option>
                        <option value="ar-en">Arabic → English</option>
                        <option value="en-ar">English → Arabic</option>
                    </select>
                    <select id="search-sort" class="select">
                        <option value="relevance">Relevance</option>
                        <option value="date">Date</option>
                        <option value="confidence">Confidence</option>
                    </select>
                </div>
                <div class="search-results" id="search-results">
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>Enter a search query to find translations</p>
                    </div>
                </div>
            </div>
        `;
        
        // Insert after main content (results container removed)
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.appendChild(searchContainer);
        }
        
        // Setup search functionality
        const searchQuery = document.getElementById('search-query');
        const searchBtn = document.getElementById('search-btn');
        const searchResults = document.getElementById('search-results');
        
        const performSearch = () => {
            const query = searchQuery.value.trim();
            if (!query) return;
            
            const languageFilter = document.getElementById('search-language').value;
            const sortBy = document.getElementById('search-sort').value;
            
            const options = {
                sortBy: sortBy,
                limit: 20
            };
            
            if (languageFilter) {
                options.filters = { languages: [languageFilter] };
            }
            
            // Search through translation history
            const results = this.searchTranslationHistory(query, options);
            
            if (results.length > 0) {
                searchResults.innerHTML = results.map(result => `
                    <div class="search-result-item" data-id="${result.id}">
                        <div class="result-content">
                            <div class="result-original">${result.original}</div>
                            <div class="result-translated">${result.translated}</div>
                            <div class="result-meta">
                                <span class="language-pair">${result.fromLang} → ${result.toLang}</span>
                                <span class="confidence">${Math.round((result.confidence || 0) * 100)}%</span>
                                <span class="date">${new Date(result.timestamp).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div class="result-actions">
                            <button class="use-result" onclick="window.textTranslator.useSearchResult('${result.id}')">
                                Use
                            </button>
                            <button class="favorite-result ${this.isFavorited(result.id) ? 'favorited' : ''}" onclick="window.textTranslator.toggleFavorite('${result.id}')">
                                <i class="fas fa-star"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
            } else {
                searchResults.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <p>No translations found for "${query}"</p>
                    </div>
                `;
            }
        };
        
        searchBtn.addEventListener('click', performSearch);
        searchQuery.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
        
        // Focus on search input
        searchQuery.focus();
    }

    useSearchResult(resultId) {
        console.log('🔍 [TextTranslator] Using search result:', resultId);
        
        // Find the result in translation history
        const result = this.translationHistory.find(item => item.id == resultId);
        
        if (result) {
            // Update the source text
            this.elements.sourceText.value = result.original;
            
            // Update language selections
            this.elements.sourceLanguage.value = result.fromLang;
            this.elements.targetLanguage.value = result.toLang;
            
            // Trigger translation
            this.translateText();
            
            // Remove search panel
            const searchPanel = document.querySelector('.search-panel');
            if (searchPanel) {
                searchPanel.remove();
            }
            
            toast('Search result applied', 'success');
        } else {
            toast('Search result not found', 'error');
        }
    }

    toggleFavorite(translationId) {
        console.log('⭐ [TextTranslator] Toggling favorite:', translationId);
        
        if (this.isFavorited(translationId)) {
            this.removeFromFavorites(translationId);
            toast('Removed from favorites', 'info');
        } else {
            // Get translation data from history or search results
            let translationData = null;
            
            // First try to find in translation history
            const historyItem = this.translationHistory.find(item => item.id == translationId);
            if (historyItem) {
                translationData = historyItem;
            } else {
                // Try to find in search index
                const result = this.advancedSearch.searchIndex.get(translationId);
                if (result) {
                    translationData = result;
                }
            }
            
            if (translationData) {
                this.addToFavorites(translationData, 'general', []);
                toast('Added to favorites', 'success');
                // Update the favorite button
                this.updateFavoriteButton(translationId, true);
            } else {
                toast('Translation not found', 'error');
            }
        }
    }

    addFavoriteButtonToTranslation(translationId) {
        console.log('⭐ [TextTranslator] Adding favorite button to translation:', translationId);
        
        // Find the translation item in the DOM
        const translationItem = document.querySelector(`[data-translation-id="${translationId}"]`);
        if (translationItem) {
            // Check if favorite button already exists
            let favoriteBtn = translationItem.querySelector('.favorite-btn');
            
            if (!favoriteBtn) {
                // Create favorite button
                favoriteBtn = document.createElement('button');
                favoriteBtn.className = 'favorite-btn btn btn-ghost';
                favoriteBtn.innerHTML = '<i class="fas fa-star"></i>';
                favoriteBtn.title = 'Add to favorites';
                favoriteBtn.onclick = () => this.toggleFavorite(translationId);
                
                // Find the actions container or create one
                let actionsContainer = translationItem.querySelector('.translation-actions');
                if (!actionsContainer) {
                    actionsContainer = document.createElement('div');
                    actionsContainer.className = 'translation-actions';
                    translationItem.appendChild(actionsContainer);
                }
                
                actionsContainer.appendChild(favoriteBtn);
            }
            
            // Update button state
            this.updateFavoriteButton(translationId, this.isFavorited(translationId));
        }
    }

    updateFavoriteButton(translationId, isFavorited) {
        const translationItem = document.querySelector(`[data-translation-id="${translationId}"]`);
        if (translationItem) {
            const favoriteBtn = translationItem.querySelector('.favorite-btn');
            if (favoriteBtn) {
                if (isFavorited) {
                    favoriteBtn.classList.add('favorited');
                    favoriteBtn.innerHTML = '<i class="fas fa-star"></i>';
                    favoriteBtn.title = 'Remove from favorites';
                } else {
                    favoriteBtn.classList.remove('favorited');
                    favoriteBtn.innerHTML = '<i class="far fa-star"></i>';
                    favoriteBtn.title = 'Add to favorites';
                }
            }
        }
    }

    updateExistingTranslationItems() {
        console.log('🔄 [TextTranslator] Updating existing translation items...');
        
        // Find all existing translation items (both in results and history)
        const translationItems = document.querySelectorAll('.translation-item, .history-item');
        
        translationItems.forEach(item => {
            const translationId = item.getAttribute('data-translation-id');
            if (translationId) {
                // Update favorite button state
                this.updateFavoriteButton(translationId, this.isFavorited(translationId));
            }
        });
        
        console.log(`✅ [TextTranslator] Updated ${translationItems.length} existing translation items`);
    }

    /**
     * Enable real-time translation
     */
    enableRealTimeTranslation() {
        if (this.realTimeTranslation) {
            this.realTimeTranslation.enable();
            console.log('✅ [TextTranslator] Real-time translation enabled');
        }
    }
    
    /**
     * Initialize virtual scrolling for history
     */
    initializeVirtualScrolling() {
        try {
            if (this.elements.historyContainer) {
                this.historyScroller = new TranslationHistoryScroller(this.elements.historyContainer, {
                    itemHeight: 80,
                    bufferSize: 5
                });
                console.log('✅ [TextTranslator] Virtual scrolling initialized');
            }
        } catch (error) {
            console.error('❌ [TextTranslator] Failed to initialize virtual scrolling:', error);
        }
    }
    
    /**
     * Initialize RTL support
     */
    initializeRTLSupport() {
        try {
            // Set up RTL detection for language changes
            this.setupRTLDetection();
            console.log('✅ [TextTranslator] RTL support initialized');
        } catch (error) {
            console.error('❌ [TextTranslator] Failed to initialize RTL support:', error);
        }
    }
    
    /**
     * Setup RTL detection
     */
    setupRTLDetection() {
        // Watch for language changes
        if (this.elements.sourceLanguage) {
            this.elements.sourceLanguage.addEventListener('change', (e) => {
                this.updateRTLSupport(e.target.value);
            });
        }
        
        if (this.elements.targetLanguage) {
            this.elements.targetLanguage.addEventListener('change', (e) => {
                this.updateRTLSupport(e.target.value);
            });
        }
    }
    
    /**
     * Update RTL support based on language
     */
    updateRTLSupport(languageCode) {
        if (rtlSupport.isRTLLanguage(languageCode)) {
            this.rtlEnabled = true;
            this.currentLanguage = languageCode;
            
            // Apply RTL styling to text areas
            const textElements = [
                this.elements.sourceText,
                ...document.querySelectorAll('.translation-result')
            ].filter(Boolean);
            
            rtlSupport.updateTextDirection(textElements, languageCode);
            
            // Announce language change
            accessibilityManager.announce(`Language changed to ${languageCode}, RTL mode enabled`);
        } else {
            this.rtlEnabled = false;
            this.currentLanguage = languageCode;
            
            // Apply LTR styling
            const textElements = [
                this.elements.sourceText,
                ...document.querySelectorAll('.translation-result')
            ].filter(Boolean);
            
            rtlSupport.updateTextDirection(textElements, languageCode);
            
            // Announce language change
            accessibilityManager.announce(`Language changed to ${languageCode}, LTR mode enabled`);
        }
    }
    
    /**
     * Initialize accessibility features
     */
    initializeAccessibility() {
        try {
            // Setup ARIA labels for translation interface
            this.setupTranslationARIA();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            console.log('✅ [TextTranslator] Accessibility features initialized');
        } catch (error) {
            console.error('❌ [TextTranslator] Failed to initialize accessibility:', error);
        }
    }
    
    /**
     * Setup translation-specific ARIA labels
     */
    setupTranslationARIA() {
        // Add ARIA labels to translation elements
        const elements = {
            '.source-text': 'Source text to translate',
            '.target-text': 'Translated text',
            '.translate-btn': 'Translate text',
            '.clear-btn': 'Clear all text',
            '.swap-btn': 'Swap source and target languages',
            '.history-item': 'Translation history item',
            '.favorite-btn': 'Add to favorites'
        };
        
        Object.entries(elements).forEach(([selector, label]) => {
            const element = document.querySelector(selector);
            if (element && !element.getAttribute('aria-label')) {
                element.setAttribute('aria-label', label);
            }
        });
    }
    
    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only prevent default for specific shortcuts, not for space in textarea
            if (e.target.tagName === 'TEXTAREA' && e.key === ' ') {
                console.log('🔍 [KeyboardShortcuts] Space in textarea - allowing default behavior');
                return; // Don't interfere with space in textarea
            }
            
            // Ctrl/Cmd + Enter to translate
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.translate();
            }
            
            // Ctrl/Cmd + K to clear
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.clearAll();
            }
            
            // Ctrl/Cmd + S to swap languages
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.swapLanguages();
            }
        });
    }
    
    /**
     * Initialize performance optimization
     */
    initializePerformanceOptimization() {
        try {
            // Performance optimization is automatically initialized
            console.log('✅ [TextTranslator] Performance optimization initialized');
        } catch (error) {
            console.error('❌ [TextTranslator] Failed to initialize performance optimization:', error);
        }
    }
    
    /**
     * Initialize security hardening
     */
    initializeSecurityHardening() {
        try {
            // Security hardening is automatically initialized
            console.log('✅ [TextTranslator] Security hardening initialized');
        } catch (error) {
            console.error('❌ [TextTranslator] Failed to initialize security hardening:', error);
        }
    }
    
    /**
     * Initialize user feedback system
     */
    initializeUserFeedback() {
        try {
            // User feedback system is automatically initialized
            console.log('✅ [TextTranslator] User feedback system initialized');
        } catch (error) {
            console.error('❌ [TextTranslator] Failed to initialize user feedback system:', error);
        }
    }
    
    /**
     * Initialize help system
     */
    initializeHelpSystem() {
        try {
            // Help system is automatically initialized
            console.log('✅ [TextTranslator] Help system initialized');
        } catch (error) {
            console.error('❌ [TextTranslator] Failed to initialize help system:', error);
        }
    }

    /**
     * Initialize voice input
     */
    initializeVoiceInput() {
        console.log('🎤 [TextTranslator] Setting up voice input...');
        
        if (!this.voiceInput) {
            console.warn('🎤 [TextTranslator] Voice input not available');
            return;
        }

        // Setup voice input event listeners
        this.setupVoiceInputEventListeners();
        
        // Setup voice input UI
        this.setupVoiceInputUI();
        
        console.log('🎤 [TextTranslator] Voice input initialized');
    }

    /**
     * Setup voice input event listeners
     */
    setupVoiceInputEventListeners() {
        // Voice input button
        const voiceBtn = document.getElementById('voice-input-btn');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                this.toggleVoiceInput();
            });
        }

        // Voice input options
        const continuousCheckbox = document.getElementById('voice-continuous');
        if (continuousCheckbox) {
            continuousCheckbox.addEventListener('change', (e) => {
                this.voiceInput.setContinuousMode(e.target.checked);
            });
        }

        const interimCheckbox = document.getElementById('voice-interim');
        if (interimCheckbox) {
            interimCheckbox.addEventListener('change', (e) => {
                this.voiceInput.setInterimResults(e.target.checked);
            });
        }

        const audioFeedbackCheckbox = document.getElementById('voice-audio-feedback');
        if (audioFeedbackCheckbox) {
            audioFeedbackCheckbox.addEventListener('change', (e) => {
                this.voiceInput.setAudioFeedback(e.target.checked);
            });
        }

        // Voice input events
        document.addEventListener('voiceInput:voiceStart', (e) => {
            this.handleVoiceStart(e.detail);
        });

        document.addEventListener('voiceInput:voiceResult', (e) => {
            this.handleVoiceResult(e.detail);
        });

        document.addEventListener('voiceInput:voiceFinal', (e) => {
            this.handleVoiceFinal(e.detail);
        });

        document.addEventListener('voiceInput:voiceError', (e) => {
            this.handleVoiceError(e.detail);
        });

        document.addEventListener('voiceInput:voiceEnd', (e) => {
            this.handleVoiceEnd(e.detail);
        });
    }

    /**
     * Setup voice input UI
     */
    setupVoiceInputUI() {
        // Update voice input button state
        this.updateVoiceInputButton();
        
        // Setup keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + V for voice input
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
                e.preventDefault();
                this.toggleVoiceInput();
            }
        });
    }

    /**
     * Toggle voice input
     */
    toggleVoiceInput() {
        if (!this.voiceInput) {
            console.warn('🎤 [TextTranslator] Voice input not available');
            return;
        }

        if (this.voiceInput.isListening) {
            this.voiceInput.stopListening();
        } else {
            this.voiceInput.startListening();
        }
    }

    /**
     * Handle voice start
     */
    handleVoiceStart(detail) {
        console.log('🎤 [TextTranslator] Voice input started');
        this.updateVoiceInputButton();
        this.updateVoiceInputControls('listening');
    }

    /**
     * Handle voice result
     */
    handleVoiceResult(detail) {
        // Update transcript display is handled by voice input module
        console.log('🎤 [TextTranslator] Voice result:', detail.interim ? 'interim' : 'final');
    }

    /**
     * Handle voice final
     */
    handleVoiceFinal(detail) {
        console.log('🎤 [TextTranslator] Voice final result:', detail.transcript);
        
        // Update source text if needed
        if (this.elements.sourceText && detail.transcript) {
            const currentText = this.elements.sourceText.value;
            // Only add if not already present (avoid duplication)
            if (!currentText.includes(detail.transcript)) {
                const newText = currentText ? `${currentText} ${detail.transcript}` : detail.transcript;
                this.elements.sourceText.value = newText;
                
                // Trigger input event for real-time translation
                this.elements.sourceText.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    /**
     * Handle voice error
     */
    handleVoiceError(detail) {
        console.error('🎤 [TextTranslator] Voice input error:', detail.error);
        this.updateVoiceInputButton();
        this.updateVoiceInputControls('error');
    }

    /**
     * Handle voice end
     */
    handleVoiceEnd(detail) {
        console.log('🎤 [TextTranslator] Voice input ended');
        this.updateVoiceInputButton();
        this.updateVoiceInputControls('idle');
    }

    /**
     * Update voice input button
     */
    updateVoiceInputButton() {
        const voiceBtn = document.getElementById('voice-input-btn');
        if (!voiceBtn || !this.voiceInput) return;

        const status = this.voiceInput.getStatus();
        
        voiceBtn.classList.remove('active', 'paused', 'disabled');
        
        if (!status.isSupported) {
            voiceBtn.disabled = true;
            voiceBtn.classList.add('disabled');
        } else if (status.isListening) {
            if (status.isPaused) {
                voiceBtn.classList.add('paused');
            } else {
                voiceBtn.classList.add('active');
            }
        }
    }

    /**
     * Update voice input controls
     */
    updateVoiceInputControls(state) {
        const controls = document.querySelector('.voice-input-controls');
        if (!controls) return;

        controls.classList.remove('listening', 'paused', 'error');
        
        if (state !== 'idle') {
            controls.classList.add(state);
        }
    }

    /**
     * Disable real-time translation
     */
    disableRealTimeTranslation() {
        if (this.realTimeTranslation) {
            this.realTimeTranslation.disable();
            console.log('✅ [TextTranslator] Real-time translation disabled');
        }
    }

    /**
     * Toggle real-time translation
     */
    toggleRealTimeTranslation() {
        if (this.realTimeTranslation) {
            if (this.realTimeTranslation.isEnabled) {
                this.disableRealTimeTranslation();
            } else {
                this.enableRealTimeTranslation();
            }
        }
    }

    // Phase 3: Translation Memory Methods
    getTranslationFromMemory(original, fromLang, toLang) {
        console.log('🧠 [TextTranslator] Getting translation from memory...');
        return this.translationMemory.getFromMemory(original, fromLang, toLang);
    }

    findSimilarTranslations(original, fromLang, toLang) {
        console.log('🧠 [TextTranslator] Finding similar translations...');
        return this.translationMemory.findSimilarTranslations(original, fromLang, toLang);
    }

    getUserPreferences(fromLang, toLang) {
        console.log('🧠 [TextTranslator] Getting user preferences...');
        return this.translationMemory.getUserPreferences(fromLang, toLang);
    }

    getMemoryStats() {
        return this.translationMemory.getMemoryStats();
    }

    // Phase 3: Advanced Search Methods
    searchTranslations(query, options = {}) {
        console.log('🔍 [TextTranslator] Searching translations...');
        return this.advancedSearch.search(query, options);
    }

    getSearchSuggestions(query) {
        console.log('🔍 [TextTranslator] Getting search suggestions...');
        return this.advancedSearch.getSuggestions(query);
    }

    getSearchStats() {
        return this.advancedSearch.getSearchStats();
    }

    searchTranslationHistory(query, options = {}) {
        console.log('🔍 [TextTranslator] Searching translation history for:', query);
        
        if (!query || query.trim().length === 0) {
            return [];
        }
        
        if (!this.translationHistory || !Array.isArray(this.translationHistory)) {
            console.warn('⚠️ [TextTranslator] Translation history is not available');
            return [];
        }
        
        const queryLower = query.toLowerCase().trim();
        const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);
        const results = [];
        
        for (const translation of this.translationHistory) {
            try {
                // Validate translation object
                if (!translation || typeof translation !== 'object') {
                    continue;
                }
                
                let score = 0;
                let matches = [];
                
                // Get text to search
                const originalText = translation.original || '';
                const translatedText = translation.translated || '';
                const originalLower = originalText.toLowerCase();
                const translatedLower = translatedText.toLowerCase();
                
                // Exact phrase match (highest priority)
                if (originalLower.includes(queryLower)) {
                    score += 100;
                    matches.push('original-exact');
                }
                
                if (translatedLower.includes(queryLower)) {
                    score += 90;
                    matches.push('translated-exact');
                }
                
                // Word-by-word matching
                let originalWordMatches = 0;
                let translatedWordMatches = 0;
                
                for (const word of queryWords) {
                    if (originalLower.includes(word)) {
                        originalWordMatches++;
                        score += 20;
                    }
                    if (translatedLower.includes(word)) {
                        translatedWordMatches++;
                        score += 15;
                    }
                }
                
                // Add bonus for multiple word matches
                if (originalWordMatches > 0) {
                    score += originalWordMatches * 10;
                    matches.push(`original-words-${originalWordMatches}`);
                }
                
                if (translatedWordMatches > 0) {
                    score += translatedWordMatches * 8;
                    matches.push(`translated-words-${translatedWordMatches}`);
                }
                
                // Check for partial matches (substring)
                if (originalLower.includes(queryLower)) {
                    score += 30;
                    matches.push('original-partial');
                }
                
                if (translatedLower.includes(queryLower)) {
                    score += 25;
                    matches.push('translated-partial');
                }
                
                // Check language pair filter
                if (options.filters && options.filters.languages) {
                    const fromLang = translation.fromLang || translation.from || 'unknown';
                    const toLang = translation.toLang || translation.to || 'unknown';
                    const langPair = `${fromLang}-${toLang}`;
                    if (!options.filters.languages.includes(langPair)) {
                        continue;
                    }
                }
                
                if (score > 0) {
                    results.push({
                        ...translation,
                        score: score,
                        matches: matches,
                        relevance: this.calculateRelevance(query, translation)
                    });
                }
            } catch (error) {
                console.warn('⚠️ [TextTranslator] Error processing translation:', error, translation);
                continue;
            }
        }
        
        // Sort results
        const sortBy = options.sortBy || 'relevance';
        results.sort((a, b) => {
            switch (sortBy) {
                case 'date':
                    return (b.timestamp || 0) - (a.timestamp || 0);
                case 'confidence':
                    return (b.confidence || 0) - (a.confidence || 0);
                case 'relevance':
                default:
                    return b.score - a.score;
            }
        });
        
        // Limit results
        const limit = options.limit || 20;
        const limitedResults = results.slice(0, limit);
        
        console.log(`🔍 [TextTranslator] Found ${limitedResults.length} results in translation history`);
        return limitedResults;
    }

    calculateRelevance(query, translation) {
        try {
            const queryWords = query.toLowerCase().split(/\s+/);
            const originalText = translation.original || '';
            const translatedText = translation.translated || '';
            const originalWords = originalText.toLowerCase().split(/\s+/);
            const translatedWords = translatedText.toLowerCase().split(/\s+/);
            
            let relevance = 0;
            
            // Word overlap with original
            for (const word of queryWords) {
                if (originalWords.includes(word)) {
                    relevance += 1;
                }
            }
            
            // Word overlap with translated
            for (const word of queryWords) {
                if (translatedWords.includes(word)) {
                    relevance += 0.8;
                }
            }
            
            // Phrase matching
            if (originalText.toLowerCase().includes(query.toLowerCase())) {
                relevance += 2;
            }
            
            if (translatedText.toLowerCase().includes(query.toLowerCase())) {
                relevance += 1.5;
            }
            
            return relevance;
        } catch (error) {
            console.warn('⚠️ [TextTranslator] Error calculating relevance:', error);
            return 0;
        }
    }

    // Phase 3: Favorites System Methods
    addToFavorites(translation, category = 'general', tags = []) {
        console.log('⭐ [TextTranslator] Adding to favorites...', translation);
        if (!this.favoritesSystem) {
            console.warn('⚠️ [TextTranslator] Favorites system not initialized yet');
            return false;
        }
        const result = this.favoritesSystem.addToFavorites(translation, category, tags);
        console.log('⭐ [TextTranslator] Add to favorites result:', result);
        return result;
    }

    removeFromFavorites(translationId) {
        console.log('⭐ [TextTranslator] Removing from favorites...');
        return this.favoritesSystem.removeFromFavorites(translationId);
    }

    isFavorited(translationId) {
        if (!this.favoritesSystem) {
            console.warn('⚠️ [TextTranslator] Favorites system not initialized yet');
            return false;
        }
        return this.favoritesSystem.isFavorited(translationId);
    }

    getFavorites(options = {}) {
        console.log('⭐ [TextTranslator] Getting favorites...');
        if (!this.favoritesSystem) {
            console.warn('⚠️ [TextTranslator] Favorites system not initialized yet');
            return [];
        }
        return this.favoritesSystem.getFavorites(options);
    }

    updateFavorite(translationId, updates) {
        console.log('⭐ [TextTranslator] Updating favorite...');
        return this.favoritesSystem.updateFavorite(translationId, updates);
    }

    getFavoritesStats() {
        return this.favoritesSystem.getStats();
    }

    // Phase 3: Enhanced UI Methods
    showMemorySuggestions(original, fromLang, toLang) {
        console.log('🧠 [TextTranslator] Showing memory suggestions...');
        const similar = this.findSimilarTranslations(original, fromLang, toLang);
        
        if (similar.length > 0) {
            const suggestionsContainer = document.createElement('div');
            suggestionsContainer.className = 'memory-suggestions';
            suggestionsContainer.innerHTML = `
                <div class="suggestions-header">
                    <h4>Similar Translations Found</h4>
                    <button class="close-suggestions" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="suggestions-list">
                    ${similar.slice(0, 3).map(sim => `
                        <div class="suggestion-item" data-key="${sim.key}">
                            <div class="suggestion-original">${sim.original}</div>
                            <div class="suggestion-translated">${sim.translated}</div>
                            <div class="suggestion-meta">
                                <span class="similarity">${Math.round(sim.similarity * 100)}% similar</span>
                                <span class="usage">Used ${sim.usageCount} times</span>
                            </div>
                            <button class="use-suggestion" onclick="window.textTranslator.useMemorySuggestion('${sim.key}')">
                                Use This
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Insert after main content (results container removed)
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.appendChild(suggestionsContainer);
            }
        }
    }

    useMemorySuggestion(suggestionKey) {
        console.log('🧠 [TextTranslator] Using memory suggestion:', suggestionKey);
        const suggestion = this.translationMemory.memory.get(suggestionKey);
        
        if (suggestion) {
            // Update the source text
            this.elements.sourceText.value = suggestion.original;
            
            // Update language selections
            this.elements.sourceLanguage.value = suggestion.fromLang;
            this.elements.targetLanguage.value = suggestion.toLang;
            
            // Trigger translation
            this.translateText();
            
            // Remove suggestions panel
            const suggestionsPanel = document.querySelector('.memory-suggestions');
            if (suggestionsPanel) {
                suggestionsPanel.remove();
            }
            
            toast('Memory suggestion applied', 'success');
        }
    }

    showFavoritesPanel() {
        console.log('⭐ [TextTranslator] Showing favorites panel...');
        
        if (!this.favoritesSystem) {
            console.warn('⚠️ [TextTranslator] Favorites system not initialized yet');
            toast('Favorites system is not ready yet. Please try again in a moment.', 'warning');
            return;
        }
        
        const favorites = this.getFavorites({ sortBy: 'lastUsed', sortOrder: 'desc' });
        console.log('⭐ [TextTranslator] Found favorites:', favorites.length, favorites);
        
        const favoritesContainer = document.createElement('div');
        favoritesContainer.className = 'favorites-panel';
        favoritesContainer.innerHTML = `
            <div class="favorites-header">
                <h4>Your Favorites (${favorites.length})</h4>
                <button class="close-favorites" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="favorites-list">
                ${favorites.slice(0, 10).map(fav => `
                    <div class="favorite-item" data-id="${fav.id}">
                        <div class="favorite-content">
                            <div class="favorite-original">${fav.original}</div>
                            <div class="favorite-translated">${fav.translated}</div>
                            <div class="favorite-meta">
                                <span class="category">${fav.category}</span>
                                <span class="usage">Used ${fav.usageCount} times</span>
                            </div>
                        </div>
                        <div class="favorite-actions">
                            <button class="use-favorite" onclick="window.textTranslator.useFavorite('${fav.id}')">
                                Use
                            </button>
                            <button class="remove-favorite" onclick="window.textTranslator.removeFromFavorites('${fav.id}')">
                                Remove
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Insert after main content (results container removed)
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.appendChild(favoritesContainer);
        }
    }

    useFavorite(favoriteId) {
        console.log('⭐ [TextTranslator] Using favorite:', favoriteId);
        const favorite = this.favoritesSystem.getFavorite(favoriteId);
        
        if (favorite) {
            // Update the source text
            this.elements.sourceText.value = favorite.original;
            
            // Update language selections
            this.elements.sourceLanguage.value = favorite.fromLang;
            this.elements.targetLanguage.value = favorite.toLang;
            
            // Increment usage count
            this.favoritesSystem.incrementUsage(favoriteId);
            
            // Trigger translation
            this.translateText();
            
            // Remove favorites panel
            const favoritesPanel = document.querySelector('.favorites-panel');
            if (favoritesPanel) {
                favoritesPanel.remove();
            }
            
            toast('Favorite applied', 'success');
        }
    }

    destroy() {
        // Cleanup real-time translation
        if (this.realTimeTranslation) {
            this.realTimeTranslation.destroy();
        }
        
        // Cleanup Phase 2 modules
        if (this.contextAwareTranslation) {
            this.contextAwareTranslation.saveContext();
        }
        
        if (this.translationAlternatives) {
            this.translationAlternatives.savePreferences();
        }
        
        // Cleanup Phase 3 modules
        if (this.translationMemory) {
            this.translationMemory.saveMemory();
        }
        
        this.eventHandlers.clear();
        this.isInitialized = false;
    }

    /**
     * Cleanup method to prevent memory leaks
     */
    destroy() {
        if (this.isDestroyed) return;
        
        this.isDestroyed = true;
        console.log('🧹 [TextTranslator] Starting cleanup...');
        
        // Cleanup real-time translation
        if (this.realTimeTranslation) {
            this.realTimeTranslation.disable();
        }
        
        // Cleanup user feedback system
        if (this.userFeedback) {
            this.userFeedback.destroy();
        }
        
        // Cleanup voice input
        if (this.voiceInput) {
            this.voiceInput.destroy();
        }
        
        // Clear intervals and timeouts
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // Clear arrays
        this.translationHistory = [];
        this.eventHandlers.clear();
        
        // Clear UI elements
        this.elements = {};
        
        // Clear performance metrics
        this.performanceMetrics = {
            translationCount: 0,
            averageResponseTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        console.log('🧹 [TextTranslator] Cleanup completed');
    }

    /**
     * Initialize ultra-enhanced features
     */
    initializeUltraEnhancedFeatures() {
        console.log('🚀 [UltraEnhanced] Initializing ultra-enhanced features...');
        
        // Setup animations
        this.setupUltraAnimations();
        
        // Setup interactions
        this.setupUltraInteractions();
        
        // Setup performance monitoring
        this.setupUltraPerformanceMonitoring();
        
        // Setup advanced effects
        this.setupUltraAdvancedEffects();
        
        console.log('✅ [UltraEnhanced] Ultra-enhanced features initialized');
    }

    /**
     * Setup ultra-enhanced animations
     */
    setupUltraAnimations() {
        console.log('🎬 [UltraEnhanced] Setting up animations...');
        
        // Intersection Observer for scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('ultra-fade-in');
                }
            });
        }, observerOptions);

        // Observe all ultra-enhanced elements
        document.querySelectorAll('.ultra-glass-card, .ultra-feature-card, .stat').forEach(el => {
            observer.observe(el);
        });

        // Stagger animations for feature cards
        const featureCards = document.querySelectorAll('.ultra-feature-card');
        featureCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });

        console.log('✅ [UltraEnhanced] Animations setup complete');
    }

    /**
     * Setup ultra-enhanced interactions
     */
    setupUltraInteractions() {
        console.log('🎯 [UltraEnhanced] Setting up interactions...');

        // Enhanced button interactions
        document.querySelectorAll('.ultra-btn-enhanced').forEach(btn => {
            btn.addEventListener('mouseenter', (e) => {
                this.createRippleEffect(e.target, e);
            });

            btn.addEventListener('click', (e) => {
                this.createClickEffect(e.target, e);
            });
        });

        // Enhanced card interactions
        document.querySelectorAll('.ultra-glass-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                this.enhanceCardHover(card);
            });

            card.addEventListener('mouseleave', () => {
                this.resetCardHover(card);
            });
        });

        // Enhanced textarea interactions
        const textarea = document.getElementById('source-text');
        if (textarea) {
            textarea.addEventListener('focus', () => {
                this.enhanceTextareaFocus(textarea);
            });

            textarea.addEventListener('blur', () => {
                this.resetTextareaFocus(textarea);
            });
        }

        console.log('✅ [UltraEnhanced] Interactions setup complete');
    }

    /**
     * Setup ultra-enhanced performance monitoring
     */
    setupUltraPerformanceMonitoring() {
        console.log('📊 [UltraEnhanced] Setting up performance monitoring...');

        // Translation performance tracking
        this.translationStats = {
            count: 0,
            totalTime: 0,
            averageTime: 0,
            accuracy: 0
        };

        // Update statistics display
        this.updateUltraStatistics();

        console.log('✅ [UltraEnhanced] Performance monitoring setup complete');
    }

    /**
     * Setup ultra-enhanced advanced effects
     */
    setupUltraAdvancedEffects() {
        console.log('✨ [UltraEnhanced] Setting up advanced effects...');

        // Parallax effect for background
        this.setupUltraParallaxEffect();

        // Dynamic gradient effects
        this.setupUltraDynamicGradients();

        // Particle effects
        this.setupUltraParticleEffects();

        console.log('✅ [UltraEnhanced] Advanced effects setup complete');
    }

    /**
     * Create ripple effect on button hover
     */
    createRippleEffect(button, event) {
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
            z-index: 1;
        `;

        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    /**
     * Create click effect on button click
     */
    createClickEffect(button, event) {
        const clickEffect = document.createElement('div');
        const rect = button.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        clickEffect.style.cssText = `
            position: absolute;
            width: 20px;
            height: 20px;
            left: ${x - 10}px;
            top: ${y - 10}px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            transform: scale(0);
            animation: clickEffect 0.3s ease-out;
            pointer-events: none;
            z-index: 2;
        `;

        button.appendChild(clickEffect);

        setTimeout(() => {
            clickEffect.remove();
        }, 300);
    }

    /**
     * Enhance card hover effects
     */
    enhanceCardHover(card) {
        card.style.transform = 'translateY(-8px) scale(1.02)';
        card.style.boxShadow = '0 30px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2)';
        
        // Add glow effect
        const glow = document.createElement('div');
        glow.className = 'ultra-glow-effect';
        glow.style.cssText = `
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(45deg, #4f46e5, #06b6d4, #10b981);
            border-radius: inherit;
            opacity: 0.3;
            z-index: -1;
            animation: glowPulse 2s ease-in-out infinite;
        `;
        card.appendChild(glow);
    }

    /**
     * Reset card hover effects
     */
    resetCardHover(card) {
        card.style.transform = '';
        card.style.boxShadow = '';
        
        const glow = card.querySelector('.ultra-glow-effect');
        if (glow) {
            glow.remove();
        }
    }

    /**
     * Enhance textarea focus effects
     */
    enhanceTextareaFocus(textarea) {
        textarea.style.transform = 'translateY(-4px)';
        textarea.style.boxShadow = '0 0 30px rgba(79, 70, 229, 0.3), 0 10px 20px rgba(0, 0, 0, 0.2)';
        
        // Add typing indicator
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 20px;
            height: 20px;
            background: linear-gradient(45deg, #4f46e5, #06b6d4);
            border-radius: 50%;
            animation: typingPulse 1s ease-in-out infinite;
            z-index: 1;
        `;
        textarea.parentElement.style.position = 'relative';
        textarea.parentElement.appendChild(indicator);
    }

    /**
     * Reset textarea focus effects
     */
    resetTextareaFocus(textarea) {
        textarea.style.transform = '';
        textarea.style.boxShadow = '';
        
        const indicator = textarea.parentElement.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * Update ultra-enhanced statistics
     */
    updateUltraStatistics() {
        // Update translation count
        const translationCount = document.getElementById('translation-count');
        if (translationCount) {
            translationCount.textContent = this.translationStats.count;
        }

        // Update accuracy score
        const accuracyScore = document.getElementById('accuracy-score');
        if (accuracyScore) {
            accuracyScore.textContent = this.translationStats.accuracy > 0 ? `${this.translationStats.accuracy}%` : '--';
        }

        // Update speed score
        const speedScore = document.getElementById('speed-score');
        if (speedScore) {
            speedScore.textContent = this.translationStats.averageTime > 0 ? `${Math.round(this.translationStats.averageTime)}ms` : '--';
        }

        // Update history count
        const historyCount = document.getElementById('history-count');
        if (historyCount) {
            const historyItems = document.querySelectorAll('.history-item');
            historyCount.textContent = historyItems.length;
        }

        // Update today count
        const todayCount = document.getElementById('today-count');
        if (todayCount) {
            const today = new Date().toDateString();
            const todayItems = Array.from(document.querySelectorAll('.history-item')).filter(item => {
                const itemDate = new Date(item.dataset.date || 0).toDateString();
                return itemDate === today;
            });
            todayCount.textContent = todayItems.length;
        }
    }

    /**
     * Setup ultra-enhanced parallax effect
     */
    setupUltraParallaxEffect() {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const parallax = document.querySelector('.text-translator-container::before');
            if (parallax) {
                parallax.style.transform = `translateY(${scrolled * 0.5}px)`;
            }
        });
    }

    /**
     * Setup ultra-enhanced dynamic gradients
     */
    setupUltraDynamicGradients() {
        let hue = 0;
        setInterval(() => {
            hue = (hue + 1) % 360;
            document.documentElement.style.setProperty('--gradient-hue', `${hue}deg`);
        }, 100);
    }

    /**
     * Setup ultra-enhanced particle effects
     */
    setupUltraParticleEffects() {
        const container = document.querySelector('.text-translator-container');
        if (!container) return;

        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            this.createUltraParticle(container);
        }
    }

    /**
     * Create individual particle
     */
    createUltraParticle(container) {
        const particle = document.createElement('div');
        particle.className = 'ultra-particle';
        particle.style.cssText = `
            position: absolute;
            width: 2px;
            height: 2px;
            background: rgba(79, 70, 229, 0.5);
            border-radius: 50%;
            pointer-events: none;
            animation: float ${5 + Math.random() * 10}s linear infinite;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
        `;
        
        container.appendChild(particle);
        
        setTimeout(() => {
            particle.remove();
            this.createUltraParticle(container);
        }, 15000);
    }

    /**
     * Initialize advanced productivity features
     */
    initializeProductivityFeatures() {
        console.log('🚀 [Productivity] Initializing advanced productivity features...');
        
        // Setup keyboard shortcuts
        this.setupAdvancedKeyboardShortcuts();
        
        // Setup auto-save functionality
        this.setupAutoSave();
        
        // Setup smart suggestions
        this.setupSmartSuggestions();
        
        // Setup productivity analytics
        this.setupProductivityAnalytics();
        
        // Setup quick actions
        this.setupQuickActions();
        
        console.log('✅ [Productivity] Advanced productivity features initialized');
    }

    /**
     * Setup advanced keyboard shortcuts
     */
    setupAdvancedKeyboardShortcuts() {
        console.log('⌨️ [Productivity] Setting up advanced keyboard shortcuts...');
        
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter: Quick translate
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.quickTranslate();
            }
            
            // Ctrl/Cmd + S: Save current translation
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveCurrentTranslation();
            }
            
            // Ctrl/Cmd + D: Duplicate last translation
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.duplicateLastTranslation();
            }
            
            // Ctrl/Cmd + L: Clear all
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.clearAll();
            }
            
            // Ctrl/Cmd + H: Toggle history panel
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                this.toggleHistoryPanel();
            }
            
            // Ctrl/Cmd + F: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.focusSearch();
            }
            
            // Ctrl/Cmd + V: Voice input toggle
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                this.toggleVoiceInput();
            }
            
            // Escape: Close modals/panels
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
        
        console.log('✅ [Productivity] Advanced keyboard shortcuts setup complete');
    }

    /**
     * Setup auto-save functionality
     */
    setupAutoSave() {
        console.log('💾 [Productivity] Setting up auto-save functionality...');
        
        let autoSaveTimer;
        const autoSaveInterval = 30000; // 30 seconds
        
        const autoSave = () => {
            if (this.elements.sourceText.value.trim()) {
                this.saveToLocalStorage();
                this.showAutoSaveIndicator();
            }
        };
        
        this.elements.sourceText.addEventListener('input', () => {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(autoSave, autoSaveInterval);
        });
        
        // Auto-save on page unload
        window.addEventListener('beforeunload', () => {
            autoSave();
        });
        
        console.log('✅ [Productivity] Auto-save functionality setup complete');
    }

    /**
     * Setup smart suggestions
     */
    setupSmartSuggestions() {
        console.log('🧠 [Productivity] Setting up smart suggestions...');
        
        this.smartSuggestions = {
            commonPhrases: [
                'السلام عليكم',
                'بسم الله الرحمن الرحيم',
                'الحمد لله',
                'سبحان الله',
                'لا إله إلا الله',
                'الله أكبر',
                'استغفر الله',
                'ما شاء الله',
                'بارك الله فيك',
                'جزاك الله خيراً'
            ],
            recentTranslations: [],
            userFavorites: []
        };
        
        // Load recent translations from localStorage
        const saved = localStorage.getItem('smartSuggestions');
        if (saved) {
            this.smartSuggestions = { ...this.smartSuggestions, ...JSON.parse(saved) };
        }
        
        console.log('✅ [Productivity] Smart suggestions setup complete');
    }

    /**
     * Setup productivity analytics
     */
    setupProductivityAnalytics() {
        console.log('📊 [Productivity] Setting up productivity analytics...');
        
        this.productivityStats = {
            translationsPerDay: 0,
            averageTranslationTime: 0,
            mostUsedLanguages: {},
            peakHours: [],
            productivityScore: 0,
            streak: 0
        };
        
        // Load existing stats from localStorage
        const savedStats = localStorage.getItem('productivityStats');
        if (savedStats) {
            try {
                this.productivityStats = { ...this.productivityStats, ...JSON.parse(savedStats) };
            } catch (error) {
                console.warn('Failed to load productivity stats:', error);
            }
        }
        
        // Track translation activity - we'll hook into the existing translate method
        this.setupTranslationTracking();
        
        console.log('✅ [Productivity] Productivity analytics setup complete');
    }

    /**
     * Setup translation tracking
     */
    setupTranslationTracking() {
        // Override the translate method to track analytics
        const originalTranslate = this.translate;
        if (originalTranslate) {
            this.translate = async (...args) => {
                const startTime = Date.now();
                try {
                    const result = await originalTranslate.apply(this, args);
                    const endTime = Date.now();
                    this.updateProductivityStats(endTime - startTime);
                    return result;
                } catch (error) {
                    const endTime = Date.now();
                    this.updateProductivityStats(endTime - startTime);
                    throw error;
                }
            };
        }
    }

    /**
     * Setup quick actions
     */
    setupQuickActions() {
        console.log('⚡ [Productivity] Setting up quick actions...');
        
        // Add quick action buttons
        this.addQuickActionButtons();
        
        // Setup drag and drop
        this.setupDragAndDrop();
        
        // Setup text selection shortcuts
        this.setupTextSelectionShortcuts();
        
        console.log('✅ [Productivity] Quick actions setup complete');
    }

    /**
     * Add quick action buttons
     */
    addQuickActionButtons() {
        const quickActionsContainer = document.createElement('div');
        quickActionsContainer.className = 'quick-actions-container';
        quickActionsContainer.innerHTML = `
            <div class="quick-actions">
                <button class="quick-action-btn" data-action="translate" title="Quick Translate (Ctrl+Enter)">
                    <i class="fas fa-language"></i>
                </button>
                <button class="quick-action-btn" data-action="save" title="Save Translation (Ctrl+S)">
                    <i class="fas fa-save"></i>
                </button>
                <button class="quick-action-btn" data-action="duplicate" title="Duplicate Last (Ctrl+D)">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="quick-action-btn" data-action="clear" title="Clear All (Ctrl+L)">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="quick-action-btn" data-action="voice" title="Voice Input (Ctrl+V)">
                    <i class="fas fa-microphone"></i>
                </button>
                <button class="quick-action-btn" data-action="history" title="Toggle History (Ctrl+H)">
                    <i class="fas fa-history"></i>
                </button>
            </div>
        `;
        
        document.querySelector('.text-translator-container').appendChild(quickActionsContainer);
        
        // Add event listeners
        quickActionsContainer.addEventListener('click', (e) => {
            const action = e.target.closest('.quick-action-btn')?.dataset.action;
            if (action) {
                this.executeQuickAction(action);
            }
        });
    }

    /**
     * Execute quick action
     */
    executeQuickAction(action) {
        switch (action) {
            case 'translate':
                this.quickTranslate();
                break;
            case 'save':
                this.saveCurrentTranslation();
                break;
            case 'duplicate':
                this.duplicateLastTranslation();
                break;
            case 'clear':
                this.clearAll();
                break;
            case 'voice':
                this.toggleVoiceInput();
                break;
            case 'history':
                this.toggleHistoryPanel();
                break;
        }
    }

    /**
     * Quick translate function
     */
    async quickTranslate() {
        const text = this.elements.sourceText.value.trim();
        if (!text) return;
        
        console.log('⚡ [Productivity] Quick translate triggered');
        await this.translate();
    }

    /**
     * Save current translation
     */
    saveCurrentTranslation() {
        const text = this.elements.sourceText.value.trim();
        if (!text) return;
        
        console.log('💾 [Productivity] Saving current translation');
        this.saveToLocalStorage();
        this.showToast('Translation saved!', 'success');
    }

    /**
     * Duplicate last translation
     */
    duplicateLastTranslation() {
        const lastTranslation = this.getLastTranslation();
        if (lastTranslation) {
            this.elements.sourceText.value = lastTranslation.original;
            console.log('📋 [Productivity] Duplicated last translation');
            this.showToast('Last translation duplicated!', 'info');
        }
    }

    /**
     * Clear all content
     */
    clearAll() {
        this.elements.sourceText.value = '';
        this.clearTranslationResults();
        console.log('🧹 [Productivity] Cleared all content');
        this.showToast('All content cleared!', 'info');
    }

    /**
     * Toggle history panel
     */
    toggleHistoryPanel() {
        const historyPanel = document.getElementById('history-panel');
        if (historyPanel) {
            historyPanel.classList.toggle('hidden');
            console.log('📚 [Productivity] History panel toggled');
        }
    }

    /**
     * Toggle voice input
     */
    toggleVoiceInput() {
        if (this.voiceInput) {
            this.voiceInput.toggle();
            console.log('🎤 [Productivity] Voice input toggled');
        }
    }

    /**
     * Focus search input
     */
    focusSearch() {
        const searchInput = document.getElementById('history-search');
        if (searchInput) {
            searchInput.focus();
            console.log('🔍 [Productivity] Search input focused');
        }
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        // Close any open modals or panels
        document.querySelectorAll('.modal, .panel').forEach(modal => {
            modal.classList.remove('show');
        });
        console.log('❌ [Productivity] All modals closed');
    }

    /**
     * Update productivity statistics
     */
    updateProductivityStats(translationTime) {
        this.productivityStats.translationsPerDay++;
        this.productivityStats.averageTranslationTime = 
            (this.productivityStats.averageTranslationTime + translationTime) / 2;
        
        // Update productivity score
        this.productivityStats.productivityScore = Math.min(100, 
            this.productivityStats.translationsPerDay * 2 + 
            (1000 - this.productivityStats.averageTranslationTime) / 10
        );
        
        // Save to localStorage
        localStorage.setItem('productivityStats', JSON.stringify(this.productivityStats));
    }

    /**
     * Get last translation
     */
    getLastTranslation() {
        const history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
        return history[history.length - 1] || null;
    }

    /**
     * Show auto-save indicator
     */
    showAutoSaveIndicator() {
        const indicator = document.getElementById('autosave-indicator');
        if (indicator) {
            indicator.classList.add('show');
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 2000);
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Use existing toast system
        if (typeof toast === 'function') {
            toast(message, type);
        }
    }

    /**
     * Setup drag and drop functionality
     */
    setupDragAndDrop() {
        console.log('📁 [Productivity] Setting up drag and drop...');
        
        const textarea = this.elements.sourceText;
        if (!textarea) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            textarea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            textarea.addEventListener(eventName, () => {
                textarea.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            textarea.addEventListener(eventName, () => {
                textarea.classList.remove('drag-over');
            });
        });

        // Handle dropped files
        textarea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleDroppedFile(files[0]);
            }
        });

        console.log('✅ [Productivity] Drag and drop setup complete');
    }

    /**
     * Handle dropped file
     */
    async handleDroppedFile(file) {
        console.log('📁 [Productivity] Handling dropped file:', file.name);
        
        if (file.type.startsWith('text/')) {
            try {
                const text = await file.text();
                this.elements.sourceText.value = text;
                this.showToast('File loaded successfully!', 'success');
            } catch (error) {
                console.error('Error reading file:', error);
                this.showToast('Error reading file', 'error');
            }
        } else {
            this.showToast('Please drop a text file', 'error');
        }
    }

    /**
     * Setup text selection shortcuts
     */
    setupTextSelectionShortcuts() {
        console.log('⌨️ [Productivity] Setting up text selection shortcuts...');
        
        const textarea = this.elements.sourceText;
        if (!textarea) return;

        textarea.addEventListener('keydown', (e) => {
            // Ctrl+A: Select all
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                textarea.select();
            }
            
            // Ctrl+Z: Undo (basic implementation)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undoLastAction();
            }
            
            // Ctrl+Y or Ctrl+Shift+Z: Redo
            if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
                ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey)) {
                e.preventDefault();
                this.redoLastAction();
            }
        });

        console.log('✅ [Productivity] Text selection shortcuts setup complete');
    }

    /**
     * Undo last action
     */
    undoLastAction() {
        console.log('↶ [Productivity] Undoing last action');
        // Basic undo implementation - could be enhanced with a proper history stack
        this.showToast('Undo functionality coming soon!', 'info');
    }

    /**
     * Redo last action
     */
    redoLastAction() {
        console.log('↷ [Productivity] Redoing last action');
        // Basic redo implementation - could be enhanced with a proper history stack
        this.showToast('Redo functionality coming soon!', 'info');
    }

    /**
     * Clear translation results
     */
    clearTranslationResults() {
        const translationList = document.getElementById('translation-list');
        if (translationList) {
            translationList.innerHTML = '';
        }
        
        // Clear any status indicators
        if (this.elements.statusText) {
            this.elements.statusText.textContent = 'Ready to translate';
        }
        
        if (this.elements.statusDot) {
            this.elements.statusDot.className = 'status-dot';
        }
    }

    /**
     * Save current translation to favorites
     */
    saveToFavorites() {
        const text = this.elements.sourceText?.value?.trim();
        if (!text) {
            toast('No text to save to favorites', 'warning');
            return;
        }

        if (!this.isAuthenticated) {
            toast('Please log in to save favorites', 'warning');
            return;
        }

        console.log('⭐ [TextTranslator] Saving to favorites...');
        
        // Add to favorites system
        if (this.favoritesSystem) {
            this.favoritesSystem.addFavorite({
                original: text,
                translated: '', // Will be filled when translation is complete
                fromLang: this.elements.sourceLanguage?.value || 'auto',
                toLang: this.elements.targetLanguage?.value || 'en',
                timestamp: new Date().toISOString()
            });
            
            toast('Added to favorites!', 'success');
        } else {
            toast('Favorites system not available', 'error');
        }
    }

    /**
     * Open user preferences
     */
    openPreferences() {
        console.log('⚙️ [TextTranslator] Opening preferences...');
        
        if (!this.isAuthenticated) {
            toast('Please log in to access preferences', 'warning');
            return;
        }

        // Create preferences modal
        const modal = document.createElement('div');
        modal.className = 'preferences-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>User Preferences</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="preference-group">
                        <label>Default Source Language:</label>
                        <select id="pref-source-lang">
                            <option value="auto">Auto-detect</option>
                            <option value="en">English</option>
                            <option value="ar">Arabic</option>
                            <option value="ur">Urdu</option>
                            <option value="tr">Turkish</option>
                        </select>
                    </div>
                    <div class="preference-group">
                        <label>Default Target Language:</label>
                        <select id="pref-target-lang">
                            <option value="en">English</option>
                            <option value="ar">Arabic</option>
                            <option value="ur">Urdu</option>
                            <option value="tr">Turkish</option>
                        </select>
                    </div>
                    <div class="preference-group">
                        <label>Auto-save translations:</label>
                        <input type="checkbox" id="pref-auto-save" checked>
                    </div>
                    <div class="preference-group">
                        <label>Real-time translation:</label>
                        <input type="checkbox" id="pref-real-time" checked>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="save-preferences">Save Preferences</button>
                    <button class="btn btn-secondary" id="cancel-preferences">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        modal.querySelector('.close-btn').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#cancel-preferences').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#save-preferences').addEventListener('click', () => {
            this.savePreferences(modal);
        });

        // Load current preferences
        this.loadPreferencesIntoModal(modal);
    }

    /**
     * Load preferences into modal
     */
    loadPreferencesIntoModal(modal) {
        if (this.userPreferences) {
            modal.querySelector('#pref-source-lang').value = this.userPreferences.defaultSourceLang || 'auto';
            modal.querySelector('#pref-target-lang').value = this.userPreferences.defaultTargetLang || 'en';
            modal.querySelector('#pref-auto-save').checked = this.userPreferences.autoSave || true;
            modal.querySelector('#pref-real-time').checked = this.userPreferences.realTime || true;
        }
    }

    /**
     * Save user preferences
     */
    async savePreferences(modal) {
        const preferences = {
            defaultSourceLang: modal.querySelector('#pref-source-lang').value,
            defaultTargetLang: modal.querySelector('#pref-target-lang').value,
            autoSave: modal.querySelector('#pref-auto-save').checked,
            realTime: modal.querySelector('#pref-real-time').checked
        };

        try {
            const response = await fetch('/api/user/preferences', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(preferences)
            });

            if (response.ok) {
                this.userPreferences = preferences;
                toast('Preferences saved successfully!', 'success');
                modal.remove();
            } else {
                toast('Failed to save preferences', 'error');
            }
        } catch (error) {
            console.error('Failed to save preferences:', error);
            toast('Failed to save preferences', 'error');
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Text Translator...');
    window.textTranslator = new TextTranslator();
});
