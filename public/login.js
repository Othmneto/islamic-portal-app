// translator-backend/public/login.js

document.addEventListener('DOMContentLoaded', async () => {
  // Force cache-busting by adding timestamp to URL
  const urlParams = new URLSearchParams(window.location.search);
  const currentTime = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  urlParams.set('v', currentTime);
  urlParams.set('r', randomId);
  window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
  
  const loginForm = document.getElementById('login-form');
  const messageDiv = document.getElementById('message') || document.getElementById('login-message');
  const oauthErrorDiv = document.getElementById('oauth-error-message');

  // Only run OAuth error handling on login page
  if (!loginForm) {
    return; // Silent exit for non-login pages
  }

  // Clear any stale error messages first
  if (oauthErrorDiv) {
    oauthErrorDiv.style.display = 'none';
    oauthErrorDiv.textContent = '';
  }
  if (messageDiv) {
    messageDiv.textContent = '';
    messageDiv.style.color = '';
  }

  // Check if user is already logged in
  const existingToken = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
  if (existingToken) {
    console.log('✅ Frontend: User already logged in, redirecting to profile');
    window.location.href = '/profile.html';
    return;
  }

  // Handle OAuth error messages from URL parameters
  const oauthError = urlParams.get('error');
  const token = urlParams.get('token');
  
  // Only log if there's actually an OAuth error or token
  if (oauthError || token) {
    console.log('🔍 Frontend: OAuth error from URL:', oauthError);
    console.log('🔍 Frontend: Token from URL:', token ? 'PRESENT' : 'NOT PRESENT');
    console.log('🔍 Frontend: All URL parameters:', Object.fromEntries(urlParams.entries()));
  }
  
  // If we have a token, it means OAuth was successful, so clear any error messages
  if (token && oauthErrorDiv) {
    console.log('✅ Frontend: OAuth success detected, clearing error messages');
    oauthErrorDiv.style.display = 'none';
    oauthErrorDiv.textContent = '';
    
    // Clear URL parameters to prevent error from persisting
    if (window.history.replaceState) {
      const url = new URL(window.location);
      url.searchParams.delete('error');
      window.history.replaceState({}, document.title, url);
    }
  }
  
  // Also clear any error messages if we're on a success page (like profile.html)
  if (window.location.pathname.includes('profile') && oauthErrorDiv) {
    console.log('✅ Frontend: On profile page, clearing any OAuth error messages');
    oauthErrorDiv.style.display = 'none';
    oauthErrorDiv.textContent = '';
  } else if (oauthError && oauthErrorDiv) {
    console.log('🔍 Frontend: Processing OAuth error:', oauthError);
    let errorMessage = 'OAuth authentication failed.';
    switch (oauthError) {
      case 'microsoft_auth_failed':
        errorMessage = 'Microsoft authentication failed. Please check your credentials.';
        break;
      case 'microsoft_callback_failed':
        errorMessage = 'Microsoft callback failed. Please try again.';
        break;
      case 'microsoft_oauth_error':
        errorMessage = 'Microsoft OAuth error occurred. Please check your app configuration.';
        break;
      case 'microsoft_no_user':
        errorMessage = 'No user data received from Microsoft. Please try again.';
        break;
      case 'microsoft_credentials_missing':
        errorMessage = 'Microsoft OAuth is not properly configured. Please contact support.';
        break;
      case 'microsoft_no_code':
        errorMessage = 'No authorization code received from Microsoft.';
        break;
      case 'microsoft_token_decode_error':
        errorMessage = 'Error processing Microsoft authentication token.';
        break;
      case 'microsoft_graph_api_error':
        errorMessage = 'Error fetching user profile from Microsoft Graph API.';
        break;
      case 'microsoft_no_email':
        errorMessage = 'No email address found in Microsoft profile.';
        break;
    }
    console.log('🔍 Frontend: Displaying error message:', errorMessage);
    oauthErrorDiv.textContent = errorMessage;
    oauthErrorDiv.style.display = 'block';
  } else if (oauthErrorDiv) {
    console.log('🔍 Frontend: No OAuth error, clearing error display');
    // Clear any previous error messages
    oauthErrorDiv.style.display = 'none';
  }

  if (!loginForm) {
    console.info('[login.js] No #login-form found; skipping login script.');
    return;
  }

  // Get CSRF token
  let csrfToken = null;
  try {
    const csrfResponse = await fetch('/api/csrf-token', {
      credentials: 'include'
    });
    if (csrfResponse.ok) {
      const csrfData = await csrfResponse.json();
      csrfToken = csrfData.csrfToken;
    }
  } catch (err) {
    console.warn('[login.js] Failed to get CSRF token:', err);
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

    console.log('🔍 Login attempt:', { email, passwordLength: password.length, csrfToken: csrfToken ? 'present' : 'missing' });

    if (!email || !password) {
      setMessage('Please enter your email and password.');
      return;
    }

    setMessage('Logging in...');

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers,
        credentials: 'include', // <-- ensure session cookie is set
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      console.log('🔍 Login response:', { status: res.status, data });

      if (!res.ok) {
        const msg = data?.message || data?.msg || 'Login failed.';
        console.error('❌ Login failed:', { status: res.status, message: msg, data });
        setMessage(msg);
        
        // Handle email verification requirement
        if (data.requiresVerification) {
          addResendVerificationButton(data.email);
        }
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

// Function to clear OAuth error message
function clearOAuthError() {
  console.log('🔍 Frontend: Clearing OAuth error message');
  const oauthErrorDiv = document.getElementById('oauth-error-message');
  if (oauthErrorDiv) {
    oauthErrorDiv.style.display = 'none';
    oauthErrorDiv.textContent = '';
  }
  // Also clear URL parameters
  if (window.history.replaceState) {
    const url = new URL(window.location);
    url.searchParams.delete('error');
    window.history.replaceState({}, document.title, url);
  }
}

// Function to add resend verification button
function addResendVerificationButton(email) {
  const existingButton = document.getElementById('resend-verification-btn');
  if (existingButton) return; // Don't add if already exists

  const resendButton = document.createElement('button');
  resendButton.id = 'resend-verification-btn';
  resendButton.textContent = 'Resend Verification Email';
  resendButton.className = 'btn btn-secondary';
  resendButton.style.marginTop = '10px';
  
  resendButton.addEventListener('click', async () => {
    resendButton.textContent = 'Sending...';
    resendButton.disabled = true;
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Verification email sent successfully! Please check your inbox.', true);
      } else {
        setMessage(data.msg || 'Failed to send verification email');
      }
    } catch (error) {
      console.error('Error resending verification:', error);
      setMessage('Failed to send verification email. Please try again.');
    } finally {
      resendButton.textContent = 'Resend Verification Email';
      resendButton.disabled = false;
    }
  });

  // Add button after the login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.appendChild(resendButton);
  }
}
