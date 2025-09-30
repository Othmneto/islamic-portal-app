// Comprehensive Error Tracking and Alerting System
class ErrorTracking {
    constructor() {
        this.errors = [];
        this.errorPatterns = new Map();
        this.alertThresholds = {
            errorRate: 0.05, // 5% error rate
            criticalErrors: 3, // 3 critical errors
            timeWindow: 300000 // 5 minutes
        };
        
        this.alertChannels = {
            console: true,
            notification: true,
            server: true
        };
        
        this.errorCategories = {
            JAVASCRIPT: 'javascript',
            NETWORK: 'network',
            RESOURCE: 'resource',
            PROMISE: 'promise',
            CUSTOM: 'custom',
            CRITICAL: 'critical'
        };
        
        this.initializeErrorTracking();
    }

    // Initialize error tracking
    initializeErrorTracking() {
        this.setupGlobalErrorHandlers();
        this.setupUnhandledRejectionHandlers();
        this.setupResourceErrorHandlers();
        this.setupCustomErrorHandlers();
        this.startErrorAnalysis();
        
        console.log('Error tracking initialized');
    }

    // Global error handlers
    setupGlobalErrorHandlers() {
        window.addEventListener('error', (event) => {
            const error = {
                id: this.generateErrorId(),
                type: this.errorCategories.JAVASCRIPT,
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                severity: this.determineSeverity(event.error),
                context: this.getErrorContext()
            };

            this.recordError(error);
        });
    }

    // Unhandled promise rejection handlers
    setupUnhandledRejectionHandlers() {
        window.addEventListener('unhandledrejection', (event) => {
            const error = {
                id: this.generateErrorId(),
                type: this.errorCategories.PROMISE,
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                severity: this.determineSeverity(event.reason),
                context: this.getErrorContext()
            };

            this.recordError(error);
        });
    }

