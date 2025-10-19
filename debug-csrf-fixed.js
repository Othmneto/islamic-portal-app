// Debug CSRF token handling with proper cookie support
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function debugCSRF() {
    try {
        console.log('Getting CSRF token...');

        // First, get the CSRF token and cookie
        const csrfResponse = await fetch('http://localhost:3000/api/auth/csrf');
        const csrfData = await csrfResponse.json();
        console.log('CSRF Response:', csrfData);

        // Extract the cookie from the response
        const setCookieHeader = csrfResponse.headers.get('set-cookie');
        console.log('Set-Cookie header:', setCookieHeader);

        const csrfToken = csrfData.csrfToken;
        console.log('CSRF Token:', csrfToken);

        if (csrfToken && setCookieHeader) {
            console.log('\nTesting forgot password with CSRF token and cookie...');

            const forgotResponse = await fetch('http://localhost:3000/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                    'Cookie': setCookieHeader
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
