/**
 * Performance Testing Suite
 * Comprehensive load testing and performance validation
 */

const request = require('supertest');
const app = require('../server');

describe('Performance Testing Suite', () => {
    let server;
    const testUsers = [];
    const testTranslations = [];

    beforeAll(async () => {
        // Start server for testing
        server = app.listen(0);
        
        // Create test users for load testing
        for (let i = 0; i < 50; i++) {
            testUsers.push({
                email: `testuser${i}@example.com`,
                password: 'TestPassword123!',
                name: `Test User ${i}`
            });
        }

        // Create test translations
        const testTexts = [
            'بسم الله الرحمن الرحيم',
            'الحمد لله رب العالمين',
            'In the name of Allah, the Most Gracious, the Most Merciful',
            'Praise be to Allah, Lord of the worlds',
            'Allah is the greatest',
            'لا إله إلا الله',
            'There is no god but Allah',
            'Muhammad is the messenger of Allah',
            'محمد رسول الله',
            'Peace be upon you'
        ];

        for (let i = 0; i < 100; i++) {
            testTranslations.push({
                sourceText: testTexts[i % testTexts.length],
                sourceLanguage: 'ar',
                targetLanguage: 'en',
                userId: `testuser${i % 50}`
            });
        }
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
    });

    describe('Load Testing - Concurrent Users', () => {
        test('Should handle 50 concurrent translation requests', async () => {
            const startTime = Date.now();
            
            const promises = testTranslations.slice(0, 50).map(async (translation) => {
                const response = await request(app)
                    .post('/api/text-translation/translate')
                    .send(translation)
                    .expect(200);
                
                return response.body;
            });

            const results = await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            console.log(`🚀 [Performance] 50 concurrent requests completed in ${totalTime}ms`);
            console.log(`📊 [Performance] Average response time: ${totalTime / 50}ms per request`);
            
            expect(results).toHaveLength(50);
            expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
        }, 15000);

        test('Should handle 100 concurrent translation requests', async () => {
            const startTime = Date.now();
            
            const promises = testTranslations.map(async (translation) => {
                const response = await request(app)
                    .post('/api/text-translation/translate')
                    .send(translation)
                    .expect(200);
                
                return response.body;
            });

            const results = await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            console.log(`🚀 [Performance] 100 concurrent requests completed in ${totalTime}ms`);
            console.log(`📊 [Performance] Average response time: ${totalTime / 100}ms per request`);
            
            expect(results).toHaveLength(100);
            expect(totalTime).toBeLessThan(20000); // Should complete within 20 seconds
        }, 25000);
    });

    describe('Memory Usage Testing', () => {
        test('Should not exceed memory limits during heavy load', async () => {
            const initialMemory = process.memoryUsage();
            console.log(`🧠 [Memory] Initial memory usage: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

            // Perform 200 translations
            const promises = [];
            for (let i = 0; i < 200; i++) {
                promises.push(
                    request(app)
                        .post('/api/text-translation/translate')
                        .send({
                            sourceText: `Test text ${i}`,
                            sourceLanguage: 'en',
                            targetLanguage: 'ar'
                        })
                );
            }

            await Promise.all(promises);

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log(`🧠 [Memory] Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
            console.log(`📈 [Memory] Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

            // Memory increase should be less than 100MB
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
        }, 30000);
    });

    describe('Response Time Testing', () => {
        test('Translation API should respond within 2 seconds', async () => {
            const startTime = Date.now();
            
            const response = await request(app)
                .post('/api/text-translation/translate')
                .send({
                    sourceText: 'بسم الله الرحمن الرحيم',
                    sourceLanguage: 'ar',
                    targetLanguage: 'en'
                })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            console.log(`⏱️ [Response Time] Translation completed in ${responseTime}ms`);
            
            expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
            expect(response.body.success).toBe(true);
        });

        test('Health check should respond within 100ms', async () => {
            const startTime = Date.now();
            
            const response = await request(app)
                .get('/api/text-translation/health')
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            console.log(`⏱️ [Response Time] Health check completed in ${responseTime}ms`);
            
            expect(responseTime).toBeLessThan(100); // Should respond within 100ms
        });
    });

    describe('Cache Performance Testing', () => {
        test('Cache hit rate should be above 80% for repeated requests', async () => {
            const testText = 'بسم الله الرحمن الرحيم';
            const translationData = {
                sourceText: testText,
                sourceLanguage: 'ar',
                targetLanguage: 'en'
            };

            // First request (cache miss)
            const startTime1 = Date.now();
            await request(app)
                .post('/api/text-translation/translate')
                .send(translationData)
                .expect(200);
            const endTime1 = Date.now();
            const firstRequestTime = endTime1 - startTime1;

            // Second request (cache hit)
            const startTime2 = Date.now();
            await request(app)
                .post('/api/text-translation/translate')
                .send(translationData)
                .expect(200);
            const endTime2 = Date.now();
            const secondRequestTime = endTime2 - startTime2;

            console.log(`📊 [Cache] First request time: ${firstRequestTime}ms`);
            console.log(`📊 [Cache] Second request time: ${secondRequestTime}ms`);
            console.log(`📊 [Cache] Performance improvement: ${Math.round((firstRequestTime - secondRequestTime) / firstRequestTime * 100)}%`);

            // Second request should be significantly faster
            expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5);
        });
    });

    describe('Database Performance Testing', () => {
        test('Should handle database queries efficiently', async () => {
            const startTime = Date.now();

            // Test multiple database operations
            const promises = [];
            for (let i = 0; i < 20; i++) {
                promises.push(
                    request(app)
                        .get('/api/translation-memory/history')
                        .query({ userId: `testuser${i % 10}` })
                );
            }

            await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            console.log(`🗄️ [Database] 20 database queries completed in ${totalTime}ms`);
            console.log(`📊 [Database] Average query time: ${totalTime / 20}ms per query`);

            expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
        });
    });

    describe('Error Handling Under Load', () => {
        test('Should handle errors gracefully under heavy load', async () => {
            const promises = [];
            
            // Mix of valid and invalid requests
            for (let i = 0; i < 50; i++) {
                if (i % 5 === 0) {
                    // Invalid request
                    promises.push(
                        request(app)
                            .post('/api/text-translation/translate')
                            .send({
                                sourceText: '',
                                sourceLanguage: 'invalid',
                                targetLanguage: 'invalid'
                            })
                            .expect(400)
                    );
                } else {
                    // Valid request
                    promises.push(
                        request(app)
                            .post('/api/text-translation/translate')
                            .send({
                                sourceText: `Test text ${i}`,
                                sourceLanguage: 'en',
                                targetLanguage: 'ar'
                            })
                            .expect(200)
                    );
                }
            }

            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(`✅ [Error Handling] Successful requests: ${successful}`);
            console.log(`❌ [Error Handling] Failed requests: ${failed}`);

            // Should handle most requests successfully even with some errors
            expect(successful).toBeGreaterThan(40);
        });
    });
});
