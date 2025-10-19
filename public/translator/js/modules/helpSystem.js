/**
 * Help System Module
 * Provides contextual help and documentation for users
 */

export class HelpSystem {
    constructor() {
        this.helpTopics = new Map();
        this.tooltips = new Map();
        this.tutorials = new Map();
        this.isInitialized = false;

        this.init();
    }

    init() {
        this.setupHelpTopics();
        this.setupTooltips();
        this.setupTutorials();
        this.setupHelpUI();
        this.isInitialized = true;
    }

    /**
     * Setup help topics
     */
    setupHelpTopics() {
        this.helpTopics.set('getting-started', {
            title: 'Getting Started',
            content: `
                <h3>Welcome to the Text Translator!</h3>
                <p>This powerful translation tool helps you translate text between multiple languages with advanced features.</p>
                
                <h4>Basic Usage:</h4>
                <ol>
                    <li>Enter text in the source language field</li>
                    <li>Select your target language(s)</li>
                    <li>Click "Translate" or use Ctrl+Enter</li>
                    <li>View your translations in the results area</li>
                </ol>
                
                <h4>Keyboard Shortcuts:</h4>
                <ul>
                    <li><kbd>Ctrl+Enter</kbd> - Translate text</li>
                    <li><kbd>Ctrl+K</kbd> - Clear all text</li>
                    <li><kbd>Ctrl+S</kbd> - Swap languages</li>
                </ul>
            `
        });

        this.helpTopics.set('features', {
            title: 'Features',
            content: `
                <h3>Translation Features</h3>
                
                <h4>Real-time Translation</h4>
                <p>Get instant translations as you type with our real-time translation feature.</p>
                
                <h4>Multiple Languages</h4>
                <p>Support for 50+ languages including Arabic, English, French, Spanish, and more.</p>
                
                <h4>Translation Memory</h4>
                <p>Your translations are saved and can be reused for faster future translations.</p>
                
                <h4>Favorites System</h4>
                <p>Save your favorite translations for quick access later.</p>
                
                <h4>RTL Support</h4>
                <p>Full support for right-to-left languages like Arabic and Hebrew.</p>
            `
        });

        this.helpTopics.set('troubleshooting', {
            title: 'Troubleshooting',
            content: `
                <h3>Common Issues</h3>
                
                <h4>Translation Not Working</h4>
                <ul>
                    <li>Check your internet connection</li>
                    <li>Ensure the text is not empty</li>
                    <li>Try refreshing the page</li>
                </ul>
                
                <h4>Slow Performance</h4>
                <ul>
                    <li>Clear your browser cache</li>
                    <li>Close unnecessary browser tabs</li>
                    <li>Check your internet speed</li>
                </ul>
                
                <h4>Audio Not Playing</h4>
                <ul>
                    <li>Check your browser's audio settings</li>
                    <li>Ensure your device volume is up</li>
                    <li>Try a different browser</li>
                </ul>
            `
        });

        this.helpTopics.set('accessibility', {
            title: 'Accessibility',
            content: `
                <h3>Accessibility Features</h3>
                
                <h4>Keyboard Navigation</h4>
                <p>Use Tab to navigate between elements and Enter to activate buttons.</p>
                
                <h4>Screen Reader Support</h4>
                <p>Full support for screen readers with proper ARIA labels and announcements.</p>
                
                <h4>High Contrast Mode</h4>
                <p>Toggle high contrast mode for better visibility.</p>
                
                <h4>Font Size Options</h4>
                <p>Adjust font size for better readability.</p>
            `
        });
    }

    /**
     * Setup tooltips
     */
    setupTooltips() {
        const tooltipElements = [
            {
                selector: '.translate-btn',
                content: 'Click to translate text or use Ctrl+Enter',
                position: 'top'
            },
            {
                selector: '.clear-btn',
                content: 'Clear all text and results',
                position: 'top'
            },
            {
                selector: '.swap-btn',
                content: 'Swap source and target languages',
                position: 'top'
            },
            {
                selector: '.favorite-btn',
                content: 'Add to favorites',
                position: 'right'
            },
            {
                selector: '.history-item',
                content: 'Click to reuse this translation',
                position: 'left'
            }
        ];

        tooltipElements.forEach(tooltip => {
            this.tooltips.set(tooltip.selector, {
                content: tooltip.content,
                position: tooltip.position
            });
        });
    }

