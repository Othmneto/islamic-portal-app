// Final Comprehensive Security Test
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
    
    const weakRejected = weakResult.response && weakResult.response.status === 400;
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
    
    // Test multiple rapid requests to trigger rate limiting
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
}

async function testAccountLockout() {
    console.log('\n🔒 Testing Account Lockout...');
    
    // Create a test user
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
    
    const userCreated = registerResult.response && (registerResult.response.status === 201 || 
        (registerResult.response.status === 400 && registerResult.data && registerResult.data.requiresVerification));
    
    if (userCreated) {
        logTest('Test user created for lockout test', true, 'User created successfully');
        
        // Try to login with wrong password multiple times
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
    } else {
        logTest('Test user creation for lockout test', false, 'Failed to create test user');
    }
}

async function runAllTests() {
    console.log('🚀 Starting Final Comprehensive Security Test Suite...\n');
    
    await testPasswordValidation();
    await testRateLimiting();
    await testSecurityHeaders();
    await testInformationDisclosure();
    await testCSRFProtection();
    await testAccountLockout();
    
    // Print summary
    console.log('\n📊 FINAL TEST SUMMARY:');
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
    
    // Security grade
    const successRate = (testResults.passed / (testResults.passed + testResults.failed)) * 100;
    let grade = 'F';
    if (successRate >= 90) grade = 'A';
    else if (successRate >= 80) grade = 'B';
    else if (successRate >= 70) grade = 'C';
    else if (successRate >= 60) grade = 'D';
    
    console.log(`\n🏆 SECURITY GRADE: ${grade} (${successRate.toFixed(1)}%)`);
    
    if (successRate >= 80) {
        console.log('🎉 EXCELLENT! Your authentication system is production-ready!');
    } else if (successRate >= 70) {
        console.log('👍 GOOD! Your authentication system is mostly secure with minor improvements needed.');
    } else {
        console.log('⚠️  NEEDS IMPROVEMENT! Please address the failed security tests.');
    }
}

// Run the tests
runAllTests().catch(console.error);
