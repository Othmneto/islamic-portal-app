/**
 * Notification Diagnostics Tool
 * Comprehensive testing and troubleshooting for desktop notifications
 */

export class NotificationDiagnostics {
  constructor() {
    this.results = [];
    this.platform = this.detectPlatform();
  }

  detectPlatform() {
    const ua = navigator.userAgent;
    const isWindows = /Windows/i.test(ua);
    const isMac = /Macintosh|Mac OS X/i.test(ua);
    const isLinux = /Linux/i.test(ua);

    let windowsVersion = null;
    if (isWindows) {
      if (/Windows NT 10\.0/i.test(ua)) {
        windowsVersion = 'Windows 10/11';
      } else if (/Windows NT 6\.3/i.test(ua)) {
        windowsVersion = 'Windows 8.1';
      } else if (/Windows NT 6\.2/i.test(ua)) {
        windowsVersion = 'Windows 8';
      } else if (/Windows NT 6\.1/i.test(ua)) {
        windowsVersion = 'Windows 7';
      }
    }

    return {
      os: isWindows ? 'Windows' : isMac ? 'macOS' : isLinux ? 'Linux' : 'Unknown',
      version: windowsVersion || (isMac ? 'macOS' : isLinux ? 'Linux' : 'Unknown'),
      isWindows,
      isMac,
      isLinux
    };
  }

  async runFullDiagnostics() {
    console.log('🔍 [NotificationDiagnostics] Starting comprehensive diagnostics...');
    
    this.results = [];
    
    // 1. Basic API Support
    await this.checkBasicSupport();
    
    // 2. Permission Status
    await this.checkPermissionStatus();
    
    // 3. Service Worker Status
    await this.checkServiceWorkerStatus();
    
    // 4. Push Subscription Status
    await this.checkPushSubscriptionStatus();
    
    // 5. Browser-Specific Tests
    await this.runBrowserSpecificTests();
    
    // 6. Platform-Specific Tests
    await this.runPlatformSpecificTests();
    
    // 7. Notification Display Test
    await this.testNotificationDisplay();
    
    return this.generateReport();
  }

  async checkBasicSupport() {
    const result = {
      test: 'Basic API Support',
      status: 'unknown',
      details: []
    };

    // Check Notification API
    if ('Notification' in window) {
      result.details.push('✅ Notification API available');
    } else {
      result.details.push('❌ Notification API not available');
      result.status = 'failed';
      return result;
    }

    // Check Service Worker
    if ('serviceWorker' in navigator) {
      result.details.push('✅ Service Worker API available');
    } else {
      result.details.push('❌ Service Worker API not available');
      result.status = 'failed';
      return result;
    }

    // Check Push Manager
    if ('PushManager' in window) {
      result.details.push('✅ Push Manager API available');
    } else {
      result.details.push('❌ Push Manager API not available');
      result.status = 'failed';
      return result;
    }

    result.status = 'passed';
    this.results.push(result);
  }

  async checkPermissionStatus() {
    const result = {
      test: 'Permission Status',
      status: 'unknown',
      details: []
    };

    const permission = Notification.permission;
    result.details.push(`Current permission: ${permission}`);

    if (permission === 'granted') {
      result.details.push('✅ Notifications are allowed');
      result.status = 'passed';
    } else if (permission === 'denied') {
      result.details.push('❌ Notifications are blocked');
      result.details.push('💡 Try: Browser Settings > Site Settings > Notifications');
      result.status = 'failed';
    } else {
      result.details.push('⚠️ Permission not requested yet');
      result.status = 'warning';
    }

    this.results.push(result);
  }

