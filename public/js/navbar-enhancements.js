/**
 * Navbar Enhancements
 * Additional functionality to make the navbar fully functional
 */

class NavbarEnhancements {
    constructor() {
        this.isInitialized = false;
        this.enhancements = {
            search: false,
            notifications: false,
            userMenu: false,
            theme: false,
            mobile: false,
            dropdowns: false
        };

        this.init();
    }

    async init() {
        if (this.isInitialized) return;

        console.log('🚀 [NavbarEnhancements] Initializing enhancements...');

        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initializeEnhancements());
            } else {
                this.initializeEnhancements();
            }

            this.isInitialized = true;
            console.log('✅ [NavbarEnhancements] Enhancements initialized');
        } catch (error) {
            console.error('❌ [NavbarEnhancements] Failed to initialize:', error);
        }
    }

    initializeEnhancements() {
        // Initialize each enhancement
        this.enhanceSearch();
        this.enhanceNotifications();
        this.enhanceUserMenu();
        this.enhanceTheme();
        this.enhanceMobile();
        this.enhanceDropdowns();
        this.enhanceKeyboardNavigation();
        this.enhanceAccessibility();

        console.log('🎯 [NavbarEnhancements] All enhancements applied');
    }

    /**
     * Enhance search functionality
     */
    enhanceSearch() {
        const searchInput = document.getElementById('global-search');
        const searchResults = document.getElementById('search-results');

        if (!searchInput || !searchResults) {
            console.warn('⚠️ [NavbarEnhancements] Search elements not found');
            return;
        }

        // Add search suggestions
        const suggestions = [
            'Prayer Times', 'Qibla Direction', 'Moon Status',
            'Quran Explorer', 'Daily Duas', '99 Names',
            'Zakat Calculator', 'Date Converter', 'Islamic Calendar',
            'Analytics', 'Translation History', 'Profile'
        ];

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length < 2) {
                searchResults.innerHTML = '<div class="search-empty">Type to search...</div>';
                return;
            }

            const filtered = suggestions.filter(item =>
                item.toLowerCase().includes(query)
            );

            if (filtered.length > 0) {
                searchResults.innerHTML = filtered.map(item => `
                    <div class="search-result-item" onclick="this.selectSearchResult('${item}')">
                        <i class="fas fa-search"></i>
                        <span>${item}</span>
                    </div>
                `).join('');
            } else {
                searchResults.innerHTML = '<div class="search-empty">No results found</div>';
            }
        });

        // Add keyboard navigation
        searchInput.addEventListener('keydown', (e) => {
            const results = searchResults.querySelectorAll('.search-result-item');
            const current = searchResults.querySelector('.search-result-item.active');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (current) {
                    current.classList.remove('active');
                    const next = current.nextElementSibling;
                    if (next) next.classList.add('active');
                } else if (results.length > 0) {
                    results[0].classList.add('active');
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (current) {
                    current.classList.remove('active');
                    const prev = current.previousElementSibling;
                    if (prev) prev.classList.add('active');
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (current) {
                    current.click();
                }
            } else if (e.key === 'Escape') {
                searchInput.blur();
                document.getElementById('search-dropdown')?.classList.remove('active');
            }
        });

        this.enhancements.search = true;
        console.log('🔍 [NavbarEnhancements] Search enhanced');
    }

    /**
     * Enhance notifications functionality
     */
    enhanceNotifications() {
        const notificationToggle = document.getElementById('notification-toggle');
        const notificationList = document.getElementById('notification-list');

        if (!notificationToggle || !notificationList) {
            console.warn('⚠️ [NavbarEnhancements] Notification elements not found');
            return;
        }

        // Add sample notifications
        const sampleNotifications = [
            {
                id: 1,
                title: 'Welcome to Islamic Portal',
                message: 'Your account has been created successfully',
                time: '2 minutes ago',
                type: 'success',
                read: false
            },
            {
                id: 2,
                title: 'Prayer Time Reminder',
                message: 'Maghrib prayer time is approaching',
                time: '15 minutes ago',
                type: 'info',
                read: false
            },
            {
                id: 3,
                title: 'Translation Complete',
                message: 'Your text has been translated successfully',
                time: '1 hour ago',
                type: 'success',
                read: true
            }
        ];

        // Render notifications
        this.renderNotifications(sampleNotifications);

        // Add real-time updates
        setInterval(() => {
            this.updateNotificationBadge();
        }, 5000);

        this.enhancements.notifications = true;
        console.log('🔔 [NavbarEnhancements] Notifications enhanced');
    }

    /**
     * Render notifications
     */
    renderNotifications(notifications) {
        const notificationList = document.getElementById('notification-list');
        if (!notificationList) return;

        if (notifications.length === 0) {
            notificationList.innerHTML = '<div class="notification-empty">No new notifications</div>';
            return;
        }

        notificationList.innerHTML = notifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}" data-id="${notification.id}">
                <div class="notification-icon ${notification.type}">
                    <i class="fas fa-${this.getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${notification.time}</div>
                </div>
                <button class="notification-close" onclick="this.removeNotification(${notification.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    /**
     * Get notification icon based on type
     */
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            info: 'info-circle',
            warning: 'exclamation-triangle',
            error: 'times-circle'
        };
        return icons[type] || 'bell';
    }

    /**
     * Update notification badge
     */
    updateNotificationBadge() {
        const badge = document.getElementById('notification-badge');
        const unreadCount = document.querySelectorAll('.notification-item.unread').length;

        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
        }
    }

    /**
     * Enhance user menu functionality
     */
    enhanceUserMenu() {
        const userToggle = document.getElementById('user-toggle');
        const userDropdown = document.getElementById('user-dropdown');

        if (!userToggle || !userDropdown) {
            console.warn('⚠️ [NavbarEnhancements] User menu elements not found');
            return;
        }

        // Check authentication status
        this.updateUserMenu();

        // Add click outside to close
        document.addEventListener('click', (e) => {
            if (!userToggle.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        });

        this.enhancements.userMenu = true;
        console.log('👤 [NavbarEnhancements] User menu enhanced');
    }

    /**
     * Update user menu based on authentication
     */
    updateUserMenu() {
        const isAuthenticated = window.tokenManager && window.tokenManager.isAuthenticated && window.tokenManager.isAuthenticated();

        const loginLink = document.getElementById('login-link');
        const logoutLink = document.getElementById('logout-link');
        const userName = document.getElementById('user-name');
        const userNameLarge = document.getElementById('user-name-large');
        const userEmail = document.getElementById('user-email');

        if (isAuthenticated) {
            // User is logged in
            if (loginLink) loginLink.style.display = 'none';
            if (logoutLink) logoutLink.style.display = 'block';

            // Try to use global navbar cache if present
            const userInfo = (window.globalNavbar && window.globalNavbar.currentUser) ? window.globalNavbar.currentUser : {};
            if (userName) userName.textContent = userInfo.username || userInfo.name || 'User';
            if (userNameLarge) userNameLarge.textContent = userInfo.username || userInfo.name || 'User';
            if (userEmail) userEmail.textContent = userInfo.email || 'user@example.com';
        } else {
            // User is not logged in
            if (loginLink) loginLink.style.display = 'block';
            if (logoutLink) logoutLink.style.display = 'none';

            if (userName) userName.textContent = 'Guest';
            if (userNameLarge) userNameLarge.textContent = 'Guest User';
            if (userEmail) userEmail.textContent = 'guest@example.com';
        }
    }

    /**
     * Get user info from token (simplified)
     */
    getUserInfoFromToken(token) {
        try {
            // In a real app, you'd decode the JWT token
            // For now, return default values
            return {
                name: 'John Doe',
                email: 'john@example.com'
            };
        } catch (error) {
            return {
                name: 'User',
                email: 'user@example.com'
            };
        }
    }

    /**
     * Enhance theme functionality
     */
    enhanceTheme() {
        const themeToggle = document.getElementById('theme-toggle');

        if (!themeToggle) {
            console.warn('⚠️ [NavbarEnhancements] Theme toggle not found');
            return;
        }

        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        this.setTheme(savedTheme);

        // Add smooth transitions
        document.documentElement.style.transition = 'all 0.3s ease';

        this.enhancements.theme = true;
        console.log('🎨 [NavbarEnhancements] Theme enhanced');
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        document.body.className = theme === 'light' ? 'light-mode' : 'dark-mode';
        localStorage.setItem('theme', theme);

        // Update theme icons
        const lightIcon = document.querySelector('.theme-icon-light');
        const darkIcon = document.querySelector('.theme-icon-dark');

        if (lightIcon && darkIcon) {
            if (theme === 'light') {
                lightIcon.style.display = 'none';
                darkIcon.style.display = 'block';
            } else {
                lightIcon.style.display = 'block';
                darkIcon.style.display = 'none';
            }
        }
    }

    /**
     * Enhance mobile functionality
     */
    enhanceMobile() {
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const mobileNavOverlay = document.getElementById('mobile-nav-overlay');

        if (!mobileMenuToggle || !mobileNavOverlay) {
            console.warn('⚠️ [NavbarEnhancements] Mobile elements not found');
            return;
        }

        // Add swipe gestures
        let startX = 0;
        let startY = 0;

        mobileNavOverlay.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        mobileNavOverlay.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = startX - endX;
            const diffY = startY - endY;

            // Swipe right to close
            if (diffX < -50 && Math.abs(diffY) < 50) {
                this.closeMobileMenu();
            }
        });

        // Add escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileNavOverlay.classList.contains('active')) {
                this.closeMobileMenu();
            }
        });

        this.enhancements.mobile = true;
        console.log('📱 [NavbarEnhancements] Mobile enhanced');
    }

    /**
     * Close mobile menu
     */
    closeMobileMenu() {
        const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
        if (mobileNavOverlay) {
            mobileNavOverlay.classList.remove('active');
        }
    }

    /**
     * Enhance dropdowns
     */
    enhanceDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown');

        dropdowns.forEach(dropdown => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            const menu = dropdown.querySelector('.dropdown-menu');

            if (!toggle || !menu) return;

            // Add hover delay
            let hoverTimeout;

            dropdown.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => {
                    menu.classList.add('active');
                }, 200);
            });

            dropdown.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => {
                    menu.classList.remove('active');
                }, 300);
            });

            // Add click to toggle on mobile
            toggle.addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    menu.classList.toggle('active');
                }
            });
        });

        this.enhancements.dropdowns = true;
        console.log('📋 [NavbarEnhancements] Dropdowns enhanced');
    }

    /**
     * Enhance keyboard navigation
     */
    enhanceKeyboardNavigation() {
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Alt + S for search
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                const searchToggle = document.getElementById('search-toggle');
                if (searchToggle) searchToggle.click();
            }

            // Alt + N for notifications
            if (e.altKey && e.key === 'n') {
                e.preventDefault();
                const notificationToggle = document.getElementById('notification-toggle');
                if (notificationToggle) notificationToggle.click();
            }

            // Alt + U for user menu
            if (e.altKey && e.key === 'u') {
                e.preventDefault();
                const userToggle = document.getElementById('user-toggle');
                if (userToggle) userToggle.click();
            }

            // Alt + T for theme toggle
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                const themeToggle = document.getElementById('theme-toggle');
                if (themeToggle) themeToggle.click();
            }
        });

        console.log('⌨️ [NavbarEnhancements] Keyboard navigation enhanced');
    }

    /**
     * Enhance accessibility
     */
    enhanceAccessibility() {
        // Add ARIA labels
        const elements = [
            { selector: '#search-toggle', label: 'Open search' },
            { selector: '#notification-toggle', label: 'Open notifications' },
            { selector: '#user-toggle', label: 'Open user menu' },
            { selector: '#theme-toggle', label: 'Toggle theme' },
            { selector: '#mobile-menu-toggle', label: 'Open mobile menu' }
        ];

        elements.forEach(({ selector, label }) => {
            const element = document.querySelector(selector);
            if (element && !element.getAttribute('aria-label')) {
                element.setAttribute('aria-label', label);
            }
        });

        // Add focus management
        const focusableElements = document.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        focusableElements.forEach(element => {
            element.addEventListener('focus', () => {
                element.style.outline = '2px solid #4f46e5';
                element.style.outlineOffset = '2px';
            });

            element.addEventListener('blur', () => {
                element.style.outline = 'none';
            });
        });

        console.log('♿ [NavbarEnhancements] Accessibility enhanced');
    }
}

// Global functions for HTML onclick handlers
window.selectSearchResult = function(result) {
    console.log('🔍 [NavbarEnhancements] Search result selected:', result);
    // Implement search result selection logic
};

window.removeNotification = function(id) {
    console.log('🔔 [NavbarEnhancements] Removing notification:', id);
    const notification = document.querySelector(`[data-id="${id}"]`);
    if (notification) {
        notification.remove();
    }
};

// Initialize enhancements when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.navbarEnhancements = new NavbarEnhancements();
    });
} else {
    window.navbarEnhancements = new NavbarEnhancements();
}
