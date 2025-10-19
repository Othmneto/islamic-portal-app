#!/usr/bin/env node

/**
 * Security Audit Script
 * Comprehensive penetration testing and vulnerability assessment
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class SecurityAuditor {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.vulnerabilities = [];
        this.securityScore = 100;
        this.results = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            vulnerabilities: [],
            recommendations: []
        };
    }

    async makeRequest(endpoint, method = 'GET', data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(endpoint, this.baseUrl);

            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };

            const client = url.protocol === 'https:' ? https : http;
            const req = client.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    addVulnerability(severity, category, description, recommendation) {
        this.vulnerabilities.push({
            severity,
            category,
            description,
            recommendation,
            timestamp: new Date().toISOString()
        });

        this.results.vulnerabilities.push({
            severity,
            category,
            description,
            recommendation
        });

        // Reduce security score based on severity
        switch (severity) {
            case 'CRITICAL':
                this.securityScore -= 20;
                break;
            case 'HIGH':
                this.securityScore -= 15;
                break;
            case 'MEDIUM':
                this.securityScore -= 10;
                break;
            case 'LOW':
                this.securityScore -= 5;
                break;
        }
    }

    async testSQLInjection() {
        console.log('🔍 [Security] Testing SQL injection vulnerabilities...');

        const sqlPayloads = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "admin'--",
            "' UNION SELECT * FROM users --",
            "'; INSERT INTO users VALUES ('hacker', 'password'); --",
            "' OR 1=1 --",
            "admin' OR '1'='1' --"
        ];

        for (const payload of sqlPayloads) {
            try {
                const response = await this.makeRequest('/api/auth/login', 'POST', {
                    email: payload,
                    password: 'anypassword'
                });

                this.results.totalTests++;

                if (response.statusCode === 500) {
                    this.addVulnerability(
                        'CRITICAL',
                        'SQL Injection',
                        `SQL injection detected with payload: ${payload}`,
                        'Implement parameterized queries and input validation'
                    );
                    this.results.failedTests++;
                } else {
                    this.results.passedTests++;
                }
            } catch (error) {
                this.results.totalTests++;
                this.results.passedTests++;
            }
        }
    }

    async testXSSVulnerabilities() {
        console.log('🔍 [Security] Testing XSS vulnerabilities...');

        const xssPayloads = [
            '<script>alert("XSS")</script>',
            '<img src="x" onerror="alert(\'XSS\')">',
            'javascript:alert("XSS")',
            '<svg onload="alert(\'XSS\')">',
            '<iframe src="javascript:alert(\'XSS\')"></iframe>',
            '<body onload="alert(\'XSS\')">',
            '<input onfocus="alert(\'XSS\')" autofocus>'
        ];

        for (const payload of xssPayloads) {
            try {
                const response = await this.makeRequest('/api/text-translation/translate', 'POST', {
                    sourceText: payload,
                    sourceLanguage: 'en',
                    targetLanguage: 'ar'
                });

                this.results.totalTests++;

                if (response.body.includes('<script>') ||
                    response.body.includes('javascript:') ||
                    response.body.includes('onerror') ||
                    response.body.includes('onload')) {
                    this.addVulnerability(
                        'HIGH',
                        'XSS',
                        `XSS vulnerability detected with payload: ${payload}`,
                        'Implement proper input sanitization and output encoding'
                    );
                    this.results.failedTests++;
                } else {
                    this.results.passedTests++;
                }
            } catch (error) {
                this.results.totalTests++;
                this.results.passedTests++;
            }
        }
    }

    async testAuthenticationSecurity() {
        console.log('🔍 [Security] Testing authentication security...');

        // Test weak password acceptance
        const weakPasswords = [
            '123',
            'password',
            '12345678',
            'qwerty',
            'abc123'
        ];

        for (const password of weakPasswords) {
            try {
                const response = await this.makeRequest('/api/auth/register', 'POST', {
                    email: 'test@example.com',
                    password: password,
                    name: 'Test User'
                });

                this.results.totalTests++;

                if (response.statusCode === 200) {
                    this.addVulnerability(
                        'HIGH',
                        'Authentication',
                        `Weak password accepted: ${password}`,
                        'Implement strong password requirements'
                    );
                    this.results.failedTests++;
                } else {
                    this.results.passedTests++;
                }
            } catch (error) {
                this.results.totalTests++;
                this.results.passedTests++;
            }
        }

        // Test email validation
        const invalidEmails = [
            'invalid-email',
            '@example.com',
            'test@',
            'test..test@example.com'
        ];

        for (const email of invalidEmails) {
            try {
                const response = await this.makeRequest('/api/auth/register', 'POST', {
                    email: email,
                    password: 'ValidPassword123!',
                    name: 'Test User'
                });

                this.results.totalTests++;

                if (response.statusCode === 200) {
                    this.addVulnerability(
                        'MEDIUM',
                        'Input Validation',
                        `Invalid email accepted: ${email}`,
                        'Implement proper email validation'
                    );
                    this.results.failedTests++;
                } else {
                    this.results.passedTests++;
                }
            } catch (error) {
                this.results.totalTests++;
                this.results.passedTests++;
            }
        }
    }

    async testRateLimiting() {
        console.log('🔍 [Security] Testing rate limiting...');

        const requests = [];
        for (let i = 0; i < 200; i++) {
            requests.push(
                this.makeRequest('/api/text-translation/translate', 'POST', {
                    sourceText: `Test text ${i}`,
                    sourceLanguage: 'en',
                    targetLanguage: 'ar'
                }).catch(() => ({ statusCode: 500 }))
            );
        }

        const responses = await Promise.all(requests);
        const rateLimited = responses.filter(r => r.statusCode === 429).length;

        this.results.totalTests++;

        if (rateLimited === 0) {
            this.addVulnerability(
                'HIGH',
                'Rate Limiting',
                'No rate limiting detected on translation API',
                'Implement rate limiting to prevent DoS attacks'
            );
            this.results.failedTests++;
        } else {
            console.log(`✅ [Security] Rate limiting working: ${rateLimited} requests rate limited`);
            this.results.passedTests++;
        }
    }

    async testSecurityHeaders() {
        console.log('🔍 [Security] Testing security headers...');

        try {
            const response = await this.makeRequest('/api/text-translation/health');

            this.results.totalTests++;

            const requiredHeaders = [
                'x-content-type-options',
                'x-frame-options',
                'x-xss-protection',
                'strict-transport-security'
            ];

            const missingHeaders = requiredHeaders.filter(header => !response.headers[header]);

            if (missingHeaders.length > 0) {
                this.addVulnerability(
                    'MEDIUM',
                    'Security Headers',
                    `Missing security headers: ${missingHeaders.join(', ')}`,
                    'Implement all recommended security headers'
                );
                this.results.failedTests++;
            } else {
                this.results.passedTests++;
            }
        } catch (error) {
            this.results.totalTests++;
            this.results.failedTests++;
        }
    }

    async testPathTraversal() {
        console.log('🔍 [Security] Testing path traversal vulnerabilities...');

        const pathTraversalPayloads = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
            '....//....//....//etc//passwd',
            '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
        ];

        for (const payload of pathTraversalPayloads) {
            try {
                const response = await this.makeRequest(`/api/files/${payload}`);

                this.results.totalTests++;

                if (response.statusCode === 200 && response.body.includes('root:')) {
                    this.addVulnerability(
                        'CRITICAL',
                        'Path Traversal',
                        `Path traversal vulnerability detected with payload: ${payload}`,
                        'Implement proper path validation and sanitization'
                    );
                    this.results.failedTests++;
                } else {
                    this.results.passedTests++;
                }
            } catch (error) {
                this.results.totalTests++;
                this.results.passedTests++;
            }
        }
    }

    async testCSRFProtection() {
        console.log('🔍 [Security] Testing CSRF protection...');

        try {
            const response = await this.makeRequest('/api/text-translation/translate', 'POST', {
                sourceText: 'Test text',
                sourceLanguage: 'en',
                targetLanguage: 'ar'
            }, {
                'X-CSRF-Token': 'invalid-token'
            });

            this.results.totalTests++;

            if (response.statusCode === 200) {
                this.addVulnerability(
                    'HIGH',
                    'CSRF',
                    'CSRF protection not working properly',
                    'Implement proper CSRF token validation'
                );
                this.results.failedTests++;
            } else {
                this.results.passedTests++;
            }
        } catch (error) {
            this.results.totalTests++;
            this.results.passedTests++;
        }
    }

    async testDataExposure() {
        console.log('🔍 [Security] Testing data exposure...');

        try {
            const response = await this.makeRequest('/api/text-translation/health');

            this.results.totalTests++;

            // Check for sensitive information in response
            const sensitivePatterns = [
                /password/i,
                /secret/i,
                /key/i,
                /token/i,
                /database/i,
                /connection/i
            ];

            const body = response.body.toLowerCase();
            const exposedData = sensitivePatterns.filter(pattern => pattern.test(body));

            if (exposedData.length > 0) {
                this.addVulnerability(
                    'MEDIUM',
                    'Data Exposure',
                    `Sensitive information exposed in response: ${exposedData.join(', ')}`,
                    'Remove sensitive information from API responses'
                );
                this.results.failedTests++;
            } else {
                this.results.passedTests++;
            }
        } catch (error) {
            this.results.totalTests++;
            this.results.passedTests++;
        }
    }

    async runComprehensiveAudit() {
        console.log('🔒 [Security] Starting comprehensive security audit...\n');

        const startTime = performance.now();

        await this.testSQLInjection();
        await this.testXSSVulnerabilities();
        await this.testAuthenticationSecurity();
        await this.testRateLimiting();
        await this.testSecurityHeaders();
        await this.testPathTraversal();
        await this.testCSRFProtection();
        await this.testDataExposure();

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        this.printResults(totalTime);
    }

    printResults(totalTime) {
        console.log('\n🔒 [Security] AUDIT RESULTS:');
        console.log('='.repeat(60));
        console.log(`⏱️  Total Time: ${Math.round(totalTime)}ms`);
        console.log(`📊 Total Tests: ${this.results.totalTests}`);
        console.log(`✅ Passed: ${this.results.passedTests}`);
        console.log(`❌ Failed: ${this.results.failedTests}`);
        console.log(`🎯 Security Score: ${Math.max(0, this.securityScore)}/100`);

        if (this.vulnerabilities.length > 0) {
            console.log(`\n🚨 [Vulnerabilities] Found ${this.vulnerabilities.length} issues:`);
            console.log('-'.repeat(60));

            this.vulnerabilities.forEach((vuln, index) => {
                console.log(`${index + 1}. [${vuln.severity}] ${vuln.category}`);
                console.log(`   Description: ${vuln.description}`);
                console.log(`   Recommendation: ${vuln.recommendation}`);
                console.log('');
            });
        } else {
            console.log('\n✅ [Security] No vulnerabilities found!');
        }

        console.log('='.repeat(60));
    }
}

// Run the security audit
if (require.main === module) {
    const auditor = new SecurityAuditor();
    auditor.runComprehensiveAudit();
}

module.exports = SecurityAuditor;
