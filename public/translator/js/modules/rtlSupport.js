/**
 * RTL Support Module
 * Handles right-to-left language support for Arabic, Hebrew, Persian, etc.
 */

export class RTLSupport {
    constructor() {
        this.rtlLanguages = new Set([
            'ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ku', 'dv', 'ug', 'yi'
        ]);
        this.currentDirection = 'ltr';
        this.rtlElements = new Set();
    }

    /**
     * Check if a language code is RTL
     */
    isRTLLanguage(langCode) {
        return this.rtlLanguages.has(langCode.toLowerCase());
    }

    /**
     * Get text direction for a language
     */
    getTextDirection(langCode) {
        return this.isRTLLanguage(langCode) ? 'rtl' : 'ltr';
    }

    /**
     * Apply RTL styling to an element
     */
    applyRTLStyling(element, langCode) {
        const direction = this.getTextDirection(langCode);
        element.style.direction = direction;
        element.style.textAlign = direction === 'rtl' ? 'right' : 'left';

        // Add RTL class for CSS styling
        element.classList.toggle('rtl', direction === 'rtl');
        element.classList.toggle('ltr', direction === 'ltr');

        // Store reference for cleanup
        this.rtlElements.add(element);

        return direction;
    }

    /**
     * Update text direction for multiple elements
     */
    updateTextDirection(elements, langCode) {
        const direction = this.getTextDirection(langCode);
        this.currentDirection = direction;

        elements.forEach(element => {
            this.applyRTLStyling(element, langCode);
        });

        // Update document direction
        document.documentElement.setAttribute('dir', direction);
        document.body.classList.toggle('rtl', direction === 'rtl');
        document.body.classList.toggle('ltr', direction === 'ltr');
    }

    /**
     * Handle input field RTL behavior
     */
    setupRTLInput(inputElement, langCode) {
        const direction = this.getTextDirection(langCode);

        inputElement.style.direction = direction;
        inputElement.style.textAlign = direction === 'rtl' ? 'right' : 'left';

        // Handle cursor position for RTL
        if (direction === 'rtl') {
            inputElement.addEventListener('input', (e) => {
                this.handleRTLCursor(e.target);
            });
        }
    }

    /**
     * Handle cursor positioning in RTL input
     */
    handleRTLCursor(input) {
        // Move cursor to end for RTL languages
        setTimeout(() => {
            input.setSelectionRange(input.value.length, input.value.length);
        }, 0);
    }

    /**
     * Format text for RTL display
     */
    formatRTLText(text, langCode) {
        if (!this.isRTLLanguage(langCode)) {
            return text;
        }

        // Add RTL markers if needed
        return `\u202E${text}\u202C`;
    }

    /**
     * Clean up RTL styling
     */
    cleanup() {
        this.rtlElements.forEach(element => {
            element.style.direction = '';
            element.style.textAlign = '';
            element.classList.remove('rtl', 'ltr');
        });
        this.rtlElements.clear();

        document.documentElement.removeAttribute('dir');
        document.body.classList.remove('rtl', 'ltr');
    }
}

// Global RTL support instance
export const rtlSupport = new RTLSupport();
