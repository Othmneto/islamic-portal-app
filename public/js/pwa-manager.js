/**
 * PWA Installation Manager
 * Handles PWA installation prompts and updates
 */

class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isStandalone = false;
    
    this.init();
  }

  init() {
    console.log('📱 [PWA] Initializing PWA manager');
    
    this.checkInstallationStatus();
    this.setupInstallationListeners();
    this.setupUpdateListeners();
    this.setupServiceWorker();
  }

  checkInstallationStatus() {
    // Check if app is running in standalone mode
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone ||
                       document.referrer.includes('android-app://');
    
    // Check if app is already installed
    this.isInstalled = this.isStandalone || 
                      localStorage.getItem('pwa-installed') === 'true';
    
    console.log('📱 [PWA] Installation status:', {
      isInstalled: this.isInstalled,
      isStandalone: this.isStandalone
    });
  }

  setupInstallationListeners() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log('📱 [PWA] Install prompt available');
      
      // Prevent the mini-infobar from appearing on mobile
      event.preventDefault();
      
      // Stash the event so it can be triggered later
      this.deferredPrompt = event;
      
      // Show install button
      this.showInstallButton();
    });

    // Listen for appinstalled event
    window.addEventListener('appinstalled', () => {
      console.log('✅ [PWA] App installed successfully');
      
      this.isInstalled = true;
      this.isStandalone = true;
      localStorage.setItem('pwa-installed', 'true');
      
      // Hide install button
      this.hideInstallButton();
      
      // Show success message
      this.showInstallSuccessMessage();
    });
  }

  setupUpdateListeners() {
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 [PWA] Service worker updated');
        this.showUpdateAvailableMessage();
      });
    }
  }

  async setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        console.log('🔧 [PWA] Registering service worker');
        
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ [PWA] Service worker registered:', registration);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          console.log('🔄 [PWA] Update found');
          this.showUpdateAvailableMessage();
        });
        
      } catch (error) {
        console.error('❌ [PWA] Service worker registration failed:', error);
      }
    }
  }

  showInstallButton() {
    // Create install button if it doesn't exist
    let installButton = document.getElementById('pwa-install-button');
    
    if (!installButton) {
      installButton = document.createElement('button');
      installButton.id = 'pwa-install-button';
      installButton.className = 'btn primary pwa-install-btn';
      installButton.innerHTML = '<i class="fa-solid fa-download"></i> Install App';
      
      // Add to toolbar
      const toolbar = document.querySelector('.toolbar');
      if (toolbar) {
        toolbar.appendChild(installButton);
      }
      
      // Add click handler
      installButton.addEventListener('click', () => {
        this.installApp();
      });
    }
    
    installButton.style.display = 'inline-block';
  }

  hideInstallButton() {
    const installButton = document.getElementById('pwa-install-button');
    if (installButton) {
      installButton.style.display = 'none';
    }
  }

  async installApp() {
    if (!this.deferredPrompt) {
      console.log('❌ [PWA] No install prompt available');
      return;
    }

    try {
      console.log('📱 [PWA] Showing install prompt');
      
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log('📱 [PWA] Install prompt outcome:', outcome);
      
      if (outcome === 'accepted') {
        console.log('✅ [PWA] User accepted install prompt');
      } else {
        console.log('❌ [PWA] User dismissed install prompt');
      }
      
      // Clear the deferred prompt
      this.deferredPrompt = null;
      
    } catch (error) {
      console.error('❌ [PWA] Error showing install prompt:', error);
    }
  }

  showInstallSuccessMessage() {
    this.showNotification('App installed successfully! You can now use it offline.', 'success');
  }

  showUpdateAvailableMessage() {
    const updateButton = document.createElement('button');
    updateButton.className = 'btn primary pwa-update-btn';
    updateButton.innerHTML = '<i class="fa-solid fa-sync"></i> Update Available';
    updateButton.onclick = () => {
      this.updateApp();
    };
    
    // Show as notification or add to UI
    this.showNotification('Update available! Click to refresh.', 'info', updateButton);
  }

  async updateApp() {
    try {
      console.log('🔄 [PWA] Updating app');
      
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        
        if (registration && registration.waiting) {
          // Tell the waiting service worker to skip waiting
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Reload the page
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('❌ [PWA] Error updating app:', error);
    }
  }

  showNotification(message, type = 'info', actionButton = null) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `pwa-notification pwa-notification-${type}`;
    notification.innerHTML = `
      <div class="pwa-notification-content">
        <span class="pwa-notification-message">${message}</span>
        ${actionButton ? actionButton.outerHTML : ''}
        <button class="pwa-notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // Check if app can be installed
  canInstall() {
    return this.deferredPrompt !== null && !this.isInstalled;
  }

  // Get installation status
  getInstallationStatus() {
    return {
      isInstalled: this.isInstalled,
      isStandalone: this.isStandalone,
      canInstall: this.canInstall()
    };
  }

  // Request notification permission
  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('🔔 [PWA] Notification permission:', permission);
      return permission === 'granted';
    }
    return false;
  }

  // Subscribe to push notifications
  async subscribeToPushNotifications() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('❌ [PWA] Push notifications not supported');
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          'BEl62iUYgUivxIkv69yViEuiBIa40HI0YyQONN6X4BQ'
        )
      });

      console.log('🔔 [PWA] Push subscription created:', subscription);
      return subscription;
    } catch (error) {
      console.error('❌ [PWA] Error subscribing to push notifications:', error);
      return null;
    }
  }

  // Convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Share content
  async shareContent(data) {
    if (navigator.share) {
      try {
        await navigator.share(data);
        console.log('📤 [PWA] Content shared successfully');
      } catch (error) {
        console.error('❌ [PWA] Error sharing content:', error);
      }
    } else {
      console.log('❌ [PWA] Web Share API not supported');
    }
  }

  // Get device info
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      onLine: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack
    };
  }
}

// Export for global use
if (typeof window !== 'undefined') {
  window.PWAManager = PWAManager;
}