    // Resource error handlers
    setupResourceErrorHandlers() {
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                const error = {
                    id: this.generateErrorId(),
                    type: this.errorCategories.RESOURCE,
                    message: `Failed to load resource: ${event.target.src || event.target.href}`,
                    element: event.target.tagName,
                    src: event.target.src || event.target.href,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    severity: 'medium',
                    context: this.getErrorContext()
                };

                this.recordError(error);
            }
        }, true);
    }

    // Custom error handlers
    setupCustomErrorHandlers() {
        // Listen for custom error events
        window.addEventListener('customError', (event) => {
            const error = {
                id: this.generateErrorId(),
                type: this.errorCategories.CUSTOM,
                message: event.detail.message,
                code: event.detail.code,
                data: event.detail.data,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                severity: event.detail.severity || 'medium',
                context: this.getErrorContext()
            };

            this.recordError(error);
        });
    }

    // Record error
    recordError(error) {
        // Add to errors array
        this.errors.push(error);
        
        // Update error patterns
        this.updateErrorPatterns(error);
        
        // Check for alerts
        this.checkAlerts(error);
        
        // Send to server if enabled
        if (this.alertChannels.server) {
            this.sendErrorToServer(error);
        }
        
        // Log to console if enabled
        if (this.alertChannels.console) {
            this.logErrorToConsole(error);
        }
        
        // Show notification if enabled
        if (this.alertChannels.notification && error.severity === 'critical') {
            this.showErrorNotification(error);
        }
        
        // Keep only last 1000 errors
        if (this.errors.length > 1000) {
            this.errors = this.errors.slice(-1000);
        }
    }

    // Update error patterns for analysis
    updateErrorPatterns(error) {
        const patternKey = this.getErrorPatternKey(error);
        
        if (!this.errorPatterns.has(patternKey)) {
            this.errorPatterns.set(patternKey, {
                count: 0,
                firstSeen: error.timestamp,
                lastSeen: error.timestamp,
                severity: error.severity,
                examples: []
            });
        }
        
        const pattern = this.errorPatterns.get(patternKey);
        pattern.count++;
        pattern.lastSeen = error.timestamp;
        
        if (pattern.examples.length < 5) {
            pattern.examples.push({
                message: error.message,
                timestamp: error.timestamp,
                url: error.url
            });
        }
    }

    // Get error pattern key
    getErrorPatternKey(error) {
        return `${error.type}:${error.message}:${error.filename}:${error.lineno}`;
    }

    // Check for alerts
    checkAlerts(error) {
        const now = Date.now();
        const timeWindow = this.alertThresholds.timeWindow;
        
        // Check error rate
        const recentErrors = this.errors.filter(e => now - e.timestamp < timeWindow);
        const totalInteractions = this.getTotalInteractions();
        const errorRate = totalInteractions > 0 ? recentErrors.length / totalInteractions : 0;
        
        if (errorRate > this.alertThresholds.errorRate) {
            this.triggerAlert('high_error_rate', {
                errorRate,
                threshold: this.alertThresholds.errorRate,
                recentErrors: recentErrors.length
            });
        }
        
        // Check critical errors
        const criticalErrors = recentErrors.filter(e => e.severity === 'critical');
        if (criticalErrors.length >= this.alertThresholds.criticalErrors) {
            this.triggerAlert('critical_errors', {
                count: criticalErrors.length,
                threshold: this.alertThresholds.criticalErrors
            });
        }
        
        // Check error patterns
        const pattern = this.errorPatterns.get(this.getErrorPatternKey(error));
        if (pattern && pattern.count >= 10) {
            this.triggerAlert('recurring_error', {
                pattern: pattern,
                count: pattern.count
            });
        }
    }

    // Trigger alert
    triggerAlert(type, data) {
        const alert = {
            type,
            data,
            timestamp: Date.now(),
            id: this.generateErrorId()
        };
        
        console.warn(`Error Alert: ${type}`, data);
        
        // Send alert to server
        this.sendAlertToServer(alert);
        
        // Show notification
        this.showAlertNotification(alert);
    }

    // Determine error severity
    determineSeverity(error) {
        if (!error) return 'low';
        
        const message = error.message || String(error);
        const stack = error.stack || '';
        
        // Critical errors
        if (message.includes('Critical') || 
            message.includes('Fatal') ||
            stack.includes('Critical')) {
            return 'critical';
        }
        
        // High severity errors
        if (message.includes('TypeError') ||
            message.includes('ReferenceError') ||
            message.includes('SyntaxError')) {
            return 'high';
        }
        
        // Medium severity errors
        if (message.includes('Network') ||
            message.includes('Timeout') ||
            message.includes('Failed to fetch')) {
            return 'medium';
        }
        
        return 'low';
    }

    // Get error context
    getErrorContext() {
        return {
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            screen: {
                width: screen.width,
                height: screen.height
            },
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            online: navigator.onLine,
            referrer: document.referrer,
            title: document.title
        };
    }

    // Get total interactions (approximation)
    getTotalInteractions() {
        // This would be integrated with APM monitoring
        return window.apmMonitoring?.metrics.userInteractions.length || 100;
    }

    // Send error to server
    async sendErrorToServer(error) {
        try {
            await fetch('/api/errors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(error)
            });
        } catch (err) {
            console.warn('Failed to send error to server:', err);
        }
    }

    // Send alert to server
    async sendAlertToServer(alert) {
        try {
            await fetch('/api/errors/alerts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(alert)
            });
        } catch (err) {
            console.warn('Failed to send alert to server:', err);
        }
    }

    // Log error to console
    logErrorToConsole(error) {
        const logMethod = error.severity === 'critical' ? 'error' : 'warn';
        console[logMethod](`[${error.severity.toUpperCase()}] ${error.message}`, {
            id: error.id,
            type: error.type,
            timestamp: new Date(error.timestamp).toISOString(),
            context: error.context
        });
    }

    // Show error notification
    showErrorNotification(error) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Critical Error Detected', {
                body: error.message,
                icon: '/favicon.ico',
                tag: 'error-notification'
            });
        }
    }

    // Show alert notification
    showAlertNotification(alert) {
        // Create in-page notification
        const notification = document.createElement('div');
        notification.className = 'error-alert-notification';
        notification.innerHTML = `
            <div class="alert-content">
                <h4>Error Alert: ${alert.type.replace('_', ' ').toUpperCase()}</h4>
                <p>${JSON.stringify(alert.data, null, 2)}</p>
                <button onclick="this.parentElement.parentElement.remove()">Dismiss</button>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc2626;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 10000);
    }

    // Start error analysis
    startErrorAnalysis() {
        setInterval(() => {
            this.analyzeErrorPatterns();
            this.cleanupOldErrors();
        }, 60000); // Analyze every minute
    }

    // Analyze error patterns
    analyzeErrorPatterns() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        for (const [patternKey, pattern] of this.errorPatterns) {
            if (now - pattern.lastSeen > oneHour) {
                // Pattern hasn't been seen in an hour, remove it
                this.errorPatterns.delete(patternKey);
            } else if (pattern.count >= 5) {
                // Pattern is recurring, analyze it
                this.analyzeRecurringPattern(patternKey, pattern);
            }
        }
    }

    // Analyze recurring pattern
    analyzeRecurringPattern(patternKey, pattern) {
        const analysis = {
            patternKey,
            frequency: pattern.count / ((pattern.lastSeen - pattern.firstSeen) / 1000 / 60), // errors per minute
            severity: pattern.severity,
            examples: pattern.examples,
            recommendation: this.getRecommendation(pattern)
        };
        
        console.log('Recurring error pattern detected:', analysis);
        
        // Send analysis to server
        this.sendAnalysisToServer(analysis);
    }

    // Get recommendation for pattern
    getRecommendation(pattern) {
        if (pattern.severity === 'critical') {
            return 'Immediate attention required - critical error pattern detected';
        } else if (pattern.count >= 20) {
            return 'High frequency error - consider implementing retry logic or better error handling';
        } else if (pattern.count >= 10) {
            return 'Moderate frequency error - monitor closely and consider preventive measures';
        } else {
            return 'Low frequency error - continue monitoring';
        }
    }

    // Send analysis to server
    async sendAnalysisToServer(analysis) {
        try {
            await fetch('/api/errors/analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(analysis)
            });
        } catch (err) {
            console.warn('Failed to send analysis to server:', err);
        }
    }

    // Cleanup old errors
    cleanupOldErrors() {
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        this.errors = this.errors.filter(error => now - error.timestamp < oneDay);
    }

    // Generate error ID
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Get error statistics
    getErrorStats() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * 60 * 60 * 1000;
        
        const recentErrors = this.errors.filter(e => now - e.timestamp < oneHour);
        const dailyErrors = this.errors.filter(e => now - e.timestamp < oneDay);
        
        const severityCounts = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        };
        
        recentErrors.forEach(error => {
            severityCounts[error.severity]++;
        });
        
        return {
            total: this.errors.length,
            recent: recentErrors.length,
            daily: dailyErrors.length,
            severityCounts,
            patterns: this.errorPatterns.size,
            errorRate: this.getErrorRate()
        };
    }

    // Get error rate
    getErrorRate() {
        const totalInteractions = this.getTotalInteractions();
        return totalInteractions > 0 ? this.errors.length / totalInteractions : 0;
    }

    // Export errors
    exportErrors(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.errors, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(this.errors);
        }
    }

    // Convert to CSV
    convertToCSV(errors) {
        const headers = ['id', 'type', 'message', 'severity', 'timestamp', 'url'];
        const rows = errors.map(error => 
            headers.map(header => `"${error[header] || ''}"`).join(',')
        );
        return [headers.join(','), ...rows].join('\n');
    }

    // Clear errors
    clearErrors() {
        this.errors = [];
        this.errorPatterns.clear();
        console.log('Error tracking cleared');
    }

    // Update alert channels
    updateAlertChannels(channels) {
        this.alertChannels = { ...this.alertChannels, ...channels };
    }

    // Update thresholds
    updateThresholds(thresholds) {
        this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    }
}

// Export for use
export default ErrorTracking;
