// translator-backend - full/public/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');

    // Function to display messages (success or error)
    function displayMessage(message, isSuccess = false) {
        if (loginMessage) { // Ensure the element exists before trying to manipulate it
            loginMessage.textContent = message;
            loginMessage.className = isSuccess ? 'success-message' : 'error-message';
        } else {
            console.warn('Login message element not found, displaying in console:', message);
        }
    }

    // This ensures that the code runs only if the loginForm element exists on the page.
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Stop the browser from refreshing the page on form submission

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            // Clear previous messages and show a loading state
            displayMessage('Logging in...', false);

            try {
                // Send the login data to our backend API
                const response = await fetch('/api/auth/login', {
                    method: 'POST', // This must be POST to match the backend route
                    headers: {
                        'Content-Type': 'application/json', // Tell the server we're sending JSON
                    },
                    body: JSON.stringify({ email, password }), // Convert data to JSON string
                });

                const data = await response.json(); // Parse the JSON response from the server

                if (response.ok) { // Check if the HTTP status code is 2xx (success)
                    displayMessage(data.msg + '. Redirecting...', true);
                    // Store the received token in local storage – this is the user's "digital ID"
                    if (data.token) {
                        localStorage.setItem('token', data.token); // Save the JWT token
                        // The common.js file will use this token to update the nav bar
                    }
                    // Redirect to the main page or dashboard after a short delay
                    setTimeout(() => {
                        window.location.href = 'index.html'; // Go to the main portal page after successful login
                    }, 1500); // 1.5-second delay
                } else {
                    // Handle errors from the backend (e.g., invalid credentials, validation errors)
                    // If backend sends an 'errors' array (from express-validator) or a 'msg'
                    const errorMessage = data.errors 
                                       ? data.errors.map(err => err.msg).join(', ') 
                                       : (data.msg || 'Login failed. Please check your credentials.');
                    displayMessage(errorMessage);
                }
            } catch (error) {
                // This catch block handles network errors or issues with fetch itself
                console.error('Error during login:', error);
                displayMessage('An unexpected network error occurred. Please check your internet connection or try again later.');
            }
        });
    }
});