/**
 * Live Text Translator - Modular Implementation
 * Main application file that orchestrates all modules
 */

import { TranslationCore } from './modules/translationCore.js';
import { TranslationHistory } from './modules/translationHistory.js';
import { ExportManager } from './modules/exportManager.js';
import { PartialTranslation } from './modules/partialTranslation.js';
import { toast, VoiceVisualizer, TranslationItem, ProgressIndicator, SkeletonLoader } from './utils/ui-utils.js';

class LiveTextTranslator {
    constructor() {
        this.translationCore = new TranslationCore();
        this.history = new TranslationHistory();
        this.exportManager = new ExportManager();
        this.partialTranslation = new PartialTranslation();
        this.isInitialized = false;
        
        // UI Components
        this.voiceVisualizer = null;
        this.progressIndicator = new ProgressIndicator(document.getElementById('loading-spinner'));
        this.skeletonLoader = new SkeletonLoader(document.getElementById('translation-results'));
        this.currentTranslationItem = null;
        
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('Initializing Live Text Translator...');
        
        try {
            // Initialize core translation functionality
            await this.translationCore.init();
            
            // Setup history integration
            this.setupHistoryIntegration();
            
            // Setup export functionality
            this.setupExportFunctionality();
            
            // Setup save functionality
            this.setupSaveFunctionality();
            
            // Setup UI event listeners
            this.setupUIEventListeners();
            
            // Setup mobile functionality
            this.setupMobileFunctionality();
            
            // Setup theme management
            this.setupThemeManagement();
            
            this.isInitialized = true;
            console.log('Live Text Translator initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Live Text Translator:', error);
            this.showError('Failed to initialize application');
        }
    }

    setupHistoryIntegration() {
        // Override the core's displayTranslation to integrate with history
        const originalDisplayTranslation = this.translationCore.displayTranslation.bind(this.translationCore);
        
        this.translationCore.displayTranslation = (data) => {
            // Call original method
            originalDisplayTranslation(data);
            
            // Add to history
            this.history.addTranslation({
                original: data.original,
                translated: data.translated,
                timestamp: data.timestamp,
                fromLanguage: this.translationCore.currentLanguage,
                toLanguage: this.translationCore.targetLanguage,
                confidence: data.confidence
            });
        };

        // Setup history item click handler
        this.history.onItemClick = (item) => {
            this.loadHistoryItem(item);
        };
    }

    setupExportFunctionality() {
        const exportPdf = document.getElementById('export-pdf');
        const exportTxt = document.getElementById('export-txt');
        const exportWord = document.getElementById('export-word');

        if (exportPdf) {
            exportPdf.addEventListener('click', () => this.handleExport('pdf'));
        }
        if (exportTxt) {
            exportTxt.addEventListener('click', () => this.handleExport('txt'));
        }
        if (exportWord) {
            exportWord.addEventListener('click', () => this.handleExport('word'));
        }
    }

    setupSaveFunctionality() {
        const saveCurrentBtn = document.getElementById('save-current');
        
        if (saveCurrentBtn) {
            saveCurrentBtn.addEventListener('click', () => this.saveCurrentTranslation());
        }
    }

    setupUIEventListeners() {
        const clearHistoryBtn = document.getElementById('clear-history');
        const historySearch = document.getElementById('history-search');
        const searchBtn = document.getElementById('search-btn');

        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.clearHistory());
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

