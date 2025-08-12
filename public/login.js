// translator-backend/public/login.js

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const messageDiv = document.getElementById('message') || document.getElementById('login-message');

  if (!loginForm) {
    console.info('[login.js] No #login-form found; skipping login script.');
    return;
  }

  function setMessage(text, ok = false) {
    if (!messageDiv) return console[ok ? 'info' : 'warn'](text);
    messageDiv.textContent = text;
    messageDiv.style.color = ok ? 'green' : 'red';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailEl = document.getElementById('email') || document.getElementById('login-email');
    const passEl  = document.getElementById('password') || document.getElementById('login-password');

    const email = emailEl?.value?.trim() || '';
    const password = passEl?.value || '';

    if (!email || !password) {
      setMessage('Please enter your email and password.');
      return;
    }

    setMessage('Logging in...');

    try {
      const res = await fetch('/api/auth/login-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // <-- ensure session cookie is set
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.message || data?.msg || 'Login failed.';
        setMessage(msg);
        return;
      }

      // Save JWT for Bearer flows (some code reads "authToken", some reads "token")
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('token', data.token);
      } else {
        console.warn('[login.js] Login succeeded but no token was returned.');
      }

      setMessage('Login successful! Redirecting...', true);

      // Redirect to prayer times page (as per our previous flow)
      window.location.href = '/prayer-time.html';
    } catch (err) {
      console.error('[login.js] Network/Unexpected error:', err);
      setMessage('An error occurred. Please try again.');
    }
  });
});
