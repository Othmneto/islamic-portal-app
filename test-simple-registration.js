// Simple registration test
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testRegistration() {
    try {
        console.log('Testing registration with weak password...');
        
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'test@example.com',
                username: 'testuser',
                password: '123456'
            })
        });
        
        const data = await response.json();
        
        console.log('Status:', response.status);
        console.log('Response:', data);
        
        if (response.status === 400) {
            console.log('✅ Password validation working - weak password rejected');
        } else {
            console.log('❌ Password validation not working - weak password accepted');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testRegistration();
