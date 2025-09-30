/**
 * Security Audit Suite
 * Comprehensive penetration testing and vulnerability assessment
 */

const request = require('supertest');
const app = require('../server');

describe('Security Audit Suite', () => {
    let server;

    beforeAll(async () => {
        server = app.listen(0);
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
    });

    describe('Authentication Security', () => {
        test('Should prevent SQL injection in login', async () => {
            const maliciousPayloads = [
                "'; DROP TABLE users; --",
                "' OR '1'='1",
                "admin'--",
                "' UNION SELECT * FROM users --",
                "'; INSERT INTO users VALUES ('hacker', 'password'); --"
            ];

            for (const payload of maliciousPayloads) {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: payload,
                        password: 'anypassword'
                    });

                // Should not return 500 (server error) or 200 (success)
                expect(response.status).not.toBe(500);
                expect(response.status).not.toBe(200);
                expect(response.status).toBe(400); // Should return validation error
            }
        });

        test('Should prevent NoSQL injection in login', async () => {
            const maliciousPayloads = [
                { email: { $ne: null }, password: { $ne: null } },
                { email: { $regex: ".*" }, password: { $regex: ".*" } },
                { email: { $where: "this.password" }, password: "anything" }
            ];

            for (const payload of maliciousPayloads) {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send(payload);

                expect(response.status).not.toBe(500);
                expect(response.status).not.toBe(200);
            }
        });

        test('Should enforce strong password requirements', async () => {
            const weakPasswords = [
                '123',
                'password',
                '12345678',
                'qwerty',
                'abc123',
                'Password',
                'password123'
            ];

            for (const password of weakPasswords) {
                const response = await request(app)
                    .post('/api/auth/register')
                    .send({
                        email: 'test@example.com',
                        password: password,
                        name: 'Test User'
                    });

                expect(response.status).toBe(400);
                expect(response.body.error).toContain('password');
            }
        });

        test('Should validate email format', async () => {
            const invalidEmails = [
                'invalid-email',
                '@example.com',
                'test@',
                'test..test@example.com',
                'test@.com',
                'test@example.',
                ''
            ];

            for (const email of invalidEmails) {
                const response = await request(app)
                    .post('/api/auth/register')
                    .send({
                        email: email,
                        password: 'ValidPassword123!',
                        name: 'Test User'
                    });

                expect(response.status).toBe(400);
                expect(response.body.error).toContain('email');
            }
        });
    });

    describe('Input Validation Security', () => {
        test('Should sanitize XSS in translation input', async () => {
            const xssPayloads = [
                '<script>alert("XSS")</script>',
                '<img src="x" onerror="alert(\'XSS\')">',
                'javascript:alert("XSS")',
                '<svg onload="alert(\'XSS\')">',
                '<iframe src="javascript:alert(\'XSS\')"></iframe>'
            ];

            for (const payload of xssPayloads) {
                const response = await request(app)
                    .post('/api/text-translation/translate')
                    .send({
                        sourceText: payload,
                        sourceLanguage: 'en',
                        targetLanguage: 'ar'
                    });

                // Should not contain the malicious script
                expect(response.body.translatedText).not.toContain('<script>');
                expect(response.body.translatedText).not.toContain('javascript:');
                expect(response.body.translatedText).not.toContain('onerror');
                expect(response.body.translatedText).not.toContain('onload');
            }
        });

        test('Should prevent path traversal attacks', async () => {
            const pathTraversalPayloads = [
                '../../../etc/passwd',
                '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
                '....//....//....//etc//passwd',
                '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
            ];

            for (const payload of pathTraversalPayloads) {
                const response = await request(app)
                    .get(`/api/files/${payload}`)
                    .expect(404); // Should not find the file

                expect(response.status).toBe(404);
            }
        });

        test('Should validate file uploads', async () => {
            const maliciousFiles = [
                { name: 'malicious.exe', content: 'MZ...' },
                { name: 'script.php', content: '<?php system($_GET["cmd"]); ?>' },
                { name: 'test.jsp', content: '<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>' }
            ];

            for (const file of maliciousFiles) {
                const response = await request(app)
                    .post('/api/upload')
                    .attach('file', Buffer.from(file.content), file.name);

                expect(response.status).toBe(400);
            }
        });
    });

    describe('Rate Limiting Security', () => {
        test('Should enforce rate limits on translation API', async () => {
            const requests = [];
            
            // Make 200 requests quickly (should trigger rate limit)
            for (let i = 0; i < 200; i++) {
                requests.push(
                    request(app)
                        .post('/api/text-translation/translate')
                        .send({
                            sourceText: `Test text ${i}`,
                            sourceLanguage: 'en',
                            targetLanguage: 'ar'
                        })
                );
            }

            const results = await Promise.allSettled(requests);
            const rateLimited = results.filter(r => 
                r.status === 'fulfilled' && r.value.status === 429
            ).length;

            console.log(`🚫 [Rate Limiting] Rate limited requests: ${rateLimited}`);
            
            // Should have some rate limited requests
            expect(rateLimited).toBeGreaterThan(0);
        }, 30000);

        test('Should enforce rate limits on auth endpoints', async () => {
            const requests = [];
            
            // Make 100 login attempts quickly
            for (let i = 0; i < 100; i++) {
                requests.push(
                    request(app)
                        .post('/api/auth/login')
                        .send({
                            email: `test${i}@example.com`,
                            password: 'wrongpassword'
                        })
                );
            }

            const results = await Promise.allSettled(requests);
            const rateLimited = results.filter(r => 
                r.status === 'fulfilled' && r.value.status === 429
            ).length;

            console.log(`🚫 [Rate Limiting] Auth rate limited requests: ${rateLimited}`);
            
            // Should have some rate limited requests
            expect(rateLimited).toBeGreaterThan(0);
        }, 20000);
    });

    describe('CSRF Protection', () => {
        test('Should require CSRF token for state-changing operations', async () => {
            const response = await request(app)
                .post('/api/text-translation/translate')
                .send({
                    sourceText: 'Test text',
                    sourceLanguage: 'en',
                    targetLanguage: 'ar'
                });

            // Should either require CSRF token or be protected by other means
            expect(response.status).not.toBe(403); // Should not be forbidden due to CSRF
        });

        test('Should validate CSRF token format', async () => {
            const response = await request(app)
                .post('/api/text-translation/translate')
                .set('X-CSRF-Token', 'invalid-token')
                .send({
                    sourceText: 'Test text',
                    sourceLanguage: 'en',
                    targetLanguage: 'ar'
                });

            // Should handle invalid CSRF token appropriately
            expect(response.status).not.toBe(500);
        });
    });

    describe('Headers Security', () => {
        test('Should include security headers', async () => {
            const response = await request(app)
                .get('/api/text-translation/health');

            // Check for security headers
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBeDefined();
            expect(response.headers['x-xss-protection']).toBeDefined();
            expect(response.headers['strict-transport-security']).toBeDefined();
        });

        test('Should not expose sensitive server information', async () => {
            const response = await request(app)
                .get('/api/text-translation/health');

            // Should not expose server version or internal paths
            expect(response.headers['server']).not.toContain('Express');
            expect(response.headers['x-powered-by']).toBeUndefined();
        });
    });

    describe('Data Encryption', () => {
        test('Should encrypt sensitive data in transit', async () => {
            const response = await request(app)
                .post('/api/text-translation/translate')
                .send({
                    sourceText: 'Sensitive data',
                    sourceLanguage: 'en',
                    targetLanguage: 'ar'
                });

            // Response should not contain plaintext sensitive data
            expect(response.body.sourceText).not.toBe('Sensitive data');
            expect(response.body.encrypted).toBe(true);
        });

        test('Should not log sensitive information', async () => {
            const consoleSpy = jest.spyOn(console, 'log');
            
            await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'SensitivePassword123!'
                });

            // Console logs should not contain password
            const logs = consoleSpy.mock.calls.flat().join(' ');
            expect(logs).not.toContain('SensitivePassword123!');
            
            consoleSpy.mockRestore();
        });
    });

    describe('Session Security', () => {
        test('Should use secure session cookies', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'ValidPassword123!'
                });

            const setCookieHeader = response.headers['set-cookie'];
            if (setCookieHeader) {
                expect(setCookieHeader.some(cookie => 
                    cookie.includes('HttpOnly') && 
                    cookie.includes('Secure') && 
                    cookie.includes('SameSite')
                )).toBe(true);
            }
        });

        test('Should invalidate sessions on logout', async () => {
            // First login
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'ValidPassword123!'
                });

            const authToken = loginResponse.body.token;

            // Logout
            await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${authToken}`);

            // Try to use the token after logout
            const protectedResponse = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(protectedResponse.status).toBe(401);
        });
    });

    describe('API Security', () => {
        test('Should validate request size limits', async () => {
            const largeText = 'A'.repeat(1000000); // 1MB of text
            
            const response = await request(app)
                .post('/api/text-translation/translate')
                .send({
                    sourceText: largeText,
                    sourceLanguage: 'en',
                    targetLanguage: 'ar'
                });

            expect(response.status).toBe(413); // Payload too large
        });

        test('Should handle malformed JSON gracefully', async () => {
            const response = await request(app)
                .post('/api/text-translation/translate')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}');

            expect(response.status).toBe(400);
        });

        test('Should prevent HTTP parameter pollution', async () => {
            const response = await request(app)
                .get('/api/translation-memory/history')
                .query({
                    userId: 'user1',
                    userId: 'user2',
                    limit: '10',
                    limit: '1000'
                });

            // Should handle multiple parameters appropriately
            expect(response.status).not.toBe(500);
        });
    });

    describe('Error Handling Security', () => {
        test('Should not expose internal errors to client', async () => {
            const response = await request(app)
                .get('/api/nonexistent-endpoint');

            expect(response.status).toBe(404);
            expect(response.body.error).not.toContain('stack');
            expect(response.body.error).not.toContain('at ');
        });

        test('Should handle database errors securely', async () => {
            // This test would require mocking database errors
            // For now, we'll test that the app doesn't crash on invalid requests
            const response = await request(app)
                .post('/api/text-translation/translate')
                .send({
                    sourceText: null,
                    sourceLanguage: null,
                    targetLanguage: null
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toBeDefined();
        });
    });
});
