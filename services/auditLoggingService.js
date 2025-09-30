const fs = require('fs').promises;
const path = require('path');

/**
 * Comprehensive Audit Logging Service
 * Tracks all user actions for security and compliance
 */
class AuditLoggingService {
    constructor() {
        this.logDirectory = path.join(__dirname, '../logs/audit');
        this.initializeLogDirectory();
        
        this.actionTypes = {
            // Authentication actions
            'AUTH_LOGIN': { severity: 'info', category: 'authentication' },
            'AUTH_LOGOUT': { severity: 'info', category: 'authentication' },
            'AUTH_FAILED_LOGIN': { severity: 'warning', category: 'authentication' },
            'AUTH_PASSWORD_CHANGE': { severity: 'info', category: 'authentication' },
            'AUTH_ACCOUNT_LOCKED': { severity: 'warning', category: 'authentication' },
            
            // Translation actions
            'TRANSLATION_REQUEST': { severity: 'info', category: 'translation' },
            'TRANSLATION_SUCCESS': { severity: 'info', category: 'translation' },
            'TRANSLATION_FAILED': { severity: 'warning', category: 'translation' },
            'TRANSLATION_CACHED': { severity: 'debug', category: 'translation' },
            'TRANSLATION_DELETED': { severity: 'info', category: 'translation' },
            
            // Data access actions
            'DATA_READ': { severity: 'debug', category: 'data_access' },
            'DATA_WRITE': { severity: 'info', category: 'data_access' },
            'DATA_DELETE': { severity: 'warning', category: 'data_access' },
            'DATA_EXPORT': { severity: 'info', category: 'data_access' },
            'DATA_IMPORT': { severity: 'info', category: 'data_access' },
            
            // Security actions
            'SECURITY_VIOLATION': { severity: 'error', category: 'security' },
            'RATE_LIMIT_EXCEEDED': { severity: 'warning', category: 'security' },
            'SUSPICIOUS_ACTIVITY': { severity: 'warning', category: 'security' },
            'UNAUTHORIZED_ACCESS': { severity: 'error', category: 'security' },
            'CSRF_ATTEMPT': { severity: 'warning', category: 'security' },
            
            // System actions
            'SYSTEM_START': { severity: 'info', category: 'system' },
            'SYSTEM_SHUTDOWN': { severity: 'info', category: 'system' },
            'CONFIGURATION_CHANGE': { severity: 'warning', category: 'system' },
            'ERROR_OCCURRED': { severity: 'error', category: 'system' },
            
            // User management actions
            'USER_CREATED': { severity: 'info', category: 'user_management' },
            'USER_UPDATED': { severity: 'info', category: 'user_management' },
            'USER_DELETED': { severity: 'warning', category: 'user_management' },
            'USER_SUSPENDED': { severity: 'warning', category: 'user_management' },
            'USER_ACTIVATED': { severity: 'info', category: 'user_management' }
        };

        this.sensitiveFields = [
            'password', 'token', 'secret', 'key', 'auth', 'credential',
            'ssn', 'social_security', 'credit_card', 'bank_account'
        ];
    }

    /**
     * Initialize log directory
     */
    async initializeLogDirectory() {
        try {
            await fs.mkdir(this.logDirectory, { recursive: true });
            console.log('📋 [AuditLoggingService] Audit log directory initialized');
        } catch (error) {
            console.error('❌ [AuditLoggingService] Failed to initialize log directory:', error);
        }
    }

    /**
     * Log an audit event
     */
    async logEvent(actionType, userId, details = {}, request = null) {
        try {
            const actionConfig = this.actionTypes[actionType];
            if (!actionConfig) {
                console.warn(`⚠️ [AuditLoggingService] Unknown action type: ${actionType}`);
                return;
            }

            const auditEvent = {
                id: this.generateEventId(),
                timestamp: new Date().toISOString(),
                actionType: actionType,
                userId: userId || 'anonymous',
                severity: actionConfig.severity,
                category: actionConfig.category,
                details: this.sanitizeDetails(details),
                request: this.sanitizeRequest(request),
                sessionId: request?.sessionID || null,
                ipAddress: this.extractIPAddress(request),
                userAgent: request?.get('User-Agent') || null,
                riskScore: this.calculateRiskScore(actionType, details, request)
            };

            // Write to file
            await this.writeToLogFile(auditEvent);

            // Write to console for immediate visibility
            this.logToConsole(auditEvent);

            // Check for security alerts
            await this.checkSecurityAlerts(auditEvent);

            return auditEvent.id;
        } catch (error) {
            console.error('❌ [AuditLoggingService] Failed to log event:', error);
        }
    }