    /**
     * Setup tutorials
     */
    setupTutorials() {
        this.tutorials.set('first-time', {
            title: 'First Time User Tutorial',
            steps: [
                {
                    target: '.source-text',
                    content: 'Enter the text you want to translate here',
                    position: 'bottom'
                },
                {
                    target: '.source-language',
                    content: 'Select the source language (or leave as auto-detect)',
                    position: 'bottom'
                },
                {
                    target: '.target-language',
                    content: 'Select the target language(s) for translation',
                    position: 'bottom'
                },
                {
                    target: '.translate-btn',
                    content: 'Click here to translate or use Ctrl+Enter',
                    position: 'top'
                },
                {
                    target: '.results-container',
                    content: 'Your translations will appear here',
                    position: 'top'
                }
            ]
        });

        this.tutorials.set('advanced-features', {
            title: 'Advanced Features Tutorial',
            steps: [
                {
                    target: '.real-time-toggle',
                    content: 'Enable real-time translation for instant results',
                    position: 'bottom'
                },
                {
                    target: '.favorites-section',
                    content: 'Access your saved translations here',
                    position: 'left'
                },
                {
                    target: '.history-section',
                    content: 'View your translation history',
                    position: 'left'
                },
                {
                    target: '.settings-button',
                    content: 'Access settings and preferences',
                    position: 'bottom'
                }
            ]
        });
    }

    /**
     * Setup help UI
     */
    setupHelpUI() {
        this.createHelpButton();
        this.createHelpModal();
        this.createTooltipSystem();
        this.createTutorialOverlay();
    }

    /**
     * Create help button
     */
    createHelpButton() {
        const button = document.createElement('button');
        button.id = 'help-button';
        button.className = 'help-button';
        button.textContent = '❓';
        button.setAttribute('aria-label', 'Open help');
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--secondary-color);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 20px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
        `;

        button.addEventListener('click', () => this.showHelpModal());
        document.body.appendChild(button);
    }

    /**
     * Create help modal
     */
    createHelpModal() {
        const modal = document.createElement('div');
        modal.id = 'help-modal';
        modal.className = 'help-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1001;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'help-modal-content';
        modalContent.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;

        // Create help modal content programmatically
        const header = document.createElement('div');
        header.className = 'help-header';

        const title = document.createElement('h2');
        title.textContent = 'Help & Documentation';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-button';
        closeBtn.setAttribute('aria-label', 'Close help modal');
        closeBtn.textContent = '×';

        header.appendChild(title);
        header.appendChild(closeBtn);

        const content = document.createElement('div');
        content.className = 'help-content';

        const sidebar = document.createElement('div');
        sidebar.className = 'help-sidebar';

        const nav = document.createElement('nav');
        nav.className = 'help-nav';

        const ul = document.createElement('ul');

        const navItems = [
            { href: '#getting-started', text: 'Getting Started', active: true },
            { href: '#features', text: 'Features', active: false },
            { href: '#troubleshooting', text: 'Troubleshooting', active: false },
            { href: '#accessibility', text: 'Accessibility', active: false }
        ];

        navItems.forEach(item => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = item.href;
            a.className = `help-nav-link${item.active ? ' active' : ''}`;
            a.textContent = item.text;
            li.appendChild(a);
            ul.appendChild(li);
        });

        nav.appendChild(ul);
        sidebar.appendChild(nav);

        const main = document.createElement('div');
        main.className = 'help-main';

        const contentArea = document.createElement('div');
        contentArea.id = 'help-content-area';

        main.appendChild(contentArea);
        content.appendChild(sidebar);
        content.appendChild(main);

        modalContent.appendChild(header);
        modalContent.appendChild(content);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Add event listeners
        this.setupHelpModalEvents();
    }

    /**
     * Setup help modal events
     */
    setupHelpModalEvents() {
        const modal = document.getElementById('help-modal');
        const closeButton = modal.querySelector('.close-button');
        const navLinks = modal.querySelectorAll('.help-nav-link');

        closeButton.addEventListener('click', () => this.hideHelpModal());

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const topic = link.getAttribute('href').substring(1);
                this.showHelpTopic(topic);

                // Update active link
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideHelpModal();
            }
        });
    }

    /**
     * Create tooltip system
     */
    createTooltipSystem() {
        const tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        tooltip.className = 'tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 1002;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(tooltip);

        // Add tooltip events
        this.setupTooltipEvents();
    }

    /**
     * Setup tooltip events
     */
    setupTooltipEvents() {
        const tooltip = document.getElementById('tooltip');

        document.addEventListener('mouseover', (e) => {
            const element = e.target;
            const selector = this.getElementSelector(element);
            const tooltipData = this.tooltips.get(selector);

            if (tooltipData) {
                this.showTooltip(element, tooltipData.content, tooltipData.position);
            }
        });

        document.addEventListener('mouseout', (e) => {
            this.hideTooltip();
        });
    }

    /**
     * Create tutorial overlay
     */
    createTutorialOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.className = 'tutorial-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: none;
            z-index: 1003;
        `;

