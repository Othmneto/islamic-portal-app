/**
 * Global Theme Manager
 * Handles theme synchronization between localStorage and server
 */
class ThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.isInitialized = false;
    this.listeners = new Set();
  }

  // Initialize theme manager
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('[ThemeManager] Initializing...');
    
    // Load theme from server first, fallback to localStorage
    const serverTheme = await this.loadThemeFromServer();
    if (serverTheme) {
      this.currentTheme = serverTheme;
      console.log('[ThemeManager] Loaded theme from server:', serverTheme);
    } else {
      this.currentTheme = localStorage.getItem('theme') || 'dark';
      console.log('[ThemeManager] Loaded theme from localStorage:', this.currentTheme);
    }
    
    this.applyTheme(this.currentTheme);
    this.isInitialized = true;
    
    // Notify all listeners
    this.notifyListeners();
  }

  // Load theme from server
  async loadThemeFromServer() {
    try {
      const token = this.getAuthToken();
      if (!token) return null;

      const response = await fetch('/api/user/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.preferences?.theme || null;
      }
    } catch (error) {
      console.warn('[ThemeManager] Failed to load theme from server:', error);
    }
    return null;
  }

  // Save theme to server
  async saveThemeToServer(theme) {
    try {
      const token = this.getAuthToken();
      if (!token) {
        console.log('[ThemeManager] No auth token, saving to localStorage only');
        return;
      }

      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ theme })
      });

      if (response.ok) {
        console.log('[ThemeManager] Theme saved to server:', theme);
      } else {
        console.warn('[ThemeManager] Failed to save theme to server:', response.status);
      }
    } catch (error) {
      console.warn('[ThemeManager] Error saving theme to server:', error);
    }
  }

  // Set theme
  async setTheme(theme) {
    if (!['light', 'dark', 'auto'].includes(theme)) {
      console.warn('[ThemeManager] Invalid theme:', theme);
      return;
    }

    this.currentTheme = theme;
    
    // Save to localStorage immediately
    localStorage.setItem('theme', theme);
    
    // Apply theme
    this.applyTheme(theme);
    
    // Save to server in background
    this.saveThemeToServer(theme);
    
    // Notify listeners
    this.notifyListeners();
  }

  // Apply theme to DOM
  applyTheme(theme) {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light-theme', 'dark-theme', 'auto-theme');
    
    // Add new theme class
    root.classList.add(`${theme}-theme`);
    
    // Set data attribute for CSS
    root.setAttribute('data-theme', theme);
    
    // Update meta theme-color
    this.updateMetaThemeColor(theme);
    
    console.log('[ThemeManager] Applied theme:', theme);
  }

  // Update meta theme-color
  updateMetaThemeColor(theme) {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    
    const colors = {
      light: '#ffffff',
      dark: '#1a1a1a',
      auto: '#1a1a1a' // Default to dark for auto
    };
    
    metaThemeColor.content = colors[theme] || colors.dark;
  }

  // Get current theme
  getCurrentTheme() {
    return this.currentTheme;
  }

  // Toggle between light and dark
  async toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    await this.setTheme(newTheme);
  }

  // Add theme change listener
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove theme change listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentTheme);
      } catch (error) {
        console.error('[ThemeManager] Listener error:', error);
      }
    });
  }

  // Get auth token (helper method)
  getAuthToken() {
    return localStorage.getItem('accessToken') || 
           localStorage.getItem('authToken') || 
           localStorage.getItem('token') || 
           localStorage.getItem('jwt');
  }
}

// Create global instance
window.themeManager = new ThemeManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.themeManager.initialize();
  });
} else {
  window.themeManager.initialize();
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
