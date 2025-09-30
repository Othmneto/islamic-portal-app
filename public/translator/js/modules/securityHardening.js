/**
 * Security Hardening Module
 * Implements additional security measures for the translation interface
 */

export class SecurityHardener {
    constructor() {
        this.cspViolations = [];
        this.xssAttempts = 0;
        this.csrfToken = null;
        this.securityHeaders = {
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.openai.com https://api.elevenlabs.io https://api.pinecone.io https://cdnjs.cloudflare.com https://*.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; worker-src 'self' blob:; child-src 'self' blob:",
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
        };
        
        this.init();
    }
    
    init() {
        this.setupCSPMonitoring();
        this.setupXSSProtection();
        this.setupCSRFProtection();
        this.setupInputSanitization();
        this.setupClickjackingProtection();
        this.setupSecureStorage();
    }
    
    /**
     * Setup Content Security Policy monitoring
     */
    setupCSPMonitoring() {
        // Monitor CSP violations
        document.addEventListener('securitypolicyviolation', (e) => {
            this.cspViolations.push({
                timestamp: Date.now(),
                violatedDirective: e.violatedDirective,
                blockedURI: e.blockedURI,
                sourceFile: e.sourceFile,
                lineNumber: e.lineNumber
            });
            
            console.warn('CSP Violation:', {
                directive: e.violatedDirective,
                blocked: e.blockedURI,
                source: e.sourceFile,
                line: e.lineNumber
            });
            
            // Report to server
            this.reportCSPViolation(e);
        });
    }
    
