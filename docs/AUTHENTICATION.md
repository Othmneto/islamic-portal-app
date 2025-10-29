# Authentication System Documentation

## Overview

This application uses **session-based authentication** with server-side session management via MongoDB (MongoStore). JWT-based authentication for web clients has been deprecated as of the latest migration.

## Current Authentication Flow

### Web Clients (Recommended)

#### Login
1. **Endpoint:** `POST /api/auth-cookie/login`
2. **Request:**
   ```json
   {
     "email": "user@example.com",
     "password": "SecurePassword123!",
     "rememberMe": false  // optional, default: false
   }
   ```
3. **Headers:** Must include CSRF token
   - `X-CSRF-Token: <token>` (get from `GET /api/csrf-token`)
4. **Response:**
   ```json
   {
     "message": "Login successful",
     "user": {
       "id": "...",
       "email": "...",
       "username": "..."
     }
   }
   ```
5. **Session Cookie:** `sid` cookie set automatically (httpOnly, secure in production)

#### Authenticated Requests
- Include `credentials: 'include'` in fetch options
- Session cookie sent automatically
- No `Authorization` header needed
- Example:
  ```javascript
  const response = await fetch('/api/user/preferences', {
    method: 'GET',
    credentials: 'include'
  });
  ```

#### CSRF Protection
For state-changing operations (POST, PUT, DELETE):
1. Fetch CSRF token: `GET /api/csrf-token`
2. Include in request header: `X-CSRF-Token: <token>`

#### Logout
- **Endpoint:** `POST /api/auth-cookie/logout`
- **Effect:** Destroys session and clears cookies
- **Example:**
  ```javascript
  await fetch('/api/auth-cookie/logout', {
    method: 'POST',
    credentials: 'include'
  });
  ```

### Session Lifecycle

- **Default lifetime:** Session cookie (expires on browser close)
- **Remember Me:** 90 days (persistent cookie)
- **Auto-expiration:** Sessions auto-expire in MongoDB after 90 days via TTL index
- **Renewal:** Rolling sessions - `maxAge` renewed on each request

### Session Storage

- **Store:** MongoDB via `connect-mongo` (MongoStore)
- **Collection:** `sessions`
- **Persistence:** Sessions survive server restarts
- **TTL Index:** Automatically expires old sessions after 90 days

## Deprecated: JWT Authentication

### Status
⚠️ **DEPRECATED** - JWT-based authentication for web clients has been removed.

### Migration Guide

#### Old Flow (JWT - DEPRECATED)
```javascript
// ❌ DON'T USE
const token = localStorage.getItem('authToken');
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email, password })
});
```

#### New Flow (Session - CURRENT)
```javascript
// ✅ USE THIS
const csrfToken = await fetch('/api/csrf-token', { credentials: 'include' })
  .then(r => r.json()).then(d => d.csrfToken);

const response = await fetch('/api/auth-cookie/login', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({ email, password })
});
```

### Deprecated Endpoints

- `POST /api/auth/login` → Returns 410 Gone (use `/api/auth-cookie/login` instead)

### Token Cleanup

The frontend automatically clears legacy tokens on load via `tokenManager.js`:
- `localStorage.getItem('token')`
- `localStorage.getItem('authToken')`
- `localStorage.getItem('jwt')`
- `localStorage.getItem('access_token')`

## API Clients & Mobile Apps

JWT authentication is still supported for non-browser clients via `Authorization: Bearer` header. This fallback is logged with deprecation warnings.

**Note:** Consider migrating to session-based auth or implementing a dedicated API token system for production mobile apps.

## Security Features

- ✅ Session fixation prevention via `req.session.regenerate()`
- ✅ CSRF protection (double-submit HMAC pattern)
- ✅ httpOnly cookies (prevent XSS token theft)
- ✅ Secure cookies in production (HTTPS only)
- ✅ SameSite=Lax (CSRF mitigation)
- ✅ Account lockout on failed login attempts
- ✅ Email verification
- ✅ Helmet security headers
- ✅ CORS with credentials

## Middleware

### `middleware/authMiddleware.js`
- **Primary:** Resolves user from `req.session.userId`
- **Fallback:** Accepts JWT Bearer token (logged with deprecation warning)
- **Usage:** Applied globally via `app.use(attachUser)`

### `middleware/csrfMiddleware.js`
- **Function:** CSRF protection via double-submit HMAC
- **Bypass:** Only if `ALLOW_NO_CSRF=true` env var set
- **Usage:** Applied to state-changing routes

## Testing Authentication

### Manual Test Flow
1. Navigate to `/login.html`
2. Login with email/password
3. Open DevTools → Application → Cookies
4. Verify `sid` cookie exists
5. Navigate to protected page (e.g., `/prayer-time.html`)
6. Verify no console errors
7. Open DevTools → Application → Local Storage
8. Verify NO `token`, `authToken`, or `jwt` keys
9. Logout
10. Verify `sid` cookie cleared
11. Attempt to access protected page → redirect to login

### Automated Tests
See `__tests__/auth.test.js` for unit tests.

## Troubleshooting

### "Session or valid token required" (401)
- **Cause:** No session cookie or expired session
- **Fix:** Login again at `/login.html`

### "CSRF token missing" (403)
- **Cause:** Missing CSRF token on state-changing request
- **Fix:** Fetch CSRF token from `/api/csrf-token` and include in `X-CSRF-Token` header

### Session not persisting across requests
- **Cause:** `credentials: 'include'` not set in fetch
- **Fix:** Add `credentials: 'include'` to all authenticated requests

### Guest flash on page load
- **Cause:** Frontend rendering before session check completes
- **Status:** Fixed - navbar waits for user profile before showing guest

## Environment Variables

```env
# Session configuration
SESSION_SECRET=<your-secret-here>
COOKIE_SECURE=true  # Force secure cookies (production)
COOKIE_DOMAIN=       # Optional: .yourdomain.com for subdomain sharing

# MongoDB (for session store)
MONGO_URI=mongodb://...
DB_NAME=translator-backend

# CSRF
ALLOW_NO_CSRF=false  # Only set to 'true' for local E2E testing
```

## Migration Checklist

If you have an existing JWT-based frontend:

- [ ] Remove `localStorage.getItem('token')` calls
- [ ] Remove `Authorization: Bearer` headers
- [ ] Add `credentials: 'include'` to all fetch calls
- [ ] Implement CSRF token fetch and header inclusion
- [ ] Change login endpoint from `/api/auth/login` to `/api/auth-cookie/login`
- [ ] Change logout endpoint from `/api/auth/logout` to `/api/auth-cookie/logout`
- [ ] Remove token refresh logic
- [ ] Test session persistence across page reloads
- [ ] Test session sharing across tabs
- [ ] Test logout clears session

## Architecture Diagram

```
┌──────────────┐
│   Browser    │
│              │
│ 1. Login     │───────┐
│    POST /api/auth-cookie/login
│    + CSRF    │       │
└──────────────┘       │
                       ▼
              ┌─────────────────┐
              │  Express Server │
              │                 │
              │  req.session    │◄────┐
              │  .userId        │     │
              └─────────────────┘     │
                       │              │
                       │              │
                       ▼              │
              ┌─────────────────┐    │
              │   MongoStore    │    │
              │   (sessions)    │────┘
              │   + TTL Index   │
              └─────────────────┘
                       │
                       │ (90 days)
                       ▼
                  Auto-expire
```

---

**Last updated:** 2025-01-29  
**Version:** 2.0 (Session-based)