  async checkServiceWorkerStatus() {
    const result = {
      test: 'Service Worker Status',
      status: 'unknown',
      details: []
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          result.details.push('✅ Service Worker registered');
          result.details.push(`Active: ${registration.active ? 'Yes' : 'No'}`);
          result.details.push(`Installing: ${registration.installing ? 'Yes' : 'No'}`);
          result.details.push(`Waiting: ${registration.waiting ? 'Yes' : 'No'}`);
          result.status = 'passed';
        } else {
          result.details.push('❌ No Service Worker registered');
          result.status = 'failed';
        }
      } else {
        result.details.push('❌ Service Worker not supported');
        result.status = 'failed';
      }
    } catch (error) {
      result.details.push(`❌ Error checking Service Worker: ${error.message}`);
      result.status = 'failed';
    }

    this.results.push(result);
  }

  async checkPushSubscriptionStatus() {
    const result = {
      test: 'Push Subscription Status',
      status: 'unknown',
      details: []
    };

    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            result.details.push('✅ Push subscription exists');
            result.details.push(`Endpoint: ${subscription.endpoint.substring(0, 50)}...`);
            result.details.push(`Expires: ${subscription.expirationTime ? new Date(subscription.expirationTime) : 'Never'}`);
            result.status = 'passed';
          } else {
            result.details.push('❌ No push subscription found');
            result.status = 'failed';
          }
        } else {
          result.details.push('❌ No Service Worker to check subscription');
          result.status = 'failed';
        }
      } else {
        result.details.push('❌ Push API not supported');
        result.status = 'failed';
      }
    } catch (error) {
      result.details.push(`❌ Error checking subscription: ${error.message}`);
      result.status = 'failed';
    }

    this.results.push(result);
  }

  async runBrowserSpecificTests() {
    const result = {
      test: 'Browser-Specific Tests',
      status: 'unknown',
      details: []
    };

    const ua = navigator.userAgent;
    
    // Detect browser
    let browserName = 'Unknown';
    if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) {
      browserName = 'Chrome';
      if (/Comet/i.test(ua)) browserName = 'Comet';
      if (/Brave/i.test(ua)) browserName = 'Brave';
      if (/Opera|OPR\//i.test(ua)) browserName = 'Opera';
    } else if (/Firefox/i.test(ua)) {
      browserName = 'Firefox';
    } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
      browserName = 'Safari';
    } else if (/Edg\//i.test(ua)) {
      browserName = 'Edge';
    }

    result.details.push(`Browser: ${browserName}`);

    // Browser-specific checks
    if (browserName === 'Comet') {
      result.details.push('🔍 Comet Browser detected - checking for specific issues...');
      result.details.push('💡 Comet may have additional notification restrictions');
      result.details.push('💡 Check Comet Settings > Privacy & Security > Notifications');
    } else if (browserName === 'Firefox') {
      result.details.push('🔍 Firefox detected - checking notification support...');
      result.details.push('💡 Firefox notifications work but may be delayed when browser is closed');
    } else if (browserName === 'Safari') {
      result.details.push('🔍 Safari detected - checking Web Push support...');
      result.details.push('💡 Safari Web Push requires macOS Ventura (13) or later');
    }

    result.status = 'passed';
    this.results.push(result);
  }

  async runPlatformSpecificTests() {
    const result = {
      test: 'Platform-Specific Tests',
      status: 'unknown',
      details: []
    };

    result.details.push(`Platform: ${this.platform.os} ${this.platform.version}`);

    if (this.platform.isWindows) {
      result.details.push('🔍 Windows-specific checks:');
      result.details.push('💡 Check Windows Settings > System > Notifications & actions');
      result.details.push('💡 Check Focus Assist settings (may block notifications)');
      result.details.push('💡 Check if browser is in "Do Not Disturb" mode');
      result.details.push('💡 Try: Windows + A to open Action Center and check notification settings');
    } else if (this.platform.isMac) {
      result.details.push('🔍 macOS-specific checks:');
      result.details.push('💡 Check System Preferences > Notifications & Focus');
      result.details.push('💡 Check if Do Not Disturb is enabled');
      result.details.push('💡 Check Notification Center settings');
    } else if (this.platform.isLinux) {
      result.details.push('🔍 Linux-specific checks:');
      result.details.push('💡 Check desktop environment notification settings');
      result.details.push('💡 Some Linux distributions have limited notification support');
    }

    result.status = 'passed';
    this.results.push(result);
  }

  async testNotificationDisplay() {
    const result = {
      test: 'Notification Display Test',
      status: 'unknown',
      details: []
    };

    try {
      if (Notification.permission === 'granted') {
        result.details.push('🔔 Testing notification display...');
        
        // Create a test notification
        const testNotification = new Notification('🔍 Diagnostic Test', {
          body: 'If you can see this notification, the system is working!',
          icon: '/favicon.ico',
          tag: 'diagnostic-test',
          requireInteraction: true
        });

        testNotification.onclick = () => {
          result.details.push('✅ Notification was clicked - user interaction works');
          testNotification.close();
        };

        testNotification.onshow = () => {
          result.details.push('✅ Notification was displayed successfully');
        };

        testNotification.onerror = (error) => {
          result.details.push(`❌ Notification error: ${error.message || 'Unknown error'}`);
        };

        // Close after 5 seconds
        setTimeout(() => {
          testNotification.close();
        }, 5000);

        result.status = 'passed';
      } else {
        result.details.push('❌ Cannot test notification display - permission not granted');
        result.status = 'failed';
      }
    } catch (error) {
      result.details.push(`❌ Error testing notification: ${error.message}`);
      result.status = 'failed';
    }

    this.results.push(result);
  }

  generateReport() {
    const report = {
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'passed').length,
        failed: this.results.filter(r => r.status === 'failed').length,
        warnings: this.results.filter(r => r.status === 'warning').length
      },
      results: this.results,
      recommendations: this.generateRecommendations()
    };

    console.log('📊 [NotificationDiagnostics] Diagnostic Report:', report);
    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    const failedTests = this.results.filter(r => r.status === 'failed');
    const warningTests = this.results.filter(r => r.status === 'warning');

    if (failedTests.length > 0) {
      recommendations.push('🚨 Critical Issues Found:');
      failedTests.forEach(test => {
        recommendations.push(`- ${test.test}: ${test.details.join(', ')}`);
      });
    }

    if (warningTests.length > 0) {
      recommendations.push('⚠️ Warnings:');
      warningTests.forEach(test => {
        recommendations.push(`- ${test.test}: ${test.details.join(', ')}`);
      });
    }

    // Platform-specific recommendations
    if (this.platform.isWindows) {
      recommendations.push('🪟 Windows-Specific Fixes:');
      recommendations.push('1. Press Windows + I to open Settings');
      recommendations.push('2. Go to System > Notifications & actions');
      recommendations.push('3. Make sure "Get notifications from apps and other senders" is ON');
      recommendations.push('4. Check Focus Assist settings (Windows + A)');
      recommendations.push('5. Try disabling "Do Not Disturb" mode');
    }

    if (this.results.some(r => r.test === 'Browser-Specific Tests' && r.details.some(d => d.includes('Comet')))) {
      recommendations.push('🌠 Comet Browser-Specific Fixes:');
      recommendations.push('1. Open Comet Browser');
      recommendations.push('2. Go to Settings > Privacy & Security');
      recommendations.push('3. Check Notification settings');
      recommendations.push('4. Make sure notifications are allowed for this site');
      recommendations.push('5. Try refreshing the page after changing settings');
    }

    return recommendations;
  }
}