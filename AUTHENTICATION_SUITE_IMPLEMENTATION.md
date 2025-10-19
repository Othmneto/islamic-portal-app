# Enhanced Session & Authentication System - Implementation Guide

## Overview

This document provides comprehensive testing scenarios and implementation details for the Enhanced Session & Authentication System. The system implements production-grade authentication with Remember Me functionality, sliding window token renewal, cross-tab synchronization, push subscription health monitoring, notification confirmation, and per-user rate limiting.

## Features Implemented

### 1. Remember Me Authentication
- **Checked**: 90 days persistent session
- **Unchecked**: 24 hours session-only (expires on browser close)
- Dynamic session cookie `maxAge` based on user preference
- Secure refresh token rotation with hashing

### 2. Sliding Window Token Renewal
- Auto-refresh tokens at 50% lifetime
- `X-New-Token` header for seamless renewal
- Grace period for slightly older tokens
- Proactive token refresh on frontend

### 3. Cross-Tab Synchronization
- `BroadcastChannel` API for instant sync
- `localStorage` event fallback
- Heartbeat mechanism for tab detection
- Real-time login/logout sync across tabs

### 4. Push Subscription Health Monitoring
- Daily health checks at 3:00 AM
- Silent probe notifications
- Automatic removal after 3 failures
- Expired subscription cleanup

### 5. Notification Confirmation & Retry
- Delivery confirmation tracking
- Exponential backoff retry logic
- Write-Ahead Log (WAL) for durability
- Idempotent retry processing

### 6. Per-User Rate Limiting
- User:IP composite keys
- 10x multiplier for authenticated users
- Token bucket algorithm with LRU pruning
- Enhanced rate limits for Remember Me

## Manual Testing Scenarios

### Test 1: Remember Me Functionality

#### 1.1 Remember Me Checked (90 days)
1. **Setup**: Open browser, go to `/login.html`
2. **Action**: Check "Keep me logged in for 90 days" checkbox
3. **Login**: Enter credentials and submit
4. **Verify**: 
   - Check browser DevTools → Application → Cookies
   - Verify `sid` cookie has `maxAge` of 90 days
   - Check `localStorage` for `accessToken` and `refreshToken`
5. **Test Persistence**: Close browser completely, reopen, navigate to protected page
6. **Expected**: User remains logged in

#### 1.2 Remember Me Unchecked (24 hours)
1. **Setup**: Open browser, go to `/login.html`
2. **Action**: Uncheck "Keep me logged in for 90 days" checkbox
3. **Login**: Enter credentials and submit
4. **Verify**:
   - Check browser DevTools → Application → Cookies
   - Verify `sid` cookie has no `maxAge` (session cookie)
   - Check `localStorage` for `accessToken` and `refreshToken`
5. **Test Persistence**: Close browser completely, reopen, navigate to protected page
6. **Expected**: User is logged out

### Test 2: Sliding Window Token Renewal

#### 2.1 Token Renewal at 50% Lifetime
1. **Setup**: Login with Remember Me checked
2. **Action**: Make API requests every few minutes
3. **Monitor**: Check browser DevTools → Network tab
4. **Verify**: Look for `X-New-Token` header in responses
5. **Expected**: New token issued when current token is 50% through its lifetime

#### 2.2 Frontend Token Update
1. **Setup**: Login and monitor console logs
2. **Action**: Wait for sliding renewal to trigger
3. **Verify**: Check console for "Token updated from sliding renewal" message
4. **Expected**: `localStorage` contains updated `accessToken`

### Test 3: Cross-Tab Synchronization

#### 3.1 Login Sync
1. **Setup**: Open two browser tabs to `/login.html`
2. **Action**: Login in Tab A
3. **Verify**: Check Tab B
4. **Expected**: Tab B automatically redirects to authenticated page

#### 3.2 Logout Sync
1. **Setup**: User logged in with two tabs open
2. **Action**: Logout in Tab A
3. **Verify**: Check Tab B
4. **Expected**: Tab B automatically redirects to login page

#### 3.3 Token Update Sync
1. **Setup**: User logged in with two tabs open
2. **Action**: Token renewal occurs in Tab A
3. **Verify**: Check Tab B console logs
4. **Expected**: Tab B receives updated token via BroadcastChannel

### Test 4: Push Subscription Health

#### 4.1 Health Check Monitoring
1. **Setup**: Create push subscription
2. **Action**: Wait for daily health check (3:00 AM) or trigger manually
3. **Verify**: Check server logs for health check results
4. **Expected**: Healthy subscriptions remain, failed ones are marked

#### 4.2 Subscription Cleanup
1. **Setup**: Create invalid subscription (expired endpoint)
2. **Action**: Wait for 3 health check failures
3. **Verify**: Check database for subscription removal
4. **Expected**: Invalid subscription is removed after 3 failures

### Test 5: Notification Confirmation

#### 5.1 Delivery Confirmation
1. **Setup**: Enable push notifications
2. **Action**: Receive prayer time notification
3. **Action**: Click on notification
4. **Verify**: Check database for `confirmedAt` timestamp
5. **Expected**: Notification marked as confirmed

#### 5.2 Retry Logic
1. **Setup**: Simulate notification delivery failure
2. **Action**: Wait for retry attempts
3. **Verify**: Check retry queue and exponential backoff
4. **Expected**: Notifications retried with increasing delays

### Test 6: Rate Limiting

#### 6.1 Anonymous User Limits
1. **Setup**: Make requests without authentication
2. **Action**: Exceed rate limit (1000 requests per hour)
3. **Verify**: Check for 429 status code
4. **Expected**: Rate limit enforced per IP

