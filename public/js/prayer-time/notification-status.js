class NotificationStatusDashboard {
  constructor(core, api) {
    this.core = core;
    this.api = api;
    this.socket = null;
    this.isCollapsed = localStorage.getItem('statusPanelCollapsed') === 'true';
    this.updateInterval = null;
    this.lastUpdateTime = 0;
    this.updateThrottle = 5000; // Minimum 5 seconds between updates
    this.isUpdating = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second delay
  }

  async initialize() {
    console.log('[NotificationStatus] Initializing dashboard');

    // Setup UI
    this.setupUI();

    // Connect WebSocket
    await this.connectWebSocket();

    // Load initial data
    await this.loadCurrentStatus();
    await this.loadHistory();

    // Setup periodic updates (fallback if WebSocket fails)
    this.updateInterval = setInterval(() => {
      if (!this.socket || !this.socket.connected) {
        this.throttledLoadCurrentStatus();
      }
    }, 5 * 60 * 1000); // Update every 5 minutes (less aggressive)
  }

  setupUI() {
    const toggle = document.getElementById('statusPanelToggle');
    const content = document.getElementById('statusContent');

    if (this.isCollapsed) {
      content.classList.add('collapsed');
      toggle.classList.add('collapsed');
    }

    toggle?.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      content.classList.toggle('collapsed');
      toggle.classList.toggle('collapsed');
      localStorage.setItem('statusPanelCollapsed', this.isCollapsed);
    });
  }

  async connectWebSocket() {
    try {
      const token = this.api?.getAuthToken();
      if (!token) {
        console.warn('[NotificationStatus] No auth token for WebSocket');
        return;
      }

      // Check if socket.io is available
      if (typeof io === 'undefined') {
        console.warn('[NotificationStatus] Socket.IO not available, using polling only');
        this.updateConnectionStatus('disconnected');
        return;
      }

      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      this.socket = io({
        path: '/socket.io/',
        auth: { token },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        console.log('[NotificationStatus] WebSocket connected');
        this.updateConnectionStatus('connected');
        this.reconnectAttempts = 0; // Reset on successful connection
        this.reconnectDelay = 1000; // Reset delay
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[NotificationStatus] WebSocket disconnected:', reason);
        this.updateConnectionStatus('disconnected');

        // Only attempt reconnection for certain disconnect reasons
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          // Server or client initiated disconnect, don't auto-reconnect
          return;
        }

        // For other reasons (network issues), attempt reconnection
        this.attemptReconnection();
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('[NotificationStatus] WebSocket reconnected after', attemptNumber, 'attempts');
        this.updateConnectionStatus('connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      });

      this.socket.on('reconnect_error', (error) => {
        console.warn('[NotificationStatus] WebSocket reconnection error:', error);
        this.updateConnectionStatus('disconnected');
      });

      this.socket.on('reconnect_failed', () => {
        console.error('[NotificationStatus] WebSocket reconnection failed after maximum attempts');
        this.updateConnectionStatus('disconnected');
      });

      this.socket.on('scheduleUpdate', (data) => {
        console.log('[NotificationStatus] Schedule updated', data);
        this.updateScheduleDisplay(data);
      });

      this.socket.on('notificationStatus', (data) => {
        console.log('[NotificationStatus] Notification status', data);
        this.addHistoryItem(data);
      });

    } catch (error) {
      console.error('[NotificationStatus] WebSocket error:', error);
      this.updateConnectionStatus('disconnected');
    }
  }

  async loadCurrentStatus() {
    try {
      const token = this.api?.getAuthToken();
      if (!token) {
        console.warn('[NotificationStatus] No auth token available');
        return;
      }

      console.log('[NotificationStatus] Loading current status...');
      const response = await fetch('/api/notification-status/current', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('[NotificationStatus] Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[NotificationStatus] Received data:', data);
        this.updateScheduleDisplay(data.schedule);
      } else {
        console.error('[NotificationStatus] API error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('[NotificationStatus] Error loading status:', error);
    }
  }

  async throttledLoadCurrentStatus() {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottle) {
      console.log('[NotificationStatus] Throttling status update - too soon');
      return;
    }

    if (this.isUpdating) {
      console.log('[NotificationStatus] Update already in progress - skipping');
      return;
    }

    this.isUpdating = true;
    this.lastUpdateTime = now;

    try {
      await this.loadCurrentStatus();
    } finally {
      this.isUpdating = false;
    }
  }

  async throttledLoadStats() {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottle) {
      console.log('[NotificationStatus] Throttling stats update - too soon');
      return;
    }

    await this.loadStats();
  }

  attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[NotificationStatus] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[NotificationStatus] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(() => {
      this.connectWebSocket();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
  }

  async loadHistory() {
    try {
      const token = this.api?.getAuthToken();
      if (!token) {
        console.warn('[NotificationStatus] No auth token for history');
        return;
      }

      console.log('[NotificationStatus] Loading history with token:', token.substring(0, 20) + '...');
      const response = await fetch('/api/notification-status/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('[NotificationStatus] History response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[NotificationStatus] History data received:', data);
        this.displayHistory(data.history);
      } else {
        const errorText = await response.text();
        console.error('[NotificationStatus] History API error:', response.status, errorText);
      }
    } catch (error) {
      console.error('[NotificationStatus] Error loading history:', error);
    }
  }

  displayHistory(history) {
    console.log('[NotificationStatus] Displaying history:', history);
    const listEl = document.getElementById('historyList');
    if (!listEl) {
      console.error('[NotificationStatus] History list element not found');
      return;
    }

    if (!history || history.length === 0) {
      console.log('[NotificationStatus] No history data, showing empty message');
      listEl.innerHTML = '<div class="no-history">No notifications in the last 24 hours</div>';
      return;
    }

    console.log('[NotificationStatus] Rendering', history.length, 'history items');
    listEl.innerHTML = history.map(item => `
      <div class="history-item ${item.status}">
        <div class="history-item-header">
          <span class="history-item-prayer">${item.prayerName}</span>
          <span class="history-item-time">${new Date(item.sentTime).toLocaleTimeString()}</span>
        </div>
        <div class="history-item-type">${item.notificationType} - ${item.status}</div>
        ${item.error ? `<div class="history-item-error">${item.error}</div>` : ''}
      </div>
    `).join('');
  }

  addHistoryItem(item) {
    const listEl = document.getElementById('historyList');
    if (!listEl) return;

    // Create unique identifier for the notification
    const notificationId = `${item.prayerName}-${item.notificationType}-${item.sentTime}`;

    // Check if we've already processed this notification
    if (this.processedNotifications && this.processedNotifications.has(notificationId)) {
      console.log('[NotificationStatus] Duplicate notification ignored:', notificationId);
      return;
    }

    // Initialize processedNotifications if not exists
    if (!this.processedNotifications) {
      this.processedNotifications = new Set();
    }

    // Add to processed set
    this.processedNotifications.add(notificationId);

    // Clean up old processed notifications (keep only last 50)
    if (this.processedNotifications.size > 50) {
      const notificationsArray = Array.from(this.processedNotifications);
      this.processedNotifications.clear();
      // Keep the most recent 25
      notificationsArray.slice(-25).forEach(id => this.processedNotifications.add(id));
    }

    const itemHtml = `
      <div class="history-item ${item.status}">
        <div class="history-item-header">
          <span class="history-item-prayer">${item.prayerName}</span>
          <span class="history-item-time">${new Date(item.sentTime).toLocaleTimeString()}</span>
        </div>
        <div class="history-item-type">${item.notificationType} - ${item.status}</div>
        ${item.error ? `<div class="history-item-error">${item.error}</div>` : ''}
      </div>
    `;

    listEl.insertAdjacentHTML('afterbegin', itemHtml);

    // Keep only last 10 items
    while (listEl.children.length > 10) {
      listEl.removeChild(listEl.lastChild);
    }
  }

  updateScheduleDisplay(schedule) {
    console.log('[NotificationStatus] Updating schedule display:', schedule);

    const timezoneEl = document.getElementById('statusTimezone');
    const reminderEl = document.getElementById('statusReminder');
    const nextPrayerEl = document.getElementById('statusNextPrayer');
    const nextReminderEl = document.getElementById('statusNextReminder');

    console.log('[NotificationStatus] DOM elements found:', {
      timezoneEl: !!timezoneEl,
      reminderEl: !!reminderEl,
      nextPrayerEl: !!nextPrayerEl,
      nextReminderEl: !!nextReminderEl
    });

    if (timezoneEl) timezoneEl.textContent = schedule.timezone || 'UTC';
    if (reminderEl) {
      reminderEl.textContent = schedule.reminderMinutes > 0 ?
        `${schedule.reminderMinutes} minutes before` : 'Disabled';
    }

    if (nextPrayerEl) {
      if (schedule.nextPrayer) {
        const time = new Date(schedule.nextPrayer.time).toLocaleTimeString();
        nextPrayerEl.textContent = `${schedule.nextPrayer.prayer} at ${time}`;
      } else {
        nextPrayerEl.textContent = 'None today';
      }
    }

    if (nextReminderEl) {
      if (schedule.nextReminder) {
        const time = new Date(schedule.nextReminder.time).toLocaleTimeString();
        nextReminderEl.textContent = `${schedule.nextReminder.prayer} at ${time}`;
      } else {
        nextReminderEl.textContent = 'None scheduled';
      }
    }
  }


  updateConnectionStatus(status) {
    const indicator = document.getElementById('wsStatus');
    const text = document.getElementById('wsStatusText');

    if (indicator) {
      indicator.classList.remove('connected', 'disconnected', 'connecting');
      indicator.classList.add(status);
    }

    const statusText = {
      connected: 'Connected - Real-time updates active',
      disconnected: 'Disconnected - Using polling',
      connecting: 'Connecting...'
    };

    if (text) text.textContent = statusText[status] || status;
  }

  destroy() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.processedNotifications) {
      this.processedNotifications.clear();
    }
    this.isUpdating = false;
  }
}

// Export for use in main prayer-time.js
export { NotificationStatusDashboard };

// Also make available globally for browser compatibility
if (typeof window !== 'undefined') {
  window.NotificationStatusDashboard = NotificationStatusDashboard;
}
