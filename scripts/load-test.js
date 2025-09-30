#!/usr/bin/env node

/**
 * Load Testing Script
 * Comprehensive performance testing with multiple users and scenarios
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class LoadTester {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.results = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errors: [],
            memoryUsage: [],
            startTime: null,
            endTime: null
        };
    }

    async makeRequest(endpoint, method = 'GET', data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const startTime = performance.now();
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
                    const endTime = performance.now();
                    const responseTime = endTime - startTime;
                    
                    this.results.totalRequests++;
                    this.results.responseTimes.push(responseTime);
                    
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        this.results.successfulRequests++;
                    } else {
                        this.results.failedRequests++;
                        this.results.errors.push({
                            statusCode: res.statusCode,
                            endpoint,
                            response: body
                        });
                    }
                    
                    resolve({
                        statusCode: res.statusCode,
                        responseTime,
                        body: JSON.parse(body || '{}')
                    });
                });
            });

            req.on('error', (error) => {
                this.results.failedRequests++;
                this.results.errors.push({
                    error: error.message,
                    endpoint
                });
                reject(error);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    async testTranslationAPI(concurrentUsers = 10, requestsPerUser = 10) {
        console.log(`🚀 [Load Test] Starting translation API test with ${concurrentUsers} concurrent users`);
        console.log(`📊 [Load Test] ${requestsPerUser} requests per user = ${concurrentUsers * requestsPerUser} total requests`);
        
        this.results.startTime = performance.now();
        
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

        const promises = [];
        
        for (let user = 0; user < concurrentUsers; user++) {
            for (let request = 0; request < requestsPerUser; request++) {
                const text = testTexts[Math.floor(Math.random() * testTexts.length)];
                const sourceLang = Math.random() > 0.5 ? 'ar' : 'en';
                const targetLang = sourceLang === 'ar' ? 'en' : 'ar';
                
                promises.push(
                    this.makeRequest('/api/text-translation/translate', 'POST', {
                        sourceText: text,
                        sourceLanguage: sourceLang,
                        targetLanguage: targetLang
                    }).catch(error => {
                        console.error(`❌ [Load Test] Request failed: ${error.message}`);
                        return { error: error.message };
                    })
                );
            }
        }

        await Promise.all(promises);
        this.results.endTime = performance.now();
        
        this.printResults();
    }

    async testHealthCheck(requests = 100) {
        console.log(`🏥 [Load Test] Testing health check endpoint with ${requests} requests`);
        
        this.results.startTime = performance.now();
        
        const promises = [];
        for (let i = 0; i < requests; i++) {
            promises.push(
                this.makeRequest('/api/text-translation/health')
                    .catch(error => ({ error: error.message }))
            );
        }

        await Promise.all(promises);
        this.results.endTime = performance.now();
        
        this.printResults();
    }

    async testMemoryUsage() {
        console.log(`🧠 [Load Test] Testing memory usage under load`);
        
        const initialMemory = process.memoryUsage();
        console.log(`📊 [Memory] Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
        
        // Perform 1000 translations
        const promises = [];
        for (let i = 0; i < 1000; i++) {
            promises.push(
                this.makeRequest('/api/text-translation/translate', 'POST', {
                    sourceText: `Test text ${i}`,
                    sourceLanguage: 'en',
                    targetLanguage: 'ar'
                }).catch(() => ({}))
            );
        }

        await Promise.all(promises);
        
        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        console.log(`📊 [Memory] Final: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
        console.log(`📈 [Memory] Increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        
        if (memoryIncrease > 100 * 1024 * 1024) {
            console.log(`⚠️ [Memory] WARNING: Memory increase exceeds 100MB`);
        }
    }

    async testErrorHandling() {
        console.log(`❌ [Load Test] Testing error handling under load`);
        
        const errorPromises = [];
        
        // Mix of valid and invalid requests
        for (let i = 0; i < 100; i++) {
            if (i % 5 === 0) {
                // Invalid request
                errorPromises.push(
                    this.makeRequest('/api/text-translation/translate', 'POST', {
                        sourceText: '',
                        sourceLanguage: 'invalid',
                        targetLanguage: 'invalid'
                    }).catch(() => ({}))
                );
            } else {
                // Valid request
                errorPromises.push(
                    this.makeRequest('/api/text-translation/translate', 'POST', {
                        sourceText: `Test text ${i}`,
                        sourceLanguage: 'en',
                        targetLanguage: 'ar'
                    }).catch(() => ({}))
                );
            }
        }

        await Promise.all(errorPromises);
        console.log(`✅ [Load Test] Error handling test completed`);
    }

    printResults() {
        const totalTime = this.results.endTime - this.results.startTime;
        const avgResponseTime = this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length;
        const maxResponseTime = Math.max(...this.results.responseTimes);
        const minResponseTime = Math.min(...this.results.responseTimes);
        const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;
        const requestsPerSecond = this.results.totalRequests / (totalTime / 1000);

        console.log('\n📊 [Load Test] RESULTS:');
        console.log('='.repeat(50));
        console.log(`⏱️  Total Time: ${Math.round(totalTime)}ms`);
        console.log(`📈 Requests/sec: ${Math.round(requestsPerSecond)}`);
        console.log(`✅ Success Rate: ${Math.round(successRate)}%`);
        console.log(`📊 Total Requests: ${this.results.totalRequests}`);
        console.log(`✅ Successful: ${this.results.successfulRequests}`);
        console.log(`❌ Failed: ${this.results.failedRequests}`);
        console.log(`⏱️  Avg Response Time: ${Math.round(avgResponseTime)}ms`);
        console.log(`⚡ Min Response Time: ${Math.round(minResponseTime)}ms`);
        console.log(`🐌 Max Response Time: ${Math.round(maxResponseTime)}ms`);
        
        if (this.results.errors.length > 0) {
            console.log(`\n❌ [Errors] ${this.results.errors.length} errors occurred:`);
            this.results.errors.slice(0, 5).forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.error || error.statusCode}: ${error.endpoint}`);
            });
        }
        
        console.log('='.repeat(50));
    }

    async runComprehensiveTest() {
        console.log('🚀 [Load Test] Starting comprehensive load testing...\n');
        
        // Reset results
        this.results = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errors: [],
            memoryUsage: [],
            startTime: null,
            endTime: null
        };

        // Test 1: Health Check
        await this.testHealthCheck(50);
        
        // Test 2: Translation API with different loads
        await this.testTranslationAPI(5, 10);   // 50 requests
        await this.testTranslationAPI(10, 20);  // 200 requests
        await this.testTranslationAPI(20, 25);  // 500 requests
        
        // Test 3: Memory Usage
        await this.testMemoryUsage();
        
        // Test 4: Error Handling
        await this.testErrorHandling();
        
        console.log('\n🎉 [Load Test] Comprehensive testing completed!');
    }
}

// Run the load test
if (require.main === module) {
    const loadTester = new LoadTester();
    
    const args = process.argv.slice(2);
    const testType = args[0] || 'comprehensive';
    
    switch (testType) {
        case 'health':
            loadTester.testHealthCheck(100);
            break;
        case 'translation':
            const users = parseInt(args[1]) || 10;
            const requests = parseInt(args[2]) || 10;
            loadTester.testTranslationAPI(users, requests);
            break;
        case 'memory':
            loadTester.testMemoryUsage();
            break;
        case 'errors':
            loadTester.testErrorHandling();
            break;
        case 'comprehensive':
        default:
            loadTester.runComprehensiveTest();
            break;
    }
}

module.exports = LoadTester;