#### 6.2 Authenticated User Limits
1. **Setup**: Login and make authenticated requests
2. **Action**: Exceed rate limit (2000 requests per hour)
3. **Verify**: Check for 429 status code
4. **Expected**: Higher rate limit for authenticated users

#### 6.3 Per-User:IP Composite Keys
1. **Setup**: Two users from same IP
2. **Action**: Each user makes requests
3. **Verify**: Check rate limiting is per user, not per IP
4. **Expected**: Each user has separate rate limit bucket

## Environment Variables

Add these to your `.env` file:

```env
# JWT Token Configuration
JWT_EXPIRY_SHORT=24h
JWT_EXPIRY_LONG=90d
JWT_AUDIENCE=translator-backend
JWT_ISSUER=translator-backend
JWT_GRACE_SKEW_SECONDS=30

# Session Configuration
SESSION_SLIDING_WINDOW_THRESHOLD=0.5

# Authentication Feature Flags
AUTH_REMEMBER_ME_ENABLED=true
AUTH_SLIDING_RENEWAL_ENABLED=true
AUTH_REFRESH_ROTATION_HASHED_ENABLED=true
AUTH_CROSS_TAB_SYNC_ENABLED=true

# Push Notification Feature Flags
PUSH_SUBSCRIPTION_HEALTH_ENABLED=true
NOTIFY_DELIVERY_CONFIRMATION_ENABLED=true
NOTIFY_RETRY_BACKOFF_ENABLED=true
```

## API Endpoints

### Authentication
- `POST /api/auth-cookie/login` - Login with Remember Me support
- `POST /api/token/refresh` - Refresh access token with rotation
- `POST /api/token/validate` - Validate access token

### Notifications
- `POST /api/notifications/confirm` - Confirm notification delivery
- `GET /api/notifications/status/:notificationId` - Get notification status
- `GET /api/notifications/history/:userId` - Get notification history
- `POST /api/notifications/retry/:notificationId` - Manually retry notification

## Database Models

### Session Model
```javascript
{
  sessionId: String,
  userId: ObjectId,
  ip: String,
  userAgent: String,
  deviceInfo: Object,
  rememberMe: Boolean,
  isActive: Boolean,
  currentRefreshTokenHash: String,
  previousRefreshTokenHash: String,
  refreshTokenVersion: Number,
  refreshTokenRotatedAt: Date,
  revokedAt: Date
}
```

### NotificationHistory Model
```javascript
{
  userId: ObjectId,
  prayerName: String,
  notificationType: String,
  scheduledTime: Date,
  sentTime: Date,
  status: String,
  notificationId: String,
  confirmedAt: Date,
  retryCount: Number,
  retryScheduledFor: Date
}
```

### PushSubscription Model
```javascript
{
  userId: ObjectId,
  subscription: Object,
  tz: String,
  preferences: Object,
  location: Object,
  ua: String,
  expiresAt: Date,
  lastHealthCheck: Date,
  healthCheckFailures: Number
}
```

## Frontend Integration

### Required Scripts
Include these scripts in authenticated pages:

```html
<!-- Cross-tab sync and cache management -->
<script src="/js/cross-tab-sync.js"></script>
<script src="/js/cache-manager.js"></script>
<script src="/js/tokenManager.js"></script>
<script src="/js/prayer-time/api.js"></script>

<!-- Service Worker token relay -->
<script>
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      try {
        const data = event.data || {};
        if (data && data.type === 'GET_TOKEN' && event.ports && event.ports[0]) {
          const token = localStorage.getItem('accessToken') || null;
          event.ports[0].postMessage({ token });
        }
      } catch (err) {
        console.error('[Page] SW message handler error', err);
      }
    });
  }
</script>
```

## Troubleshooting

### Common Issues

1. **Remember Me not working**
   - Check if `AUTH_REMEMBER_ME_ENABLED=true` in environment
   - Verify session cookie `maxAge` is set correctly
   - Check browser cookie settings

2. **Cross-tab sync not working**
   - Verify `BroadcastChannel` is supported in browser
   - Check console for BroadcastChannel errors
   - Fallback to localStorage events should work

3. **Token renewal not working**
   - Check if `AUTH_SLIDING_RENEWAL_ENABLED=true`
   - Verify JWT secret is consistent
   - Check token expiration times

4. **Rate limiting too strict**
   - Adjust limits in `middleware/inMemoryRateLimiter.js`
   - Check if user is properly authenticated
   - Verify rate limit keys are correct

5. **Notifications not confirming**
   - Check Service Worker registration
   - Verify notification click handlers
   - Check database for confirmation records

## Performance Considerations

- **Memory Usage**: Rate limiters use LRU pruning to manage memory
- **Database**: Indexes on frequently queried fields
- **Caching**: Token validation results cached in memory
- **Cleanup**: Automatic cleanup of expired sessions and notifications

## Security Features

- **Token Rotation**: Refresh tokens rotated on each use
- **Reuse Detection**: Old refresh tokens invalidated immediately
- **Audience/Issuer Validation**: JWT claims verified
- **Rate Limiting**: Per-user:IP composite keys prevent abuse
- **Session Fixation Protection**: Session regenerated on login
- **CSRF Protection**: Double-submit cookie pattern

## Monitoring

### Logs to Monitor
- Authentication events
- Token renewal activities
- Rate limit violations
- Notification delivery status
- Subscription health check results

### Metrics to Track
- Login success/failure rates
- Token renewal frequency
- Cross-tab sync events
- Notification delivery rates
- Rate limit hit rates

## Conclusion

This Enhanced Session & Authentication System provides a robust, production-ready authentication solution with advanced features for user experience and security. The implementation follows security best practices and includes comprehensive monitoring and testing capabilities.

For questions or issues, refer to the troubleshooting section or check the server logs for detailed error information.

