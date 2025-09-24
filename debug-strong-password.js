// Debug strong password validation
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function debugStrongPassword() {
    try {
        console.log('Testing strong password: Password123@');
        
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: `strong${Date.now()}@example.com`,
                username: `strong${Date.now()}`,
                password: 'Password123@'
            })
        });
        
        const text = await response.text();
        console.log('Raw response:', text);
        console.log('Status:', response.status);
        
        try {
            const data = JSON.parse(text);
            console.log('Parsed JSON:', JSON.stringify(data, null, 2));
        } catch (parseError) {
            console.log('JSON parse error:', parseError.message);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugStrongPassword();
