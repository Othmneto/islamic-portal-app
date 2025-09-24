// Debug CSRF token handling
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function debugCSRF() {
    try {
        console.log('Getting CSRF token...');
        
        const csrfResponse = await fetch('http://localhost:3000/api/auth/csrf');
        const csrfData = await csrfResponse.json();
        console.log('CSRF Response:', csrfData);
        
        const csrfToken = csrfData.csrfToken;
        console.log('CSRF Token:', csrfToken);
        
        if (csrfToken) {
            console.log('\nTesting forgot password with CSRF token...');
            
            const forgotResponse = await fetch('http://localhost:3000/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({
                    email: 'test@example.com'
                })
            });
            
            const text = await forgotResponse.text();
            console.log('Forgot Password Response Status:', forgotResponse.status);
            console.log('Forgot Password Response:', text);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugCSRF();
