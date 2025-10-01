/**
 * Global Navbar Component
 * Handles all navbar functionality including dropdowns, search, notifications, and user menu
 */

// Global state management
window.GlobalNavbarState = {
    currentUser: null,
    isAuthenticated: false,
    notifications: [],
    theme: 'light',
    lastUpdate: Date.now()
};

// Global event system for navbar updates
window.GlobalNavbarEvents = {
    listeners: [],
    
    addListener(callback) {
        this.listeners.push(callback);
    },
    
    removeListener(callback) {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    },
    
    notify(eventType, data) {
        console.log('📡 [GlobalNavbar] Broadcasting event:', eventType, data);
        this.listeners.forEach(listener => {
            try {
                listener(eventType, data);
            } catch (error) {
                console.error('❌ [GlobalNavbar] Event listener error:', error);
            }
        });
    }
};

class GlobalNavbar {
    constructor() {
        this.isInitialized = false;
        this.currentUser = window.GlobalNavbarState.currentUser;
        this.notifications = window.GlobalNavbarState.notifications;
        this.searchResults = [];
        this.isMobileMenuOpen = false;
        
        // Bind methods
        this.handleClick = this.handleClick.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleGlobalEvent = this.handleGlobalEvent.bind(this);
        
        // Listen for global events
        window.GlobalNavbarEvents.addListener(this.handleGlobalEvent);
        
        this.init();
    }

