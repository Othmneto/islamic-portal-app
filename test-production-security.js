// Comprehensive Production-Grade Security Test Suite
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
    }
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
        
        await new Promise(resolve => setTimeout(resolve, 100));
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
    
    console.log('   Security Headers:', securityHeaders);
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

async function testTokenSecurity() {
    console.log('\n🔑 Testing Token Security...');
    
    // Test with invalid token
    const invalidTokenResult = await makeRequest('/api/user/profile', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer invalid_token'
        }
    });
    
    const invalidTokenRejected = invalidTokenResult.response && invalidTokenResult.response.status === 401;
    logTest('Invalid token rejected', invalidTokenRejected, 
        invalidTokenRejected ? 'Invalid token correctly rejected' : 'Invalid token incorrectly accepted');
    
    // Test with malformed token
    const malformedTokenResult = await makeRequest('/api/user/profile', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer malformed.token.here'
        }
    });
    
    const malformedTokenRejected = malformedTokenResult.response && malformedTokenResult.response.status === 401;
    logTest('Malformed token rejected', malformedTokenRejected, 
        malformedTokenRejected ? 'Malformed token correctly rejected' : 'Malformed token incorrectly accepted');
}

async function testInputValidation() {
    console.log('\n📝 Testing Input Validation...');
    
    // Test SQL injection attempts
    const sqlInjectionResult = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: "admin' OR '1'='1",
            password: "password"
        })
    });
    
    const sqlInjectionBlocked = sqlInjectionResult.response && sqlInjectionResult.response.status === 400;
    logTest('SQL injection blocked', sqlInjectionBlocked, 
        sqlInjectionBlocked ? 'SQL injection correctly blocked' : 'SQL injection not blocked');
    
    // Test XSS attempts
    const xssResult = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            email: 'test@example.com',
            username: '<script>alert("xss")</script>',
            password: 'TestPassword123@'
        })
    });
    
    const xssBlocked = xssResult.response && xssResult.response.status === 400;
    logTest('XSS attempt blocked', xssBlocked, 
        xssBlocked ? 'XSS attempt correctly blocked' : 'XSS attempt not blocked');
}

async function runAllTests() {
    console.log('🚀 Starting Comprehensive Production Security Test Suite...\n');
    
    await testPasswordSecurity();
    await testRateLimiting();
    await testSecurityHeaders();
    await testCSRFProtection();
    await testInformationDisclosure();
    await testAccountLockout();
    await testTokenSecurity();
    await testInputValidation();
    
    // Print summary
    console.log('\n📊 COMPREHENSIVE TEST SUMMARY:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.tests.filter(test => !test.passed).forEach(test => {
            console.log(`   - ${test.name}: ${test.details}`);
        });
    }
    
    // Security grade
    const successRate = (testResults.passed / (testResults.passed + testResults.failed)) * 100;
    let grade = 'F';
    if (successRate >= 95) grade = 'A+';
    else if (successRate >= 90) grade = 'A';
    else if (successRate >= 85) grade = 'A-';
    else if (successRate >= 80) grade = 'B+';
    else if (successRate >= 75) grade = 'B';
    else if (successRate >= 70) grade = 'B-';
    else if (successRate >= 65) grade = 'C+';
    else if (successRate >= 60) grade = 'C';
    else if (successRate >= 55) grade = 'C-';
    else if (successRate >= 50) grade = 'D';
    
    console.log(`\n🏆 PRODUCTION SECURITY GRADE: ${grade} (${successRate.toFixed(1)}%)`);
    
    if (successRate >= 90) {
        console.log('🎉 EXCELLENT! Your authentication system is production-ready!');
    } else if (successRate >= 80) {
        console.log('👍 GOOD! Your authentication system is mostly secure with minor improvements needed.');
    } else if (successRate >= 70) {
        console.log('⚠️  FAIR! Your authentication system needs security improvements.');
    } else {
        console.log('🚨 POOR! Your authentication system has significant security issues.');
    }
    
    console.log('\n🎯 Production Security Test Complete!');
}

// Run the tests
runAllTests().catch(console.error);
