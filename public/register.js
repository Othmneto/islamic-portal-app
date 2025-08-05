// translator-backend - full/public/register.js

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const registerMessage = document.getElementById('register-message');

    // Function to display messages (success or error)
    function displayMessage(message, isSuccess = false) {
        registerMessage.textContent = message;
        registerMessage.className = isSuccess ? 'success-message' : 'error-message';
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Stop the browser from refreshing the page

            const email = document.getElementById('register-email').value;
            const username = document.getElementById('register-username').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;

            // Basic frontend validation for password match
            if (password !== confirmPassword) {
                displayMessage('Passwords do not match.');
                return;
            }

            displayMessage('Registering...', false); // Show a temporary message

            try {
                // Send the registration data to our backend API
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, username, password }),
                });

                const data = await response.json(); // Get the response from the server

                if (response.ok) {
                    displayMessage(data.msg + '. Redirecting to login...', true);
                    // Store the token securely using a common function (we'll add this next)
                    // This token isn't strictly needed on register, but good to have if we auto-login
                    if (data.token) {
                        localStorage.setItem('token', data.token); // Store token in browser's local storage
                    }
                    // Redirect to the login page or a success page after a short delay
                    setTimeout(() => {
                        window.location.href = 'login.html'; // Go to login page
                    }, 2000); // 2-second delay
                } else {
                    // Handle errors from the backend (e.g., email already exists, validation errors)
                    const errorMessage = data.errors ? data.errors.map(err => err.msg).join(', ') : (data.msg || 'Registration failed.');
                    displayMessage(errorMessage);
                }
            } catch (error) {
                console.error('Error during registration:', error);
                displayMessage('An unexpected error occurred. Please try again later.');
            }
        });
    }
});