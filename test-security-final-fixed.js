// Final Fixed Comprehensive Production-Grade Security Test Suite
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:3000';
const testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(testName, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName}`);
    if (details) console.log(`   Details: ${details}`);

    testResults.tests.push({ name: testName, passed, details });
    if (passed) testResults.passed++;
    else testResults.failed++;
}

async function makeRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const text = await response.text();
        let data = {};
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { rawResponse: text };
        }

        return { response, data, text };
    } catch (error) {
        return { error: error.message };
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPasswordSecurity() {
    console.log('\n🔐 Testing Password Security...');

    // Test weak passwords
    const weakPasswords = [
        '123456',
        'password',
        'Password123',
        'Password@',
        'password123@',
        'PASSWORD123@',
        'Pass123',
        'Password123'
    ];

    for (const password of weakPasswords) {
        const result = await makeRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: `weak${Date.now()}@example.com`,
                username: `weak${Date.now()}`,
                password: password
            })
        });

        const rejected = result.response && result.response.status === 400;
        logTest(`Weak password rejected: "${password}"`, rejected,
            rejected ? 'Password correctly rejected' : 'Password incorrectly accepted');

        await sleep(200); // Wait to avoid rate limiting
    }

    // Test strong passwords
    const strongPasswords = [
        'Password123@',
        'MySecure@Pass2024',
        'Test123!@#',
        'StrongP@ssw0rd'
    ];

    for (const password of strongPasswords) {
        const result = await makeRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: `strong${Date.now()}@example.com`,
                username: `strong${Date.now()}`,
                password: password
            })
        });

        const accepted = result.response && (result.response.status === 201 ||
            (result.response.status === 400 && result.data && result.data.requiresVerification));
        logTest(`Strong password accepted: "${password}"`, accepted,
            accepted ? 'Password correctly accepted' : 'Password incorrectly rejected');

        await sleep(200); // Wait to avoid rate limiting
    }
}

async function testCSRFProtection() {
    console.log('\n🍪 Testing CSRF Protection...');

    // Test forgot password without CSRF token
    const result1 = await makeRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
            email: 'test@example.com'
        })
    });

    const csrfRequired = result1.response && result1.response.status === 403;
    logTest('CSRF protection on forgot password', csrfRequired,
        csrfRequired ? 'CSRF protection working' : 'CSRF protection not working');
}

async function testInformationDisclosure() {
    console.log('\n🔍 Testing Information Disclosure...');

    // Test login with non-existent user
    const result1 = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
        })
    });

    const genericError = result1.response && result1.response.status === 400 &&
                        result1.data && result1.data.msg === 'Invalid Credentials';
    logTest('Generic error message for non-existent user', genericError,
        genericError ? 'User existence not revealed' : 'User existence might be revealed');
}

async function testAccountLockout() {
    console.log('\n🔒 Testing Account Lockout...');

    // Create a test user first
    const testEmail = `lockout${Date.now()}@example.com`;
    const testPassword = 'TestPassword123@';

    const registerResult = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            email: testEmail,
            username: `lockout${Date.now()}`,
            password: testPassword
        })
    });

    if (!registerResult.response || registerResult.response.status !== 201) {
        logTest('Test user creation for lockout test', false, 'Failed to create test user');
        return;
    }

    await sleep(500); // Wait before testing lockout

    // Try to login with wrong password multiple times
    let lockoutTriggered = false;
    for (let i = 0; i < 6; i++) {
        const loginResult = await makeRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: testEmail,
                password: 'wrongpassword'
            })
        });

        if (loginResult.response && loginResult.response.status === 423) {
            lockoutTriggered = true;
            break;
        }

        await sleep(200); // Wait between attempts
    }

    logTest('Account lockout after multiple failed attempts', lockoutTriggered,
        lockoutTriggered ? 'Account lockout working' : 'Account lockout not working');
}

async function testTokenSecurity() {
    console.log('\n🔑 Testing Token Security...');

    // Test invalid token
    const result1 = await makeRequest('/api/user/profile', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer invalid-token'
        }
    });

    const invalidRejected = result1.response && result1.response.status === 401;
    logTest('Invalid token rejected', invalidRejected,
        invalidRejected ? 'Invalid token correctly rejected' : 'Invalid token not rejected');

    // Test malformed token
    const result2 = await makeRequest('/api/user/profile', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer malformed.token.here'
        }
    });

    const malformedRejected = result2.response && result2.response.status === 401;
    logTest('Malformed token rejected', malformedRejected,
        malformedRejected ? 'Malformed token correctly rejected' : 'Malformed token not rejected');
}

async function testInputValidation() {
    console.log('\n📝 Testing Input Validation...');

    // Test SQL injection
    const sqlInjectionPayload = "'; DROP TABLE users; --";
    const result1 = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: sqlInjectionPayload,
            password: 'test'
        })
    });

    const sqlBlocked = result1.response && result1.response.status === 400;
    logTest('SQL injection blocked', sqlBlocked,
        sqlBlocked ? 'SQL injection blocked' : 'SQL injection not blocked');

    // Test XSS
    const xssPayload = "<script>alert('xss')</script>";
    const result2 = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            email: `${xssPayload}@example.com`,
            username: xssPayload,
            password: 'TestPassword123@'
        })
    });

    const xssBlocked = result2.response && result2.response.status === 400;
    logTest('XSS attempt blocked', xssBlocked,
        xssBlocked ? 'XSS attempt blocked' : 'XSS attempt not blocked');
}

async function testRateLimiting() {
    console.log('\n🛡️ Testing Rate Limiting...');

    // Test login rate limiting
    let rateLimitHit = false;

    for (let i = 0; i < 7; i++) {
        const result = await makeRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: 'nonexistent@example.com',
                password: 'wrongpassword'
            })
        });

        if (result.response && result.response.status === 429) {
            rateLimitHit = true;
            break;
        }

        await sleep(100); // Wait between attempts
    }

    logTest('Login rate limiting triggered', rateLimitHit,
        rateLimitHit ? 'Rate limiting working correctly' : 'Rate limiting not working');
}

async function testSecurityHeaders() {
    console.log('\n🛡️ Testing Security Headers...');

    const result = await makeRequest('/');

    const securityHeaders = {
        'X-Content-Type-Options': result.response ? result.response.headers.get('X-Content-Type-Options') : null,
        'X-Frame-Options': result.response ? result.response.headers.get('X-Frame-Options') : null,
        'X-XSS-Protection': result.response ? result.response.headers.get('X-XSS-Protection') : null,
        'Strict-Transport-Security': result.response ? result.response.headers.get('Strict-Transport-Security') : null,
        'Content-Security-Policy': result.response ? result.response.headers.get('Content-Security-Policy') : null,
        'Referrer-Policy': result.response ? result.response.headers.get('Referrer-Policy') : null,
        'Permissions-Policy': result.response ? result.response.headers.get('Permissions-Policy') : null
    };

    const hasSecurityHeaders = Object.values(securityHeaders).some(header => header !== null);
    logTest('Security headers present', hasSecurityHeaders,
        hasSecurityHeaders ? 'Security headers configured' : 'Security headers missing');

    if (hasSecurityHeaders) {
        console.log('   Security Headers:', securityHeaders);
    }
}

async function runAllTests() {
    console.log('🚀 Starting Final Fixed Comprehensive Production Security Test Suite...\n');

    await testPasswordSecurity();
    await testRateLimiting();
    await testSecurityHeaders();
    await testCSRFProtection();
    await testInformationDisclosure();
    await testAccountLockout();
    await testTokenSecurity();
    await testInputValidation();

    console.log('\n📊 COMPREHENSIVE TEST SUMMARY:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

    if (testResults.failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.tests.filter(t => !t.passed).forEach(test => {
            console.log(`   - ${test.name}: ${test.details}`);
        });
    }

    const successRate = (testResults.passed / (testResults.passed + testResults.failed)) * 100;
    let grade = 'F';
    if (successRate >= 90) grade = 'A+';
    else if (successRate >= 80) grade = 'A';
    else if (successRate >= 70) grade = 'B';
    else if (successRate >= 60) grade = 'C';
    else if (successRate >= 50) grade = 'D';

    console.log(`\n🏆 PRODUCTION SECURITY GRADE: ${grade} (${successRate.toFixed(1)}%)`);

    if (successRate >= 80) {
        console.log('🎉 EXCELLENT! Your authentication system is production-ready!');
    } else if (successRate >= 60) {
        console.log('⚠️ GOOD! Your authentication system has minor security issues.');
    } else {
        console.log('🚨 POOR! Your authentication system has significant security issues.');
    }

    console.log('\n🎯 Final Fixed Production Security Test Complete!');
}

runAllTests().catch(console.error);
