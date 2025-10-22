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

  // Check if user is already logged in (but only if not coming from OAuth callback)
  const existingToken = localStorage.getItem('accessToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
  const isOAuthCallback = urlParams.get('token') || urlParams.get('code');

  console.log('🔍 [Login] Auth check:', {
    existingToken: !!existingToken,
    isOAuthCallback: !!isOAuthCallback,
    tokenManagerAvailable: !!window.tokenManager,
    tokenManagerAuthenticated: window.tokenManager ? window.tokenManager.isAuthenticated() : false
  });

  // Only redirect if we have a valid, non-expired token
  if (existingToken && !isOAuthCallback) {
    try {
      // Check if token is expired
      const payload = JSON.parse(atob(existingToken.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp && payload.exp < now;

      if (!isExpired) {
        console.log('✅ Frontend: User already logged in with valid token, redirecting to home');
        window.location.href = '/index.html';
        return;
      } else {
        console.log('⚠️ Frontend: Token expired, clearing and staying on login page');
        // Clear expired tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
        localStorage.removeItem('jwt');
        localStorage.removeItem('refreshToken');
        if (window.tokenManager) {
          window.tokenManager.clearTokens();
        }
      }
    } catch (error) {
      console.log('⚠️ Frontend: Invalid token format, clearing and staying on login page');
      // Clear invalid tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      localStorage.removeItem('jwt');
      localStorage.removeItem('refreshToken');
      if (window.tokenManager) {
        window.tokenManager.clearTokens();
      }
    }
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

  function setMessage(text, ok = false) {
    if (!messageDiv) return console[ok ? 'info' : 'warn'](text);
    messageDiv.textContent = text;
    messageDiv.style.color = ok ? 'green' : 'red';
  }

  // Helper to get fresh CSRF token
  async function getFreshCsrfToken() {
    try {
      const csrfResponse = await fetch('/api/csrf-token', {
        credentials: 'include'
      });
      if (csrfResponse.ok) {
        const csrfData = await csrfResponse.json();
        console.log('🔐 Fresh CSRF token obtained:', csrfData.csrfToken ? csrfData.csrfToken.substring(0, 10) + '...' : 'None');
        return csrfData.csrfToken;
      }
    } catch (err) {
      console.warn('[login.js] Failed to get CSRF token:', err);
    }
    return null;
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailEl = document.getElementById('email') || document.getElementById('login-email');
    const passEl  = document.getElementById('password') || document.getElementById('login-password');
    const rememberMeEl = document.getElementById('rememberMe');

    const email = emailEl?.value?.trim() || '';
    const password = passEl?.value || '';
    const rememberMe = rememberMeEl ? rememberMeEl.checked : false;

    if (!email || !password) {
      setMessage('Please enter your email and password.');
      return;
    }

    setMessage('Logging in...');

    // Get fresh CSRF token right before login attempt
    const csrfToken = await getFreshCsrfToken();
    console.log('🔍 Login attempt:', { email, passwordLength: password.length, rememberMe, csrfToken: csrfToken ? 'present' : 'missing' });

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const res = await fetch('/api/auth-cookie/login', {
        method: 'POST',
        headers,
        credentials: 'include', // <-- ensure session cookie is set
        body: JSON.stringify({ email, password, rememberMe }),
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

      // Save tokens using the new token management system
      if (data.token && data.refreshToken) {
        // Use the new token manager
        if (window.tokenManager) {
          window.tokenManager.saveTokens(data.token, data.refreshToken);
        } else {
          // Fallback to old method if token manager not available
          localStorage.setItem('accessToken', data.token);
          localStorage.setItem('refreshToken', data.refreshToken);
          localStorage.removeItem('authToken');
          localStorage.removeItem('token');
          localStorage.removeItem('jwt');
        }
        console.log('✅ [Login] Tokens saved successfully (rememberMe:', data.rememberMe, ')');
      } else if (data.token) {
        // Legacy support for old API responses
        localStorage.setItem('accessToken', data.token);
        console.warn('[login.js] Using legacy token storage - refresh token not available');
      } else {
        console.warn('[login.js] Login succeeded but no token was returned.');
      }

      // Save user data
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('userData', JSON.stringify(data.user)); // For navbar compatibility
      }

      setMessage('Login successful! Loading account options...', true);

      // Update navbar if it exists
      if (window.globalNavbar) {
        window.globalNavbar.updateAuthStatus();
      }

      // Also trigger global navbar update
      if (window.updateNavbarState) {
        window.updateNavbarState({
          currentUser: data.user,
          isAuthenticated: true
        });
      }

      // Load user's authentication methods
      await loadUserAuthMethods(data.user.id);

      // Show account linking section
      showAccountLinking();

      // Check if user needs username setup
      if (data.user && data.user.needsUsernameSetup) {
        setTimeout(() => {
          window.location.href = '/setup-username.html';
        }, 2000);
      } else {
      // Redirect to home page after showing account options
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
      }
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

// Enhanced authentication functions
async function loadUserAuthMethods(userId) {
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/auth/auth-methods/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      displayAuthMethods(data.authMethods);
    }
  } catch (error) {
    console.error('Error loading auth methods:', error);
  }
}

function displayAuthMethods(authMethods) {
  const authMethodsDiv = document.getElementById('auth-methods');
  if (!authMethodsDiv) return;

  authMethodsDiv.innerHTML = '';

  Object.entries(authMethods).forEach(([provider, isConnected]) => {
    if (provider === 'email') return; // Skip email as it's always connected for logged-in users

    const methodDiv = document.createElement('div');
    methodDiv.className = `auth-method ${isConnected ? 'connected' : ''}`;

    const icon = getProviderIcon(provider);
    const name = getProviderName(provider);

    methodDiv.innerHTML = `
      <i class="${icon}"></i>
      <span>${name}</span>
      ${isConnected ? '<i class="fas fa-check"></i>' : ''}
    `;

    authMethodsDiv.appendChild(methodDiv);
  });
}

function getProviderIcon(provider) {
  const icons = {
    google: 'fab fa-google',
    microsoft: 'fab fa-microsoft',
    facebook: 'fab fa-facebook',
    twitter: 'fab fa-twitter',
    tiktok: 'fab fa-tiktok'
  };
  return icons[provider] || 'fas fa-user';
}

function getProviderName(provider) {
  const names = {
    google: 'Google',
    microsoft: 'Microsoft',
    facebook: 'Facebook',
    twitter: 'Twitter',
    tiktok: 'TikTok'
  };
  return names[provider] || provider;
}

function showAccountLinking() {
  const accountLinkingDiv = document.getElementById('account-linking');
  if (accountLinkingDiv) {
    accountLinkingDiv.style.display = 'block';
    accountLinkingDiv.scrollIntoView({ behavior: 'smooth' });
  }
}

// Handle OAuth success
async function handleOAuthSuccess(token, refreshToken = null) {
  try {
    // Decode token to get user info
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.user.id;

    // Store tokens using the new token management system
    if (window.tokenManager && refreshToken) {
      window.tokenManager.saveTokens(token, refreshToken);
    } else {
      // Fallback to old method
      localStorage.setItem('authToken', token);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
    }

    // Store user data
    localStorage.setItem('user', JSON.stringify(payload.user));
    localStorage.setItem('userData', JSON.stringify(payload.user)); // For navbar compatibility

    // Update navbar if it exists
    if (window.globalNavbar) {
      window.globalNavbar.updateAuthStatus();
    }

    setMessage('OAuth login successful! Loading account options...', true);

    // Load user's authentication methods
    await loadUserAuthMethods(userId);

    // Show account linking section
    showAccountLinking();

    // Check if user needs username setup
    if (payload.user.needsUsernameSetup) {
      setTimeout(() => {
        window.location.href = '/setup-username.html';
      }, 2000);
    } else {
      // Redirect after showing account options
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    }
  } catch (error) {
    console.error('OAuth success handling error:', error);
    setMessage('OAuth login successful but failed to load account options.', false);
  }
}

// Link OAuth account
window.linkOAuthAccount = async function(provider) {
  const button = document.getElementById(`link-${provider}`);
  if (!button) return;

  const originalText = button.innerHTML;

  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Linking...';
  button.disabled = true;

  try {
    // Redirect to OAuth provider
    window.location.href = `/api/auth/${provider}`;
  } catch (error) {
    console.error(`Error linking ${provider}:`, error);
    button.innerHTML = originalText;
    button.disabled = false;
    setMessage(`Failed to link ${provider} account`, false);
  }
};
