/**
 * Smart Timezone Detection Module
 *
 * Features:
 * - Automatic timezone detection and updates
 * - Manual timezone selection
 * - Timezone change notifications
 * - Travel mode detection
 * - Timezone analytics
 */

export class SmartTimezone {
  constructor(core, api) {
    console.log("[SmartTimezone] Initializing SmartTimezone");
    this.core = core;
    this.api = api;
    this.currentTimezone = null;
    this.timezoneDetectionEnabled = true;
    this.lastLocationCheck = null;
    this.locationCheckInterval = 5 * 60 * 1000; // Check every 5 minutes
    this.travelDetectionThreshold = 100; // 100km threshold for travel detection
  }

  /**
   * Initialize smart timezone detection
   */
  async initialize() {
    try {
      console.log("[SmartTimezone] Initializing smart timezone detection");

      // Get current timezone status
      await this.loadTimezoneStatus();

      // Set up periodic location checks if enabled
      if (this.timezoneDetectionEnabled) {
        this.startPeriodicLocationChecks();
      }

      // Set up UI elements
      this.setupUI();

      console.log("[SmartTimezone] Smart timezone detection initialized");
    } catch (error) {
      console.error("[SmartTimezone] Error initializing:", error);
    }
  }

  /**
   * Load current timezone status from server
   */
  async loadTimezoneStatus() {
    try {
      const response = await this.api.apiFetch("/api/timezone/status");

      if (response.success) {
        this.currentTimezone = response.status.currentTimezone;
        this.timezoneDetectionEnabled = response.status.detectionEnabled;

        console.log(`[SmartTimezone] Current timezone: ${this.currentTimezone}`);
        console.log(`[SmartTimezone] Detection enabled: ${this.timezoneDetectionEnabled}`);

        // Update UI with current status
        this.updateTimezoneDisplay();
      }
    } catch (error) {
      console.error("[SmartTimezone] Error loading timezone status:", error);
    }
  }