        const tutorialContent = document.createElement('div');
        tutorialContent.className = 'tutorial-content';
        tutorialContent.style.cssText = `
            position: absolute;
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 300px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;

        overlay.appendChild(tutorialContent);
        document.body.appendChild(overlay);
    }

    /**
     * Show help modal
     */
    showHelpModal() {
        const modal = document.getElementById('help-modal');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Show first topic
        this.showHelpTopic('getting-started');
    }

    /**
     * Hide help modal
     */
    hideHelpModal() {
        const modal = document.getElementById('help-modal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    /**
     * Show help topic
     */
    showHelpTopic(topicId) {
        const topic = this.helpTopics.get(topicId);
        if (topic) {
            const contentArea = document.getElementById('help-content-area');
            // Clear existing content
            contentArea.innerHTML = '';

            // Create a temporary div to parse the HTML content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = topic.content;

            // Move all child nodes to the content area
            while (tempDiv.firstChild) {
                contentArea.appendChild(tempDiv.firstChild);
            }
        }
    }

    /**
     * Show tooltip
     */
    showTooltip(element, content, position = 'top') {
        const tooltip = document.getElementById('tooltip');
        tooltip.textContent = content;
        tooltip.style.opacity = '1';

        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top, left;

        switch (position) {
            case 'top':
                top = rect.top - tooltipRect.height - 8;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = rect.bottom + 8;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.left - tooltipRect.width - 8;
                break;
            case 'right':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.right + 8;
                break;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        tooltip.style.opacity = '0';
    }

    /**
     * Start tutorial
     */
    startTutorial(tutorialId) {
        const tutorial = this.tutorials.get(tutorialId);
        if (tutorial) {
            this.currentTutorial = tutorial;
            this.currentStep = 0;
            this.showTutorialStep();
        }
    }

    /**
     * Show tutorial step
     */
    showTutorialStep() {
        if (!this.currentTutorial || this.currentStep >= this.currentTutorial.steps.length) {
            this.hideTutorial();
            return;
        }

        const step = this.currentTutorial.steps[this.currentStep];
        const target = document.querySelector(step.target);

        if (target) {
            this.showTutorialOverlay(target, step.content, step.position);
        }
    }

    /**
     * Show tutorial overlay
     */
    showTutorialOverlay(target, content, position) {
        const overlay = document.getElementById('tutorial-overlay');
        const tutorialContent = overlay.querySelector('.tutorial-content');

        tutorialContent.innerHTML = `
            <div class="tutorial-step">
                <p>${content}</p>
                <div class="tutorial-actions">
                    <button class="tutorial-prev" ${this.currentStep === 0 ? 'disabled' : ''}>Previous</button>
                    <button class="tutorial-next">${this.currentStep === this.currentTutorial.steps.length - 1 ? 'Finish' : 'Next'}</button>
                </div>
            </div>
        `;

        // Position overlay
        const rect = target.getBoundingClientRect();
        tutorialContent.style.top = `${rect.top}px`;
        tutorialContent.style.left = `${rect.left}px`;

        overlay.style.display = 'block';

        // Add event listeners
        const prevBtn = tutorialContent.querySelector('.tutorial-prev');
        const nextBtn = tutorialContent.querySelector('.tutorial-next');

        prevBtn.addEventListener('click', () => {
            this.currentStep--;
            this.showTutorialStep();
        });

        nextBtn.addEventListener('click', () => {
            this.currentStep++;
            this.showTutorialStep();
        });
    }

    /**
     * Hide tutorial
     */
    hideTutorial() {
        const overlay = document.getElementById('tutorial-overlay');
        overlay.style.display = 'none';
        this.currentTutorial = null;
        this.currentStep = 0;
    }

    /**
     * Get element selector
     */
    getElementSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }

        if (element.className) {
            return `.${element.className.split(' ')[0]}`;
        }

        return element.tagName.toLowerCase();
    }

    /**
     * Get help status
     */
    getHelpStatus() {
        return {
            isInitialized: this.isInitialized,
            topicsCount: this.helpTopics.size,
            tooltipsCount: this.tooltips.size,
            tutorialsCount: this.tutorials.size
        };
    }
}

// Global help system
export const helpSystem = new HelpSystem();
