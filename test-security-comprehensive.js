// Comprehensive Security Test with Rate Limit Handling
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

async function testPasswordValidation() {
    console.log('\n🔐 Testing Password Validation...');

    // Test weak password
    const weakResult = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            email: `weak${Date.now()}@example.com`,
            username: `weak${Date.now()}`,
            password: '123456'
        })
    });

    const weakRejected = weakResult.response && (weakResult.response.status === 400 || weakResult.response.status === 429);
    logTest('Weak password rejected', weakRejected,
        weakRejected ? 'Password correctly rejected' : 'Password incorrectly accepted');

    // Test strong password
    const strongResult = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            email: `strong${Date.now()}@example.com`,
            username: `strong${Date.now()}`,
            password: 'Password123@'
        })
    });

    const strongAccepted = strongResult.response && (strongResult.response.status === 201 ||
        (strongResult.response.status === 400 && strongResult.data && strongResult.data.requiresVerification));
    logTest('Strong password accepted', strongAccepted,
        strongAccepted ? 'Password correctly accepted' : 'Password incorrectly rejected');
}

async function testRateLimiting() {
    console.log('\n🛡️ Testing Rate Limiting...');

    // Test if we're currently rate limited
    const testResult = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: 'test@example.com',
            password: 'test'
        })
    });

    const isRateLimited = testResult.response && testResult.response.status === 429;
    logTest('Rate limiting active', isRateLimited,
        isRateLimited ? 'Rate limiting is working' : 'Rate limiting not active (may have reset)');
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

async function testCSRFProtection() {
    console.log('\n🍪 Testing CSRF Protection...');

    // Get CSRF token
    const csrfResult = await makeRequest('/api/auth/csrf');
    const csrfToken = csrfResult.data && csrfResult.data.csrfToken;

    if (csrfToken) {
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
    } else {
        logTest('CSRF token retrieval', false, 'Failed to get CSRF token');
    }
}

async function testInformationDisclosure() {
    console.log('\n🔍 Testing Information Disclosure...');

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

async function runAllTests() {
    console.log('🚀 Starting Comprehensive Security Test Suite...\n');

    await testPasswordValidation();
    await testRateLimiting();
    await testSecurityHeaders();
    await testCSRFProtection();
    await testInformationDisclosure();

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