    /**
     * Report CSP violation to server
     */
    async reportCSPViolation(violation) {
        try {
            await fetch('/api/security/csp-violation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({
                    violatedDirective: violation.violatedDirective,
                    blockedURI: violation.blockedURI,
                    sourceFile: violation.sourceFile,
                    lineNumber: violation.lineNumber,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                })
            });
        } catch (error) {
            console.error('Failed to report CSP violation:', error);
        }
    }
    
    /**
     * Setup XSS protection
     */
    setupXSSProtection() {
        // Note: innerHTML override disabled to prevent conflicts
        // this.sanitizeInputs();
        
        // Monitor for XSS attempts
        this.monitorXSSAttempts();
        
        // Setup output encoding
        this.setupOutputEncoding();
    }
    
    /**
     * Sanitize user inputs
     */
    sanitizeInputs() {
        // Store reference to sanitizeHTML method
        const self = this;
        
        // Override innerHTML to sanitize content
        const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function(value) {
                const sanitized = self.sanitizeHTML(value);
                originalInnerHTML.set.call(this, sanitized);
            },
            get: originalInnerHTML.get
        });
    }
    
    /**
     * Sanitize HTML content
     */
    sanitizeHTML(html) {
        if (typeof html !== 'string') return html;
        
        // Remove script tags and event handlers
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/vbscript:/gi, '')
            .replace(/data:/gi, '');
    }
    
    /**
     * Monitor XSS attempts
     */
    monitorXSSAttempts() {
        // Monitor for suspicious patterns
        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /vbscript:/i,
            /on\w+\s*=/i,
            /eval\s*\(/i,
            /expression\s*\(/i
        ];
        
        // Monitor form inputs
        document.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                const value = e.target.value;
                const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(value));
                
                if (isSuspicious) {
                    this.xssAttempts++;
                    console.warn('Potential XSS attempt detected:', value);
                    this.reportXSSAttempt(value, e.target);
                }
            }
        });
    }
    
    /**
     * Report XSS attempt
     */
    async reportXSSAttempt(value, element) {
        try {
            await fetch('/api/security/xss-attempt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({
                    value: value.substring(0, 100), // Limit length
                    element: element.tagName,
                    timestamp: Date.now(),
                    url: window.location.href
                })
            });
        } catch (error) {
            console.error('Failed to report XSS attempt:', error);
        }
    }
    
    /**
     * Setup output encoding
     */
    setupOutputEncoding() {
        // Encode HTML entities
        this.encodeHTML = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        // Encode URL parameters
        this.encodeURL = (text) => {
            return encodeURIComponent(text);
        };
    }
    
    /**
     * Setup CSRF protection
     */
    setupCSRFProtection() {
        // Get CSRF token from meta tag
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta) {
            this.csrfToken = csrfMeta.getAttribute('content');
        }
        
        // Add CSRF token to all forms
        this.addCSRFTokenToForms();
        
        // Add CSRF token to AJAX requests
        this.addCSRFTokenToAJAX();
    }
    
    /**
     * Add CSRF token to forms
     */
    addCSRFTokenToForms() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            if (!form.querySelector('input[name="_token"]')) {
                const tokenInput = document.createElement('input');
                tokenInput.type = 'hidden';
                tokenInput.name = '_token';
                tokenInput.value = this.csrfToken;
                form.appendChild(tokenInput);
            }
        });
    }
    
    /**
     * Add CSRF token to AJAX requests
     */
    addCSRFTokenToAJAX() {
        const originalFetch = window.fetch;
        window.fetch = async (url, options = {}) => {
            if (this.csrfToken) {
                options.headers = {
                    ...options.headers,
                    'X-CSRF-Token': this.csrfToken
                };
            }
            return originalFetch(url, options);
        };
    }
    
    /**
     * Setup input sanitization
     */
    setupInputSanitization() {
        // Sanitize text inputs
        const textInputs = document.querySelectorAll('input[type="text"], textarea');
        textInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                e.target.value = this.sanitizeText(e.target.value);
            });
        });
    }
    
    /**
     * Sanitize text input
     */
    sanitizeText(text) {
        if (typeof text !== 'string') return text;
        
        return text
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/vbscript:/gi, '') // Remove vbscript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();
    }
    
    /**
     * Setup clickjacking protection
     */
    setupClickjackingProtection() {
        // Check if page is in iframe
        if (window !== window.top) {
            // Allow only trusted domains
            const trustedDomains = ['localhost', 'yourdomain.com'];
            const parentDomain = window.parent.location.hostname;
            
            if (!trustedDomains.includes(parentDomain)) {
                // Redirect to prevent clickjacking
                window.top.location = window.location;
            }
        }
        
        // Note: X-Frame-Options should be set via HTTP headers, not meta tags
        // This is handled by the server-side security headers
    }
    
    /**
     * Setup secure storage
     */
    setupSecureStorage() {
        // Use secure storage for sensitive data
        this.secureStorage = {
            set: (key, value) => {
                try {
                    const encrypted = this.encrypt(JSON.stringify(value));
                    localStorage.setItem(`secure_${key}`, encrypted);
                } catch (error) {
                    console.error('Failed to store secure data:', error);
                }
            },
            
            get: (key) => {
                try {
                    const encrypted = localStorage.getItem(`secure_${key}`);
                    if (encrypted) {
                        const decrypted = this.decrypt(encrypted);
                        return JSON.parse(decrypted);
                    }
                } catch (error) {
                    console.error('Failed to retrieve secure data:', error);
                }
                return null;
            },
            
            remove: (key) => {
                localStorage.removeItem(`secure_${key}`);
            }
        };
    }
    
    /**
     * Simple encryption for sensitive data
     */
    encrypt(text) {
        // Simple XOR encryption (not cryptographically secure)
        const key = 'translation_security_key';
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(result);
    }
    
    /**
     * Simple decryption for sensitive data
     */
    decrypt(encryptedText) {
        try {
            const text = atob(encryptedText);
            const key = 'translation_security_key';
            let result = '';
            for (let i = 0; i < text.length; i++) {
                result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return result;
        } catch (error) {
            console.error('Failed to decrypt data:', error);
            return null;
        }
    }
    
    /**
     * Validate file uploads
     */
    validateFileUpload(file) {
        const allowedTypes = ['text/plain', 'text/csv', 'application/json'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!allowedTypes.includes(file.type)) {
            throw new Error('File type not allowed');
        }
        
        if (file.size > maxSize) {
            throw new Error('File too large');
        }
        
        return true;
    }
    
    /**
     * Get security status
     */
    getSecurityStatus() {
        return {
            cspViolations: this.cspViolations.length,
            xssAttempts: this.xssAttempts,
            csrfToken: !!this.csrfToken,
            isInIframe: window !== window.top,
            securityHeaders: this.securityHeaders
        };
    }
    
    /**
     * Cleanup security monitoring
     */
    cleanup() {
        // Remove event listeners
        document.removeEventListener('securitypolicyviolation', this.reportCSPViolation);
        document.removeEventListener('input', this.monitorXSSAttempts);
    }
}

// Global security hardener
export const securityHardener = new SecurityHardener();
