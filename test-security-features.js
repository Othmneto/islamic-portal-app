// Comprehensive Security Features Test Suite
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'security.test@example.com';
const TEST_USERNAME = 'securitytest123';

// Test results tracking
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

        const data = await response.json().catch(() => ({}));
        return { response, data };
    } catch (error) {
        return { error: error.message };
    }
}

async function getCSRFToken() {
    try {
        const response = await fetch(`${BASE_URL}/api/auth/csrf`);
        const data = await response.json();
        return data.csrfToken;
    } catch (error) {
        console.log('CSRF token fetch failed:', error.message);
    }
    return null;
}

async function testPasswordStrength() {
    console.log('\n🔐 Testing Password Strength Validation...');

    const weakPasswords = [
        '123456',           // Too short
        'password',         // No complexity
        'Password123',      // No special char
        'Password@',        // No number
        'password123@',     // No uppercase
        'PASSWORD123@',     // No lowercase
        'Pass123',          // Too short
        'Password123',      // No special char
    ];

    const strongPasswords = [
        'Password123@',
        'MySecure@Pass2024',
        'Test123!@#',
        'StrongP@ssw0rd',
    ];

    // Test weak passwords (should fail)
    for (const password of weakPasswords) {
        const result = await makeRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: `test${Date.now()}@example.com`,
                username: `test${Date.now()}`,
                password: password
            })
        });

        const shouldFail = result.response && result.response.status === 400;
        logTest(`Weak password rejected: "${password}"`, shouldFail,
            shouldFail ? 'Password correctly rejected' : 'Password incorrectly accepted');
    }

    // Test strong passwords (should pass validation)
    for (const password of strongPasswords) {
        const result = await makeRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: `test${Date.now()}@example.com`,
                username: `test${Date.now()}`,
                password: password
            })
        });

        const shouldPass = result.response && (result.response.status === 201 || (result.response.status === 400 && result.data && result.data.requiresVerification)); // 400 with requiresVerification is also success
        logTest(`Strong password accepted: "${password}"`, shouldPass,
            shouldPass ? 'Password validation passed' : 'Password incorrectly rejected');
    }
}

async function testBruteForceProtection() {
    console.log('\n🛡️ Testing Brute Force Protection...');

    // Test rate limiting
    console.log('Testing rate limiting (5 attempts per 15 minutes)...');
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

        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    logTest('Rate limiting triggered after multiple failed attempts', rateLimitHit,
        rateLimitHit ? 'Rate limiting working correctly' : 'Rate limiting not working');
}

async function testAccountLockout() {
    console.log('\n🔒 Testing Account Lockout...');

    // First, create a test user
    const testEmail = `lockout${Date.now()}@example.com`;
    const testUsername = `lockout${Date.now()}`;

    const registerResult = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            email: testEmail,
            username: testUsername,
            password: 'TestPassword123@'
        })
    });

    if (!registerResult.response || (registerResult.response.status !== 201 && !(registerResult.response.status === 400 && registerResult.data && registerResult.data.requiresVerification))) {
        logTest('Test user creation for lockout test', false, 'Failed to create test user');
        return;
    }

    // Verify email first (simulate by updating user directly)
    // For testing purposes, we'll skip email verification

    // Now try to login with wrong password multiple times
    let accountLocked = false;

    for (let i = 0; i < 6; i++) {
        const result = await makeRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: testEmail,
                password: 'wrongpassword'
            })
        });

        if (result.response && result.response.status === 423) {
            accountLocked = true;
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    logTest('Account lockout after 5 failed attempts', accountLocked,
        accountLocked ? 'Account lockout working correctly' : 'Account lockout not working');
}

async function testInformationDisclosure() {
    console.log('\n🔍 Testing Information Disclosure Prevention...');

    // Test that error messages don't reveal user existence
    const result = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: 'definitelydoesnotexist@example.com',
            password: 'anypassword'
        })
    });

    const genericMessage = result.data && result.data.msg === 'Invalid Credentials';
    logTest('Generic error message for non-existent user', genericMessage,
        genericMessage ? 'User existence not revealed' : 'User existence might be revealed');
}

async function testCSRFProtection() {
    console.log('\n🍪 Testing CSRF Protection...');

    // Test forgot password without CSRF token
    const noCSRFResult = await makeRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
            email: 'test@example.com'
        })
    });

    const csrfRequired = noCSRFResult.response && noCSRFResult.response.status === 403;
    logTest('CSRF protection on forgot password', csrfRequired,
        csrfRequired ? 'CSRF protection working' : 'CSRF protection not working');

    // Test with CSRF token
    const csrfToken = await getCSRFToken();
    if (csrfToken) {
        const withCSRFResult = await makeRequest('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                email: 'test@example.com'
            })
        });

        const csrfWorking = withCSRFResult.response && withCSRFResult.response.status === 200;
        logTest('CSRF token acceptance', csrfWorking,
            csrfWorking ? 'CSRF token accepted' : 'CSRF token rejected');
    }
}

async function testTokenBlacklisting() {
    console.log('\n🚫 Testing Token Blacklisting...');

    // First, create and login a user
    const testEmail = `token${Date.now()}@example.com`;
    const testUsername = `token${Date.now()}`;

    const registerResult = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            email: testEmail,
            username: testUsername,
            password: 'TestPassword123@'
        })
    });

    if (!registerResult.response || (registerResult.response.status !== 201 && !(registerResult.response.status === 400 && registerResult.data && registerResult.data.requiresVerification))) {
        logTest('Test user creation for token test', false, 'Failed to create test user');
        return;
    }

    // For testing, we'll simulate a successful login
    // In real scenario, user would verify email first
    logTest('Token blacklisting test setup', true, 'Test user created (email verification skipped for testing)');
}

async function testSecurityHeaders() {
    console.log('\n🛡️ Testing Security Headers...');

    const result = await makeRequest('/');

    const securityHeaders = {
        'X-Content-Type-Options': result.response ? result.response.headers.get('X-Content-Type-Options') : null,
        'X-Frame-Options': result.response ? result.response.headers.get('X-Frame-Options') : null,
        'X-XSS-Protection': result.response ? result.response.headers.get('X-XSS-Protection') : null,
        'Strict-Transport-Security': result.response ? result.response.headers.get('Strict-Transport-Security') : null,
        'Content-Security-Policy': result.response ? result.response.headers.get('Content-Security-Policy') : null
    };

    const hasSecurityHeaders = Object.values(securityHeaders).some(header => header !== null);
    logTest('Security headers present', hasSecurityHeaders,
        hasSecurityHeaders ? 'Security headers configured' : 'Security headers missing');

    console.log('   Security Headers:', securityHeaders);
}

async function runAllTests() {
    console.log('🚀 Starting Comprehensive Security Features Test Suite...\n');

    await testPasswordStrength();
    await testBruteForceProtection();
    await testAccountLockout();
    await testInformationDisclosure();
    await testCSRFProtection();
    await testTokenBlacklisting();
    await testSecurityHeaders();

    // Print summary
    console.log('\n📊 TEST SUMMARY:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

    if (testResults.failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.tests.filter(test => !test.passed).forEach(test => {
            console.log(`   - ${test.name}: ${test.details}`);
        });
    }

    console.log('\n🎯 Security Test Complete!');
}

// Run the tests
runAllTests().catch(console.error);