    async init() {
        // Prevent multiple initializations
        if (window.globalNavbar && window.globalNavbar.isInitialized) {
            console.log('🔄 [GlobalNavbar] Navbar already initialized, skipping...');
            return;
        }
        
        console.log('🌐 [GlobalNavbar] Initializing global navbar...');
        
        try {
            // Check if navbar already exists in DOM
            if (document.querySelector('.global-navbar')) {
                console.log('📄 [GlobalNavbar] Navbar HTML already exists in DOM');
            } else {
                console.log('⚠️ [GlobalNavbar] No navbar found in DOM, creating fallback');
                await this.createFallbackNavbar();
            }
            
            // Initialize components
            this.initializeElements();
            this.initializeEventListeners();
            
            // Wait a bit for token manager to be ready
            if (window.tokenManager) {
                console.log('⏳ [GlobalNavbar] Waiting for token manager to be ready...');
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            await this.initializeUserState();
            this.initializeTheme();
            this.initializeNotifications();
            this.initializeSearch();
            this.initializeMobileMenu();
            this.updateAuthStatus();
            
            this.isInitialized = true;
            console.log('✅ [GlobalNavbar] Global navbar initialized successfully');
        } catch (error) {
            console.error('❌ [GlobalNavbar] Failed to initialize:', error);
        }
    }

    /**
     * Update global state to ensure navbar reflects current user state
     */
    updateGlobalState() {
        console.log('🔄 [GlobalNavbar] Updating global state...');
        
        // Only update if elements are initialized
        if (!this.elements) {
            console.warn('⚠️ [GlobalNavbar] Elements not initialized, skipping global state update');
            return;
        }
        
        // Update user state
        this.initializeUserState();
        
        // Update auth status
        this.updateAuthStatus();
        
        // Update notifications
        this.initializeNotifications();
        
        // Update theme
        this.initializeTheme();
        
        console.log('✅ [GlobalNavbar] Global state updated');
    }

    /**
     * Update global state with new data
     */
    updateGlobalStateData(newData) {
        console.log('🔄 [GlobalNavbar] Updating global state data:', newData);
        
        // Update global state
        Object.assign(window.GlobalNavbarState, newData, {
            lastUpdate: Date.now()
        });
        
        // Update local state
        this.currentUser = window.GlobalNavbarState.currentUser;
        this.notifications = window.GlobalNavbarState.notifications;
        
        // Ensure elements are initialized before updating UI
        if (!this.elements) {
            console.log('🔄 [GlobalNavbar] Elements not ready, initializing first...');
            this.initializeElements();
        }
        
        // Broadcast events to all navbar instances
        if (newData.currentUser !== undefined) {
            window.GlobalNavbarEvents.notify('userStateChanged', {
                currentUser: newData.currentUser,
                isAuthenticated: newData.isAuthenticated
            });
        }
        
        if (newData.notifications !== undefined) {
            window.GlobalNavbarEvents.notify('notificationsChanged', {
                notifications: newData.notifications
            });
        }
        
        if (newData.theme !== undefined) {
            window.GlobalNavbarEvents.notify('themeChanged', {
                theme: newData.theme
            });
        }
        
        // Update UI
        this.updateAuthStatus();
        this.updateNotificationsDisplay();
        
        console.log('✅ [GlobalNavbar] Global state data updated and broadcasted');
    }

    /**
     * Get current global state
     */
    getGlobalState() {
        return { ...window.GlobalNavbarState };
    }

    /**
     * Handle global events from other navbar instances
     */
    handleGlobalEvent(eventType, data) {
        console.log('📡 [GlobalNavbar] Received global event:', eventType, data);
        
        // Ensure elements are initialized before handling events
        if (!this.elements) {
            console.log('🔄 [GlobalNavbar] Elements not ready, initializing first...');
            this.initializeElements();
        }
        
        switch (eventType) {
            case 'userStateChanged':
                this.currentUser = data.currentUser;
                this.updateUserDisplay();
                break;
            case 'notificationsChanged':
                this.notifications = data.notifications;
                this.updateNotificationsDisplay();
                break;
            case 'themeChanged':
                this.updateThemeDisplay(data.theme);
                break;
            case 'authStatusChanged':
                this.updateAuthStatus();
                break;
            default:
                console.log('📡 [GlobalNavbar] Unknown event type:', eventType);
        }
    }

    /**
     * Cleanup method to remove event listeners
     */
    destroy() {
        console.log('🧹 [GlobalNavbar] Cleaning up navbar instance...');
        window.GlobalNavbarEvents.removeListener(this.handleGlobalEvent);
        this.isInitialized = false;
    }

    /**
     * Create fallback navbar if no navbar exists in DOM
     */
    async createFallbackNavbar() {
        const fallbackHTML = `
            <header class="global-navbar">
                <nav class="navbar-container">
                    <div class="navbar-brand">
                        <a href="/" class="brand-logo">
                            <i class="fas fa-mosque brand-icon"></i>
                            <span class="brand-text">Islamic Portal</span>
                        </a>
                    </div>
                    <div class="navbar-nav">
                        <ul class="nav-menu">
                            <li class="nav-item">
                                <a href="/" class="nav-link" data-tooltip="Home">
                                    <i class="fas fa-home"></i>
                                    <span class="nav-text">Home</span>
                                </a>
                            </li>
                            <li class="nav-item dropdown">
                                <a href="#" class="nav-link dropdown-toggle" data-tooltip="Core Features">
                                    <i class="fas fa-star"></i>
                                    <span class="nav-text">Features</span>
                                    <i class="fas fa-chevron-down dropdown-arrow"></i>
                                </a>
                                <ul class="dropdown-menu">
                                    <li><a href="/translator/text-translator" class="dropdown-link">
                                        <i class="fas fa-language"></i> AI Translator
                                    </a></li>
                                    <li><a href="/prayer-time.html" class="dropdown-link">
                                        <i class="fas fa-mosque"></i> Prayer Times
                                    </a></li>
                                    <li><a href="/qibla.html" class="dropdown-link">
                                        <i class="fas fa-compass"></i> Qibla Direction
                                    </a></li>
                                    <li><a href="/moon.html" class="dropdown-link">
                                        <i class="fas fa-moon"></i> Moon Status
                                    </a></li>
                                </ul>
                            </li>
                            <li class="nav-item dropdown">
                                <a href="#" class="nav-link dropdown-toggle" data-tooltip="Islamic Content">
                                    <i class="fas fa-book-open"></i>
                                    <span class="nav-text">Content</span>
                                    <i class="fas fa-chevron-down dropdown-arrow"></i>
                                </a>
                                <ul class="dropdown-menu">
                                    <li><a href="/explorer.html" class="dropdown-link">
                                        <i class="fas fa-search"></i> Quran Explorer
                                    </a></li>
                                    <li><a href="/duas.html" class="dropdown-link">
                                        <i class="fas fa-hands-praying"></i> Daily Duas
                                    </a></li>
                                    <li><a href="/names.html" class="dropdown-link">
                                        <i class="fas fa-star"></i> 99 Names
                                    </a></li>
                                    <li><a href="/khutbah.html" class="dropdown-link">
                                        <i class="fas fa-microphone"></i> Khutbah
                                    </a></li>
                                </ul>
                            </li>
                            <li class="nav-item dropdown">
                                <a href="#" class="nav-link dropdown-toggle" data-tooltip="Islamic Tools">
                                    <i class="fas fa-tools"></i>
                                    <span class="nav-text">Tools</span>
                                    <i class="fas fa-chevron-down dropdown-arrow"></i>
                                </a>
                                <ul class="dropdown-menu">
                                    <li><a href="/zakat.html" class="dropdown-link">
                                        <i class="fas fa-coins"></i> Zakat Calculator
                                    </a></li>
                                    <li><a href="/converter.html" class="dropdown-link">
                                        <i class="fas fa-calendar-alt"></i> Date Converter
                                    </a></li>
                                    <li><a href="/calendar.html" class="dropdown-link">
                                        <i class="fas fa-calendar"></i> Islamic Calendar
                                    </a></li>
                                </ul>
                            </li>
                            <li class="nav-item dropdown">
                                <a href="#" class="nav-link dropdown-toggle" data-tooltip="Account & Settings">
                                    <i class="fas fa-user-cog"></i>
                                    <span class="nav-text">Account</span>
                                    <i class="fas fa-chevron-down dropdown-arrow"></i>
                                </a>
                                <ul class="dropdown-menu">
                                    <li><a href="/profile.html" class="dropdown-link">
                                        <i class="fas fa-user"></i> Profile
                                    </a></li>
                                    <li><a href="/profile-management.html" class="dropdown-link">
                                        <i class="fas fa-user-edit"></i> Profile Management
                                    </a></li>
                                    <li><a href="/account-management.html" class="dropdown-link">
                                        <i class="fas fa-cog"></i> Account Management
                                    </a></li>
                                    <li><a href="/security-dashboard.html" class="dropdown-link">
                                        <i class="fas fa-shield-alt"></i> Security Dashboard
                                    </a></li>
                                    <li><a href="/privacy-settings.html" class="dropdown-link">
                                        <i class="fas fa-lock"></i> Privacy Settings
                                    </a></li>
                                    <li><a href="/remember-me-settings.html" class="dropdown-link">
                                        <i class="fas fa-memory"></i> Remember Me
                                    </a></li>
                                </ul>
                            </li>
                            <li class="nav-item dropdown">
                                <a href="#" class="nav-link dropdown-toggle" data-tooltip="Analytics & Data">
                                    <i class="fas fa-chart-line"></i>
                                    <span class="nav-text">Analytics</span>
                                    <i class="fas fa-chevron-down dropdown-arrow"></i>
                                </a>
                                <ul class="dropdown-menu">
                                    <li><a href="/analytics.html" class="dropdown-link">
                                        <i class="fas fa-chart-line"></i> Analytics
                                    </a></li>
                                    <li><a href="/history.html" class="dropdown-link">
                                        <i class="fas fa-history"></i> Translation History
                                    </a></li>
                                    <li><a href="/stats.html" class="dropdown-link">
                                        <i class="fas fa-chart-bar"></i> Statistics
                                    </a></li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                    <div class="navbar-controls">
                        <div class="search-container">
                            <button class="search-toggle" id="search-toggle" data-tooltip="Search">
                                <i class="fas fa-search"></i>
                            </button>
                            <div class="search-dropdown" id="search-dropdown">
                                <input type="text" placeholder="Search..." class="search-input" id="global-search">
                                <div class="search-results" id="search-results"></div>
                            </div>
                        </div>
                        <div class="notification-container">
                            <button class="notification-toggle" id="notification-dropdown-toggle" data-tooltip="Notifications">
                                <i class="fas fa-bell"></i>
                                <span class="notification-badge" id="notification-badge">0</span>
                            </button>
                            <div class="notification-dropdown" id="notification-dropdown">
                                <div class="notification-header">
                                    <h4>Notifications</h4>
                                    <button class="mark-all-read" id="mark-all-read">Mark all read</button>
                                </div>
                                <div class="notification-list" id="notification-list">
                                    <div class="notification-empty">No new notifications</div>
                                </div>
                            </div>
                        </div>
                        <div class="user-menu-container">
                            <button class="user-toggle" id="user-toggle" data-tooltip="User Menu">
                                <div class="user-avatar" id="user-avatar">
                                    <i class="fas fa-user"></i>
                                </div>
                                <span class="user-name" id="user-name">Guest</span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <div class="user-dropdown" id="user-dropdown">
                                <div class="user-info">
                                    <div class="user-avatar-large" id="user-avatar-large">
                                        <i class="fas fa-user"></i>
                                    </div>
                                    <div class="user-details">
                                        <div class="user-name-large" id="user-name-large">Guest User</div>
                                        <div class="user-email" id="user-email">guest@example.com</div>
                                    </div>
                                </div>
                                <div class="user-menu-divider"></div>
                                <ul class="user-menu-list">
                                    <li><a href="/profile.html" class="user-menu-link">
                                        <i class="fas fa-user"></i> Profile
                                    </a></li>
                                    <li><a href="/settings.html" class="user-menu-link">
                                        <i class="fas fa-cog"></i> Settings
                                    </a></li>
                                    <li><a href="/security-dashboard.html" class="user-menu-link">
                                        <i class="fas fa-shield-alt"></i> Security
                                    </a></li>
                                    <li class="user-menu-divider"></li>
                                    <li><a href="/login.html" class="user-menu-link" id="login-link">
                                        <i class="fas fa-sign-in-alt"></i> Login
                                    </a></li>
                                    <li><a href="#" class="user-menu-link" id="logout-link" style="display: none;">
                                        <i class="fas fa-sign-out-alt"></i> Logout
                                    </a></li>
                                </ul>
                            </div>
                        </div>
                        <div class="theme-toggle-container">
                            <button class="theme-toggle" id="theme-toggle" data-tooltip="Toggle Theme">
                                <i class="fas fa-sun theme-icon-light"></i>
                                <i class="fas fa-moon theme-icon-dark"></i>
                            </button>
                        </div>
                        <button class="mobile-menu-toggle" id="mobile-menu-toggle">
                            <span class="hamburger-line"></span>
                            <span class="hamburger-line"></span>
                            <span class="hamburger-line"></span>
                        </button>
                    </div>
                </nav>
                <div class="mobile-nav-overlay" id="mobile-nav-overlay">
                    <div class="mobile-nav-content">
                        <div class="mobile-nav-header">
                            <div class="mobile-nav-brand">
                                <i class="fas fa-mosque"></i>
                                <span>Islamic Portal</span>
                            </div>
                            <button class="mobile-nav-close" id="mobile-nav-close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="mobile-nav-body">
                            <!-- Mobile navigation will be populated by JavaScript -->
                        </div>
                    </div>
                </div>
            </header>
        `;
        
        document.body.insertAdjacentHTML('afterbegin', fallbackHTML);
        console.log('🔄 [GlobalNavbar] Fallback navbar created');
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            // Main containers
            navbar: document.querySelector('.global-navbar'),
            mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
            mobileNavOverlay: document.getElementById('mobile-nav-overlay'),
            mobileNavClose: document.getElementById('mobile-nav-close'),
            
            // Search
            searchToggle: document.getElementById('search-toggle'),
            searchDropdown: document.getElementById('search-dropdown'),
            searchInput: document.getElementById('global-search'),
            searchResults: document.getElementById('search-results'),
            
            // Notifications
            notificationToggle: document.getElementById('notification-dropdown-toggle'),
            notificationDropdown: document.getElementById('notification-dropdown'),
            notificationBadge: document.getElementById('notification-badge'),
            notificationList: document.getElementById('notification-list'),
            markAllRead: document.getElementById('mark-all-read'),
            
            // User menu
            userToggle: document.getElementById('user-toggle'),
            userDropdown: document.getElementById('user-dropdown'),
            userAvatar: document.getElementById('user-avatar'),
            userName: document.getElementById('user-name'),
            userAvatarLarge: document.getElementById('user-avatar-large'),
            userNameLarge: document.getElementById('user-name-large'),
            userEmail: document.getElementById('user-email'),
            loginLink: document.getElementById('login-link'),
            logoutLink: document.getElementById('logout-link'),
            
            // Theme
            themeToggle: document.getElementById('theme-toggle'),
            
            // Dropdowns
            dropdowns: document.querySelectorAll('.dropdown'),
            dropdownMenus: document.querySelectorAll('.dropdown-menu')
        };
        
        // Log which elements were found
        const foundElements = Object.entries(this.elements)
            .filter(([key, element]) => element !== null)
            .map(([key]) => key);
        
        console.log('🎯 [GlobalNavbar] DOM elements initialized:', foundElements.length, 'elements found');
        
        // Log missing elements (but don't warn for optional ones)
        const optionalElements = ['userName', 'userNameLarge', 'userEmail', 'loginLink', 'logoutLink'];
        const missingOptional = Object.entries(this.elements)
            .filter(([key, element]) => !element && optionalElements.includes(key))
            .map(([key]) => key);
        
        if (missingOptional.length > 0) {
            console.log('ℹ️ [GlobalNavbar] Optional elements not found (this is normal):', missingOptional);
        }
        
        // Log missing critical elements
        const criticalElements = ['navbar', 'themeToggle'];
        const missingCritical = criticalElements.filter(key => !this.elements[key]);
        if (missingCritical.length > 0) {
            console.warn('⚠️ [GlobalNavbar] Missing critical elements:', missingCritical);
        }
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Global click handler
        document.addEventListener('click', this.handleClick);
        
        // Global keydown handler
        document.addEventListener('keydown', this.handleKeydown);
        
        // Resize handler
        window.addEventListener('resize', this.handleResize);
        
        // Search
        if (this.elements.searchToggle) {
            this.elements.searchToggle.addEventListener('click', () => this.toggleSearch());
            console.log('🔍 [GlobalNavbar] Search toggle listener added');
        }
        
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => this.handleSearch(e));
            console.log('🔍 [GlobalNavbar] Search input listener added');
        }
        
        // Notifications
        if (this.elements.notificationToggle) {
            this.elements.notificationToggle.addEventListener('click', () => this.toggleNotifications());
            console.log('🔔 [GlobalNavbar] Notification toggle listener added');
        }
        
        if (this.elements.markAllRead) {
            this.elements.markAllRead.addEventListener('click', () => this.markAllNotificationsRead());
            console.log('🔔 [GlobalNavbar] Mark all read listener added');
        }
        
        // User menu
        if (this.elements.userToggle) {
            this.elements.userToggle.addEventListener('click', () => this.toggleUserMenu());
            console.log('👤 [GlobalNavbar] User toggle listener added');
        }
        
        if (this.elements.loginLink) {
            this.elements.loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
            console.log('🔐 [GlobalNavbar] Login link listener added');
        }
        
        if (this.elements.logoutLink) {
            this.elements.logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
            console.log('🔐 [GlobalNavbar] Logout link listener added');
        }
        
        // Theme toggle
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
            console.log('🎨 [GlobalNavbar] Theme toggle listener added');
        }
        
        // Mobile menu
        if (this.elements.mobileMenuToggle) {
            this.elements.mobileMenuToggle.addEventListener('click', () => this.toggleMobileMenu());
            console.log('📱 [GlobalNavbar] Mobile menu toggle listener added');
        }
        
        if (this.elements.mobileNavClose) {
            this.elements.mobileNavClose.addEventListener('click', () => this.closeMobileMenu());
            console.log('📱 [GlobalNavbar] Mobile nav close listener added');
        }
        
        if (this.elements.mobileNavOverlay) {
            this.elements.mobileNavOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.mobileNavOverlay) {
                    this.closeMobileMenu();
                }
            });
            console.log('📱 [GlobalNavbar] Mobile nav overlay listener added');
        }
        
        console.log('👂 [GlobalNavbar] Event listeners initialized');
    }

    /**
     * Initialize user state
     */
    async initializeUserState() {
        try {
            // Use token manager if available, otherwise fallback to old method
            let authToken = null;
            let isAuthenticated = false;
            
            if (window.tokenManager && window.tokenManager.isAuthenticated()) {
                authToken = window.tokenManager.getAccessToken();
                isAuthenticated = true;
                console.log('🔑 [GlobalNavbar] Using token manager, token available:', !!authToken);
            } else {
                authToken = localStorage.getItem('accessToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
                isAuthenticated = !!authToken;
                console.log('🔑 [GlobalNavbar] Using localStorage, token available:', !!authToken);
            }
            
            if (authToken && isAuthenticated) {
                console.log('🔍 [GlobalNavbar] Verifying token with server...');
                
                try {
                    // Verify token and get user info
                    const response = await fetch('/api/user/profile', {
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        const userData = await response.json();
                        this.currentUser = userData;
                        
                        // Update global state
                        this.updateGlobalStateData({
                            currentUser: userData,
                            isAuthenticated: true
                        });
                        
                        this.updateUserDisplay();
                        console.log('👤 [GlobalNavbar] User authenticated:', this.currentUser.email || this.currentUser.username);
                    } else {
                        console.warn('⚠️ [GlobalNavbar] Token verification failed, status:', response.status);
                        
                        // Token invalid, clear it
                        if (window.tokenManager) {
                            window.tokenManager.clearTokens();
                        } else {
                            localStorage.removeItem('authToken');
                            localStorage.removeItem('token');
                            localStorage.removeItem('jwt');
                        }
                        this.currentUser = null;
                        
                        // Update global state
                        this.updateGlobalStateData({
                            currentUser: null,
                            isAuthenticated: false
                        });
                        
                        this.updateUserDisplay();
                    }
                } catch (fetchError) {
                    console.warn('⚠️ [GlobalNavbar] Token verification request failed:', fetchError);
                    // Don't clear tokens on network errors, just show as guest
                    this.currentUser = null;
                    this.updateUserDisplay();
                }
            } else {
                console.log('👤 [GlobalNavbar] No auth data found, showing guest');
                this.currentUser = null;
                this.updateUserDisplay();
            }
        } catch (error) {
            console.warn('⚠️ [GlobalNavbar] Failed to initialize user state:', error);
            this.currentUser = null;
            this.updateUserDisplay();
        }
    }

    /**
     * Update user display in navbar
     */
    updateUserDisplay() {
        if (!this.elements) {
            console.log('ℹ️ [GlobalNavbar] Elements not initialized yet, skipping user display update');
            return;
        }

        if (this.currentUser) {
            // Update user info
            if (this.elements.userName) {
                this.elements.userName.textContent = this.currentUser.username || this.currentUser.email || 'User';
            }
            
            if (this.elements.userNameLarge) {
                this.elements.userNameLarge.textContent = this.currentUser.username || this.currentUser.email || 'User';
            }
            
            if (this.elements.userEmail) {
                this.elements.userEmail.textContent = this.currentUser.email || '';
            }
            
            // Update avatar
            if (this.elements.userAvatar) {
                this.elements.userAvatar.innerHTML = `<i class="fas fa-user"></i>`;
            }
            
            if (this.elements.userAvatarLarge) {
                this.elements.userAvatarLarge.innerHTML = `<i class="fas fa-user"></i>`;
            }
            
            // Show/hide login/logout links
            if (this.elements.loginLink) {
                this.elements.loginLink.style.display = 'none';
            }
            
            if (this.elements.logoutLink) {
                this.elements.logoutLink.style.display = 'block';
            }
        } else {
            // Guest user
            if (this.elements.userName) {
                this.elements.userName.textContent = 'Guest';
            }
            
            if (this.elements.userNameLarge) {
                this.elements.userNameLarge.textContent = 'Guest User';
            }
            
            if (this.elements.userEmail) {
                this.elements.userEmail.textContent = 'guest@example.com';
            }
            
            // Show/hide login/logout links
            if (this.elements.loginLink) {
                this.elements.loginLink.style.display = 'block';
            }
            
            if (this.elements.logoutLink) {
                this.elements.logoutLink.style.display = 'none';
            }
        }
    }

    /**
     * Update notifications display
     */
    updateNotificationsDisplay() {
        if (!this.elements) {
            console.warn('⚠️ [GlobalNavbar] Elements not initialized yet');
            return;
        }

        if (this.elements.notificationBadge) {
            const count = this.notifications ? this.notifications.length : 0;
            this.elements.notificationBadge.textContent = count;
            this.elements.notificationBadge.style.display = count > 0 ? 'block' : 'none';
        }

        if (this.elements.notificationList) {
            if (this.notifications && this.notifications.length > 0) {
                this.elements.notificationList.innerHTML = this.notifications.map(notification => `
                    <div class="notification-item">
                        <div class="notification-title">${notification.title || 'Notification'}</div>
                        <div class="notification-message">${notification.message || ''}</div>
                        <div class="notification-time">${new Date(notification.timestamp).toLocaleTimeString()}</div>
                    </div>
                `).join('');
            } else {
                this.elements.notificationList.innerHTML = '<div class="notification-empty">No new notifications</div>';
            }
        }
    }

    /**
     * Initialize theme
     */
    initializeTheme() {
        // Use theme manager if available
        if (window.themeManager) {
            window.themeManager.addListener((theme) => {
                this.updateThemeUI(theme);
            });
            this.updateThemeUI(window.themeManager.getCurrentTheme());
            console.log('🎨 [GlobalNavbar] Theme initialized via ThemeManager:', window.themeManager.getCurrentTheme());
        } else {
            // Fallback to localStorage
            const savedTheme = localStorage.getItem('theme') || 'dark';
            this.setTheme(savedTheme);
            console.log('🎨 [GlobalNavbar] Theme initialized from localStorage:', savedTheme);
        }
    }

    /**
     * Update theme UI elements
     */
    updateThemeUI(theme) {
        // Update theme toggle if it exists
        if (this.elements.themeToggle) {
            this.elements.themeToggle.checked = theme === 'light';
        }
        
        // Apply theme classes
        document.body.className = document.body.className.replace(/light-mode|dark-mode/g, '');
        document.body.classList.add(`${theme}-mode`);
    }

    /**
     * Set theme (fallback method)
     */
    setTheme(theme) {
        document.body.className = document.body.className.replace(/light-mode|dark-mode/g, '');
        document.body.classList.add(`${theme}-mode`);
        localStorage.setItem('theme', theme);
    }

    /**
     * Update theme display
     */
    updateThemeDisplay(theme) {
        this.updateThemeUI(theme);
        console.log('🎨 [GlobalNavbar] Theme updated to:', theme);
    }

    /**
     * Toggle theme
     */
    async toggleTheme() {
        if (window.themeManager) {
            await window.themeManager.toggleTheme();
            console.log('🎨 [GlobalNavbar] Theme toggled via ThemeManager');
        } else {
            // Fallback to localStorage
            const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            this.setTheme(newTheme);
            console.log('🎨 [GlobalNavbar] Theme toggled to:', newTheme);
        }
    }

    /**
     * Initialize notifications
     */
    async initializeNotifications() {
        try {
            const authToken = localStorage.getItem('authToken');
            if (authToken) {
                const response = await fetch('/api/notifications', {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    this.notifications = await response.json();
                    this.updateNotificationDisplay();
                }
            }
        } catch (error) {
            console.warn('⚠️ [GlobalNavbar] Failed to load notifications:', error);
        }
    }

    /**
     * Update notification display
     */
    updateNotificationDisplay() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        
        if (this.elements.notificationBadge) {
            this.elements.notificationBadge.textContent = unreadCount;
            this.elements.notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
        
        if (this.elements.notificationList) {
            if (this.notifications.length === 0) {
                this.elements.notificationList.innerHTML = '<div class="notification-empty">No new notifications</div>';
            } else {
                this.elements.notificationList.innerHTML = this.notifications.map(notification => `
                    <div class="notification-item ${notification.read ? 'read' : 'unread'}">
                        <div class="notification-content">
                            <div class="notification-title">${notification.title}</div>
                            <div class="notification-message">${notification.message}</div>
                            <div class="notification-time">${this.formatTime(notification.createdAt)}</div>
                        </div>
                    </div>
                `).join('');
            }
        }
    }

    /**
     * Initialize search
     */
    initializeSearch() {
        this.searchResults = [];
        console.log('🔍 [GlobalNavbar] Search initialized');
    }

    /**
     * Initialize mobile menu
     */
    initializeMobileMenu() {
        this.isMobileMenuOpen = false;
        console.log('📱 [GlobalNavbar] Mobile menu initialized');
    }

    /**
     * Update authentication status
     */
    updateAuthStatus() {
        console.log('🔐 [GlobalNavbar] Updating auth status...');
        
        if (!this.elements) {
            console.warn('⚠️ [GlobalNavbar] Elements not initialized, skipping auth status update');
            return;
        }
        
        const authToken = localStorage.getItem('accessToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
        const userData = localStorage.getItem('userData') || localStorage.getItem('user');
        
        if (authToken && userData) {
            try {
                const user = JSON.parse(userData);
                console.log('👤 [GlobalNavbar] User data found:', user);
                
                // Update user display
                if (this.elements.userName) {
                    this.elements.userName.textContent = user.username || user.email || 'User';
                    console.log('✅ [GlobalNavbar] Updated userName to:', user.username || user.email || 'User');
                } else {
                    console.log('ℹ️ [GlobalNavbar] userName element not found (optional)');
                }
                if (this.elements.userNameLarge) {
                    this.elements.userNameLarge.textContent = user.username || user.email || 'User';
                    console.log('✅ [GlobalNavbar] Updated userNameLarge to:', user.username || user.email || 'User');
                } else {
                    console.log('ℹ️ [GlobalNavbar] userNameLarge element not found (optional)');
                }
                if (this.elements.userEmail) {
                    this.elements.userEmail.textContent = user.email || '';
                    console.log('✅ [GlobalNavbar] Updated userEmail to:', user.email || '');
                } else {
                    console.log('ℹ️ [GlobalNavbar] userEmail element not found (optional)');
                }
                
                // Update avatar
                if (this.elements.userAvatar) {
                    this.elements.userAvatar.innerHTML = `<i class="fas fa-user"></i>`;
                }
                if (this.elements.userAvatarLarge) {
                    this.elements.userAvatarLarge.innerHTML = `<i class="fas fa-user"></i>`;
                }
                
                // Show logout, hide login
                if (this.elements.logoutLink) {
                    this.elements.logoutLink.style.display = 'block';
                    console.log('✅ [GlobalNavbar] Showing logout button');
                } else {
                    console.log('ℹ️ [GlobalNavbar] logoutLink element not found (optional)');
                }
                if (this.elements.loginLink) {
                    this.elements.loginLink.style.display = 'none';
                    console.log('✅ [GlobalNavbar] Hiding login button');
                } else {
                    console.log('ℹ️ [GlobalNavbar] loginLink element not found (optional)');
                }
                
                console.log('✅ [GlobalNavbar] Auth status updated successfully');
            } catch (error) {
                console.error('❌ [GlobalNavbar] Error parsing user data:', error);
            }
        } else {
            console.log('👤 [GlobalNavbar] No auth data found, showing guest');
            
            // Show guest state
            if (this.elements.userName) {
                this.elements.userName.textContent = 'Guest';
            }
            if (this.elements.userNameLarge) {
                this.elements.userNameLarge.textContent = 'Guest User';
            }
            if (this.elements.userEmail) {
                this.elements.userEmail.textContent = 'guest@example.com';
            }
            
            // Show login, hide logout
            if (this.elements.loginLink) {
                this.elements.loginLink.style.display = 'block';
            }
            if (this.elements.logoutLink) {
                this.elements.logoutLink.style.display = 'none';
            }
        }
    }

    /**
     * Handle global clicks
     */
    handleClick(event) {
        // Close dropdowns when clicking outside
        if (!event.target.closest('.dropdown') && !event.target.closest('.search-container') && 
            !event.target.closest('.notification-container') && !event.target.closest('.user-menu-container')) {
            this.closeAllDropdowns();
        }
    }

    /**
     * Handle global keydown events
     */
    handleKeydown(event) {
        // Close dropdowns on Escape
        if (event.key === 'Escape') {
            this.closeAllDropdowns();
            this.closeMobileMenu();
        }
        
        // Search shortcut (Ctrl/Cmd + K)
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            this.toggleSearch();
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Close mobile menu on desktop
        if (window.innerWidth > 768 && this.isMobileMenuOpen) {
            this.closeMobileMenu();
        }
    }

    /**
     * Toggle search dropdown
     */
    toggleSearch() {
        if (this.elements.searchDropdown) {
            const isActive = this.elements.searchDropdown.classList.contains('active');
            this.elements.searchDropdown.classList.toggle('active');
            
            // Close other dropdowns
            this.closeOtherDropdowns('search');
            
            if (this.elements.searchDropdown.classList.contains('active')) {
                this.elements.searchInput?.focus();
            }
            console.log('🔍 [GlobalNavbar] Search toggled:', !isActive ? 'opened' : 'closed');
        } else {
            console.warn('⚠️ [GlobalNavbar] Search dropdown not found');
        }
    }

    /**
     * Handle search input
     */
    async handleSearch(event) {
        const query = event.target.value.trim();
        
        if (query.length < 2) {
            this.searchResults = [];
            this.updateSearchResults();
            return;
        }
        
        try {
            // Search across different content types
            const searchPromises = [
                this.searchTranslations(query),
                this.searchPrayerTimes(query),
                this.searchQuran(query),
                this.searchDuas(query)
            ];
            
            const results = await Promise.all(searchPromises);
            this.searchResults = results.flat();
            this.updateSearchResults();
        } catch (error) {
            console.error('❌ [GlobalNavbar] Search failed:', error);
        }
    }

    /**
     * Search translations
     */
    async searchTranslations(query) {
        try {
            const response = await fetch(`/api/search/translations?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                return data.map(item => ({
                    type: 'translation',
                    title: item.original,
                    subtitle: item.translated,
                    url: `/translator/text-translator?search=${encodeURIComponent(item.original)}`
                }));
            }
        } catch (error) {
            console.warn('⚠️ [GlobalNavbar] Translation search failed:', error);
        }
        return [];
    }

    /**
     * Search prayer times
     */
    async searchPrayerTimes(query) {
        // Mock search - replace with actual API
        return [];
    }

    /**
     * Search Quran
     */
    async searchQuran(query) {
        try {
            const response = await fetch(`/api/quran/search?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                return data.map(item => ({
                    type: 'quran',
                    title: `Surah ${item.surahName}, Verse ${item.verseNumber}`,
                    subtitle: item.text,
                    url: `/explorer.html?surah=${item.surahNumber}&verse=${item.verseNumber}`
                }));
            }
        } catch (error) {
            console.warn('⚠️ [GlobalNavbar] Quran search failed:', error);
        }
        return [];
    }

    /**
     * Search duas
     */
    async searchDuas(query) {
        try {
            const response = await fetch(`/api/duas/search?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                return data.map(item => ({
                    type: 'dua',
                    title: item.title,
                    subtitle: item.arabic,
                    url: `/duas.html?id=${item.id}`
                }));
            }
        } catch (error) {
            console.warn('⚠️ [GlobalNavbar] Duas search failed:', error);
        }
        return [];
    }

    /**
     * Update search results display
     */
    updateSearchResults() {
        if (!this.elements.searchResults) return;
        
        if (this.searchResults.length === 0) {
            this.elements.searchResults.innerHTML = '<div class="search-empty">No results found</div>';
        } else {
            this.elements.searchResults.innerHTML = this.searchResults.map(result => `
                <div class="search-result" onclick="window.location.href='${result.url}'">
                    <div class="search-result-type">${result.type}</div>
                    <div class="search-result-title">${result.title}</div>
                    <div class="search-result-subtitle">${result.subtitle}</div>
                </div>
            `).join('');
        }
    }

    /**
     * Toggle notifications dropdown
     */
    toggleNotifications() {
        if (this.elements.notificationDropdown) {
            const isActive = this.elements.notificationDropdown.classList.contains('active');
            this.elements.notificationDropdown.classList.toggle('active');
            
            // Close other dropdowns
            this.closeOtherDropdowns('notification');
            
            console.log('🔔 [GlobalNavbar] Notifications toggled:', !isActive ? 'opened' : 'closed');
        } else {
            console.warn('⚠️ [GlobalNavbar] Notification dropdown not found');
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllNotificationsRead() {
        try {
            const authToken = localStorage.getItem('authToken');
            if (authToken) {
                const response = await fetch('/api/notifications/mark-all-read', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    this.notifications.forEach(n => n.read = true);
                    this.updateNotificationDisplay();
                }
            }
        } catch (error) {
            console.error('❌ [GlobalNavbar] Failed to mark notifications as read:', error);
        }
    }

    /**
     * Toggle user menu
     */
    toggleUserMenu() {
        if (this.elements.userDropdown) {
            const isActive = this.elements.userDropdown.classList.contains('active');
            this.elements.userDropdown.classList.toggle('active');
            
            // Close other dropdowns
            this.closeOtherDropdowns('user');
            
            console.log('👤 [GlobalNavbar] User menu toggled:', !isActive ? 'opened' : 'closed');
        } else {
            console.warn('⚠️ [GlobalNavbar] User dropdown not found');
        }
    }
    
    /**
     * Close other dropdowns
     */
    closeOtherDropdowns(except = '') {
        const dropdowns = ['search', 'notification', 'user'];
        dropdowns.forEach(dropdown => {
            if (dropdown !== except) {
                const element = this.elements[`${dropdown}Dropdown`];
                if (element) {
                    element.classList.remove('active');
                }
            }
        });
    }

    /**
     * Handle login
     */
    handleLogin() {
        window.location.href = '/login.html';
    }

    /**
     * Handle logout
     */
    async handleLogout() {
        try {
            const authToken = localStorage.getItem('authToken');
            if (authToken) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.warn('⚠️ [GlobalNavbar] Logout API call failed:', error);
        } finally {
            // Clear local storage and redirect
            localStorage.removeItem('accessToken');
            localStorage.removeItem('authToken');
            localStorage.removeItem('token');
            localStorage.removeItem('jwt');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            localStorage.removeItem('userData');
            this.currentUser = null;
            this.updateUserDisplay();
            window.location.href = '/';
        }
    }

    /**
     * Toggle mobile menu
     */
    toggleMobileMenu() {
        this.isMobileMenuOpen = !this.isMobileMenuOpen;
        
        if (this.elements.mobileMenuToggle) {
            this.elements.mobileMenuToggle.classList.toggle('active', this.isMobileMenuOpen);
        }
        
        if (this.elements.mobileNavOverlay) {
            this.elements.mobileNavOverlay.classList.toggle('active', this.isMobileMenuOpen);
        }
        
        // Prevent body scroll when mobile menu is open
        document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : '';
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        this.isMobileMenuOpen = false;
        
        if (this.elements.mobileMenuToggle) {
            this.elements.mobileMenuToggle.classList.remove('active');
        }
        
        if (this.elements.mobileNavOverlay) {
            this.elements.mobileNavOverlay.classList.remove('active');
        }
        
        document.body.style.overflow = '';
    }

    /**
     * Close all dropdowns
     */
    closeAllDropdowns() {
        if (this.elements.searchDropdown) {
            this.elements.searchDropdown.classList.remove('active');
        }
        
        if (this.elements.notificationDropdown) {
            this.elements.notificationDropdown.classList.remove('active');
        }
        
        if (this.elements.userDropdown) {
            this.elements.userDropdown.classList.remove('active');
        }
        
        this.elements.dropdownMenus?.forEach(menu => {
            menu.classList.remove('active');
        });
    }

    /**
     * Format time for display
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            return `${Math.floor(diff / 60000)}m ago`;
        } else if (diff < 86400000) { // Less than 1 day
            return `${Math.floor(diff / 3600000)}h ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Destroy navbar (cleanup)
     */
    destroy() {
        document.removeEventListener('click', this.handleClick);
        document.removeEventListener('keydown', this.handleKeydown);
        window.removeEventListener('resize', this.handleResize);
        
        if (this.elements.navbar) {
            this.elements.navbar.remove();
        }
        
        this.isInitialized = false;
        console.log('🗑️ [GlobalNavbar] Navbar destroyed');
    }
}

// Global API for updating navbar state from anywhere in the application
window.updateNavbarState = function(newData) {
    if (window.globalNavbar) {
        window.globalNavbar.updateGlobalStateData(newData);
    } else {
        console.warn('⚠️ [GlobalNavbar] Navbar not initialized yet, storing state for later');
        // Store state to be applied when navbar is initialized
        Object.assign(window.GlobalNavbarState, newData, {
            lastUpdate: Date.now()
        });
    }
};

// Global API for getting current navbar state
window.getNavbarState = function() {
    return window.GlobalNavbarState;
};

// Global API for triggering navbar updates
window.triggerNavbarUpdate = function(eventType, data) {
    window.GlobalNavbarEvents.notify(eventType, data);
};

// Initialize global navbar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only create if not already created by individual pages
    if (!window.globalNavbar) {
        window.globalNavbar = new GlobalNavbar();
    }
});

// Export for use in other modules
window.GlobalNavbar = GlobalNavbar;