    /**
     * Generate unique event ID
     */
    generateEventId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sanitize details to remove sensitive information
     */
    sanitizeDetails(details) {
        const sanitized = { ...details };
        
        for (const field of this.sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }

        // Sanitize nested objects
        for (const key in sanitized) {
            if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
                sanitized[key] = this.sanitizeDetails(sanitized[key]);
            }
        }

        return sanitized;
    }

    /**
     * Sanitize request object
     */
    sanitizeRequest(request) {
        if (!request) return null;

        return {
            method: request.method,
            url: request.url,
            headers: this.sanitizeHeaders(request.headers),
            body: this.sanitizeDetails(request.body || {}),
            query: this.sanitizeDetails(request.query || {}),
            params: this.sanitizeDetails(request.params || {})
        };
    }

    /**
     * Sanitize headers
     */
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        
        for (const header of sensitiveHeaders) {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        }

        return sanitized;
    }

    /**
     * Extract IP address from request
     */
    extractIPAddress(request) {
        if (!request) return null;
        
        return request.ip || 
               request.connection?.remoteAddress || 
               request.socket?.remoteAddress ||
               (request.connection?.socket ? request.connection.socket.remoteAddress : null) ||
               request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               'unknown';
    }

    /**
     * Calculate risk score for the event
     */
    calculateRiskScore(actionType, details, request) {
        let score = 0;

        // Base score by action type
        const actionScores = {
            'AUTH_FAILED_LOGIN': 30,
            'AUTH_ACCOUNT_LOCKED': 50,
            'SECURITY_VIOLATION': 100,
            'UNAUTHORIZED_ACCESS': 80,
            'SUSPICIOUS_ACTIVITY': 60,
            'CSRF_ATTEMPT': 40,
            'RATE_LIMIT_EXCEEDED': 20
        };

        score += actionScores[actionType] || 0;

        // Additional risk factors
        if (request) {
            // High risk: requests from unusual locations
            if (request.headers['x-forwarded-for']?.includes(',')) {
                score += 10;
            }

            // High risk: requests with suspicious user agents
            const userAgent = request.get('User-Agent') || '';
            if (userAgent.includes('bot') || userAgent.includes('crawler')) {
                score += 15;
            }

            // High risk: requests with unusual patterns
            if (request.url.includes('..') || request.url.includes('//')) {
                score += 25;
            }
        }

        // High risk: unusual data access patterns
        if (details.recordCount && details.recordCount > 1000) {
            score += 20;
        }

        return Math.min(score, 100); // Cap at 100
    }

    /**
     * Write audit event to log file
     */
    async writeToLogFile(auditEvent) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const logFile = path.join(this.logDirectory, `audit_${date}.log`);
            const logEntry = JSON.stringify(auditEvent) + '\n';
            
            await fs.appendFile(logFile, logEntry);
        } catch (error) {
            console.error('❌ [AuditLoggingService] Failed to write to log file:', error);
        }
    }

    /**
     * Log to console for immediate visibility
     */
    logToConsole(auditEvent) {
        const severity = auditEvent.severity;
        const message = `[AUDIT] ${auditEvent.actionType} - User: ${auditEvent.userId} - Risk: ${auditEvent.riskScore}`;
        
        switch (severity) {
            case 'error':
                console.error(`🔴 ${message}`);
                break;
            case 'warning':
                console.warn(`🟡 ${message}`);
                break;
            case 'info':
                console.log(`🔵 ${message}`);
                break;
            case 'debug':
                console.debug(`⚪ ${message}`);
                break;
            default:
                console.log(`📋 ${message}`);
        }
    }

    /**
     * Check for security alerts
     */
    async checkSecurityAlerts(auditEvent) {
        // High risk events
        if (auditEvent.riskScore >= 70) {
            await this.triggerSecurityAlert(auditEvent);
        }

        // Multiple failed login attempts
        if (auditEvent.actionType === 'AUTH_FAILED_LOGIN') {
            await this.checkFailedLoginPattern(auditEvent);
        }

        // Suspicious activity patterns
        if (auditEvent.actionType === 'SUSPICIOUS_ACTIVITY') {
            await this.analyzeSuspiciousActivity(auditEvent);
        }
    }

    /**
     * Trigger security alert
     */
    async triggerSecurityAlert(auditEvent) {
        console.error(`🚨 [SECURITY ALERT] High risk event detected:`, {
            eventId: auditEvent.id,
            actionType: auditEvent.actionType,
            userId: auditEvent.userId,
            riskScore: auditEvent.riskScore,
            timestamp: auditEvent.timestamp
        });

        // Here you could integrate with external security systems
        // e.g., send to SIEM, trigger automated responses, etc.
    }

    /**
     * Check for failed login patterns
     */
    async checkFailedLoginPattern(auditEvent) {
        // This would typically query recent failed login attempts
        // For now, we'll just log the pattern
        console.warn(`🔍 [AuditLoggingService] Monitoring failed login pattern for user: ${auditEvent.userId}`);
    }

    /**
     * Analyze suspicious activity
     */
    async analyzeSuspiciousActivity(auditEvent) {
        console.warn(`🔍 [AuditLoggingService] Analyzing suspicious activity:`, auditEvent.details);
    }

    /**
     * Get audit logs for a specific user
     */
    async getUserAuditLogs(userId, startDate, endDate, limit = 100) {
        try {
            const logs = [];
            const start = new Date(startDate);
            const end = new Date(endDate);

            // Get all log files in the date range
            const files = await fs.readdir(this.logDirectory);
            
            for (const file of files) {
                if (file.startsWith('audit_') && file.endsWith('.log')) {
                    const fileDate = new Date(file.replace('audit_', '').replace('.log', ''));
                    if (fileDate >= start && fileDate <= end) {
                        const filePath = path.join(this.logDirectory, file);
                        const content = await fs.readFile(filePath, 'utf8');
                        const lines = content.trim().split('\n');

                        for (const line of lines) {
                            try {
                                const logEntry = JSON.parse(line);
                                if (logEntry.userId === userId) {
                                    logs.push(logEntry);
                                }
                            } catch (error) {
                                // Skip malformed log entries
                            }
                        }
                    }
                }
            }

            return logs
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limit);
        } catch (error) {
            console.error('❌ [AuditLoggingService] Failed to get user audit logs:', error);
            return [];
        }
    }

    /**
     * Get audit statistics
     */
    async getAuditStatistics(startDate, endDate) {
        try {
            const stats = {
                total_events: 0,
                by_severity: {},
                by_category: {},
                by_action_type: {},
                high_risk_events: 0,
                security_alerts: 0
            };

            const start = new Date(startDate);
            const end = new Date(endDate);

            const files = await fs.readdir(this.logDirectory);
            
            for (const file of files) {
                if (file.startsWith('audit_') && file.endsWith('.log')) {
                    const fileDate = new Date(file.replace('audit_', '').replace('.log', ''));
                    if (fileDate >= start && fileDate <= end) {
                        const filePath = path.join(this.logDirectory, file);
                        const content = await fs.readFile(filePath, 'utf8');
                        const lines = content.trim().split('\n');

                        for (const line of lines) {
                            try {
                                const logEntry = JSON.parse(line);
                                stats.total_events++;
                                
                                // Count by severity
                                stats.by_severity[logEntry.severity] = (stats.by_severity[logEntry.severity] || 0) + 1;
                                
                                // Count by category
                                stats.by_category[logEntry.category] = (stats.by_category[logEntry.category] || 0) + 1;
                                
                                // Count by action type
                                stats.by_action_type[logEntry.actionType] = (stats.by_action_type[logEntry.actionType] || 0) + 1;
                                
                                // Count high risk events
                                if (logEntry.riskScore >= 70) {
                                    stats.high_risk_events++;
                                }
                                
                                // Count security alerts
                                if (logEntry.actionType.includes('SECURITY') || logEntry.actionType.includes('AUTH_FAILED')) {
                                    stats.security_alerts++;
                                }
                            } catch (error) {
                                // Skip malformed log entries
                            }
                        }
                    }
                }
            }

            return stats;
        } catch (error) {
            console.error('❌ [AuditLoggingService] Failed to get audit statistics:', error);
            return null;
        }
    }

    /**
     * Clean up old audit logs
     */
    async cleanupOldLogs(retentionDays = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            const files = await fs.readdir(this.logDirectory);
            let deletedCount = 0;

            for (const file of files) {
                if (file.startsWith('audit_') && file.endsWith('.log')) {
                    const fileDate = new Date(file.replace('audit_', '').replace('.log', ''));
                    if (fileDate < cutoffDate) {
                        const filePath = path.join(this.logDirectory, file);
                        await fs.unlink(filePath);
                        deletedCount++;
                    }
                }
            }

            console.log(`🧹 [AuditLoggingService] Cleaned up ${deletedCount} old audit log files`);
            return deletedCount;
        } catch (error) {
            console.error('❌ [AuditLoggingService] Failed to cleanup old logs:', error);
            return 0;
        }
    }
}

module.exports = AuditLoggingService;
