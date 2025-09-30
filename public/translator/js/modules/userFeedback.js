/**
 * User Feedback System Module
 * Collects and manages user feedback for continuous improvement
 */

export class UserFeedbackSystem {
    constructor() {
        this.feedbackQueue = [];
        this.isCollecting = false;
        this.feedbackTypes = {
            BUG: 'bug',
            FEATURE: 'feature',
            IMPROVEMENT: 'improvement',
            TRANSLATION: 'translation',
            UI: 'ui',
            PERFORMANCE: 'performance'
        };
        
        // Memory leak prevention
        this.intervals = [];
        this.isDestroyed = false;
        this.sessionId = this.generateSessionId();
        
        this.init();
    }
    
    init() {
        this.setupFeedbackUI();
        this.setupFeedbackCollection();
        this.setupUserTesting();
        this.setupAnalytics();
    }
    
    /**
     * Setup feedback UI
     */
    setupFeedbackUI() {
        // Create feedback button
        this.createFeedbackButton();
        
        // Create feedback modal
        this.createFeedbackModal();
        
        // Create feedback form
        this.createFeedbackForm();
    }
    
    /**
     * Create feedback button
     */
    createFeedbackButton() {
        const button = document.createElement('button');
        button.id = 'feedback-button';
        button.className = 'feedback-button';
        button.textContent = '💬';
        button.setAttribute('aria-label', 'Send feedback');
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--primary-color);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 20px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
        `;
        
        button.addEventListener('click', () => this.showFeedbackModal());
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });
        
        document.body.appendChild(button);
    }
    
    /**
     * Create feedback modal
     */
    createFeedbackModal() {
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.className = 'feedback-modal';
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
        modalContent.className = 'feedback-modal-content';
        modalContent.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideFeedbackModal();
            }
        });
    }
    
    /**
     * Create feedback form
     */
    createFeedbackForm() {
        const modal = document.getElementById('feedback-modal');
        const modalContent = modal.querySelector('.feedback-modal-content');
        
        // Create feedback form elements programmatically to avoid innerHTML
        const header = document.createElement('div');
        header.className = 'feedback-header';
        
        const title = document.createElement('h2');
        title.textContent = 'Send Feedback';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-button';
        closeBtn.setAttribute('aria-label', 'Close feedback modal');
        closeBtn.textContent = '×';
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        const form = document.createElement('form');
        form.id = 'feedback-form';
        form.className = 'feedback-form';
        
        // Create form elements
        const typeGroup = this.createFormGroup('feedback-type', 'Type of Feedback', 'select');
        const typeSelect = typeGroup.querySelector('select');
        typeSelect.name = 'type';
        typeSelect.required = true;
        
        const typeOptions = [
            { value: '', text: 'Select feedback type' },
            { value: this.feedbackTypes.BUG, text: 'Bug Report' },
            { value: this.feedbackTypes.FEATURE, text: 'Feature Request' },
            { value: this.feedbackTypes.IMPROVEMENT, text: 'Improvement Suggestion' },
            { value: this.feedbackTypes.TRANSLATION, text: 'Translation Issue' },
            { value: this.feedbackTypes.UI, text: 'UI/UX Issue' },
            { value: this.feedbackTypes.PERFORMANCE, text: 'Performance Issue' }
        ];
        
        typeOptions.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
            typeSelect.appendChild(optionEl);
        });
        
        const titleGroup = this.createFormGroup('feedback-title', 'Title', 'input');
        const titleInput = titleGroup.querySelector('input');
        titleInput.name = 'title';
        titleInput.required = true;
        titleInput.placeholder = 'Brief description of your feedback';
        
        const descGroup = this.createFormGroup('feedback-description', 'Description', 'textarea');
        const descTextarea = descGroup.querySelector('textarea');
        descTextarea.name = 'description';
        descTextarea.required = true;
        descTextarea.placeholder = 'Please provide detailed information about your feedback';
        descTextarea.rows = 4;
        
        const ratingGroup = this.createRatingGroup();
        const emailGroup = this.createFormGroup('feedback-email', 'Email (optional)', 'input');
        const emailInput = emailGroup.querySelector('input');
        emailInput.type = 'email';
        emailInput.name = 'email';
        emailInput.placeholder = 'your@email.com';
        
        const actionsGroup = this.createActionsGroup();
        
        form.appendChild(typeGroup);
        form.appendChild(titleGroup);
        form.appendChild(descGroup);
        form.appendChild(ratingGroup);
        form.appendChild(emailGroup);
        form.appendChild(actionsGroup);
        
        modalContent.appendChild(header);
        modalContent.appendChild(form);
        
        // Add event listeners
        this.setupFeedbackFormEvents();
    }
    
    /**
     * Create form group element
     */
    createFormGroup(id, labelText, inputType) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const label = document.createElement('label');
        label.setAttribute('for', id);
        label.textContent = labelText;
        
        let input;
        if (inputType === 'select') {
            input = document.createElement('select');
        } else if (inputType === 'textarea') {
            input = document.createElement('textarea');
        } else {
            input = document.createElement('input');
        }
        
        input.id = id;
        
        group.appendChild(label);
        group.appendChild(input);
        
        return group;
    }
    
    /**
     * Create rating group
     */
    createRatingGroup() {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = 'Overall Experience';
        
        const container = document.createElement('div');
        container.className = 'rating-container';
        
        const ratings = [
            { id: 'rating-1', value: '1', emoji: '😞' },
            { id: 'rating-2', value: '2', emoji: '😐' },
            { id: 'rating-3', value: '3', emoji: '😊' },
            { id: 'rating-4', value: '4', emoji: '😄' },
            { id: 'rating-5', value: '5', emoji: '🤩' }
        ];
        
        ratings.forEach(rating => {
            const input = document.createElement('input');
            input.type = 'radio';
            input.id = rating.id;
            input.name = 'rating';
            input.value = rating.value;
            
            const label = document.createElement('label');
            label.setAttribute('for', rating.id);
            label.textContent = rating.emoji;
            
            container.appendChild(input);
            container.appendChild(label);
        });
        
        group.appendChild(label);
        group.appendChild(container);
        
        return group;
    }
    
    /**
     * Create actions group
     */
    createActionsGroup() {
        const group = document.createElement('div');
        group.className = 'form-actions';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'cancel-button';
        cancelBtn.textContent = 'Cancel';
        
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'submit-button';
        submitBtn.textContent = 'Send Feedback';
        
        group.appendChild(cancelBtn);
        group.appendChild(submitBtn);
        
        return group;
    }
    
    /**
     * Setup feedback form events
     */
    setupFeedbackFormEvents() {
        const modal = document.getElementById('feedback-modal');
        const form = document.getElementById('feedback-form');
        const closeButton = modal.querySelector('.close-button');
        const cancelButton = modal.querySelector('.cancel-button');
        
        closeButton.addEventListener('click', () => this.hideFeedbackModal());
        cancelButton.addEventListener('click', () => this.hideFeedbackModal());
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitFeedback();
        });
    }
    
    /**
     * Show feedback modal
     */
    showFeedbackModal() {
        const modal = document.getElementById('feedback-modal');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Focus on first input
        const firstInput = modal.querySelector('input, select, textarea');
        if (firstInput) {
            firstInput.focus();
        }
    }
    
    /**
     * Hide feedback modal
     */
    hideFeedbackModal() {
        const modal = document.getElementById('feedback-modal');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        
        // Reset form
        const form = document.getElementById('feedback-form');
        form.reset();
    }
    
    /**
     * Submit feedback
     */
    async submitFeedback() {
        const form = document.getElementById('feedback-form');
        const formData = new FormData(form);
        
        const feedback = {
            type: formData.get('type'),
            title: formData.get('title'),
            description: formData.get('description'),
            rating: formData.get('rating'),
            email: formData.get('email'),
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            sessionId: this.getSessionId()
        };
        
        try {
            await this.sendFeedback(feedback);
            this.showSuccessMessage();
            this.hideFeedbackModal();
        } catch (error) {
            this.showErrorMessage(error.message);
        }
    }
    
    /**
     * Send feedback to server
     */
    async sendFeedback(feedback) {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.getCSRFToken()
            },
            body: JSON.stringify(feedback)
        });
        
        if (!response.ok) {
            throw new Error('Failed to send feedback');
        }
        
        return response.json();
    }
    
    /**
     * Setup feedback collection
     */
    setupFeedbackCollection() {
        // Collect automatic feedback
        this.collectAutomaticFeedback();
        
        // Collect user behavior data
        this.collectUserBehavior();
    }
    
    /**
     * Collect automatic feedback
     */
    collectAutomaticFeedback() {
        // Monitor translation errors
        this.monitorTranslationErrors();
        
        // Monitor performance issues
        this.monitorPerformanceIssues();
        
        // Monitor user interactions
        this.monitorUserInteractions();
    }
    
    /**
     * Collect user behavior data
     */
    collectUserBehavior() {
        // Track page views
        this.trackPageView();
        
        // Track feature usage
        this.trackFeatureUsage();
        
        // Track user interactions
        this.trackUserInteractions();
    }
    
    /**
     * Collect error feedback
     * @param {string} type - Error type
     * @param {string} message - Error message
     */
    collectErrorFeedback(type, message) {
        console.log('📊 [UserFeedback] Collecting error feedback:', { type, message });
        
        const errorData = {
            type: type,
            message: message,
            timestamp: new Date(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        this.feedbackQueue.push(errorData);
        
        // Send error feedback immediately
        this.sendErrorFeedback(errorData).catch(error => {
            console.warn('Failed to send error feedback:', error);
        });
    }

    /**
     * Send error feedback to server
     * @param {Object} errorData - Error data
     */
    async sendErrorFeedback(errorData) {
        try {
            const response = await fetch('/api/user-feedback/error', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
                },
                body: JSON.stringify({
                    error: errorData,
                    sessionId: this.sessionId
                })
            });
            
            if (response.ok) {
                console.log('📊 [UserFeedback] Error feedback sent successfully');
            }
        } catch (error) {
            console.error('❌ [UserFeedback] Failed to send error feedback:', error);
        }
    }

    /**
     * Monitor translation errors
     */
    monitorTranslationErrors() {
        // Override console.error to catch translation errors
        const originalError = console.error;
        console.error = (...args) => {
            if (args.some(arg => typeof arg === 'string' && arg.includes('translation'))) {
                this.collectErrorFeedback('translation', args.join(' '));
            }
            originalError.apply(console, args);
        };
    }
    
    /**
     * Monitor performance issues
     */
    monitorPerformanceIssues() {
        // Monitor slow operations
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const start = performance.now();
            const response = await originalFetch(...args);
            const end = performance.now();
            
            if (end - start > 5000) { // 5 seconds
                this.collectPerformanceFeedback(args[0], end - start);
            }
            
            return response;
        };
    }
    
    /**
     * Monitor user interactions
     */
    monitorUserInteractions() {
        // Track clicks on important elements
        document.addEventListener('click', (e) => {
            const element = e.target;
            if (element.matches('.translate-btn, .clear-btn, .swap-btn')) {
                this.collectInteractionFeedback('button_click', element.className);
            }
        });
        
        // Track form submissions
        document.addEventListener('submit', (e) => {
            this.collectInteractionFeedback('form_submit', e.target.id);
        });
    }
    
    /**
     * Setup user testing
     */
    setupUserTesting() {
        // A/B testing
        this.setupABTesting();
        
        // User session recording
        this.setupSessionRecording();
    }
    
    /**
     * Setup A/B testing
     */
    setupABTesting() {
        // Test different UI layouts
        const testVariant = this.getABTestVariant();
        this.applyABTestVariant(testVariant);
    }
    
    /**
     * Get A/B test variant
     */
    getABTestVariant() {
        const variants = ['control', 'variant_a', 'variant_b'];
        const random = Math.random();
        return variants[Math.floor(random * variants.length)];
    }
    
    /**
     * Apply A/B test variant
     */
    applyABTestVariant(variant) {
        document.body.setAttribute('data-ab-variant', variant);
        
        // Apply variant-specific styles
        if (variant === 'variant_a') {
            document.body.classList.add('variant-a');
        } else if (variant === 'variant_b') {
            document.body.classList.add('variant-b');
        }
    }
    
    /**
     * Setup session recording
     */
    setupSessionRecording() {
        // Record user interactions
        this.recordUserInteractions();
        
        // Record performance metrics
        this.recordPerformanceMetrics();
    }
    
    /**
     * Record user interactions
     */
    recordUserInteractions() {
        const interactions = [];
        
        document.addEventListener('click', (e) => {
            interactions.push({
                type: 'click',
                target: e.target.tagName,
                className: e.target.className,
                timestamp: Date.now()
            });
        });
        
        document.addEventListener('input', (e) => {
            interactions.push({
                type: 'input',
                target: e.target.tagName,
                value: e.target.value.substring(0, 50), // Limit length
                timestamp: Date.now()
            });
        });
        
        // Send interactions periodically
        const interactionInterval = setInterval(() => {
            if (this.isDestroyed) {
                clearInterval(interactionInterval);
                return;
            }
            if (interactions.length > 0) {
                this.sendUserInteractions(interactions.splice(0, 10)).catch(error => {
                    console.warn('Failed to send user interactions:', error);
                });
            }
        }, 30000); // Every 30 seconds
        
        this.intervals.push(interactionInterval);
    }
    
    /**
     * Record performance metrics
     */
    recordPerformanceMetrics() {
        const metricsInterval = setInterval(() => {
            if (this.isDestroyed) {
                clearInterval(metricsInterval);
                return;
            }
            
            const metrics = {
                memoryUsage: performance.memory?.usedJSHeapSize || 0,
                loadTime: performance.timing?.loadEventEnd - performance.timing?.navigationStart || 0,
                domContentLoaded: performance.timing?.domContentLoadedEventEnd - performance.timing?.navigationStart || 0,
                timestamp: Date.now()
            };
            
            this.sendPerformanceMetrics(metrics).catch(error => {
                console.warn('Failed to send performance metrics:', error);
            });
        }, 60000); // Every minute
        
        this.intervals.push(metricsInterval);
    }

    /**
     * Send user interactions to server
     */
    async sendUserInteractions(interactions) {
        if (!interactions || !interactions.length) return;
        
        try {
            const response = await fetch('/api/user-feedback/interactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
                },
                body: JSON.stringify({
                    interactions: interactions,
                    sessionId: this.sessionId
                })
            });
            
            if (response.ok) {
                console.log('📊 [UserFeedback] User interactions sent successfully');
            }
        } catch (error) {
            console.error('❌ [UserFeedback] Failed to send user interactions:', error);
        }
    }

    /**
     * Send performance metrics to server
     */
    async sendPerformanceMetrics(metrics) {
        if (!metrics) return;
        
        try {
            const response = await fetch('/api/user-feedback/performance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
                },
                body: JSON.stringify({
                    metrics: metrics,
                    sessionId: this.sessionId
                })
            });
            
            if (response.ok) {
                console.log('📊 [UserFeedback] Performance metrics sent successfully');
            }
        } catch (error) {
            console.error('❌ [UserFeedback] Failed to send performance metrics:', error);
        }
    }
    
    /**
     * Setup analytics
     */
    setupAnalytics() {
        // Track page views
        this.trackPageView();
        
        // Track feature usage
        this.trackFeatureUsage();
    }

    /**
     * Generate a unique session ID
     * @returns {string} Session ID
     */
    generateSessionId() {
        return 'feedback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Cleanup method to prevent memory leaks
     */
    destroy() {
        this.isDestroyed = true;
        
        // Clear all intervals
        this.intervals.forEach(interval => {
            clearInterval(interval);
        });
        this.intervals = [];
        
        // Clear arrays
        this.feedbackQueue = [];
        this.interactions = [];
        this.performanceMetrics = [];
        
        console.log('UserFeedbackSystem destroyed and cleaned up');
    }
    
    /**
     * Track page view
     */
    trackPageView() {
        this.sendAnalytics('page_view', {
            url: window.location.href,
            title: document.title,
            timestamp: Date.now()
        });
    }
    
    /**
     * Track feature usage
     */
    trackFeatureUsage() {
        // Track translation usage
        document.addEventListener('translation_complete', (e) => {
            this.sendAnalytics('translation_complete', {
                sourceLanguage: e.detail.sourceLanguage,
                targetLanguage: e.detail.targetLanguage,
                textLength: e.detail.textLength,
                timestamp: Date.now()
            });
        });
    }
    
    /**
     * Track user interactions
     */
    trackUserInteractions() {
        // Track clicks on important elements
        document.addEventListener('click', (e) => {
            const element = e.target;
            if (element.matches('.translate-btn, .clear-btn, .swap-btn, .favorite-btn')) {
                this.sendAnalytics('button_click', {
                    buttonClass: element.className,
                    buttonId: element.id,
                    timestamp: Date.now()
                });
            }
        });
        
        // Track form submissions
        document.addEventListener('submit', (e) => {
            this.sendAnalytics('form_submit', {
                formId: e.target.id,
                formClass: e.target.className,
                timestamp: Date.now()
            });
        });
        
        // Track input focus
        document.addEventListener('focus', (e) => {
            if (e.target.matches('input, textarea, select')) {
                this.sendAnalytics('input_focus', {
                    inputType: e.target.type || e.target.tagName.toLowerCase(),
                    inputId: e.target.id,
                    timestamp: Date.now()
                });
            }
        }, true);
    }
    
    /**
     * Send analytics data
     */
    async sendAnalytics(event, data) {
        try {
            await fetch('/api/analytics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    event,
                    data,
                    sessionId: this.getSessionId()
                })
            });
        } catch (error) {
            console.error('Failed to send analytics:', error);
        }
    }
    
    /**
     * Get session ID
     */
    getSessionId() {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }
    
    /**
     * Get CSRF token
     */
    getCSRFToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : null;
    }
    
    /**
     * Show success message
     */
    showSuccessMessage() {
        this.showMessage('Thank you for your feedback!', 'success');
    }
    
    /**
     * Show error message
     */
    showErrorMessage(message) {
        this.showMessage(`Error: ${message}`, 'error');
    }
    
    /**
     * Show message
     */
    showMessage(text, type) {
        const message = document.createElement('div');
        message.className = `feedback-message ${type}`;
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            border-radius: 4px;
            color: white;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
            z-index: 1002;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 3000);
    }
}

// Global user feedback system
export const userFeedbackSystem = new UserFeedbackSystem();
