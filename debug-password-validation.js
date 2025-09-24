// Debug Password Validation
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testPasswordValidation() {
    console.log('🔍 Testing Password Validation...\n');
    
    const testCases = [
        { password: '123456', shouldReject: true, reason: 'Too short' },
        { password: 'password', shouldReject: true, reason: 'No uppercase, number, special char' },
        { password: 'Password123', shouldReject: true, reason: 'No special character' },
        { password: 'Password@', shouldReject: true, reason: 'Too short' },
        { password: 'password123@', shouldReject: true, reason: 'No uppercase' },
        { password: 'PASSWORD123@', shouldReject: true, reason: 'No lowercase' },
        { password: 'Pass123', shouldReject: true, reason: 'Too short' },
        { password: 'Password123', shouldReject: true, reason: 'No special character' },
        { password: 'Password123@', shouldReject: false, reason: 'Valid password' },
        { password: 'MySecure@Pass2024', shouldReject: false, reason: 'Valid password' },
        { password: 'Test123!@#', shouldReject: false, reason: 'Valid password' },
        { password: 'StrongP@ssw0rd', shouldReject: false, reason: 'Valid password' }
    ];
    
    for (const testCase of testCases) {
        console.log(`Testing: "${testCase.password}" (${testCase.reason})`);
        
        try {
            const response = await fetch('http://localhost:3000/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: `test${Date.now()}@example.com`,
                    username: `test${Date.now()}`,
                    password: testCase.password
                })
            });
            
            const data = await response.json();
            
            const wasRejected = response.status === 400;
            const wasAccepted = response.status === 201 || (response.status === 400 && data.requiresVerification);
            
            console.log(`  Status: ${response.status}`);
            console.log(`  Response:`, data);
            console.log(`  Expected: ${testCase.shouldReject ? 'REJECT' : 'ACCEPT'}`);
            console.log(`  Actual: ${wasRejected ? 'REJECT' : wasAccepted ? 'ACCEPT' : 'UNKNOWN'}`);
            console.log(`  Result: ${(testCase.shouldReject && wasRejected) || (!testCase.shouldReject && wasAccepted) ? '✅ CORRECT' : '❌ WRONG'}`);
            console.log('---');
            
        } catch (error) {
            console.log(`  Error: ${error.message}`);
            console.log('---');
        }
        
        // Wait a bit to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Start the server first, then run the test
console.log('Make sure the server is running on port 3000...');
setTimeout(testPasswordValidation, 2000);
