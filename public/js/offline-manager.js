/**
 * Offline Data Manager
 * Handles offline storage using IndexedDB
 */

class OfflineManager {
  constructor() {
    this.dbName = 'IslamicCalendarDB';
    this.dbVersion = 1;
    this.db = null;
    this.isOnline = navigator.onLine;
    
    this.init();
    this.setupOnlineOfflineListeners();
  }

  async init() {
    try {
      this.db = await this.openDatabase();
      console.log('✅ [OfflineManager] Database initialized');
    } catch (error) {
      console.error('❌ [OfflineManager] Database initialization failed:', error);
    }
  }

  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => {
        console.error('❌ [OfflineManager] Database open failed');
        reject(request.error);
      };
      
      request.onsuccess = () => {
        console.log('✅ [OfflineManager] Database opened successfully');
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('🔧 [OfflineManager] Database upgrade needed');
        
        // Create object stores
        this.createObjectStores(db);
      };
    });
  }

  createObjectStores(db) {
    // Events store
    if (!db.objectStoreNames.contains('events')) {
      const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
      eventsStore.createIndex('date', 'startDate', { unique: false });
      eventsStore.createIndex('category', 'category', { unique: false });
      eventsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
    }

    // Prayer times store
    if (!db.objectStoreNames.contains('prayerTimes')) {
      const prayerStore = db.createObjectStore('prayerTimes', { keyPath: 'date' });
      prayerStore.createIndex('location', 'location', { unique: false });
    }

    // Holidays store
    if (!db.objectStoreNames.contains('holidays')) {
      const holidaysStore = db.createObjectStore('holidays', { keyPath: 'id' });
      holidaysStore.createIndex('date', 'date', { unique: false });
      holidaysStore.createIndex('country', 'country', { unique: false });
    }

    // Categories store
    if (!db.objectStoreNames.contains('categories')) {
      const categoriesStore = db.createObjectStore('categories', { keyPath: 'id' });
    }

    // Pending actions store
    if (!db.objectStoreNames.contains('pendingActions')) {
      const pendingStore = db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
      pendingStore.createIndex('type', 'type', { unique: false });
      pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Settings store
    if (!db.objectStoreNames.contains('settings')) {
      const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
    }
  }

  setupOnlineOfflineListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 [OfflineManager] Back online');
      this.isOnline = true;
      this.syncPendingActions();
    });

    window.addEventListener('offline', () => {
      console.log('📱 [OfflineManager] Gone offline');
      this.isOnline = false;
    });
  }

  // ========================================
  // EVENTS MANAGEMENT
  // ========================================

  async saveEvent(event) {
    try {
      const transaction = this.db.transaction(['events'], 'readwrite');
      const store = transaction.objectStore('events');
      
      // Mark as pending sync if offline
      if (!this.isOnline) {
        event.syncStatus = 'pending';
        event.lastModified = new Date().toISOString();
      } else {
        event.syncStatus = 'synced';
      }
      
      await store.put(event);
      console.log('💾 [OfflineManager] Event saved:', event.id);
      
      // Add to pending actions if offline
      if (!this.isOnline) {
        await this.addPendingAction('create', 'events', event);
      }
      
      return event;
    } catch (error) {
      console.error('❌ [OfflineManager] Error saving event:', error);
      throw error;
    }
  }

  async updateEvent(event) {
    try {
      const transaction = this.db.transaction(['events'], 'readwrite');
      const store = transaction.objectStore('events');
      
      if (!this.isOnline) {
        event.syncStatus = 'pending';
        event.lastModified = new Date().toISOString();
      } else {
        event.syncStatus = 'synced';
      }
      
      await store.put(event);
      console.log('💾 [OfflineManager] Event updated:', event.id);
      
      if (!this.isOnline) {
        await this.addPendingAction('update', 'events', event);
      }
      
      return event;
    } catch (error) {
      console.error('❌ [OfflineManager] Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(eventId) {
    try {
      const transaction = this.db.transaction(['events'], 'readwrite');
      const store = transaction.objectStore('events');
      
      await store.delete(eventId);
      console.log('🗑️ [OfflineManager] Event deleted:', eventId);
      
      if (!this.isOnline) {
        await this.addPendingAction('delete', 'events', { id: eventId });
      }
      
      return true;
    } catch (error) {
      console.error('❌ [OfflineManager] Error deleting event:', error);
      throw error;
    }
  }

  async getEvents(startDate, endDate) {
    try {
      const transaction = this.db.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      const index = store.index('date');
      
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.getAll(range);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const events = request.result;
          console.log('📅 [OfflineManager] Retrieved events:', events.length);
          resolve(events);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ [OfflineManager] Error getting events:', error);
      return [];
    }
  }

  // ========================================
  // PRAYER TIMES MANAGEMENT
  // ========================================

  async savePrayerTimes(date, prayerTimes, location) {
    try {
      const transaction = this.db.transaction(['prayerTimes'], 'readwrite');
      const store = transaction.objectStore('prayerTimes');
      
      const data = {
        date,
        prayerTimes,
        location,
        cachedAt: new Date().toISOString()
      };
      
      await store.put(data);
      console.log('🕌 [OfflineManager] Prayer times saved for:', date);
      
      return data;
    } catch (error) {
      console.error('❌ [OfflineManager] Error saving prayer times:', error);
      throw error;
    }
  }

  async getPrayerTimes(date) {
    try {
      const transaction = this.db.transaction(['prayerTimes'], 'readonly');
      const store = transaction.objectStore('prayerTimes');
      const request = store.get(date);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result;
          console.log('🕌 [OfflineManager] Retrieved prayer times for:', date);
          resolve(result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ [OfflineManager] Error getting prayer times:', error);
      return null;
    }
  }

  // ========================================
  // HOLIDAYS MANAGEMENT
  // ========================================

  async saveHolidays(holidays) {
    try {
      const transaction = this.db.transaction(['holidays'], 'readwrite');
      const store = transaction.objectStore('holidays');
      
      // Clear existing holidays
      await store.clear();
      
      // Add new holidays
      for (const holiday of holidays) {
        const withId = holiday && holiday.id ? holiday : {
          ...holiday,
          id: `${holiday.country || 'XX'}-${holiday.date || '0000-00-00'}-${(holiday.name || '').toString().toLowerCase().replace(/\s+/g, '-')}`
        };
        await store.put(withId);
      }
      
      console.log('🎉 [OfflineManager] Holidays saved:', holidays.length);
      return holidays;
    } catch (error) {
      console.error('❌ [OfflineManager] Error saving holidays:', error);
      throw error;
    }
  }

  async getHolidays(startDate, endDate) {
    try {
      const transaction = this.db.transaction(['holidays'], 'readonly');
      const store = transaction.objectStore('holidays');
      const index = store.index('date');
      
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = index.getAll(range);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const holidays = request.result;
          console.log('🎉 [OfflineManager] Retrieved holidays:', holidays.length);
          resolve(holidays);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ [OfflineManager] Error getting holidays:', error);
      return [];
    }
  }

  // ========================================
  // PENDING ACTIONS MANAGEMENT
  // ========================================

  async addPendingAction(type, resource, data) {
    try {
      const transaction = this.db.transaction(['pendingActions'], 'readwrite');
      const store = transaction.objectStore('pendingActions');
      
      const action = {
        type,
        resource,
        data,
        timestamp: new Date().toISOString(),
        retryCount: 0
      };
      
      await store.add(action);
      console.log('⏳ [OfflineManager] Pending action added:', type, resource);
      
      return action;
    } catch (error) {
      console.error('❌ [OfflineManager] Error adding pending action:', error);
      throw error;
    }
  }

  async getPendingActions() {
    try {
      const transaction = this.db.transaction(['pendingActions'], 'readonly');
      const store = transaction.objectStore('pendingActions');
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const actions = request.result;
          console.log('⏳ [OfflineManager] Retrieved pending actions:', actions.length);
          resolve(actions);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ [OfflineManager] Error getting pending actions:', error);
      return [];
    }
  }

  async removePendingAction(actionId) {
    try {
      const transaction = this.db.transaction(['pendingActions'], 'readwrite');
      const store = transaction.objectStore('pendingActions');
      
      await store.delete(actionId);
      console.log('✅ [OfflineManager] Pending action removed:', actionId);
      
      return true;
    } catch (error) {
      console.error('❌ [OfflineManager] Error removing pending action:', error);
      throw error;
    }
  }

  // ========================================
  // SETTINGS MANAGEMENT
  // ========================================

  async saveSetting(key, value) {
    try {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      
      const setting = { key, value, updatedAt: new Date().toISOString() };
      await store.put(setting);
      
      console.log('⚙️ [OfflineManager] Setting saved:', key);
      return setting;
    } catch (error) {
      console.error('❌ [OfflineManager] Error saving setting:', error);
      throw error;
    }
  }

  async getSetting(key) {
    try {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ [OfflineManager] Error getting setting:', error);
      return null;
    }
  }

  // ========================================
  // SYNC MANAGEMENT
  // ========================================

  async syncPendingActions() {
    if (!this.isOnline) {
      console.log('📱 [OfflineManager] Still offline, skipping sync');
      return;
    }

    try {
      console.log('🔄 [OfflineManager] Starting sync of pending actions');
      
      const pendingActions = await this.getPendingActions();
      
      for (const action of pendingActions) {
        try {
          await this.processPendingAction(action);
          await this.removePendingAction(action.id);
        } catch (error) {
          console.error('❌ [OfflineManager] Error processing action:', error);
          action.retryCount++;
          
          if (action.retryCount >= 3) {
            console.log('❌ [OfflineManager] Max retries reached, removing action');
            await this.removePendingAction(action.id);
          }
        }
      }
      
      console.log('✅ [OfflineManager] Sync completed');
    } catch (error) {
      console.error('❌ [OfflineManager] Sync error:', error);
    }
  }

  async processPendingAction(action) {
    console.log('🔄 [OfflineManager] Processing action:', action.type, action.resource);
    
    // This would make API calls to sync the data
    // For now, just log the action
    console.log('📤 [OfflineManager] Would sync:', action);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  async clearAllData() {
    try {
      const stores = ['events', 'prayerTimes', 'holidays', 'categories', 'pendingActions', 'settings'];
      
      for (const storeName of stores) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        await store.clear();
      }
      
      console.log('🗑️ [OfflineManager] All data cleared');
      return true;
    } catch (error) {
      console.error('❌ [OfflineManager] Error clearing data:', error);
      throw error;
    }
  }

  async getStorageInfo() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          available: estimate.quota - estimate.usage
        };
      }
      return null;
    } catch (error) {
      console.error('❌ [OfflineManager] Error getting storage info:', error);
      return null;
    }
  }
}

// Export for global use
if (typeof window !== 'undefined') {
  window.OfflineManager = OfflineManager;
}
