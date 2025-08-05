document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');

    // Function to display messages (success or error)
    function displayMessage(message, isSuccess = false) {
        if (loginMessage) {
            loginMessage.textContent = message;
            loginMessage.className = isSuccess ? 'success-message' : 'error-message';
        } else {
            console.warn('Login message element not found, displaying in console:', message);
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Stop the browser from refreshing

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            displayMessage('Logging in...', false);

            try {
                // Send the login data to our backend API
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (response.ok) { // Check for a successful HTTP status code (2xx)
                    displayMessage(data.msg + '. Redirecting...', true);

                    if (data.token) {
                        // Store the token in local storage for authenticated requests
                        localStorage.setItem('token', data.token);

                        // --- NEW: INITIATE PUSH NOTIFICATION SUBSCRIPTION ---
                        // This function is defined in push-client.js
                        // It will check for permission and subscribe the user if needed.
                        if (typeof initPushNotifications === 'function') {
                            initPushNotifications();
                        } else {
                            console.error('initPushNotifications function not found. Make sure push-client.js is loaded.');
                        }
                    }

                    // Redirect to the main page or dashboard after a short delay
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1500);

                } else {
                    // Handle errors from the backend (e.g., invalid credentials)
                    const errorMessage = data.errors 
                                       ? data.errors.map(err => err.msg).join(', ') 
                                       : (data.msg || 'Login failed. Please check your credentials.');
                    displayMessage(errorMessage);
                }
            } catch (error) {
                // Handle network errors or issues with the fetch itself
                console.error('Error during login:', error);
                displayMessage('An unexpected network error occurred. Please try again later.');
            }
        });
    }
});