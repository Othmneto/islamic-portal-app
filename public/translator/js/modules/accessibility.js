/**
 * Accessibility Module
 * Enhances accessibility features for the translation interface
 */

export class AccessibilityManager {
    constructor() {
        this.announcer = null;
        this.keyboardNavigation = true;
        this.highContrast = false;
        this.fontSize = 'medium';
        this.init();
    }
    
    init() {
        this.createAnnouncer();
        this.setupKeyboardNavigation();
        this.setupARIALabels();
        this.setupFocusManagement();
        this.detectUserPreferences();
    }
    
    /**
     * Create screen reader announcer
     */
    createAnnouncer() {
        this.announcer = document.createElement('div');
        this.announcer.setAttribute('aria-live', 'polite');
        this.announcer.setAttribute('aria-atomic', 'true');
        this.announcer.className = 'sr-only';
        this.announcer.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(this.announcer);
    }
    
    /**
     * Announce text to screen readers
     */
    announce(message, priority = 'polite') {
        if (this.announcer) {
            this.announcer.setAttribute('aria-live', priority);
            this.announcer.textContent = message;
            
            // Clear after announcement
            setTimeout(() => {
                this.announcer.textContent = '';
            }, 1000);
        }
    }
    
    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
    }
    
    /**
     * Handle keyboard navigation
     */
    handleKeyboardNavigation(e) {
        if (!this.keyboardNavigation) return;
        
        // Tab navigation
        if (e.key === 'Tab') {
            this.handleTabNavigation(e);
        }
        
        // Arrow key navigation
        if (e.key.startsWith('Arrow')) {
            this.handleArrowNavigation(e);
        }
        
        // Escape key
        if (e.key === 'Escape') {
            this.handleEscapeKey(e);
        }
        
        // Enter key
        if (e.key === 'Enter') {
            this.handleEnterKey(e);
        }
    }
    
    /**
     * Handle tab navigation
     */
    handleTabNavigation(e) {
        const focusableElements = this.getFocusableElements();
        const currentIndex = focusableElements.indexOf(document.activeElement);
        
        if (e.shiftKey) {
            // Shift + Tab (backward)
            if (currentIndex <= 0) {
                e.preventDefault();
                focusableElements[focusableElements.length - 1].focus();
            }
        } else {
            // Tab (forward)
            if (currentIndex >= focusableElements.length - 1) {
                e.preventDefault();
                focusableElements[0].focus();
            }
        }
    }
    
    /**
     * Handle arrow key navigation
     */
    handleArrowNavigation(e) {
        const currentElement = document.activeElement;
        const parent = currentElement.closest('[role="menu"], [role="listbox"], [role="grid"]');
        
        if (parent) {
            e.preventDefault();
            this.navigateInContainer(parent, e.key, currentElement);
        }
    }
    
    /**
     * Navigate within a container
     */
    navigateInContainer(container, direction, currentElement) {
        const focusableElements = this.getFocusableElements(container);
        const currentIndex = focusableElements.indexOf(currentElement);
        
        let nextIndex = currentIndex;
        
        switch (direction) {
            case 'ArrowDown':
                nextIndex = (currentIndex + 1) % focusableElements.length;
                break;
            case 'ArrowUp':
                nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
                break;
            case 'ArrowRight':
                nextIndex = (currentIndex + 1) % focusableElements.length;
                break;
            case 'ArrowLeft':
                nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
                break;
        }
        
        focusableElements[nextIndex].focus();
    }
    
    /**
     * Handle escape key
     */
    handleEscapeKey(e) {
        // Close any open modals or dropdowns
        const openModal = document.querySelector('.modal.show, .dropdown.show');
        if (openModal) {
            e.preventDefault();
            this.closeModal(openModal);
        }
    }
    
    /**
     * Handle enter key
     */
    handleEnterKey(e) {
        const currentElement = document.activeElement;
        
        // Activate buttons and links
        if (currentElement.matches('button, [role="button"], a')) {
            currentElement.click();
        }
        
        // Submit forms
        if (currentElement.matches('input[type="submit"]')) {
            const form = currentElement.closest('form');
            if (form) {
                form.submit();
            }
        }
    }
    
    /**
     * Get focusable elements
     */
    getFocusableElements(container = document) {
        const focusableSelectors = [
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'a[href]',
            '[tabindex]:not([tabindex="-1"])',
            '[role="button"]:not([disabled])',
            '[role="link"]',
            '[role="menuitem"]',
            '[role="option"]'
        ];
        
        return Array.from(container.querySelectorAll(focusableSelectors.join(', ')));
    }
    
    /**
     * Setup ARIA labels
     */
    setupARIALabels() {
        // Add ARIA labels to common elements
        const elements = {
            '.translate-btn': 'Translate text',
            '.clear-btn': 'Clear text',
            '.swap-btn': 'Swap languages',
            '.source-text': 'Source text input',
            '.target-text': 'Translated text output',
            '.language-select': 'Language selection',
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
     * Setup focus management
     */
    setupFocusManagement() {
        // Trap focus in modals
        document.addEventListener('keydown', (e) => {
            const modal = document.querySelector('.modal.show');
            if (modal && e.key === 'Tab') {
                this.trapFocusInModal(modal, e);
            }
        });
    }
    
    /**
     * Trap focus in modal
     */
    trapFocusInModal(modal, e) {
        const focusableElements = this.getFocusableElements(modal);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }
    
    /**
     * Detect user preferences
     */
    detectUserPreferences() {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            this.enableReducedMotion();
        }
        
        // Check for high contrast preference
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
        if (prefersHighContrast) {
            this.enableHighContrast();
        }
        
        // Check for color scheme preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            this.enableDarkMode();
        }
    }
    
    /**
     * Enable reduced motion
     */
    enableReducedMotion() {
        document.documentElement.style.setProperty('--animation-duration', '0s');
        document.documentElement.style.setProperty('--transition-duration', '0s');
    }
    
    /**
     * Enable high contrast mode
     */
    enableHighContrast() {
        this.highContrast = true;
        document.body.classList.add('high-contrast');
    }
    
    /**
     * Enable dark mode
     */
    enableDarkMode() {
        document.body.classList.add('dark-mode');
    }
    
    /**
     * Toggle high contrast mode
     */
    toggleHighContrast() {
        this.highContrast = !this.highContrast;
        document.body.classList.toggle('high-contrast', this.highContrast);
        this.announce(`High contrast mode ${this.highContrast ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Set font size
     */
    setFontSize(size) {
        const sizes = {
            'small': '14px',
            'medium': '16px',
            'large': '18px',
            'xlarge': '20px'
        };
        
        if (sizes[size]) {
            this.fontSize = size;
            document.documentElement.style.setProperty('--base-font-size', sizes[size]);
            this.announce(`Font size set to ${size}`);
        }
    }
    
    /**
     * Close modal
     */
    closeModal(modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        
        // Return focus to trigger element
        const trigger = document.querySelector(`[aria-controls="${modal.id}"]`);
        if (trigger) {
            trigger.focus();
        }
    }
    
    /**
     * Get accessibility status
     */
    getAccessibilityStatus() {
        return {
            keyboardNavigation: this.keyboardNavigation,
            highContrast: this.highContrast,
            fontSize: this.fontSize,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            darkMode: document.body.classList.contains('dark-mode')
        };
    }
}

// Global accessibility manager
export const accessibilityManager = new AccessibilityManager();