  /**
   * Set up UI elements for timezone management
   */
  setupUI() {
    // Add timezone management to settings panel
    this.addTimezoneSettingsToUI();

    // Add timezone indicator to prayer times display
    this.addTimezoneIndicator();

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Add timezone settings to the settings panel
   */
  addTimezoneSettingsToUI() {
    const settingsPanel = document.getElementById('settings-panel');
    if (!settingsPanel) return;

    // Check if timezone settings already exist
    if (document.getElementById('timezone-settings')) return;

    const timezoneSettings = document.createElement('div');
    timezoneSettings.id = 'timezone-settings';
    timezoneSettings.className = 'settings-section';
    timezoneSettings.innerHTML = `
      <h3>🌍 Smart Timezone Detection</h3>
      <div class="setting-item">
        <label class="setting-label">
          <input type="checkbox" id="timezone-detection-toggle" ${this.timezoneDetectionEnabled ? 'checked' : ''}>
          <span class="setting-text">Enable automatic timezone detection</span>
        </label>
        <p class="setting-description">Automatically detect and update your timezone when you travel</p>
      </div>
      
      <div class="setting-item">
        <label class="setting-label">Current Timezone</label>
        <div class="timezone-display">
          <span id="current-timezone-display">${this.currentTimezone || 'Unknown'}</span>
          <button id="timezone-change-btn" class="btn btn-sm">Change</button>
        </div>
      </div>
      
      <div class="setting-item">
        <button id="force-timezone-check" class="btn btn-sm">Check Timezone Now</button>
        <button id="timezone-analytics-btn" class="btn btn-sm">View Analytics</button>
      </div>
    `;

    // Insert after prayer settings
    const prayerSettings = settingsPanel.querySelector('.settings-section');
    if (prayerSettings) {
      prayerSettings.insertAdjacentElement('afterend', timezoneSettings);
    } else {
      settingsPanel.appendChild(timezoneSettings);
    }
  }

  /**
   * Add timezone indicator to prayer times display
   */
  addTimezoneIndicator() {
    const prayerTimesContainer = document.getElementById('prayer-times-container');
    if (!prayerTimesContainer) return;

    // Check if timezone indicator already exists
    if (document.getElementById('timezone-indicator')) return;

    const timezoneIndicator = document.createElement('div');
    timezoneIndicator.id = 'timezone-indicator';
    timezoneIndicator.className = 'timezone-indicator';
    timezoneIndicator.innerHTML = `
      <div class="timezone-info">
        <span class="timezone-icon">🌍</span>
        <span class="timezone-text">${this.currentTimezone || 'Unknown'}</span>
        ${this.timezoneDetectionEnabled ? '<span class="auto-detection-badge">AUTO</span>' : ''}
      </div>
    `;

    // Insert at the top of prayer times container
    prayerTimesContainer.insertBefore(timezoneIndicator, prayerTimesContainer.firstChild);
  }

  /**
   * Set up event listeners for timezone management
   */
  setupEventListeners() {
    // Timezone detection toggle
    const detectionToggle = document.getElementById('timezone-detection-toggle');
    if (detectionToggle) {
      detectionToggle.addEventListener('change', (e) => {
        this.toggleTimezoneDetection(e.target.checked);
      });
    }

    // Force timezone check
    const forceCheckBtn = document.getElementById('force-timezone-check');
    if (forceCheckBtn) {
      forceCheckBtn.addEventListener('click', () => {
        this.forceTimezoneCheck();
      });
    }

    // Timezone change button
    const changeBtn = document.getElementById('timezone-change-btn');
    if (changeBtn) {
      changeBtn.addEventListener('click', () => {
        this.showTimezoneSelector();
      });
    }

    // Timezone analytics button
    const analyticsBtn = document.getElementById('timezone-analytics-btn');
    if (analyticsBtn) {
      analyticsBtn.addEventListener('click', () => {
        this.showTimezoneAnalytics();
      });
    }
  }

  /**
   * Toggle timezone detection on/off
   */
  async toggleTimezoneDetection(enabled) {
    try {
      const endpoint = enabled ? '/api/timezone/enable' : '/api/timezone/disable';
      const response = await this.api.apiFetch(endpoint, { method: 'POST' });

      if (response.success) {
        this.timezoneDetectionEnabled = enabled;

        if (enabled) {
          this.startPeriodicLocationChecks();
          this.core.toast('Timezone detection enabled', 'success');
        } else {
          this.stopPeriodicLocationChecks();
          this.core.toast('Timezone detection disabled', 'info');
        }

        this.updateTimezoneDisplay();
      } else {
        this.core.toast('Failed to update timezone detection', 'error');
      }
    } catch (error) {
      console.error("[SmartTimezone] Error toggling timezone detection:", error);
      this.core.toast('Failed to update timezone detection', 'error');
    }
  }

  /**
   * Force timezone check
   */
  async forceTimezoneCheck() {
    try {
      this.core.toast('Checking timezone...', 'info');

      const response = await this.api.apiFetch('/api/timezone/check', { method: 'POST' });

      if (response.success) {
        this.core.toast('Timezone check completed', 'success');
        // Reload timezone status
        await this.loadTimezoneStatus();
      } else {
        this.core.toast('Timezone check failed', 'error');
      }
    } catch (error) {
      console.error("[SmartTimezone] Error forcing timezone check:", error);
      this.core.toast('Timezone check failed', 'error');
    }
  }

  /**
   * Show timezone selector modal
   */
  async showTimezoneSelector() {
    try {
      // Get supported timezones
      const response = await this.api.apiFetch('/api/timezone/supported');

      if (!response.success) {
        this.core.toast('Failed to load timezones', 'error');
        return;
      }

      const timezones = response.timezones;

      // Create timezone selector modal
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content timezone-selector">
          <div class="modal-header">
            <h3>Select Timezone</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="timezone-search">
              <input type="text" id="timezone-search" placeholder="Search timezones..." class="form-control">
            </div>
            <div class="timezone-list" id="timezone-list">
              ${timezones.map(tz => `
                <div class="timezone-item ${tz.value === this.currentTimezone ? 'selected' : ''}" data-timezone="${tz.value}">
                  <div class="timezone-name">${tz.label}</div>
                  <div class="timezone-offset">${tz.offset > 0 ? '+' : ''}${tz.offset}:00</div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary modal-cancel">Cancel</button>
            <button class="btn btn-primary modal-confirm" disabled>Select Timezone</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Set up event listeners
      const searchInput = modal.querySelector('#timezone-search');
      const timezoneList = modal.querySelector('#timezone-list');
      const timezoneItems = modal.querySelectorAll('.timezone-item');
      const confirmBtn = modal.querySelector('.modal-confirm');
      const cancelBtn = modal.querySelector('.modal-cancel');
      const closeBtn = modal.querySelector('.modal-close');

      let selectedTimezone = null;

      // Search functionality
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        timezoneItems.forEach(item => {
          const timezoneName = item.querySelector('.timezone-name').textContent.toLowerCase();
          if (timezoneName.includes(searchTerm)) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      });

      // Timezone selection
      timezoneItems.forEach(item => {
        item.addEventListener('click', () => {
          timezoneItems.forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedTimezone = item.dataset.timezone;
          confirmBtn.disabled = false;
        });
      });

      // Confirm selection
      confirmBtn.addEventListener('click', async () => {
        if (selectedTimezone) {
          await this.updateTimezone(selectedTimezone);
          modal.remove();
        }
      });

      // Cancel
      cancelBtn.addEventListener('click', () => {
        modal.remove();
      });

      closeBtn.addEventListener('click', () => {
        modal.remove();
      });

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });

    } catch (error) {
      console.error("[SmartTimezone] Error showing timezone selector:", error);
      this.core.toast('Failed to load timezone selector', 'error');
    }
  }

  /**
   * Update timezone
   */
  async updateTimezone(timezone) {
    try {
      this.core.toast('Updating timezone...', 'info');

      const response = await this.api.apiFetch('/api/timezone/update', {
        method: 'POST',
        body: JSON.stringify({ timezone })
      });

      if (response.success) {
        this.currentTimezone = timezone;
        this.core.toast(`Timezone updated to ${response.timezoneDisplayName}`, 'success');
        this.updateTimezoneDisplay();

        // Trigger prayer times refresh
        if (this.core.state.locationData) {
          this.core.refreshPrayerTimesByLocation?.(this.core.state.locationData);
        }
      } else {
        this.core.toast('Failed to update timezone', 'error');
      }
    } catch (error) {
      console.error("[SmartTimezone] Error updating timezone:", error);
      this.core.toast('Failed to update timezone', 'error');
    }
  }

  /**
   * Show timezone analytics
   */
  async showTimezoneAnalytics() {
    try {
      const response = await this.api.apiFetch('/api/timezone/analytics');

      if (!response.success) {
        this.core.toast('No timezone analytics available', 'info');
        return;
      }

      const analytics = response.analytics;

      // Create analytics modal
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content timezone-analytics">
          <div class="modal-header">
            <h3>Timezone Analytics</h3>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="analytics-stats">
              <div class="stat-item">
                <div class="stat-label">Current Timezone</div>
                <div class="stat-value">${analytics.currentTimezone}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Total Timezones Used</div>
                <div class="stat-value">${analytics.totalTimezones}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Most Used Timezone</div>
                <div class="stat-value">${analytics.mostUsedTimezone || 'N/A'}</div>
              </div>
            </div>
            
            <div class="timezone-history">
              <h4>Timezone History</h4>
              <div class="history-list">
                ${analytics.timezoneHistory.map(entry => `
                  <div class="history-item">
                    <div class="timezone-name">${entry.timezone}</div>
                    <div class="timezone-details">
                      <span class="count">Used ${entry.count} times</span>
                      <span class="last-seen">Last seen: ${new Date(entry.lastSeen).toLocaleDateString()}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary modal-close">Close</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Set up event listeners
      const closeBtn = modal.querySelector('.modal-close');
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });

    } catch (error) {
      console.error("[SmartTimezone] Error showing timezone analytics:", error);
      this.core.toast('Failed to load timezone analytics', 'error');
    }
  }

  /**
   * Start periodic location checks
   */
  startPeriodicLocationChecks() {
    if (this.locationCheckIntervalId) {
      clearInterval(this.locationCheckIntervalId);
    }

    this.locationCheckIntervalId = setInterval(() => {
      this.checkLocationForTimezoneChange();
    }, this.locationCheckInterval);
  }

  /**
   * Stop periodic location checks
   */
  stopPeriodicLocationChecks() {
    if (this.locationCheckIntervalId) {
      clearInterval(this.locationCheckIntervalId);
      this.locationCheckIntervalId = null;
    }
  }

  /**
   * Check location for timezone changes
   */
  async checkLocationForTimezoneChange() {
    try {
      // Get current location
      const location = await this.getCurrentLocation();
      if (!location) return;

      // Check if we've moved significantly
      if (this.lastLocationCheck) {
        const distance = this.calculateDistance(
          this.lastLocationCheck.lat,
          this.lastLocationCheck.lon,
          location.lat,
          location.lon
        );

        if (distance < this.travelDetectionThreshold) {
          return; // Not far enough to trigger timezone change
        }
      }

      // Update last location check
      this.lastLocationCheck = location;

      // Force timezone check
      await this.forceTimezoneCheck();

    } catch (error) {
      console.error("[SmartTimezone] Error checking location for timezone change:", error);
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.warn("[SmartTimezone] Geolocation error:", error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  /**
   * Calculate distance between two coordinates (in km)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Update timezone display in UI
   */
  updateTimezoneDisplay() {
    // Update timezone indicator
    const timezoneText = document.querySelector('.timezone-text');
    if (timezoneText) {
      timezoneText.textContent = this.currentTimezone || 'Unknown';
    }

    // Update timezone display in settings
    const timezoneDisplay = document.getElementById('current-timezone-display');
    if (timezoneDisplay) {
      timezoneDisplay.textContent = this.currentTimezone || 'Unknown';
    }

    // Update auto-detection badge
    const autoBadge = document.querySelector('.auto-detection-badge');
    if (autoBadge) {
      autoBadge.style.display = this.timezoneDetectionEnabled ? 'inline' : 'none';
    }

    // Update detection toggle
    const detectionToggle = document.getElementById('timezone-detection-toggle');
    if (detectionToggle) {
      detectionToggle.checked = this.timezoneDetectionEnabled;
    }
  }

  /**
   * Handle timezone change notification
   */
  handleTimezoneChangeNotification(notification) {
    console.log("[SmartTimezone] Timezone change notification received:", notification);

    // Update current timezone
    this.currentTimezone = notification.data?.newTimezone || this.currentTimezone;

    // Update UI
    this.updateTimezoneDisplay();

    // Show notification
    this.core.toast(
      `Timezone updated to ${notification.data?.newTimezone || 'new timezone'}`,
      'success'
    );
  }
}

export default SmartTimezone;
