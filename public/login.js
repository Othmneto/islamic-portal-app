// public/login.js
// Handles login, saves JWT in localStorage under both "authToken" and "token",
// and triggers push subscription init safely.

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginMessage = document.getElementById('login-message');

  function displayMessage(message, isSuccess = false) {
    if (loginMessage) {
      loginMessage.textContent = message;
      loginMessage.className = isSuccess ? 'success-message' : 'error-message';
    } else {
      console.warn('Login message element not found:', message);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');

    const email = emailEl ? emailEl.value : '';
    const password = passEl ? passEl.value : '';

    displayMessage('Logging in...');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.errors
          ? data.errors.map(e => e.msg).join(', ')
          : (data?.msg || res.statusText || 'Login failed');
        displayMessage(msg);
        return;
      }

      // Store token under BOTH keys so all code paths work
      const token = data.token || data.accessToken || data.jwt;
      if (token) {
        localStorage.setItem('authToken', token);
        localStorage.setItem('token', token);
      } else {
        console.warn('Login response had no token field.');
      }

      displayMessage((data.msg || 'Logged in') + '. Redirecting...', true);

      // Trigger push init if available (supports either function name)
      const init =
        (typeof window.initPushNotifications === 'function' && window.initPushNotifications) ||
        (typeof window.initializePushNotifications === 'function' && window.initializePushNotifications);

      if (init) {
        try { await init(); } catch (e) { console.warn('Push init failed:', e); }
      }

      // Redirect home (adjust if your route differs)
      setTimeout(() => { window.location.href = '/'; }, 800);

    } catch (err) {
      console.error('Error during login:', err);
      displayMessage('Network error. Please try again.');
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  } else {
    console.warn('login-form not found in DOM.');
  }
});