    async handleExport(format) {
        try {
            const originalText = this.translationCore.accumulatedText;
            const translatedText = this.getLastTranslation();
            
            if (!originalText.trim()) {
                this.showError('No text to export');
                return;
            }

            const metadata = {
                fromLanguage: this.translationCore.currentLanguage,
                toLanguage: this.translationCore.targetLanguage
            };

            let result;
            switch (format) {
                case 'pdf':
                    result = await this.exportManager.exportToPDF(originalText, translatedText, metadata);
                    break;
                case 'txt':
                    result = this.exportManager.exportToTXT(originalText, translatedText, metadata);
                    break;
                case 'word':
                    result = this.exportManager.exportToWord(originalText, translatedText, metadata);
                    break;
                default:
                    throw new Error('Unsupported export format');
            }

            this.updateSaveStatus(result.message, 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.updateSaveStatus('Export failed: ' + error.message, 'error');
        }
    }

    saveCurrentTranslation() {
        const originalText = this.translationCore.accumulatedText;
        const translatedText = this.getLastTranslation();
        
        if (!originalText.trim()) {
            this.updateSaveStatus('No text to save', 'error');
            return;
        }

        try {
            this.history.addTranslation({
                original: originalText,
                translated: translatedText,
                timestamp: new Date().toISOString(),
                fromLanguage: this.translationCore.currentLanguage,
                toLanguage: this.translationCore.targetLanguage,
                confidence: 0.9
            });

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

    loadHistoryItem(item) {
        // Load the history item into the current session
        this.translationCore.accumulatedText = item.original;
        this.translationCore.currentPhrase = item.original;
        this.translationCore.currentLanguage = item.fromLanguage;
        this.translationCore.targetLanguage = item.toLanguage;
        
        // Update UI
        const voiceLanguageSelect = document.getElementById('voice-language');
        const targetLanguageSelect = document.getElementById('target-language');
        
        if (voiceLanguageSelect) {
            voiceLanguageSelect.value = item.fromLanguage;
        }
        if (targetLanguageSelect) {
            targetLanguageSelect.value = item.toLanguage;
        }
        
        // Update text counter
        this.translationCore.updateTextCounter();
        
        // Display the translation
        this.translationCore.displayTranslation({
            original: item.original,
            translated: item.translated,
            language: this.translationCore.getLanguageName(item.toLanguage),
            timestamp: item.timestamp,
            confidence: item.confidence
        });

        this.showSuccess('History item loaded');
    }

    searchHistory(query) {
        const filteredHistory = this.history.searchHistory(query);
        this.displayFilteredHistory(filteredHistory);
    }

    displayFilteredHistory(filteredHistory) {
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
                const historyItem = this.history.history.find(h => h.id === id);
                if (historyItem) {
                    this.loadHistoryItem(historyItem);
                }
            });
        });
    }

    clearHistory() {
        if (this.history.clearHistory()) {
            this.updateSaveStatus('History cleared', 'success');
            
            setTimeout(() => {
                this.updateSaveStatus('Ready to save', 'ready');
            }, 2000);
        }
    }

    getLastTranslation() {
        // Get the last translation from the history
        if (this.history.history.length > 0) {
            return this.history.history[0].translated;
        }
        return '';
    }

    updateSaveStatus(message, type) {
        const saveStatus = document.getElementById('save-status');
        if (saveStatus) {
            saveStatus.textContent = message;
            saveStatus.className = `save-status ${type}`;
        }
    }

    showError(message) {
        console.error('Error:', message);
        toast.error(message);
    }

    showSuccess(message) {
        console.log('Success:', message);
        toast.success(message);
    }

    showWarning(message) {
        console.warn('Warning:', message);
        toast.warning(message);
    }

    showInfo(message) {
        console.log('Info:', message);
        toast.info(message);
    }

    // Mobile functionality
    setupMobileFunctionality() {
        // Mobile voice button
        const mobileVoiceBtn = document.getElementById('mobile-start-voice');
        if (mobileVoiceBtn) {
            mobileVoiceBtn.addEventListener('click', () => {
                this.toggleVoiceInput();
            });
        }

        // Mobile save button
        const mobileSaveBtn = document.getElementById('mobile-save');
        if (mobileSaveBtn) {
            mobileSaveBtn.addEventListener('click', () => {
                this.saveCurrentTranslation();
            });
        }

        // Mobile export button
        const mobileExportBtn = document.getElementById('mobile-export');
        if (mobileExportBtn) {
            mobileExportBtn.addEventListener('click', () => {
                this.showExportOptions();
            });
        }

        // Mobile settings button
        const mobileSettingsBtn = document.getElementById('mobile-settings');
        const settingsSheet = document.getElementById('settings-sheet');
        const settingsClose = document.getElementById('settings-close');
        
        if (mobileSettingsBtn && settingsSheet) {
            mobileSettingsBtn.addEventListener('click', () => {
                settingsSheet.classList.add('open');
            });
        }

        if (settingsClose && settingsSheet) {
            settingsClose.addEventListener('click', () => {
                settingsSheet.classList.remove('open');
            });
        }

        // Close settings sheet when clicking outside
        if (settingsSheet) {
            settingsSheet.addEventListener('click', (e) => {
                if (e.target === settingsSheet) {
                    settingsSheet.classList.remove('open');
                }
            });
        }
    }

    // Theme management
    setupThemeManagement() {
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            // Load saved theme
            const savedTheme = localStorage.getItem('theme') || 'dark';
            themeSelect.value = savedTheme;
            this.applyTheme(savedTheme);

            // Listen for theme changes
            themeSelect.addEventListener('change', (e) => {
                this.applyTheme(e.target.value);
                localStorage.setItem('theme', e.target.value);
            });
        }
    }

    applyTheme(theme) {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        
        // Update theme-specific styles
        if (theme === 'high-contrast') {
            root.style.setProperty('--brand', '#5aa2ff');
            root.style.setProperty('--color-subtle', '#d8e2f2');
        } else {
            root.style.removeProperty('--brand');
            root.style.removeProperty('--color-subtle');
        }
    }

    // Enhanced voice input with visualization
    async startVoiceInput() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create voice visualizer
            const waveformContainer = document.getElementById('waveform-container');
            if (waveformContainer) {
                this.voiceVisualizer = new VoiceVisualizer(waveformContainer);
                await this.voiceVisualizer.start(stream);
            }

            // Start voice recognition
            await this.translationCore.startVoiceInput();
            
            // Update UI
            this.updateVoiceButton(true);
            this.showInfo('Voice input started');
            
        } catch (error) {
            console.error('Error starting voice input:', error);
            this.showError('Failed to start voice input. Please check microphone permissions.');
        }
    }

    stopVoiceInput() {
        if (this.voiceVisualizer) {
            this.voiceVisualizer.stop();
        }
        
        this.translationCore.stopVoiceInput();
        this.updateVoiceButton(false);
        this.showInfo('Voice input stopped');
    }

    updateVoiceButton(isListening) {
        const buttons = document.querySelectorAll('#start-voice, #mobile-start-voice');
        buttons.forEach(btn => {
            const icon = btn.querySelector('i');
            const text = btn.querySelector('span');
            
            if (isListening) {
                btn.classList.add('listening');
                if (icon) icon.className = 'fas fa-stop';
                if (text) text.textContent = 'Stop';
            } else {
                btn.classList.remove('listening');
                if (icon) icon.className = 'fas fa-microphone';
                if (text) text.textContent = 'Start';
            }
        });
    }

    // Enhanced translation display with partial/final states
    displayTranslationWithStates(data) {
        const resultsContainer = document.getElementById('translation-results');
        if (!resultsContainer) return;

        // Create translation item
        const translationData = {
            id: Date.now(),
            from: data.fromLang || 'auto',
            to: data.toLang || 'en',
            original: data.original,
            translated: data.translated,
            confidence: data.confidence || 0,
            latency: data.latency || 0
        };

        this.currentTranslationItem = new TranslationItem(translationData);
        resultsContainer.appendChild(this.currentTranslationItem.getElement());

        // Show partial text if available
        if (data.partial) {
            this.currentTranslationItem.updatePartial(data.partial);
        }

        // Show final text
        if (data.translated) {
            this.currentTranslationItem.updateFinal(data.translated);
        }
    }

    // Show export options modal
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
            this.exportManager.exportToPDF();
            modal.remove();
        });

        modal.querySelector('#export-txt-modal').addEventListener('click', () => {
            this.exportManager.exportToTXT();
            modal.remove();
        });

        modal.querySelector('#export-word-modal').addEventListener('click', () => {
            this.exportManager.exportToWord();
            modal.remove();
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // Cleanup method
    destroy() {
        if (this.history) {
            this.history.destroy();
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.liveTextTranslator = new LiveTextTranslator();
});

// Export for potential use in other modules
export default LiveTextTranslator;
