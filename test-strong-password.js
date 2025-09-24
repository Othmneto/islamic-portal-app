// Test strong password registration
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testStrongPassword() {
    try {
        console.log('Testing registration with strong password...');
        
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'test@example.com',
                username: 'testuser',
                password: 'Password123@'
            })
        });
        
        const data = await response.json();
        
        console.log('Status:', response.status);
        console.log('Response:', data);
        
        if (response.status === 201) {
            console.log('✅ Strong password validation working - password accepted');
        } else if (response.status === 400 && data.requiresVerification) {
            console.log('✅ Strong password validation working - password accepted (email verification required)');
        } else {
            console.log('❌ Strong password validation not working - password rejected');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testStrongPassword();
