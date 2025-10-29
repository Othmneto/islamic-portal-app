/**
 * Browser Detection and Feature Detection Utility
 * Detects browser type, OS, and notification support capabilities
 */

export class BrowserDetection {
  constructor() {
    this.browser = this.detectBrowser();
    this.os = this.detectOS();
    this.features = this.detectFeatures();
    this.capabilities = this.getBrowserCapabilities();
  }

  /**
   * Detect browser type and version
   * @returns {Object} Browser information
   */
  detectBrowser() {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    let engine = 'Unknown';

    // Check for Comet Browser (Windows browser)
    if (/Comet/i.test(ua)) {
      browserName = 'Comet';
      engine = 'Chromium';
      const match = ua.match(/Comet\/([\d.]+)/);
      if (match) browserVersion = match[1];
    }
    // Check for Edge (Chromium-based)
    else if (/Edg\//i.test(ua)) {
      browserName = 'Edge';
      engine = 'Chromium';
      const match = ua.match(/Edg\/([\d.]+)/);
      if (match) browserVersion = match[1];
    }
    // Check for Opera
    else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
      browserName = 'Opera';
      engine = 'Chromium';
      const match = ua.match(/OPR\/([\d.]+)/) || ua.match(/Opera\/([\d.]+)/);
      if (match) browserVersion = match[1];
    }
    // Check for Brave (harder to detect, uses Chrome UA)
    else if (navigator.brave && navigator.brave.isBrave) {
      browserName = 'Brave';
      engine = 'Chromium';
      const match = ua.match(/Chrome\/([\d.]+)/);
      if (match) browserVersion = match[1];
    }
    // Check for Chrome
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) {
      browserName = 'Chrome';
      engine = 'Chromium';
      const match = ua.match(/Chrome\/([\d.]+)/);
      if (match) browserVersion = match[1];
    }
    // Check for Safari
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
      browserName = 'Safari';
      engine = 'WebKit';
      const match = ua.match(/Version\/([\d.]+)/);
      if (match) browserVersion = match[1];
    }
    // Check for Firefox
    else if (/Firefox\//i.test(ua)) {
      browserName = 'Firefox';
      engine = 'Gecko';
      const match = ua.match(/Firefox\/([\d.]+)/);
      if (match) browserVersion = match[1];
    }

    return {
      name: browserName,
      version: browserVersion,
      engine: engine,
      isChromium: engine === 'Chromium',
      isSafari: browserName === 'Safari',
      isFirefox: browserName === 'Firefox'
    };
  }

  /**
   * Detect operating system
   * @returns {Object} OS information
   */
  detectOS() {
    const ua = navigator.userAgent;
    let osName = 'Unknown';
    let osVersion = 'Unknown';

    if (/Windows NT/i.test(ua)) {
      osName = 'Windows';
      const match = ua.match(/Windows NT ([\d.]+)/);
      if (match) {
        const ntVersion = match[1];
        // Map NT version to Windows version
        const versionMap = {
          '10.0': '10/11',
          '6.3': '8.1',
          '6.2': '8',
          '6.1': '7'
        };
        osVersion = versionMap[ntVersion] || ntVersion;
      }
    } else if (/Mac OS X/i.test(ua)) {
      osName = 'macOS';
      const match = ua.match(/Mac OS X ([\d_]+)/);
      if (match) osVersion = match[1].replace(/_/g, '.');
    } else if (/Linux/i.test(ua)) {
      osName = 'Linux';
    }

    return {
      name: osName,
      version: osVersion,
      isWindows: osName === 'Windows',
      isMacOS: osName === 'macOS',
      isLinux: osName === 'Linux'
    };
  }

  /**
   * Detect browser feature support
   * @returns {Object} Feature support information
   */
  detectFeatures() {
    return {
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      notification: 'Notification' in window,
      notificationPermission: this.getNotificationPermission(),
      indexedDB: 'indexedDB' in window,
      backgroundSync: 'sync' in (self?.registration || {}),
      vibrate: 'vibrate' in navigator,
      actions: this.supportsNotificationActions(),
      badge: this.supportsNotificationBadge(),
      requireInteraction: this.supportsRequireInteraction(),
      silent: this.supportsNotificationSilent()
    };
  }

  /**
   * Get current notification permission status
   * @returns {string} Permission status
   */
  getNotificationPermission() {
    if ('Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  }

  /**
   * Check if browser supports notification actions
   * @returns {boolean}
   */
  supportsNotificationActions() {
    // Safari doesn't support actions
    if (this.browser.isSafari) return false;
    // Firefox and Chromium browsers support actions
    return this.browser.isChromium || this.browser.isFirefox;
  }

  /**
   * Check if browser supports notification badge
   * @returns {boolean}
   */
  supportsNotificationBadge() {
    // Only Chromium browsers support badge
    return this.browser.isChromium;
  }

  /**
   * Check if browser supports requireInteraction
   * @returns {boolean}
   */
  supportsRequireInteraction() {
    // Safari has limited support
    if (this.browser.isSafari) return false;
    return true;
  }

  /**
   * Check if browser supports silent notifications
   * @returns {boolean}
   */
  supportsNotificationSilent() {
    // Most browsers support silent
    return true;
  }

  /**
   * Get browser-specific capabilities
   * @returns {Object} Capability configuration
   */
  getBrowserCapabilities() {
    const caps = {
      canShowNotifications: this.features.notification && this.features.pushManager,
      canBackgroundNotify: this.features.serviceWorker && this.features.pushManager,
      recommendedOptions: {},
      unsupportedFeatures: [],
      warnings: []
    };

    // Chromium-based browsers (Chrome, Edge, Opera, Brave, Comet)
    if (this.browser.isChromium) {
      caps.pushService = 'FCM';
      caps.endpointPattern = /^https:\/\/fcm\.googleapis\.com/;
      caps.recommendedOptions = {
        requireInteraction: true,
        vibrate: [200, 100, 200],
        badge: '/favicon.ico',
        actions: [
          { action: 'view', title: 'View Calendar', icon: '/favicon.ico' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      };
      caps.maxActions = 2;
      caps.backgroundNotificationsReliability = 'excellent';
    }
    // Firefox
    else if (this.browser.isFirefox) {
      caps.pushService = 'Mozilla Push';
      caps.endpointPattern = /^https:\/\/updates\.push\.services\.mozilla\.com/;
      caps.recommendedOptions = {
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [
          { action: 'view', title: 'View Calendar' },
          { action: 'dismiss', title: 'Dismiss' }
        ]
      };
      caps.maxActions = 2;
      caps.unsupportedFeatures = ['badge'];
      caps.backgroundNotificationsReliability = 'good';
      caps.warnings.push('Background notifications may be delayed when browser is fully closed');
    }
    // Safari
    else if (this.browser.isSafari) {
      caps.pushService = 'APNs';
      caps.endpointPattern = /^https:\/\/web\.push\.apple\.com/;
      caps.recommendedOptions = {
        // Safari has very limited options support
      };
      caps.maxActions = 0;
      caps.unsupportedFeatures = ['badge', 'actions', 'requireInteraction', 'vibrate'];
      caps.backgroundNotificationsReliability = 'limited';
      caps.warnings.push('Safari requires browser to be running for notifications');
      caps.warnings.push('Limited notification customization available');
      
      // Check Safari version for Web Push API support (Safari 16+)
      const safariVersion = parseInt(this.browser.version);
      if (safariVersion < 16) {
        caps.canShowNotifications = false;
        caps.canBackgroundNotify = false;
        caps.warnings.push('Safari 16 or later required for Web Push API support');
      }
    }
    // Unknown browser
    else {
      caps.pushService = 'Unknown';
      caps.recommendedOptions = {
        // Use minimal options for unknown browsers
      };
      caps.warnings.push('Browser compatibility not verified. Notifications may not work as expected.');
    }

    return caps;
  }

  /**
   * Get notification options adapted for current browser
   * @param {Object} baseOptions - Base notification options
   * @returns {Object} Browser-adapted notification options
   */
  adaptNotificationOptions(baseOptions) {
    const adapted = { ...baseOptions };
    const caps = this.capabilities;

    // Remove unsupported features
    if (caps.unsupportedFeatures.includes('badge')) {
      delete adapted.badge;
    }
    if (caps.unsupportedFeatures.includes('actions')) {
      delete adapted.actions;
    }
    if (caps.unsupportedFeatures.includes('requireInteraction')) {
      delete adapted.requireInteraction;
    }
    if (caps.unsupportedFeatures.includes('vibrate')) {
      delete adapted.vibrate;
    }

    // Limit actions to browser maximum
    if (adapted.actions && caps.maxActions !== undefined) {
      adapted.actions = adapted.actions.slice(0, caps.maxActions);
    }

    return adapted;
  }

  /**
   * Check if push endpoint matches expected format for this browser
   * @param {string} endpoint - Push subscription endpoint
   * @returns {boolean}
   */
  isValidEndpoint(endpoint) {
    if (!endpoint) return false;
    const caps = this.capabilities;
    if (!caps.endpointPattern) return true; // Unknown browser, allow any
    return caps.endpointPattern.test(endpoint);
  }

  /**
   * Get browser information summary for logging
   * @returns {Object} Browser summary
   */
  getSummary() {
    return {
      browser: `${this.browser.name} ${this.browser.version}`,
      os: `${this.os.name} ${this.os.version}`,
      engine: this.browser.engine,
      pushService: this.capabilities.pushService,
      canShowNotifications: this.capabilities.canShowNotifications,
      canBackgroundNotify: this.capabilities.canBackgroundNotify,
      notificationPermission: this.features.notificationPermission,
      warnings: this.capabilities.warnings,
      unsupportedFeatures: this.capabilities.unsupportedFeatures
    };
  }

  /**
   * Get user-friendly browser compatibility status
   * @returns {Object} Status information for UI display
   */
  getCompatibilityStatus() {
    const status = {
      level: 'unknown', // 'excellent', 'good', 'limited', 'unsupported'
      message: '',
      details: [],
      canEnable: this.capabilities.canShowNotifications
    };

    if (!this.features.notification || !this.features.pushManager) {
      status.level = 'unsupported';
      status.message = 'Your browser does not support push notifications';
      status.canEnable = false;
      return status;
    }

    if (this.browser.isSafari && parseInt(this.browser.version) < 16) {
      status.level = 'unsupported';
      status.message = 'Please upgrade to Safari 16 or later for notification support';
      status.canEnable = false;
      return status;
    }

    // Determine level based on reliability
    const reliability = this.capabilities.backgroundNotificationsReliability;
    if (reliability === 'excellent') {
      status.level = 'excellent';
      status.message = `${this.browser.name} fully supports prayer time notifications`;
    } else if (reliability === 'good') {
      status.level = 'good';
      status.message = `${this.browser.name} supports notifications with minor limitations`;
    } else if (reliability === 'limited') {
      status.level = 'limited';
      status.message = `${this.browser.name} has limited notification support`;
    } else {
      status.level = 'unknown';
      status.message = 'Notification support not verified for this browser';
    }

    // Add warnings and unsupported features to details
    status.details = [
      ...this.capabilities.warnings,
      ...this.capabilities.unsupportedFeatures.map(f => `${f} not supported`)
    ];

    return status;
  }
}

// Export singleton instance
export const browserDetection = new BrowserDetection();

// Log browser detection results on load
console.log('🌐 [BrowserDetection] Detected browser:', browserDetection.getSummary());






