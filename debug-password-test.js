// Debug password validation
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function debugPasswordTest() {
    try {
        console.log('Testing weak password: 123456');

        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'debug@example.com',
                username: 'debuguser',
                password: '123456'
            })
        });

        const text = await response.text();
        console.log('Raw response:', text);

        try {
            const data = JSON.parse(text);
            console.log('Parsed JSON:', JSON.stringify(data, null, 2));
        } catch (parseError) {
            console.log('JSON parse error:', parseError.message);
        }

        console.log('Status:', response.status);

        if (response.status === 400) {
            console.log('✅ Password correctly rejected');
        } else {
            console.log('❌ Password incorrectly accepted');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugPasswordTest();