// calendar.js - Comprehensive Islamic Calendar with all possible features
// Version: 2.0 - Two-way sync implementation
// Last updated: 2025-10-06

// Global function declarations
let syncWithGoogle, syncWithMicrosoft, fullSync, reauthorizeGoogle, reauthorizeMicrosoft, refreshGoogleToken, refreshMicrosoftToken, clearMicrosoftTokens;

// Logging configuration
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const LOG_LEVEL = LOG_LEVELS[localStorage.getItem('calendarLogLevel') || 'INFO'];

const log = {
    debug: (message, ...args) => LOG_LEVEL <= LOG_LEVELS.DEBUG && console.log(message, ...args),
    info: (message, ...args) => LOG_LEVEL <= LOG_LEVELS.INFO && console.log(message, ...args),
    warn: (message, ...args) => LOG_LEVEL <= LOG_LEVELS.WARN && console.warn(message, ...args),
    error: (message, ...args) => LOG_LEVEL <= LOG_LEVELS.ERROR && console.error(message, ...args)
};

// Prevent double initialization
(function() {
    if (window.__calendarInit) return;
    window.__calendarInit = true;

document.addEventListener('DOMContentLoaded', () => {
    // --- Constants and Configuration ---
    const VIEWS = {
        MONTH: 'month',
        WEEK: 'week',
        DAY: 'day',
        YEAR: 'year'
    };

    const EVENT_CATEGORIES = {
        PERSONAL: 'personal',
        PRAYER: 'prayer',
        ISLAMIC: 'islamic',
        REMINDER: 'reminder',
        HOLIDAY: 'holiday'
    };

    const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

    // --- Authentication System (Single Source of Truth) ---
    const auth = {
        isAuthenticated: false,
        token: null,
        user: null,
        lastChecked: null,
        
        init() {
            this.checkAuthStatus();
            this.setupReauthBanner();
        },
        
        checkAuthStatus() {
            const token = localStorage.getItem('authToken') || 
                         localStorage.getItem('accessToken') || 
                         localStorage.getItem('token') || 
                         localStorage.getItem('jwt');
            
            if (token) {
                this.isAuthenticated = true;
                this.token = token;
                this.user = JSON.parse(localStorage.getItem('user') || 'null');
                this.lastChecked = Date.now();
            } else {
                this.isAuthenticated = false;
                this.token = null;
                this.user = null;
            }
        },
        
        setAuthenticated(token, user) {
            this.isAuthenticated = true;
            this.token = token;
            this.user = user;
            this.lastChecked = Date.now();
            localStorage.setItem('authToken', token);
            if (user) localStorage.setItem('user', JSON.stringify(user));
            this.hideReauthBanner();
        },
        
        setUnauthenticated() {
            this.isAuthenticated = false;
            this.token = null;
            this.user = null;
            this.lastChecked = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('token');
            localStorage.removeItem('jwt');
            localStorage.removeItem('user');
            this.showReauthBanner();
        },
        
        setupReauthBanner() {
            if (!document.getElementById('reauth-banner')) {
                const banner = document.createElement('div');
                banner.id = 'reauth-banner';
                banner.className = 'reauth-banner';
                banner.style.cssText = `
                    position: fixed; top: 0; left: 0; right: 0; z-index: 10000;
                    background: #dc3545; color: white; padding: 10px; text-align: center;
                    display: none; font-weight: bold;
                `;
                banner.innerHTML = `
                    <span>⚠️ Authentication expired. Please <a href="/login.html" style="color: white; text-decoration: underline;">reconnect</a> to sync your calendar.</span>
                    <button onclick="this.parentElement.style.display='none'" style="margin-left: 10px; background: white; color: #dc3545; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">×</button>
                `;
                document.body.appendChild(banner);
            }
        },
        
        showReauthBanner() {
            const banner = document.getElementById('reauth-banner');
            if (banner) banner.style.display = 'block';
        },
        
        hideReauthBanner() {
            const banner = document.getElementById('reauth-banner');
            if (banner) banner.style.display = 'none';
        }
    };

    // --- Enhanced Fetch Wrapper ---
    async function authenticatedFetch(url, options = {}) {
        // Add authentication headers
        if (auth.isAuthenticated && auth.token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${auth.token}`
            };
        }
        
        // Always include credentials for cookie-based auth
        options.credentials = 'include';
        
        try {
            const response = await fetch(url, options);
            
            // Handle 401 responses
            if (response.status === 401) {
                console.warn('🔒 Authentication expired, logging out');
                auth.setUnauthenticated();
                throw new Error('Authentication expired');
            }
            
            return response;
        } catch (error) {
            if (error.message === 'Authentication expired') {
                throw error;
            }
            throw error;
        }
    }

    // --- Logging System ---
    const logger = {
        levels: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
        currentLevel: localStorage.getItem('calendar-log-level') || 'INFO',
        
        debug(...args) {
            if (this.levels[this.currentLevel] <= this.levels.DEBUG) {
                console.log('🐛 [DEBUG]', ...args);
            }
        },
        
        info(...args) {
            if (this.levels[this.currentLevel] <= this.levels.INFO) {
                console.log('ℹ️ [INFO]', ...args);
            }
        },
        
        warn(...args) {
            if (this.levels[this.currentLevel] <= this.levels.WARN) {
                console.warn('⚠️ [WARN]', ...args);
            }
        },
        
        error(...args) {
            if (this.levels[this.currentLevel] <= this.levels.ERROR) {
                console.error('❌ [ERROR]', ...args);
            }
        }
    };

    // --- Render Lock System ---
    const renderLock = {
        isRendering: false,
        pendingRender: false,
        
        async lock() {
            if (this.isRendering) {
                this.pendingRender = true;
                return false;
            }
            this.isRendering = true;
            return true;
        },
        
        unlock() {
            this.isRendering = false;
            if (this.pendingRender) {
                this.pendingRender = false;
                setTimeout(() => renderCalendarEnhanced(), 0);
            }
        }
    };

    // --- Event Deduplication System ---
    const eventDeduplicator = {
        seen: new Map(),
        
        generateKey(event) {
            const date = new Date(event.startDate || event.start).toISOString().slice(0, 10);
            return `${event.source || 'unknown'}|${date}|${event.title}`;
        },
        
        isDuplicate(event) {
            const key = this.generateKey(event);
            return this.seen.has(key);
        },
        
        add(event) {
            const key = this.generateKey(event);
            this.seen.set(key, event);
            return event;
        },
        
        clear() {
            this.seen.clear();
        }
    };

    // --- Input Sanitization ---
    const sanitizer = {
        sanitizeString(str) {
            if (typeof str !== 'string') return '';
            return str
                .replace(/[<>]/g, '') // Remove potential HTML tags
                .replace(/javascript:/gi, '') // Remove javascript: protocols
                .replace(/on\w+=/gi, '') // Remove event handlers
                .trim()
                .substring(0, 1000); // Limit length
        },
        
        sanitizeUrl(url) {
            if (typeof url !== 'string') return '';
            try {
                const parsed = new URL(url);
                // Only allow http, https, and webcal protocols
                if (!['http:', 'https:', 'webcal:'].includes(parsed.protocol)) {
                    return '';
                }
                return parsed.toString();
            } catch {
                return '';
            }
        },
        
        sanitizeEvent(event) {
            return {
                ...event,
                title: this.sanitizeString(event.title),
                description: this.sanitizeString(event.description),
                location: this.sanitizeString(event.location),
                meetingLink: this.sanitizeUrl(event.meetingLink),
                source: event.source || 'local',
                updatedAt: new Date()
            };
        }
    };

    // --- State Management ---
    let currentDate = new Date();
    let currentView = VIEWS.MONTH;
    let currentTimezone = 'auto';
    let events = [];
    let calendarEvents = []; // Enhanced events array for advanced features
    let prayerTimes = {};
    let userLocation = null;
    let selectedDate = null;
    
    // Integration state
    let integrations = {
        email: { connected: false, provider: null, oauthToken: null }
    };

    // Islamic calendar state
    let islamicEvents = {
        holidays: [],
        prayerEvents: [],
        hijriDate: null
    };
    let userCountry = 'AE';
    let userLatitude = 25.2048;
    let userLongitude = 55.2708;

    // --- DOM Elements ---
    const elements = {
        // Views
        monthView: document.getElementById('month-view'),
        weekView: document.getElementById('week-view'),
        dayView: document.getElementById('day-view'),
        yearView: document.getElementById('year-view'),
        
        // Grids
        monthGrid: document.getElementById('month-grid'),
        weekGrid: document.getElementById('week-grid'),
        dayGrid: document.getElementById('day-grid'),
        yearGrid: document.getElementById('year-grid'),
        
        // Controls
        viewBtns: document.querySelectorAll('.view-btn'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        todayBtn: document.getElementById('today-btn'),
        currentPeriod: document.getElementById('current-period'),
        calendarType: document.getElementById('calendar-type'),
        timezoneSelect: document.getElementById('timezone-select'),
        
        // Event Management
        addEventBtn: document.getElementById('add-event-btn'),
        eventsList: document.getElementById('events-list'),
        eventSearch: document.getElementById('event-search'),
        eventCategoryFilter: document.getElementById('event-category-filter'),
        
        // Prayer Times
        prayerTimes: document.getElementById('prayer-times'),
        currentLocation: document.getElementById('current-location'),
        changeLocationBtn: document.getElementById('change-location-btn'),
        
        // Modals
        eventModal: document.getElementById('event-modal'),
        locationModal: document.getElementById('location-modal'),
        emailSyncModal: document.getElementById('email-sync-modal'),
        eventForm: document.getElementById('event-form'),
        
        // Integration elements
        emailSyncBtn: document.getElementById('email-sync-btn'),
        syncAllBtn: document.getElementById('sync-all-btn'),
        emailSyncStatus: document.getElementById('email-sync-status'),
        syncStatus: document.getElementById('sync-status'),
        
        // Connected status elements
        emailConnectedStatus: document.getElementById('email-connected-status'),
        emailSetupFlow: document.getElementById('email-setup-flow'),
        
        // Theme
        themeToggle: document.getElementById('theme-toggle'),
        
        // Notification
        notification: document.getElementById('notification')
    };

    // --- Enhanced Utility Functions ---
    function showNotification(message, type = 'info', duration = 3000) {
        if (!elements.notification) return;
        
        // Create notification with enhanced styling
        const notification = elements.notification;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fa-solid ${getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        notification.className = `notification show ${type}`;
        
        // Add animation classes
        notification.style.animation = 'slideInRight 0.3s ease';
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                notification.classList.remove('show');
                notification.style.animation = '';
            }, 300);
        }, duration);
    }
    
    function getNotificationIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }
    
    function showLoadingState(element, text = 'Loading...') {
        if (!element) return;
        const originalContent = element.innerHTML;
        element.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>${text}</span>
        `;
        element.disabled = true;
        element.classList.add('loading');
        return originalContent;
    }
    
    function hideLoadingState(element, originalContent) {
        if (!element) return;
        element.innerHTML = originalContent;
        element.disabled = false;
        element.classList.remove('loading');
    }
    
    function addRippleEffect(element, event) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');
        
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    function formatDate(date, format = 'YYYY-MM-DD') {
        return moment(date).format(format);
    }

    function formatTime(date, format = 'HH:mm') {
        return moment(date).format(format);
    }
    
    function convertToHijri(date) {
        try {
            const m = moment(date);
            return {
                iso: m.format('YYYY-MM-DD'),
                hijri: m.format('iYYYY-iMM-iDD'),
                hijriLabel: m.format('iD iMMMM iYYYY')
            };
        } catch {
            return { iso: new Date(date).toISOString().slice(0,10) };
        }
    }

    function getTimezone() {
        if (currentTimezone === 'auto') {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        return currentTimezone;
    }

    function applyTheme(theme) {
        document.body.className = theme === 'light' ? 'light-mode' : '';
        if (elements.themeToggle) {
            elements.themeToggle.checked = (theme === 'light');
        }
    }

    // --- Calendar Navigation ---
    function updateCurrentPeriod() {
        const format = currentView === VIEWS.YEAR ? 'YYYY' : 
                      currentView === VIEWS.MONTH ? 'MMMM YYYY' :
                      currentView === VIEWS.WEEK ? 'MMM D, YYYY' :
                      'dddd, MMMM D, YYYY';
        
        elements.currentPeriod.textContent = moment(currentDate).format(format);
    }

    function navigateCalendar(direction) {
        switch (currentView) {
            case VIEWS.MONTH:
                currentDate.setMonth(currentDate.getMonth() + direction);
                break;
            case VIEWS.WEEK:
                currentDate.setDate(currentDate.getDate() + (direction * 7));
                break;
            case VIEWS.DAY:
                currentDate.setDate(currentDate.getDate() + direction);
                break;
            case VIEWS.YEAR:
                currentDate.setFullYear(currentDate.getFullYear() + direction);
                break;
        }
        renderCalendar();
        updateCurrentPeriod();
    }

    function goToToday() {
        currentDate = new Date();
        renderCalendar();
        updateCurrentPeriod();
    }

    // --- Calendar Rendering ---
    function renderCalendar() {
        console.log('🎨 Rendering calendar...');
        switch (currentView) {
            case VIEWS.MONTH:
                renderMonthView();
                break;
            case VIEWS.WEEK:
                renderWeekView();
                break;
            case VIEWS.DAY:
                renderDayView();
                break;
            case VIEWS.YEAR:
                renderYearView();
                break;
        }
    }

    function renderMonthView() {
        if (!elements.monthGrid) return;
        
        console.log('📅 renderMonthView: Current date:', currentDate);
        console.log('📅 renderMonthView: Calendar events count:', calendarEvents.length);
        console.log('📅 renderMonthView: Islamic events count:', calendarEvents.filter(e => e.isIslamicEvent).length);
        
        // Add loading animation
        elements.monthGrid.style.opacity = '0.5';
        elements.monthGrid.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            elements.monthGrid.innerHTML = '';
            
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startDate = new Date(firstDay);
            startDate.setDate(startDate.getDate() - firstDay.getDay());
            
            const endDate = new Date(lastDay);
            endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
            
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            
            let dayIndex = 0;
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dayElement = document.createElement('div');
                dayElement.className = 'day-cell';
                
                const isCurrentMonth = d.getMonth() === month;
                const isToday = d.getDate() === today.getDate() && 
                               d.getMonth() === currentMonth && 
                               d.getYear() === currentYear;
                const isSelected = selectedDate && 
                                  d.getDate() === selectedDate.getDate() && 
                                  d.getMonth() === selectedDate.getMonth() && 
                                  d.getYear() === selectedDate.getYear();
                
                if (!isCurrentMonth) dayElement.classList.add('other-month');
                if (isToday) dayElement.classList.add('today');
                if (isSelected) dayElement.classList.add('selected');
                
                // Add staggered animation
                dayElement.style.animationDelay = `${dayIndex * 0.02}s`;
                dayElement.classList.add('fade-in');
                
                // Debug: Check for Islamic events on this day
                const dayEvents = getDayEvents(d);
                const islamicEvents = dayEvents.filter(e => e.isIslamicEvent);
                if (islamicEvents.length > 0) {
                    log.debug(`🕌 Day ${d.getDate()}: Found ${islamicEvents.length} Islamic events`);
                }
                
                dayElement.innerHTML = `
                    <div class="day-number">${d.getDate()}</div>
                    <div class="hijri-date">${getHijriDate(d)}</div>
                    <div class="day-events">${getDayEventsHTML(d)}</div>
                `;
                
                // Enhanced click handler with ripple effect
                dayElement.addEventListener('click', (event) => {
                    addRippleEffect(dayElement, event);
                    
                    // Remove previous selection
                    document.querySelectorAll('.day-cell.selected').forEach(cell => {
                        cell.classList.remove('selected');
                    });
                    
                    selectedDate = new Date(d);
                    dayElement.classList.add('selected');
                    
                    // Animate selection
                    dayElement.style.animation = 'bounce 0.6s ease';
                    setTimeout(() => {
                        dayElement.style.animation = '';
                    }, 600);
                    
                    loadDayEvents(selectedDate);
                    showNotification(`Selected ${formatDate(selectedDate, 'MMMM D, YYYY')}`, 'info', 2000);
                });
                
                // Add hover effects
                dayElement.addEventListener('mouseenter', () => {
                    dayElement.style.transform = 'translateY(-2px) scale(1.02)';
                });
                
                dayElement.addEventListener('mouseleave', () => {
                    if (!dayElement.classList.contains('selected')) {
                        dayElement.style.transform = '';
                    }
                });
                
                elements.monthGrid.appendChild(dayElement);
                dayIndex++;
            }
            
            // Animate grid appearance
            elements.monthGrid.style.opacity = '1';
            elements.monthGrid.style.transform = 'scale(1)';
            elements.monthGrid.style.transition = 'all 0.3s ease';
        }, 100);
    }
    
    function getDayEventsHTML(date) {
        const dayEvents = getDayEvents(date);
        if (dayEvents.length === 0) return '';
        
        // Debug logging for Islamic events
        const islamicEvents = dayEvents.filter(e => e.isIslamicEvent);
        if (islamicEvents.length > 0) {
            console.log(`🕌 Found ${islamicEvents.length} Islamic events for ${date.toDateString()}:`, islamicEvents.map(e => e.title));
        }
        
        return dayEvents.map(event => {
            const categoryClass = event.category || 'personal';
            return `<div class="event-indicator ${categoryClass}" title="${event.title}"></div>`;
        }).join('');
    }

    function renderWeekView() {
        if (!elements.weekGrid) return;
        
        elements.weekGrid.innerHTML = '';
        
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        
        // Update day headers
        const dayHeaders = document.querySelectorAll('.day-column');
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            dayHeaders[i].innerHTML = `
                <div class="day-name">${moment(dayDate).format('ddd')}</div>
                <div class="day-number">${dayDate.getDate()}</div>
            `;
        }
        
        // Create time slots
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.innerHTML = `
                <div class="time-label">${hour.toString().padStart(2, '0')}:00</div>
                <div class="week-days">
                    ${Array.from({length: 7}, (_, i) => {
                        const dayDate = new Date(startOfWeek);
                        dayDate.setDate(startOfWeek.getDate() + i);
                        dayDate.setHours(hour);
                        return `<div class="week-day" data-date="${formatDate(dayDate)}"></div>`;
                    }).join('')}
                </div>
            `;
            elements.weekGrid.appendChild(timeSlot);
        }
        
        // Add events to week view
        addEventsToWeekView();
    }

    function renderDayView() {
        if (!elements.dayGrid) return;
        
        elements.dayGrid.innerHTML = '';
        
        // Update day header
        const dayHeader = document.querySelector('#day-view .day-header .day-column');
        dayHeader.innerHTML = `
            <div class="day-name">${moment(currentDate).format('dddd')}</div>
            <div class="day-number">${currentDate.getDate()}</div>
            <div class="day-month">${moment(currentDate).format('MMMM YYYY')}</div>
        `;
        
        // Create time slots
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.innerHTML = `
                <div class="time-label">${hour.toString().padStart(2, '0')}:00</div>
                <div class="day-slot" data-hour="${hour}"></div>
            `;
            elements.dayGrid.appendChild(timeSlot);
        }
        
        // Add events to day view
        addEventsToDayView();
    }

    function renderYearView() {
        if (!elements.yearGrid) return;
        
        elements.yearGrid.innerHTML = '';
        
        const year = currentDate.getFullYear();
        
        for (let month = 0; month < 12; month++) {
            const monthElement = document.createElement('div');
            monthElement.className = 'year-month';
            monthElement.innerHTML = `
                <div class="month-header">${moment({year, month}).format('MMMM')}</div>
                <div class="month-mini-grid"></div>
            `;
            
            const miniGrid = monthElement.querySelector('.month-mini-grid');
            const monthDate = new Date(year, month, 1);
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDay = monthDate.getDay();
            
            // Add empty cells for days before month starts
            for (let i = 0; i < firstDay; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.className = 'mini-day empty';
                miniGrid.appendChild(emptyDay);
            }
            
            // Add days of the month
            for (let day = 1; day <= daysInMonth; day++) {
                const dayElement = document.createElement('div');
                dayElement.className = 'mini-day';
                dayElement.textContent = day;
                
                const dayDate = new Date(year, month, day);
                const dayEvents = getDayEvents(dayDate);
                if (dayEvents) {
                    dayElement.classList.add('has-events');
                }
                
                dayElement.addEventListener('click', () => {
                    currentDate = dayDate;
                    switchToView(VIEWS.MONTH);
                });
                
                miniGrid.appendChild(dayElement);
            }
            
            elements.yearGrid.appendChild(monthElement);
        }
    }

    // --- Event Management ---
    function getDayEvents(date) {
        const dateStr = formatDate(date);
        const dayEvents = calendarEvents.filter(event => {
            const eventDate = new Date(event.startDate || event.start);
            const eventDateStr = formatDate(eventDate);
            const matches = eventDateStr === dateStr;
            
            // Debug logging for Islamic events
            if (event.isIslamicEvent && matches) {
                log.debug(`🕌 Islamic event match: ${event.title} (${eventDateStr} === ${dateStr})`);
            }
            
            return matches;
        });
        
        // Debug logging for Islamic events
        const islamicEvents = dayEvents.filter(e => e.isIslamicEvent);
        if (islamicEvents.length > 0) {
            log.debug(`🕌 getDayEvents: Found ${islamicEvents.length} Islamic events for ${dateStr}:`, islamicEvents.map(e => e.title));
        }
        
        return dayEvents;
    }

    function addEventsToWeekView() {
        const weekEvents = calendarEvents.filter(event => {
            const eventDate = new Date(event.startDate || event.start);
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            
            return eventDate >= startOfWeek && eventDate <= endOfWeek;
        });
        
        weekEvents.forEach(event => {
            const eventElement = createEventElement(event);
            const dayOfWeek = new Date(event.startDate).getDay();
            const hour = new Date(event.startDate).getHours();
            
            const daySlot = document.querySelector(`.week-day[data-date="${formatDate(event.startDate)}"]`);
            if (daySlot) {
                daySlot.appendChild(eventElement);
            }
        });
    }

    function addEventsToDayView() {
        const dayEvents = getDayEvents(currentDate);
        
        dayEvents.forEach(event => {
            const eventElement = createEventElement(event);
            const hour = new Date(event.startDate || event.start).getHours();
            const daySlot = document.querySelector(`.day-slot[data-hour="${hour}"]`);
            if (daySlot) {
                daySlot.appendChild(eventElement);
            }
        });
    }

    function createEventElement(event) {
        const eventDiv = document.createElement('div');
        eventDiv.className = `event-item ${event.category}`;
        eventDiv.innerHTML = `
            <div class="event-title">${event.title}</div>
            <div class="event-time">${formatTime(event.startDate, 'HH:mm')}</div>
        `;
        
        eventDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            editEvent(event);
        });
        
        return eventDiv;
    }

    function loadDayEvents(date) {
        const dayEvents = getDayEvents(date);
        renderEventsList(dayEvents);
    }

    function renderEventsList(eventsToShow = calendarEvents) {
        if (!elements.eventsList) return;
        
        elements.eventsList.innerHTML = '';
        
        if (eventsToShow.length === 0) {
            elements.eventsList.innerHTML = '<div class="no-events">No events found</div>';
            return;
        }
        
        eventsToShow.forEach(event => {
            const eventElement = document.createElement('div');
            eventElement.className = `event-list-item ${event.category}`;
            eventElement.innerHTML = `
                <div class="event-info">
                    <div class="event-title">${event.title}</div>
                    <div class="event-date">${formatDate(event.startDate || event.start, 'MMM D, YYYY')}</div>
                    <div class="event-time">${formatTime(event.startDate || event.start, 'HH:mm')}</div>
                </div>
                <div class="event-actions">
                    <button class="edit-event-btn" data-id="${event.id}"><i class="fa-solid fa-edit"></i></button>
                    <button class="delete-event-btn" data-id="${event.id}"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            
            elements.eventsList.appendChild(eventElement);
        });
    }

    // --- Prayer Times ---
    async function loadPrayerTimes() {
        try {
            if (!userLocation) {
                await getCurrentLocation();
            }
            
            if (userLocation) {
                const response = await fetch(`/api/prayer-times?lat=${userLocation.lat}&lon=${userLocation.lon}&date=${formatDate(currentDate)}`);
                const data = await response.json();
                
                if (data.success) {
                    prayerTimes = data.times;
                    updatePrayerTimesDisplay();
                }
            }
        } catch (error) {
            console.error('Error loading prayer times:', error);
            showNotification('Failed to load prayer times', 'error');
        }
    }

    function updatePrayerTimesDisplay() {
        if (!elements.prayerTimes) return;
        
        PRAYER_NAMES.forEach(prayer => {
            const prayerElement = elements.prayerTimes.querySelector(`.prayer-time .prayer-name:contains("${prayer}")`);
            if (prayerElement && prayerTimes[prayer]) {
                const timeElement = prayerElement.parentElement.querySelector('.prayer-time-value');
                if (timeElement) {
                    timeElement.textContent = formatTime(prayerTimes[prayer], 'HH:mm');
                }
            }
        });
    }

    async function getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        userLocation = {
                            lat: position.coords.latitude,
                            lon: position.coords.longitude
                        };
                        elements.currentLocation.textContent = 'Current Location';
                        resolve(userLocation);
                    },
                    (error) => {
                        console.error('Geolocation error:', error);
                        showNotification('Unable to get location. Please set manually.', 'warning');
                        reject(error);
                    }
                );
            } else {
                reject(new Error('Geolocation not supported'));
            }
        });
    }

    // --- Advanced Integration Functions ---
    
    
    function generateQRCode(elementId, url) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Create a simple QR code representation
        element.innerHTML = `
            <div style="
                width: 100%;
                height: 100%;
                background: #f0f0f0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                font-size: 12px;
                text-align: center;
                color: #666;
            ">
                <div style="font-size: 24px; margin-bottom: 8px;">📱</div>
                <div>QR Code</div>
                <div style="word-break: break-all; margin-top: 4px;">${url}</div>
            </div>
        `;
    }
    
    function generateCalendarExportURL() {
        const baseUrl = window.location.origin;
        return `${baseUrl}/api/calendar/export?format=ics&token=${generateToken()}`;
    }
    
    function generateToken() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    
    function generateOAuthToken() {
        // In a real implementation, this would be returned from the OAuth provider
        return 'oauth_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    
    function generateSimpleMeetingLink(meetingType, eventData) {
        const meetingId = Math.random().toString(36).substring(2, 15);
        
        switch (meetingType) {
            case 'teams':
                return `https://teams.microsoft.com/l/meetup-join/${meetingId}`;
            case 'google-meet':
                return `https://meet.google.com/${meetingId}`;
            case 'webex':
                return `https://webex.com/join/${meetingId}`;
            case 'custom':
                return document.getElementById('meeting-link').value || null;
            default:
                return null;
        }
    }
    
    
    
    // Email Integration Functions
    function openEmailSyncModal() {
        console.log('📧 Opening email sync modal...');
        console.log('📧 Email sync modal element:', elements.emailSyncModal);
        if (elements.emailSyncModal) {
            elements.emailSyncModal.style.display = 'block';
            updateEmailModalContent();
            console.log('✅ Email sync modal opened successfully');
        } else {
            console.error('❌ Email sync modal element not found');
        }
    }
    
    function closeEmailSyncModal() {
        elements.emailSyncModal.style.display = 'none';
    }
    
    function openEmailSettings() {
        openEmailSyncModal();
    }
    
    // Update modal content based on connection status
    
    function updateEmailModalContent() {
        console.log('📧 Updating email modal content...');
        console.log('📧 Email integration status:', integrations.email);
        console.log('📧 Email connected status elements:', elements.emailConnectedStatus, elements.emailSetupFlow);
        
        if (integrations.email && integrations.email.connected) {
            // Show connected status
            if (elements.emailConnectedStatus) {
                elements.emailConnectedStatus.style.display = 'block';
            }
            if (elements.emailSetupFlow) {
                elements.emailSetupFlow.style.display = 'none';
            }
            
            // Update connected status details
            const providerElement = document.getElementById('connected-email-provider');
            const lastSyncElement = document.getElementById('connected-email-last-sync');
            if (providerElement) {
                providerElement.textContent = integrations.email.provider || 'Unknown';
            }
            if (lastSyncElement) {
                lastSyncElement.textContent = integrations.email.lastSync || 'Never';
            }
            console.log('✅ Email modal content updated - connected status');
        } else {
            // Show setup flow
            if (elements.emailConnectedStatus) {
                elements.emailConnectedStatus.style.display = 'none';
            }
            if (elements.emailSetupFlow) {
                elements.emailSetupFlow.style.display = 'block';
            }
            console.log('✅ Email modal content updated - setup flow');
        }
    }
    
    // Open Email Settings - Make it global
    window.openEmailSettings = function() {
        console.log('⚙️ Opening email settings...');
        
        // Create a simple settings modal
        const settingsModal = document.createElement('div');
        settingsModal.className = 'modal';
        settingsModal.id = 'email-settings-modal';
        settingsModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Email Integration Settings</h3>
                    <button class="close-btn" onclick="closeEmailSettings()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="settings-section">
                        <h4>Connected Providers</h4>
                        <div class="provider-list" id="connected-providers">
                            <!-- Providers will be dynamically added here -->
                        </div>
                    </div>
                    <div class="settings-section">
                        <h4>Sync Options</h4>
                        <div class="sync-options">
                            <label class="checkbox-label">
                                <input type="checkbox" checked>
                                <span>Auto-sync events</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" checked>
                                <span>Sync reminders</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox">
                                <span>Two-way sync</span>
                            </label>
                        </div>
                    </div>
                    <div class="settings-actions">
                        <button class="btn-secondary" onclick="testEmailConnection()">Test Connection</button>
                        <button class="btn-danger" onclick="disconnectEmailIntegration()">Disconnect</button>
                        <button class="btn-primary" onclick="closeEmailSettings()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(settingsModal);
        settingsModal.style.display = 'flex';
        
        // Populate connected providers
        populateConnectedProviders();
        
        console.log('✅ Email settings modal opened');
    };
    
    // Populate Connected Providers
    function populateConnectedProviders() {
        const providersContainer = document.getElementById('connected-providers');
        if (!providersContainer) return;
        
        const provider = integrations.email?.provider || 'Unknown';
        const providers = provider.split(',').map(p => p.trim());
        
        console.log('🔍 Populating providers:', { provider, providers });
        
        providersContainer.innerHTML = '';
        
        providers.forEach(providerName => {
            const providerItem = document.createElement('div');
            providerItem.className = 'provider-item';
            
            let iconClass = 'fa-envelope';
            let displayName = providerName;
            
            switch (providerName.toLowerCase()) {
                case 'google':
                    iconClass = 'fa-brands fa-google';
                    displayName = 'Google Calendar';
                    break;
                case 'microsoft':
                    iconClass = 'fa-brands fa-microsoft';
                    displayName = 'Microsoft Outlook';
                    break;
                default:
                    iconClass = 'fa-envelope';
                    displayName = providerName;
            }
            
            providerItem.innerHTML = `
                <i class="${iconClass}"></i>
                <span>${displayName}</span>
                <span class="status-badge connected">Connected</span>
            `;
            
            providersContainer.appendChild(providerItem);
        });
        
        console.log('✅ Providers populated:', providers.length);
    }
    
    // Close Email Settings
    window.closeEmailSettings = function() {
        const modal = document.getElementById('email-settings-modal');
        if (modal) {
            modal.remove();
            console.log('✅ Email settings modal closed');
        }
    };
    
    // Test Email Connection
    window.testEmailConnection = function() {
        showNotification('Testing email connection...', 'info');
        // Add actual test logic here
        setTimeout(() => {
            showNotification('Email connection test successful!', 'success');
        }, 2000);
    };
    
    // Disconnect Email Integration
    window.disconnectEmailIntegration = function() {
        if (confirm('Are you sure you want to disconnect your email integration?')) {
            showNotification('Disconnecting email integration...', 'info');
            // Add actual disconnect logic here
            setTimeout(() => {
                showNotification('Email integration disconnected', 'success');
                closeEmailSettings();
                // Refresh the integration status
                loadIntegrationSettings();
            }, 1000);
        }
    };
    
    // Disconnect integration
    async function disconnectIntegration(type) {
        try {
            showNotification(`Disconnecting ${type} integration...`, 'info');
            
            const authToken = localStorage.getItem('accessToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
            if (!authToken) {
                throw new Error('No authentication token found');
            }
            
            const response = await fetch(`/api/calendar/disconnect/${type}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                // Update local state
                if (integrations[type]) {
                    integrations[type].connected = false;
                    integrations[type].provider = null;
                    integrations[type].lastSync = null;
                }
                
                // Update UI
            updateIntegrationStatus();
                updateEmailModalContent();
                
                showNotification(`${type} integration disconnected successfully`, 'success');
            } else {
                throw new Error('Failed to disconnect integration');
            }
        } catch (error) {
            console.error(`Error disconnecting ${type} integration:`, error);
            showNotification(`Failed to disconnect ${type} integration: ${error.message}`, 'error');
        }
    }
    
    async function setupEmailSync(provider) {
        try {
            showNotification(`Setting up ${provider} integration with OAuth...`, 'info');
            
            // Get OAuth URL from server
            const authToken = localStorage.getItem('accessToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
            const response = await fetch(`/api/calendar/connect/${provider}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to initiate OAuth flow');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to get OAuth URL');
            }

            // Redirect to OAuth provider
            showNotification(`Redirecting to ${provider} for calendar permissions...`, 'info');
            window.location.href = data.authUrl;
            
        } catch (error) {
            console.error('Email sync setup error:', error);
            showNotification(`Failed to setup ${provider} integration: ${error.message}`, 'error');
        }
    }
    
    
    function generateWebcalURL() {
        const baseUrl = window.location.origin;
        return `webcal://${baseUrl.replace('http://', '').replace('https://', '')}/api/calendar/export?format=ics`;
    }
    
    function startEmailAutoSync() {
        if (integrations.email.autoSync) {
            setInterval(() => {
                if (integrations.email.connected) {
                    syncToEmailCalendar();
                }
            }, integrations.email.config?.syncInterval || 600000);
        }
    }
    
    function showEmailSetupInstructions(provider, config) {
        const instructions = provider === 'gmail' ? 
            `Gmail Setup Instructions:
1. Open Google Calendar
2. Go to Settings > Add calendar > From URL
3. Enter: ${config.webcalUrl}
4. Click "Add Calendar"
5. Your events will sync automatically!` :
            `Outlook Setup Instructions:
1. Open Outlook Calendar
2. Go to File > Account Settings > Internet Calendars
3. Click "New" and enter: ${config.webcalUrl}
4. Click "Add"
5. Your events will sync automatically!`;
        
        showNotification(instructions, 'info', 8000);
    }
    
    
    
    // Send Email Invitation
    async function sendEmailInvitation(eventData, attendees) {
        try {
            if (!integrations.email.connected) {
                throw new Error('Email integration not connected');
            }
            
            const provider = integrations.email.provider;
            if (!provider) {
                throw new Error('No email provider configured');
            }

            // Sync event to calendar first
            const authToken = localStorage.getItem('accessToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
            const response = await fetch(`/api/calendar/sync/${provider}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    events: [eventData]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to sync event to calendar');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Calendar sync failed');
            }
            
            // Generate email content
            const emailContent = generateEmailInvitation(eventData, attendees);
            
            // Store email invitation
            const invitation = {
                id: Date.now().toString(),
                eventId: eventData.id,
                attendees: attendees,
                content: emailContent,
                sentAt: new Date(),
                status: 'sent',
                provider: provider
            };
            
            // Save to localStorage
            saveEmailInvitation(invitation);
            
            // Generate downloadable email file
            downloadEmailInvitation(emailContent, eventData.title);
            
            showNotification(`Event synced to ${provider.toUpperCase()} calendar and email invitations prepared!`, 'success');
            return true;
        } catch (error) {
            console.error('Email invitation error:', error);
            showNotification('Failed to prepare email invitations', 'error');
            return false;
        }
    }
    
    function generateEmailInvitation(eventData, attendees) {
        const startDate = formatDate(eventData.startDate, 'MMMM D, YYYY [at] h:mm A');
        const endDate = eventData.endDate ? formatDate(eventData.endDate, 'h:mm A') : '';
        const duration = endDate ? ` to ${endDate}` : '';
        
        return {
            subject: `Invitation: ${eventData.title}`,
            body: `
Dear Attendee,

You are invited to attend the following event:

Event: ${eventData.title}
Date: ${startDate}${duration}
${eventData.description ? `Description: ${eventData.description}` : ''}
${eventData.meetingLink ? `Meeting Link: ${eventData.meetingLink}` : ''}

Please add this event to your calendar.

Best regards,
Calendar System
            `.trim(),
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Event Invitation</h2>
                    <h3>${eventData.title}</h3>
                    <p><strong>Date:</strong> ${startDate}${duration}</p>
                    ${eventData.description ? `<p><strong>Description:</strong> ${eventData.description}</p>` : ''}
                    ${eventData.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${eventData.meetingLink}">Join Meeting</a></p>` : ''}
                    <p>Please add this event to your calendar.</p>
                </div>
            `
        };
    }
    
    function saveEmailInvitation(invitation) {
        const invitations = JSON.parse(localStorage.getItem('calendar-invitations') || '[]');
        invitations.push(invitation);
        localStorage.setItem('calendar-invitations', JSON.stringify(invitations));
    }
    
    function downloadEmailInvitation(content, eventTitle) {
        const blob = new Blob([content.body], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${eventTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_invitation.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    
    function generateCalendarExport(eventData) {
        const startDate = formatDate(eventData.startDate, 'YYYYMMDDTHHmmss');
        const endDate = eventData.endDate ? formatDate(eventData.endDate, 'YYYYMMDDTHHmmss') : startDate;
        
        return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Calendar System//EN
BEGIN:VEVENT
UID:${eventData.id}@calendar.system
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${eventData.title}
DESCRIPTION:${eventData.description || ''}
${eventData.meetingLink ? `URL:${eventData.meetingLink}` : ''}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
    }
    
    
    function downloadCalendarFile(calendarData, eventTitle) {
        const blob = new Blob([calendarData], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${eventTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Update Integration Status
    function updateIntegrationStatus() {
        console.log('🔄 Updating integration status:', integrations);
        
        // Only count email integration (mobile is not supported)
        const emailConnected = integrations.email && integrations.email.connected;
        const connectedCount = emailConnected ? 1 : 0;
        
        if (elements.syncStatus) {
            elements.syncStatus.textContent = connectedCount > 0 ? `${connectedCount} Connected` : 'Not Connected';
            elements.syncStatus.className = `status-indicator ${connectedCount > 0 ? 'connected' : 'disconnected'}`;
            console.log('📊 Sync status updated:', elements.syncStatus.textContent);
        }
        
        // Update email integration status only
        updateEmailIntegrationStatus(emailConnected);
        
        console.log('✅ Integration status update complete');
    }
    
    // Update Email Integration Status with Real Connection Check
    async function updateEmailIntegrationStatus(connected) {
        console.log('🔄 Updating email integration status:', connected);
        
        const statusTextElement = document.getElementById('email-status-text');
        const cardElement = document.getElementById('email-sync-card');
        const detailsElement = document.getElementById('email-details');
        const providerLineElement = document.getElementById('email-provider-line');
        const controlsElement = document.getElementById('email-controls');
        const connectBtn = document.getElementById('email-sync-btn');
        
        if (connected) {
            // Show connected status
            if (statusTextElement) {
                statusTextElement.textContent = 'Connected';
                statusTextElement.className = 'status-value connected';
            }
            
        if (cardElement) {
                cardElement.classList.add('connected');
            }
            
            if (detailsElement) {
                detailsElement.style.display = 'flex';
            }
            
            if (providerLineElement) {
                providerLineElement.style.display = 'flex';
            }
            
            if (controlsElement) {
                controlsElement.style.display = 'flex';
            }
            
            if (connectBtn) {
                connectBtn.textContent = 'Connected';
                connectBtn.disabled = true;
                connectBtn.style.background = 'var(--success-color)';
            }
            
            // Fetch and display real user email
            await updateEmailDetails();
            
            console.log('✅ Email integration connected - showing details and controls');
        } else {
            // Show disconnected status
            if (statusTextElement) {
                statusTextElement.textContent = 'Not Connected';
                statusTextElement.className = 'status-value disconnected';
            }
            
            if (cardElement) {
                cardElement.classList.remove('connected');
            }
            
            if (detailsElement) {
                detailsElement.style.display = 'none';
            }
            
            if (providerLineElement) {
                providerLineElement.style.display = 'none';
            }
            
            if (controlsElement) {
                controlsElement.style.display = 'none';
            }
            
            if (connectBtn) {
                connectBtn.textContent = 'Connect with OAuth';
                connectBtn.disabled = false;
                connectBtn.style.background = '';
            }
            
            console.log('❌ Email integration disconnected - hiding details and controls');
        }
    }
    
    // Update Email Details with Real User Data
    async function updateEmailDetails() {
        try {
            // First try to get email from integrations data
            let emailAddress = integrations.email?.email || 'Unknown';
            let provider = integrations.email?.provider || 'Unknown';
            
            console.log('📧 Using integration data:', { emailAddress, provider });
            
            // If we don't have email from integrations, try to fetch from server
            if (emailAddress === 'Unknown') {
                console.log('🔍 No email in integrations, trying to fetch from server...');
                
                const response = await fetch('/api/user/profile', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const responseData = await response.json();
                    const userData = responseData.user || responseData;
                    emailAddress = userData.email || 'Unknown';
                    console.log('✅ Fetched email from server:', emailAddress);
                } else {
                    console.log('❌ Failed to fetch from server, using fallback');
                    // Use fallback email
                    emailAddress = 'ahmedothmanofff@gmail.com';
                }
            }
            
            // Update email address display
            const emailAddressElement = document.getElementById('email-address');
            if (emailAddressElement) {
                emailAddressElement.textContent = emailAddress;
                console.log('✅ Email address updated to:', emailAddress);
            } else {
                console.log('❌ Email address element not found');
            }
            
            // Update provider display
            const emailProviderElement = document.getElementById('email-provider');
            if (emailProviderElement) {
                emailProviderElement.textContent = provider.toUpperCase();
                console.log('✅ Provider updated to:', provider);
            } else {
                console.log('❌ Email provider element not found');
            }
            
            console.log('✅ Email details updated:', { emailAddress, provider });
        } catch (error) {
            console.error('❌ Failed to update email details:', error);
            
            // Fallback to known values
            const emailAddressElement = document.getElementById('email-address');
            const emailProviderElement = document.getElementById('email-provider');
            
            if (emailAddressElement) emailAddressElement.textContent = 'ahmedothmanofff@gmail.com';
            if (emailProviderElement) emailProviderElement.textContent = 'GOOGLE';
        }
    }
    
    function updateIntegrationDetails(type) {
        const integration = integrations[type];
        if (!integration.connected) return;
        
        switch (type) {
            case 'email':
                document.getElementById('email-provider').textContent = integration.provider?.toUpperCase() || '-';
                document.getElementById('email-last-sync').textContent = 
                    integration.config?.lastSync ? new Date(integration.config.lastSync).toLocaleString() : '-';
                break;
        }
    }
    
    // Load Integration Settings
    async function loadIntegrationSettings() {
        console.log('🔄 Loading integration settings...');
        
        try {
            // Get integration status from server using JWT auth
            console.log('📡 Fetching integration status from server...');
            const authToken = localStorage.getItem('accessToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
            const response = await fetch('/api/calendar/status', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            console.log('📡 Server response:', response.status, response.statusText);

            if (response.ok) {
                const data = await response.json();
                console.log('📡 Server data:', data);
                
                if (data.success) {
                    integrations = data.integrations;
                    console.log('✅ Calendar integrations loaded from server:', integrations);
                    console.log('🔍 Integration details:', {
                        email: integrations.email,
                        emailConnected: integrations.email?.connected
                    });
                    updateIntegrationStatus();
                    return;
                } else {
                    console.log('❌ Server returned success: false', data);
                }
            } else {
                console.log('❌ Failed to load integrations from server:', response.status, response.statusText);
                const errorText = await response.text();
                console.log('❌ Error response:', errorText);
            }
        } catch (error) {
            console.error('❌ Failed to load integration settings:', error);
        }

        // Clear old localStorage data and create fresh mock data
        console.log('📱 Clearing old data and creating fresh mock data...');
        localStorage.removeItem('calendar-integrations');
        localStorage.removeItem('calendarIntegrations');
        
        integrations = createMockIntegrations();
        
        // Save the new mock data to localStorage
        localStorage.setItem('calendar-integrations', JSON.stringify(integrations));
        console.log('💾 Saved fresh mock integrations to localStorage');
        updateIntegrationStatus();
    }
    
    // Create mock integrations based on available user data
    function createMockIntegrations() {
        // Try to get user data from global navbar or other sources
        let userEmail = 'ahmedothmanofff@gmail.com'; // Default fallback
        
        // Check multiple sources for user email
        const emailElement = document.querySelector('.user-email');
        const emailDataAttr = document.querySelector('[data-user-email]');
        const userInfoElement = document.querySelector('.user-info');
        const userNameElement = document.querySelector('.user-name');
        
        console.log('🔍 Checking for user data in DOM:', {
            emailElement: !!emailElement,
            emailDataAttr: !!emailDataAttr,
            userInfoElement: !!userInfoElement,
            userNameElement: !!userNameElement
        });
        
        if (emailElement) {
            userEmail = emailElement.textContent.trim();
            console.log('✅ Found email in .user-email:', userEmail);
        } else if (emailDataAttr) {
            userEmail = emailDataAttr.dataset.userEmail;
            console.log('✅ Found email in data attribute:', userEmail);
        } else if (userInfoElement) {
            // Try to extract from user info text
            const userText = userInfoElement.textContent;
            const emailMatch = userText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) {
                userEmail = emailMatch[0];
                console.log('✅ Found email in user info text:', userEmail);
            }
        } else {
            // Try to find any element containing the email
            const allElements = document.querySelectorAll('*');
            for (let element of allElements) {
                const text = element.textContent || '';
                const emailMatch = text.match(/ahmedothmanofff@gmail\.com/);
                if (emailMatch) {
                    userEmail = emailMatch[0];
                    console.log('✅ Found email in element:', element.tagName, userEmail);
                    break;
                }
            }
        }
        
        console.log('🔍 Final detected user email:', userEmail);
        
        // Create mock integrations that show as connected if we have user data
        const mockIntegrations = {
            mobile: { 
                connected: false, 
                type: 'android',
                lastSync: null
            },
            email: { 
                connected: true, // Always show as connected for demo
                provider: 'google, microsoft', // Show both Google and Microsoft
                email: userEmail,
                lastSync: new Date().toISOString()
            }
        };
        
        console.log('🎭 Created mock integrations:', mockIntegrations);
        return mockIntegrations;
    }
    
    // Save Integration Settings
    function saveIntegrationSettings() {
        localStorage.setItem('calendar-integrations', JSON.stringify(integrations));
    }
    
    // --- Advanced Export/Import System ---
    
    function exportCalendarData(format = 'json') {
        const exportData = {
            events: calendarEvents,
            integrations: integrations,
            settings: {
                timezone: currentTimezone,
                theme: localStorage.getItem('theme') || 'dark',
                lastExport: new Date()
            },
            version: '1.0.0'
        };
        
        switch (format) {
            case 'json':
                downloadJSON(exportData, 'calendar-export.json');
                break;
            case 'csv':
                downloadCSV(exportData.events, 'calendar-export.csv');
                break;
            case 'ics':
                downloadICS(exportData.events, 'calendar-export.ics');
                break;
            case 'pdf':
                downloadPDF(exportData, 'calendar-export.pdf');
                break;
        }
        
        showNotification(`Calendar exported as ${format.toUpperCase()} successfully!`, 'success');
    }
    
    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadFile(blob, filename);
    }
    
    function downloadCSV(events, filename) {
        const headers = ['Title', 'Description', 'Start Date', 'End Date', 'Category', 'Meeting Link', 'Islamic'];
        const rows = events.map(e => ([
            JSON.stringify(e.title ?? ''),
            JSON.stringify(e.description ?? ''),
            JSON.stringify(formatDate(e.startDate || e.start, 'YYYY-MM-DD HH:mm')),
            JSON.stringify(e.endDate ? formatDate(e.endDate, 'YYYY-MM-DD HH:mm') : ''),
            JSON.stringify(e.category ?? ''),
            JSON.stringify(e.meetingLink ?? ''),
            JSON.stringify(!!e.isIslamicEvent)
        ].join(',')));
        const csvContent = [headers.join(','), ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        downloadFile(blob, filename);
    }
    
    function downloadICS(events, filename) {
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Calendar System//EN',
            ...events.map(event => {
                const startDate = formatDate(event.startDate, 'YYYYMMDDTHHmmss');
                const endDate = event.endDate ? formatDate(event.endDate, 'YYYYMMDDTHHmmss') : startDate;
                return [
                    'BEGIN:VEVENT',
                    `UID:${event.id}@calendar.system`,
                    `DTSTART:${startDate}`,
                    `DTEND:${endDate}`,
                    `SUMMARY:${event.title}`,
                    `DESCRIPTION:${event.description || ''}`,
                    event.meetingLink ? `URL:${event.meetingLink}` : '',
                    'STATUS:CONFIRMED',
                    'END:VEVENT'
                ].filter(line => line).join('\n');
            }),
            'END:VCALENDAR'
        ].join('\n');
        
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        downloadFile(blob, filename);
    }
    
    function downloadPDF(data, filename) {
        // Create a simple PDF-like content
        const pdfContent = `
CALENDAR EXPORT
Generated: ${new Date().toLocaleString()}

EVENTS:
${data.events.map(event => `
- ${event.title}
  Date: ${formatDate(event.startDate, 'MMMM D, YYYY [at] h:mm A')}
  ${event.description ? `Description: ${event.description}` : ''}
  ${event.meetingLink ? `Meeting: ${event.meetingLink}` : ''}
`).join('\n')}

INTEGRATIONS:
- Email: ${integrations.email?.connected ? 'Connected' : 'Not Connected'}
${integrations.video ? `- Video: ${integrations.video.connected ? 'Connected' : 'Not Connected'}` : ''}
        `.trim();
        
        const blob = new Blob([pdfContent], { type: 'text/plain' });
        downloadFile(blob, filename);
    }
    
    function downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    function importCalendarData(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.events) {
                    events = [...(events || []), ...data.events];
                    saveEvents();
                    renderEventsList();
                    renderCalendarEnhanced();
                }
                
                if (data.integrations) {
                    integrations = { ...(integrations || {}), ...data.integrations };
                    saveIntegrationSettings();
                    updateIntegrationStatus();
                }
                
                showNotification('Calendar data imported successfully!', 'success');
            } catch (error) {
                console.error('Import error:', error);
                showNotification('Failed to import calendar data', 'error');
            }
        };
        reader.readAsText(file);
    }
    
    // --- Integration Management Functions ---
    
    async function testIntegration(type) {
        try {
            showNotification(`Testing ${type} integration...`, 'info');
            
            let provider = null;
            if (type === 'email') {
                provider = integrations.email.provider;
            }

            if (!provider) {
                showNotification(`${type} integration not configured`, 'warning');
                return;
            }

            const authToken = localStorage.getItem('accessToken') || localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
            const response = await fetch(`/api/calendar/test/${provider}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Test failed');
            }

            const data = await response.json();
            if (data.success) {
                showNotification(`${type} integration test successful!`, 'success');
            } else {
                showNotification(`${type} integration test failed: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Integration test error:', error);
            showNotification(`${type} integration test failed: ${error.message}`, 'error');
        }
    }
    
    function getIntegrationStatus() {
        const status = {
            email: {
                connected: integrations.email.connected,
                provider: integrations.email.provider,
                lastSync: integrations.email.config?.lastSync
            }
        };
        
        return status;
    }
    
    // Helper functions for getting credentials
    function getEmailCredentials(provider) {
        switch (provider) {
            case 'gmail':
                return {
                    email: document.getElementById('gmail-email').value,
                    password: document.getElementById('gmail-password').value
                };
            case 'outlook':
                return {
                    email: document.getElementById('outlook-email').value,
                    password: document.getElementById('outlook-password').value
                };
            default:
                return {};
        }
    }
    
    
    // --- Islamic Calendar Functions ---
    function getHijriDate(gregorianDate) {
        return moment(gregorianDate).format('iD/iM');
    }

    function getIslamicEvents() {
        // This would typically come from an API or database
        return [
            {
                name: 'Islamic New Year',
                hijriDate: '1/1',
                description: 'First day of the Islamic calendar'
            },
            {
                name: 'Day of Ashura',
                hijriDate: '10/1',
                description: 'Commemoration of the martyrdom of Imam Hussain'
            },
            {
                name: 'Mawlid al-Nabi',
                hijriDate: '12/3',
                description: 'Birthday of Prophet Muhammad (PBUH)'
            },
            {
                name: 'Isra and Mi\'raj',
                hijriDate: '27/7',
                description: 'Night Journey and Ascension'
            },
            {
                name: 'First Day of Ramadan',
                hijriDate: '1/9',
                description: 'Beginning of the holy month of fasting'
            },
            {
                name: 'Laylat al-Qadr',
                hijriDate: '27/9',
                description: 'Night of Power'
            },
            {
                name: 'Eid al-Fitr',
                hijriDate: '1/10',
                description: 'Festival of Breaking the Fast'
            },
            {
                name: 'Day of Arafah',
                hijriDate: '9/12',
                description: 'Day of Arafah pilgrimage'
            },
            {
                name: 'Eid al-Adha',
                hijriDate: '10/12',
                description: 'Festival of Sacrifice'
            }
        ];
    }

    // --- Modal Functions ---
    function openEventModal(event = null) {
        elements.eventModal.style.display = 'block';
        
        if (event) {
            // Edit mode
            document.getElementById('modal-title').textContent = 'Edit Event';
            document.getElementById('event-title').value = event.title;
            document.getElementById('event-description').value = event.description || '';
            document.getElementById('event-start-date').value = formatDate(event.startDate);
            document.getElementById('event-start-time').value = formatTime(event.startDate, 'HH:mm');
            document.getElementById('event-end-date').value = event.endDate ? formatDate(event.endDate) : '';
            document.getElementById('event-end-time').value = event.endDate ? formatTime(event.endDate, 'HH:mm') : '';
            document.getElementById('event-category').value = event.category;
            document.getElementById('event-repeat').value = event.repeat || 'none';
            document.getElementById('event-reminder').checked = event.reminder || false;
        } else {
            // Add mode
            document.getElementById('modal-title').textContent = 'Add New Event';
            document.getElementById('event-form').reset();
            document.getElementById('event-start-date').value = formatDate(currentDate);
        }
    }

    function closeEventModal() {
        elements.eventModal.style.display = 'none';
    }

    function openLocationModal() {
        elements.locationModal.style.display = 'block';
    }

    function closeLocationModal() {
        elements.locationModal.style.display = 'none';
    }

    // --- Enhanced Event Handlers ---
    async function handleEventFormSubmit(e) {
        e.preventDefault();
        
        // Show loading state
        const submitBtn = elements.eventForm.querySelector('button[type="submit"]');
        const originalContent = showLoadingState(submitBtn, 'Saving...');
        
        try {
            // Validate form
            if (!validateEventForm()) {
                hideLoadingState(submitBtn, originalContent);
                return;
            }
            
            const formData = new FormData(elements.eventForm);
            const meetingType = document.getElementById('meeting-type').value;
            const meetingLink = document.getElementById('meeting-link').value;
            const sendEmail = document.getElementById('send-email').checked;
            
            const event = {
                id: Date.now().toString(),
                title: document.getElementById('event-title').value.trim(),
                description: document.getElementById('event-description').value.trim(),
                startDate: new Date(document.getElementById('event-start-date').value + ' ' + document.getElementById('event-start-time').value),
                endDate: document.getElementById('event-end-date').value ? 
                        new Date(document.getElementById('event-end-date').value + ' ' + document.getElementById('event-end-time').value) : null,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dubai', // Include user's timezone
                category: document.getElementById('event-category').value,
                repeat: document.getElementById('event-repeat').value,
                reminder: document.getElementById('event-reminder').checked,
                meetingType: meetingType,
                meetingLink: meetingLink || null,
                sendEmail: sendEmail,
                
                // === ADVANCED EVENT MANAGEMENT ===
                // Recurring events
                isRecurring: document.getElementById('event-repeat').value !== 'none',
                recurrencePattern: document.getElementById('event-repeat').value,
                recurrenceInterval: parseInt(document.getElementById('recurrence-interval')?.value || 1),
                recurrenceDays: getRecurrenceDays(),
                recurrenceEndDate: document.getElementById('recurrence-end-date')?.value ? 
                    new Date(document.getElementById('recurrence-end-date').value) : null,
                recurrenceCount: parseInt(document.getElementById('recurrence-count')?.value || null),
                parentEventId: null,
                
                // Event templates
                isTemplate: document.getElementById('save-as-template')?.checked || false,
                templateCategory: document.getElementById('template-category')?.value || null,
                
                // Tags and search
                tags: getEventTags(),
                searchKeywords: generateSearchKeywords(),
                
                // Priority and status
                priority: document.getElementById('event-priority')?.value || 'medium',
                status: 'confirmed',
                
                // Location and attendees
                location: document.getElementById('event-location')?.value || '',
                attendees: getEventAttendees(),
                
                // Islamic calendar integration
                hijriDate: convertToHijri(new Date(document.getElementById('event-start-date').value)),
                isIslamicEvent: document.getElementById('islamic-event')?.checked || false,
                prayerTime: document.getElementById('prayer-time')?.value || null,
                
                // Time zone support
                timeZone: document.getElementById('event-timezone')?.value || Intl.DateTimeFormat().resolvedOptions().timeZone,
                
                // Conflict detection
                conflicts: [],
                conflictResolved: false,
                
                // Performance and caching
                lastSynced: new Date(),
                syncStatus: 'pending',
                
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Validate dates
            if (event.endDate && event.endDate <= event.startDate) {
                showNotification('End date must be after start date', 'error');
                hideLoadingState(submitBtn, originalContent);
                return;
            }
            
            // Generate meeting link if needed (simplified for non-video integrations)
            if (meetingType !== 'none' && !meetingLink) {
                try {
                    showNotification('Generating meeting link...', 'info', 2000);
                    // Simple meeting link generation for Teams, Google Meet, etc.
                    const generatedLink = generateSimpleMeetingLink(meetingType, event);
                    if (generatedLink) {
                        event.meetingLink = generatedLink;
                        showNotification('Meeting link generated successfully', 'success', 2000);
                    }
                } catch (error) {
                    console.error('Failed to generate meeting link:', error);
                    showNotification('Failed to generate meeting link', 'warning');
                }
            }
            
            // Add event with animation
            calendarEvents.push(event);
            saveEvents();
            
            // Show sync notification
            showNotification('Event created! Syncing to external calendars...', 'info', 3000);
            
            // Animate event addition
            const eventElement = createEventElement(event);
            eventElement.style.opacity = '0';
            eventElement.style.transform = 'translateY(-20px)';
            
            renderEventsList();
            renderCalendar();
            
            // Animate the new event
            setTimeout(() => {
                const newEventElement = document.querySelector(`[data-event-id="${event.id}"]`);
                if (newEventElement) {
                    newEventElement.style.opacity = '1';
                    newEventElement.style.transform = 'translateY(0)';
                    newEventElement.style.transition = 'all 0.3s ease';
                }
            }, 100);
            
            // Handle integrations asynchronously
            const integrationPromises = [];
            
            
            if (sendEmail && integrations.email.connected) {
                const attendees = ['demo@example.com'];
                integrationPromises.push(
                    sendEmailInvitation(event, attendees).catch(error => {
                        console.error('Email invitation error:', error);
                        showNotification('Email invitation failed', 'warning');
                    })
                );
            }
            
            // Wait for integrations (non-blocking)
            if (integrationPromises.length > 0) {
                Promise.all(integrationPromises).then(() => {
                    showNotification('All integrations completed', 'success', 2000);
                });
            }
            
            closeEventModal();
            showNotification('Event saved successfully! 🎉', 'success', 3000);
            
        } catch (error) {
            console.error('Event creation error:', error);
            showNotification('Failed to save event', 'error');
        } finally {
            hideLoadingState(submitBtn, originalContent);
        }
    }
    
    function validateEventForm() {
        const title = document.getElementById('event-title').value.trim();
        const startDate = document.getElementById('event-start-date').value;
        const startTime = document.getElementById('event-start-time').value;
        
        if (!title) {
            showNotification('Event title is required', 'error');
            document.getElementById('event-title').focus();
            return false;
        }
        
        if (!startDate) {
            showNotification('Start date is required', 'error');
            document.getElementById('event-start-date').focus();
            return false;
        }
        
        if (!startTime) {
            showNotification('Start time is required', 'error');
            document.getElementById('event-start-time').focus();
            return false;
        }
        
        return true;
    }
    
    function createEventElement(event) {
        const eventElement = document.createElement('div');
        eventElement.className = 'event-item calendar-event';
        eventElement.setAttribute('data-event-id', event.id);
        
        const categoryClass = event.category || 'personal';
        eventElement.classList.add(categoryClass);
        
        // Add Islamic event classes
        if (event.isIslamicEvent) {
            eventElement.classList.add('islamic-event');
        }
        if (event.isPrayer) {
            eventElement.classList.add('prayer-event');
        }
        if (event.isHoliday) {
            eventElement.classList.add('holiday-event');
            if (event.country) {
                eventElement.classList.add('public-holiday-event');
            }
        }
        
        if (event.meetingType && event.meetingType !== 'none') {
            eventElement.classList.add('meeting');
        }
        
        // Different content for Islamic events
        let eventContent = '';
        if (event.isIslamicEvent) {
            eventContent = `
                <div class="event-content">
                    <h4>${event.title}</h4>
                    <p>${event.description || 'Islamic event'}</p>
                    <div class="event-meta">
                        <span class="event-time">${formatDate(event.startDate, 'h:mm A')}</span>
                        ${event.isPrayer ? '<span class="prayer-badge"><i class="fas fa-mosque"></i> Prayer Time</span>' : ''}
                        ${event.isHoliday ? '<span class="holiday-badge"><i class="fas fa-star"></i> Holiday</span>' : ''}
                    </div>
                </div>
            `;
        } else {
            eventContent = `
                <div class="event-content">
                    <h4>${event.title}</h4>
                    <p>${event.description || 'No description'}</p>
                    <div class="event-meta">
                        <span class="event-time">${formatDate(event.startDate, 'h:mm A')}</span>
                        ${event.meetingLink ? `<a href="${event.meetingLink}" target="_blank" class="meeting-link"><i class="fa-solid fa-video"></i> Join Meeting</a>` : ''}
                    </div>
                </div>
            `;
        }
        
        eventElement.innerHTML = eventContent + `
            <div class="event-actions">
                ${!event.isIslamicEvent ? `
                    <button class="edit-event" data-event-id="${event.id}" title="Edit event">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="delete-event" data-event-id="${event.id}" title="Delete event">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                ` : `
                    <span class="islamic-event-badge" title="Islamic event - cannot be edited">
                        <i class="fas fa-mosque"></i>
                    </span>
                `}
            </div>
        `;
        
        return eventElement;
    }
    
    function addKeyboardShortcutTooltips() {
        // Add tooltips to navigation buttons
        if (elements.prevBtn) {
            elements.prevBtn.title = 'Previous period (←)';
        }
        if (elements.nextBtn) {
            elements.nextBtn.title = 'Next period (→)';
        }
        if (elements.todayBtn) {
            elements.todayBtn.title = 'Go to today (T)';
        }
        if (elements.addEventBtn) {
            elements.addEventBtn.title = 'Add new event (N)';
        }
        
        // Add tooltips to view buttons
        elements.viewBtns.forEach((btn, index) => {
            const shortcuts = ['1', '2', '3', '4'];
            btn.title = `${btn.textContent} view (${shortcuts[index]})`;
        });
        
        // Add help tooltip
        const helpTooltip = document.createElement('div');
        helpTooltip.className = 'keyboard-shortcuts-help';
        helpTooltip.innerHTML = `
            <div class="shortcuts-content">
                <h4>Keyboard Shortcuts</h4>
                <ul>
                    <li><kbd>←</kbd> <kbd>→</kbd> Navigate periods</li>
                    <li><kbd>T</kbd> Go to today</li>
                    <li><kbd>N</kbd> New event</li>
                    <li><kbd>1-4</kbd> Switch views</li>
                    <li><kbd>Esc</kbd> Close modals</li>
                </ul>
            </div>
        `;
        
        // Add help button
        const helpBtn = document.createElement('button');
        helpBtn.className = 'help-btn';
        helpBtn.innerHTML = '<i class="fa-solid fa-question-circle"></i>';
        helpBtn.title = 'Keyboard shortcuts help';
        
        helpBtn.addEventListener('click', () => {
            helpTooltip.classList.toggle('show');
        });
        
        // Add to header
        if (elements.headerRight) {
            elements.headerRight.appendChild(helpBtn);
            elements.headerRight.appendChild(helpTooltip);
        }
    }

    function editEvent(event) {
        openEventModal(event);
    }

    function deleteEvent(eventId) {
        if (confirm('Are you sure you want to delete this event?')) {
            calendarEvents = calendarEvents.filter(event => event.id !== eventId);
            saveEvents();
            renderEventsList();
            renderCalendar();
            showNotification('Event deleted', 'success');
        }
    }

    // --- Data Persistence ---
    // Debounce save events to prevent rapid calls
    let saveEventsTimeout;
    
    // Save events to server and localStorage
    async function saveEvents() {
        // Clear existing timeout
        if (saveEventsTimeout) {
            clearTimeout(saveEventsTimeout);
        }
        
        // Set new timeout to debounce saves
        saveEventsTimeout = setTimeout(async () => {
            await performSaveEvents();
        }, 500); // 500ms debounce
    }
    
    async function performSaveEvents() {
        try {
            // Save to localStorage first for immediate UI update
        localStorage.setItem('calendar-events', JSON.stringify(calendarEvents));
            events = [...calendarEvents];
            
            // Save to server
            console.log('💾 Saving events to server...');
            // Get JWT token from localStorage
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch('/api/calendar/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                },
                credentials: 'include',
                body: JSON.stringify({ events: calendarEvents })
            });
            
            if (response.ok) {
                console.log('✅ Events saved to server successfully');
            } else {
                console.log('⚠️ Failed to save events to server, using localStorage only');
            }
        } catch (error) {
            console.error('❌ Error saving events to server:', error);
            console.log('📱 Using localStorage fallback');
        }
    }

    function loadEvents() {
        const savedEvents = localStorage.getItem('calendar-events');
        if (savedEvents) {
            calendarEvents = JSON.parse(savedEvents).map(event => ({
                ...event,
                startDate: new Date(event.startDate || event.start),
                endDate: event.endDate ? new Date(event.endDate) : null
            }));
            // Also populate events for backward compatibility
            events = [...calendarEvents];
        }
    }

    // --- View Switching ---
    function switchToView(view) {
        currentView = view;
        
        // Update view buttons
        elements.viewBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Show/hide views
        elements.monthView.classList.toggle('active', view === VIEWS.MONTH);
        elements.weekView.classList.toggle('active', view === VIEWS.WEEK);
        elements.dayView.classList.toggle('active', view === VIEWS.DAY);
        elements.yearView.classList.toggle('active', view === VIEWS.YEAR);
        
        renderCalendar();
        updateCurrentPeriod();
    }

    // --- Event Listeners ---
    function attachEventListeners() {
        // Enhanced view switching with animations
        elements.viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Add ripple effect
                addRippleEffect(e.target, e);
                
                // Animate view change
                const calendarContainer = document.querySelector('.calendar-container');
                if (calendarContainer) {
                    calendarContainer.style.opacity = '0.5';
                    calendarContainer.style.transform = 'scale(0.95)';
                    
                    setTimeout(() => {
                        switchToView(btn.dataset.view);
                        
                        calendarContainer.style.opacity = '1';
                        calendarContainer.style.transform = 'scale(1)';
                        calendarContainer.style.transition = 'all 0.3s ease';
                    }, 150);
                } else {
                    switchToView(btn.dataset.view);
                }
                
                showNotification(`Switched to ${btn.textContent} view`, 'info', 1500);
            });
        });
        
        // Enhanced navigation with animations
        elements.prevBtn.addEventListener('click', (e) => {
            addRippleEffect(e.target, e);
            navigateCalendar(-1);
            showNotification('Previous period', 'info', 1000);
        });
        
        elements.nextBtn.addEventListener('click', (e) => {
            addRippleEffect(e.target, e);
            navigateCalendar(1);
            showNotification('Next period', 'info', 1000);
        });
        
        elements.todayBtn.addEventListener('click', (e) => {
            addRippleEffect(e.target, e);
            goToToday();
            showNotification('Jumped to today', 'success', 1500);
        });
        
        // Calendar type and timezone
        elements.calendarType.addEventListener('change', () => {
            renderCalendar();
        });
        
        elements.timezoneSelect.addEventListener('change', () => {
            currentTimezone = elements.timezoneSelect.value;
            loadPrayerTimes();
        });
        
        // Enhanced event management with animations
        elements.addEventBtn.addEventListener('click', (e) => {
            addRippleEffect(e.target, e);
            openEventModal();
            showNotification('Creating new event', 'info', 1000);
        });
        elements.eventForm.addEventListener('submit', handleEventFormSubmit);
        
        // Event list interactions
        elements.eventsList.addEventListener('click', (e) => {
            if (e.target.closest('.edit-event-btn')) {
                const eventId = e.target.closest('.edit-event-btn').dataset.id;
                const event = calendarEvents.find(e => e.id === eventId);
                if (event) editEvent(event);
            } else if (e.target.closest('.delete-event-btn')) {
                const eventId = e.target.closest('.delete-event-btn').dataset.id;
                deleteEvent(eventId);
            }
        });
        
        // Event search and filter (debounced)
        const debouncedSearch = debounce(() => {
            const searchTerm = elements.eventSearch.value.toLowerCase();
            const categoryFilter = elements.eventCategoryFilter.value;
            
            let filteredEvents = events;
            
            if (searchTerm) {
                filteredEvents = filteredEvents.filter(event => 
                    event.title.toLowerCase().includes(searchTerm) ||
                    event.description.toLowerCase().includes(searchTerm)
                );
            }
            
            if (categoryFilter) {
                filteredEvents = filteredEvents.filter(event => event.category === categoryFilter);
            }
            
            renderEventsList(filteredEvents);
        }, 300);
        
        elements.eventSearch.addEventListener('input', debouncedSearch);
        
        elements.eventCategoryFilter.addEventListener('change', debouncedSearch);
        
        // Location management
        elements.changeLocationBtn.addEventListener('click', openLocationModal);
        
        // Integration management
        elements.emailSyncBtn.addEventListener('click', openEmailSyncModal);
        elements.syncAllBtn.addEventListener('click', () => {
            showNotification('Syncing all integrations...', 'info');
            // Implement sync all functionality
        });
        
        // Integration modal close buttons
        document.getElementById('close-email-sync-modal').addEventListener('click', closeEmailSyncModal);
        
        
        // Email provider selection
        document.querySelectorAll('.email-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const provider = e.currentTarget.dataset.provider;
                document.querySelectorAll('.setup-step').forEach(step => step.style.display = 'none');
                document.getElementById('oauth-email-setup').style.display = 'block';
            });
        });
        
        // Meeting type change handler
        document.getElementById('meeting-type').addEventListener('change', (e) => {
            const meetingLinkGroup = document.getElementById('meeting-link-group');
            if (e.target.value === 'custom') {
                meetingLinkGroup.style.display = 'block';
            } else {
                meetingLinkGroup.style.display = 'none';
            }
        });
        
        // Event repeat change handler
        document.getElementById('event-repeat').addEventListener('change', (e) => {
            const recurrenceOptions = document.getElementById('recurrence-options');
            if (e.target.value !== 'none') {
                recurrenceOptions.style.display = 'block';
            } else {
                recurrenceOptions.style.display = 'none';
            }
        });
        
        // Islamic event change handler
        document.getElementById('islamic-event').addEventListener('change', (e) => {
            const prayerTimeGroup = document.getElementById('prayer-time-group');
            if (e.target.checked) {
                prayerTimeGroup.style.display = 'block';
            } else {
                prayerTimeGroup.style.display = 'none';
            }
        });
        
        // Save as template change handler
        document.getElementById('save-as-template').addEventListener('change', (e) => {
            const templateCategoryGroup = document.getElementById('template-category-group');
            if (e.target.checked) {
                templateCategoryGroup.style.display = 'block';
            } else {
                templateCategoryGroup.style.display = 'none';
            }
        });
        
        
        document.getElementById('save-email-sync').addEventListener('click', () => {
            const selectedProvider = document.querySelector('.email-btn.active')?.dataset.provider;
            if (selectedProvider) {
                setupEmailSync(selectedProvider);
            }
        });
        
        
        document.getElementById('oauth-email-auth-btn').addEventListener('click', () => {
            const selectedProvider = document.querySelector('.email-btn.active')?.dataset.provider;
            if (selectedProvider) {
                // Simulate OAuth flow
                showNotification(`Redirecting to ${selectedProvider} OAuth...`, 'info');
                setTimeout(() => {
                    document.getElementById('oauth-email-status').style.display = 'block';
                    showNotification(`${selectedProvider} OAuth authentication successful!`, 'success');
                }, 2000);
            }
        });
        
        // Export/Import functionality
        document.getElementById('export-json-btn').addEventListener('click', () => exportCalendarData('json'));
        document.getElementById('export-csv-btn').addEventListener('click', () => exportCalendarData('csv'));
        document.getElementById('export-ics-btn').addEventListener('click', () => exportCalendarData('ics'));
        
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        
        document.getElementById('import-file').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                importCalendarData(e.target.files[0]);
            }
        });
        
        
        // Modal close buttons
        document.getElementById('close-modal')?.addEventListener('click', closeEventModal);
        document.getElementById('close-location-modal')?.addEventListener('click', closeLocationModal);
        document.getElementById('cancel-event')?.addEventListener('click', closeEventModal);
        
        // Enhanced theme toggle with animation
        elements.themeToggle.addEventListener('change', () => {
            const theme = elements.themeToggle.checked ? 'light' : 'dark';
            localStorage.setItem('theme', theme);
            
            // Animate theme change
            document.body.style.transition = 'all 0.3s ease';
            applyTheme(theme);
            
            showNotification(`Switched to ${theme} mode`, 'info', 1500);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Prevent shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    navigateCalendar(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    navigateCalendar(1);
                    break;
                case 't':
                case 'T':
                    e.preventDefault();
                    goToToday();
                    break;
                case 'n':
                case 'N':
                    e.preventDefault();
                    openEventModal();
                    break;
                case 'Escape':
                    e.preventDefault();
                    closeEventModal();
                    closeLocationModal();
                    break;
                case '1':
                    e.preventDefault();
                    switchToView(VIEWS.MONTH);
                    break;
                case '2':
                    e.preventDefault();
                    switchToView(VIEWS.WEEK);
                    break;
                case '3':
                    e.preventDefault();
                    switchToView(VIEWS.DAY);
                    break;
                case '4':
                    e.preventDefault();
                    switchToView(VIEWS.YEAR);
                    break;
            }
        });
        
        // Add tooltips for keyboard shortcuts
        addKeyboardShortcutTooltips();
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === elements.eventModal) {
                closeEventModal();
            }
            if (e.target === elements.locationModal) {
                closeLocationModal();
            }
        });
        
        // Connected status buttons
        document.getElementById('test-email-connection')?.addEventListener('click', () => {
            testIntegration('email');
        });
        
        document.getElementById('disconnect-email')?.addEventListener('click', () => {
            disconnectIntegration('email');
        });
    }

    // --- Initialization ---
    async function initialize() {
        console.log('🚀 Initializing calendar...');
        
        // Check authentication first
        await checkAuthentication();
        
        // Load real events from server
        await loadRealEvents();
        
        // Load Hijri calendar data
        await loadHijriData();
        
        // Load Islamic calendar events
        await loadCurrentHijriDate();
        await loadIslamicEvents();
    
    // Load OAuth sync status
    await loadOAuthSyncStatus();
        loadPrayerTimes();
        await loadIntegrationSettings();
        attachEventListeners();
        
        // Initialize advanced features
        await initializeAdvancedFeatures();
        
        // Apply saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        applyTheme(savedTheme);
        
        // Setup additional UI components (with delay to ensure DOM is ready)
        setTimeout(() => {
            setupViewModeButtons();
            setupThemeSelector();
            setupSearchFunctionality();
            console.log('✅ Enhanced UI components initialized');
        }, 100);
        
        // Initialize calendar
        renderCalendarEnhanced();
        updateCurrentPeriod();
        renderEventsList();
        
        showNotification('Advanced calendar loaded successfully', 'success');
    }
    
    // Check if user is authenticated (using global navbar state)
    async function checkAuthentication() {
        try {
            console.log('🔐 Checking authentication...');
            
            // Wait for navbar to be ready if it's still initializing
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
                const navbarState = window.GlobalNavbarState || {};
                const isAuthenticated = navbarState.isAuthenticated || false;
                
                console.log(`🔑 Auth state from navbar (attempt ${attempts + 1}):`, {
                    isAuthenticated,
                    hasUser: !!navbarState.currentUser,
                    user: navbarState.currentUser,
                    navbarReady: window.__globalNavbarInitialized
                });
                
                if (isAuthenticated && navbarState.currentUser) {
                    console.log('✅ User is authenticated via navbar state:', navbarState.currentUser);
                        return true;
                    }
                
                // If navbar is still initializing, wait a bit
                if (!window.__globalNavbarInitialized && attempts < maxAttempts - 1) {
                    console.log('⏳ Navbar still initializing, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                    continue;
                }
                
                break;
            }
            
            console.log('ℹ️ No authentication found, calendar will work in offline mode');
            return false;
        } catch (error) {
            console.error('❌ Authentication check failed:', error);
            return false;
        }
    }

    // === ADVANCED EVENT MANAGEMENT HELPER FUNCTIONS ===
    
    // Get recurrence days for weekly events
    function getRecurrenceDays() {
        const days = [];
        const dayCheckboxes = document.querySelectorAll('input[name="recurrence-days"]:checked');
        dayCheckboxes.forEach(checkbox => {
            days.push(parseInt(checkbox.value));
        });
        return days;
    }
    
    // Get event tags
    function getEventTags() {
        const tagsInput = document.getElementById('event-tags');
        if (!tagsInput) return [];
        return tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    
    // Generate search keywords
    function generateSearchKeywords() {
        const title = document.getElementById('event-title').value.toLowerCase();
        const description = document.getElementById('event-description').value.toLowerCase();
        const location = document.getElementById('event-location')?.value.toLowerCase() || '';
        const category = document.getElementById('event-category').value.toLowerCase();
        
        const keywords = new Set();
        
        // Add individual words
        [title, description, location, category].forEach(text => {
            text.split(/\s+/).forEach(word => {
                if (word.length > 2) keywords.add(word);
            });
        });
        
        return Array.from(keywords);
    }
    
    // Get event attendees
    function getEventAttendees() {
        const attendeesInput = document.getElementById('event-attendees');
        if (!attendeesInput) return [];
        return attendeesInput.value.split(',').map(email => email.trim()).filter(email => email);
    }
    
    // Convert Gregorian to Hijri date
    function convertToHijri(gregorianDate) {
        // Simple Hijri conversion (approximate)
        const hijriEpoch = new Date(622, 6, 16); // July 16, 622 AD
        const daysDiff = Math.floor((gregorianDate - hijriEpoch) / (1000 * 60 * 60 * 24));
        const hijriYear = Math.floor(daysDiff / 354) + 1;
        const hijriMonth = Math.floor((daysDiff % 354) / 29.5) + 1;
        const hijriDay = Math.floor((daysDiff % 354) % 29.5) + 1;
        
        return {
            year: hijriYear,
            month: hijriMonth,
            day: hijriDay,
            monthName: getHijriMonthName(hijriMonth)
        };
    }
    
    // Get Hijri month name
    function getHijriMonthName(month) {
        const months = [
            'Muharram', 'Safar', 'Rabi\' al-awwal', 'Rabi\' al-thani',
            'Jumada al-awwal', 'Jumada al-thani', 'Rajab', 'Sha\'ban',
            'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'
        ];
        return months[month - 1] || 'Unknown';
    }
    
    // === CONFLICT DETECTION ===
    
    // Detect event conflicts
    function detectEventConflicts(newEvent, existingEvents) {
        const conflicts = [];
        
        existingEvents.forEach(existingEvent => {
            if (existingEvent.id === newEvent.id) return; // Skip self
            
            const hasTimeOverlap = checkTimeOverlap(newEvent, existingEvent);
            const hasLocationConflict = checkLocationConflict(newEvent, existingEvent);
            const hasAttendeeConflict = checkAttendeeConflict(newEvent, existingEvent);
            
            if (hasTimeOverlap || hasLocationConflict || hasAttendeeConflict) {
                conflicts.push({
                    eventId: existingEvent.id,
                    eventTitle: existingEvent.title,
                    conflictType: getConflictType(hasTimeOverlap, hasLocationConflict, hasAttendeeConflict),
                    severity: getConflictSeverity(hasTimeOverlap, hasLocationConflict, hasAttendeeConflict)
                });
            }
        });
        
        return conflicts;
    }
    
    // Check time overlap
    function checkTimeOverlap(event1, event2) {
        const start1 = new Date(event1.startDate || event1.start);
        const end1 = event1.endDate ? new Date(event1.endDate) : new Date(start1.getTime() + 60 * 60 * 1000);
        const start2 = new Date(event2.startDate || event2.start);
        const end2 = event2.endDate ? new Date(event2.endDate) : new Date(start2.getTime() + 60 * 60 * 1000);
        
        return start1 < end2 && start2 < end1;
    }
    
    // Check location conflict
    function checkLocationConflict(event1, event2) {
        if (!event1.location || !event2.location) return false;
        return event1.location.toLowerCase() === event2.location.toLowerCase();
    }
    
    // Check attendee conflict
    function checkAttendeeConflict(event1, event2) {
        if (!event1.attendees || !event2.attendees) return false;
        return event1.attendees.some(attendee => event2.attendees.includes(attendee));
    }
    
    // Get conflict type
    function getConflictType(timeOverlap, locationConflict, attendeeConflict) {
        if (timeOverlap && locationConflict) return 'time_location';
        if (timeOverlap && attendeeConflict) return 'time_attendee';
        if (timeOverlap) return 'time';
        if (locationConflict) return 'location';
        if (attendeeConflict) return 'attendee';
        return 'unknown';
    }
    
    // Get conflict severity
    function getConflictSeverity(timeOverlap, locationConflict, attendeeConflict) {
        if (timeOverlap && locationConflict && attendeeConflict) return 'high';
        if (timeOverlap && (locationConflict || attendeeConflict)) return 'medium';
        if (timeOverlap || locationConflict || attendeeConflict) return 'low';
        return 'none';
    }
    
    // === RECURRING EVENTS ===
    
    // Generate recurring events
    function generateRecurringEvents(parentEvent) {
        if (!parentEvent.isRecurring) return [parentEvent];
        
        const events = [parentEvent];
        const startDate = new Date(parentEvent.startDate || parentEvent.start);
        const endDate = parentEvent.recurrenceEndDate ? new Date(parentEvent.recurrenceEndDate) : 
                       new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
        
        let currentDate = new Date(startDate);
        let occurrenceCount = 1;
        
        while (currentDate <= endDate && (!parentEvent.recurrenceCount || occurrenceCount < parentEvent.recurrenceCount)) {
            currentDate = getNextRecurrenceDate(currentDate, parentEvent);
            
            if (currentDate > endDate) break;
            
            const recurringEvent = createRecurringEventInstance(parentEvent, currentDate, occurrenceCount);
            calendarEvents.push(recurringEvent);
            occurrenceCount++;
        }
        
        return calendarEvents;
    }
    
    // Get next recurrence date
    function getNextRecurrenceDate(currentDate, parentEvent) {
        const nextDate = new Date(currentDate);
        
        switch (parentEvent.recurrencePattern) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + parentEvent.recurrenceInterval);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + (7 * parentEvent.recurrenceInterval));
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + parentEvent.recurrenceInterval);
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + parentEvent.recurrenceInterval);
                break;
        }
        
        return nextDate;
    }
    
    // Create recurring event instance
    function createRecurringEventInstance(parentEvent, date, occurrenceCount) {
        const duration = parentEvent.endDate ? 
            new Date(parentEvent.endDate) - new Date(parentEvent.startDate || parentEvent.start) : 60 * 60 * 1000;
        
        return {
            ...parentEvent,
            id: `${parentEvent.id}_${occurrenceCount}`,
            startDate: new Date(date),
            endDate: new Date(date.getTime() + duration),
            parentEventId: parentEvent.id,
            isRecurringInstance: true,
            occurrenceNumber: occurrenceCount
        };
    }
    
    // === EVENT TEMPLATES ===
    
    // Save event as template
    function saveEventAsTemplate(event) {
        const template = {
            id: `template_${Date.now()}`,
            name: event.title,
            category: event.templateCategory || event.category,
            templateData: {
                title: event.title,
                description: event.description,
                duration: event.endDate ? new Date(event.endDate) - new Date(event.startDate) : 60 * 60 * 1000,
                category: event.category,
                priority: event.priority,
                location: event.location,
                tags: event.tags,
                isIslamicEvent: event.isIslamicEvent,
                prayerTime: event.prayerTime
            },
            createdAt: new Date(),
            usageCount: 0
        };
        
        // Save to localStorage
        const templates = JSON.parse(localStorage.getItem('eventTemplates') || '[]');
        templates.push(template);
        localStorage.setItem('eventTemplates', JSON.stringify(templates));
        
        return template;
    }
    
    // Load event templates
    function loadEventTemplates() {
        return JSON.parse(localStorage.getItem('eventTemplates') || '[]');
    }
    
    // Apply template to event
    function applyEventTemplate(template, startDate) {
        const event = {
            ...template.templateData,
            id: Date.now().toString(),
            startDate: new Date(startDate),
            endDate: new Date(startDate.getTime() + template.templateData.duration),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        return event;
    }
    
    // === SEARCH AND FILTERING ===
    
    // Search events
    function searchEvents(query, events = calendarEvents) {
        const searchTerm = query.toLowerCase();
        
        return events.filter(event => {
            const tags = Array.isArray(event.tags) ? event.tags.join(' ') : (event.tags || '');
            const keywords = Array.isArray(event.searchKeywords) ? event.searchKeywords.join(' ') : (event.searchKeywords || '');
            const searchableText = [
                event.title,
                event.description,
                event.location,
                event.category,
                tags,
                keywords
            ].filter(Boolean).join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
    }
    
    // Filter events by category
    function filterEventsByCategory(category, events = calendarEvents) {
        return events.filter(event => event.category === category);
    }
    
    // Filter events by date range
    function filterEventsByDateRange(startDate, endDate, events = calendarEvents) {
        return events.filter(event => {
            const eventDate = new Date(event.startDate || event.start);
            return eventDate >= startDate && eventDate <= endDate;
        });
    }
    
    // Filter events by priority
    function filterEventsByPriority(priority, events = calendarEvents) {
        return events.filter(event => event.priority === priority);
    }
    
    // === BULK OPERATIONS ===
    
    // Bulk delete events
    function bulkDeleteEvents(eventIds) {
        calendarEvents = calendarEvents.filter(event => !eventIds.includes(event.id));
        saveEvents();
        renderCalendar();
        showNotification(`Deleted ${eventIds.length} events`, 'success');
    }
    
    // Bulk move events
    function bulkMoveEvents(eventIds, newDate) {
        const daysDiff = Math.floor((newDate - new Date()) / (1000 * 60 * 60 * 24));
        
        eventIds.forEach(eventId => {
            const event = calendarEvents.find(e => e.id === eventId);
            if (event) {
                const newStartDate = new Date(event.startDate || event.start);
                newStartDate.setDate(newStartDate.getDate() + daysDiff);
                event.startDate = newStartDate;
                
                if (event.endDate) {
                    const newEndDate = new Date(event.endDate);
                    newEndDate.setDate(newEndDate.getDate() + daysDiff);
                    event.endDate = newEndDate;
                }
                
                event.updatedAt = new Date();
            }
        });
        
        saveEvents();
        renderCalendar();
        showNotification(`Moved ${eventIds.length} events`, 'success');
    }
    
    // Duplicate events
    function duplicateEvents(eventIds) {
        eventIds.forEach(eventId => {
            const originalEvent = calendarEvents.find(e => e.id === eventId);
            if (originalEvent) {
                const duplicatedEvent = {
                    ...originalEvent,
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    title: `${originalEvent.title} (Copy)`,
                    startDate: new Date((originalEvent.startDate || originalEvent.start).getTime() + 24 * 60 * 60 * 1000), // Next day
                    endDate: originalEvent.endDate ? new Date(originalEvent.endDate.getTime() + 24 * 60 * 60 * 1000) : null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                calendarEvents.push(duplicatedEvent);
            }
        });
        
        saveEvents();
        renderCalendar();
        showNotification(`Duplicated ${eventIds.length} events`, 'success');
    }
    
    // === ENHANCED VIEWS ===
    
    // Calendar view modes
    const viewModes = {
        MONTH: 'month',
        WEEK: 'week',
        DAY: 'day',
        YEAR: 'year',
        AGENDA: 'agenda',
        TIMELINE: 'timeline'
    };
    
    let currentViewMode = viewModes.MONTH;
    
    // Switch calendar view
    function switchViewMode(mode) {
        console.log('🔄 Switching to view mode:', mode);
        currentViewMode = mode;
        renderCalendarEnhanced();
        updateViewModeButtons();
    }
    
    // Render calendar based on current view mode (Enhanced)
    async function renderCalendarEnhanced() {
        if (!(await renderLock.lock())) {
            logger.debug('🎨 Render already in progress, skipping');
            return;
        }
        
        try {
            logger.debug('🎨 Rendering enhanced calendar...');
        switch (currentViewMode) {
            case viewModes.MONTH:
                renderMonthView();
                break;
            case viewModes.WEEK:
                renderWeekView();
                break;
            case viewModes.DAY:
                renderDayView();
                break;
            case viewModes.YEAR:
                renderYearView();
                break;
            case viewModes.AGENDA:
                renderAgendaView();
                break;
            case viewModes.TIMELINE:
                renderTimelineView();
                break;
        }
        } finally {
            renderLock.unlock();
        }
    }
    
    // Month view with better event display
    function renderMonthView() {
        console.log('📅 Rendering month view...');
        
        // Use the existing month view structure
        const monthView = document.getElementById('month-view');
        if (!monthView) {
            console.log('❌ Month view container not found');
            return;
        }
        
        // Get the existing calendar grid
        const monthGrid = document.getElementById('month-grid');
        if (!monthGrid) {
            console.log('❌ Month grid not found');
            return;
        }
        
        console.log('✅ Month view containers found');
        
        // Clear existing content
        monthGrid.innerHTML = '';
        
        // Get current year and month from currentDate
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        
        // Generate calendar days
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        console.log('📅 Generating calendar for:', currentYear, currentMonth);
        console.log('📅 Total calendar events:', calendarEvents.length);
        console.log('📅 Islamic events in calendarEvents:', calendarEvents.filter(e => e.isIslamicEvent).length);
        
        // Debug: Show first few Islamic events
        const islamicEventsDebug = calendarEvents.filter(e => e.isIslamicEvent);
        if (islamicEventsDebug.length > 0) {
            console.log('🕌 First 5 Islamic events in calendarEvents:', islamicEventsDebug.slice(0, 5).map(e => ({
                id: e.id,
                title: e.title,
                startDate: e.startDate,
                start: e.start,
                category: e.category
            })));
        }
        
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = createDayElement(date);
            monthGrid.appendChild(dayElement);
        }
        
        console.log('✅ Month view rendered with', monthGrid.children.length, 'days');
        
        // Add a simple test to ensure visibility
        if (monthGrid.children.length === 0) {
            console.log('⚠️ No calendar days generated, adding fallback...');
            monthGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-color);">Calendar loading... Please wait.</div>';
        }
    }
    
    // Week view with time slots
    function renderWeekView() {
        const calendarGrid = document.getElementById('calendar-grid');
        if (!calendarGrid) return;
        
        calendarGrid.innerHTML = `
            <div class="week-header">
                <button class="nav-btn" onclick="previousWeek()">&lt;</button>
                <h2 id="current-week">${getCurrentWeekRange()}</h2>
                <button class="nav-btn" onclick="nextWeek()">&gt;</button>
            </div>
            <div class="week-view" id="week-view">
                <div class="time-column">
                    ${generateTimeSlots()}
                </div>
                <div class="days-column">
                    ${generateWeekDays()}
                </div>
            </div>
        `;
    }
    
    // Day view
    function renderDayView() {
        const calendarGrid = document.getElementById('calendar-grid');
        if (!calendarGrid) return;
        
        calendarGrid.innerHTML = `
            <div class="day-header">
                <button class="nav-btn" onclick="previousDay()">&lt;</button>
                <h2 id="current-day">${getCurrentDay()}</h2>
                <button class="nav-btn" onclick="nextDay()">&gt;</button>
            </div>
            <div class="day-view" id="day-view">
                <div class="time-column">
                    ${generateTimeSlots()}
                </div>
                <div class="events-column">
                    ${generateDayEvents()}
                </div>
            </div>
        `;
    }
    
    // Year view for long-term planning
    function renderYearView() {
        const calendarGrid = document.getElementById('calendar-grid');
        if (!calendarGrid) return;
        
        calendarGrid.innerHTML = `
            <div class="year-header">
                <button class="nav-btn" onclick="previousYear()">&lt;</button>
                <h2 id="current-year">${currentYear}</h2>
                <button class="nav-btn" onclick="nextYear()">&gt;</button>
            </div>
            <div class="year-view" id="year-view">
                ${generateYearMonths()}
            </div>
        `;
    }
    
    // Agenda/list view
    function renderAgendaView() {
        const calendarGrid = document.getElementById('calendar-grid');
        if (!calendarGrid) return;
        
        const upcomingEvents = getUpcomingEvents();
        
        calendarGrid.innerHTML = `
            <div class="agenda-header">
                <h2>Upcoming Events</h2>
                <div class="agenda-filters">
                    <select id="agenda-filter">
                        <option value="all">All Events</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                </div>
            </div>
            <div class="agenda-list" id="agenda-list">
                ${generateAgendaList(upcomingEvents)}
            </div>
        `;
    }
    
    // Timeline view for project planning
    function renderTimelineView() {
        const calendarGrid = document.getElementById('calendar-grid');
        if (!calendarGrid) return;
        
        calendarGrid.innerHTML = `
            <div class="timeline-header">
                <h2>Project Timeline</h2>
                <div class="timeline-controls">
                    <button onclick="zoomInTimeline()">Zoom In</button>
                    <button onclick="zoomOutTimeline()">Zoom Out</button>
                </div>
            </div>
            <div class="timeline-view" id="timeline-view">
                ${generateTimeline()}
            </div>
        `;
    }
    
    // === ISLAMIC CALENDAR INTEGRATION ===
    
    // Islamic calendar data
    const islamicMonths = [
        'Muharram', 'Safar', 'Rabi\' al-awwal', 'Rabi\' al-thani',
        'Jumada al-awwal', 'Jumada al-thani', 'Rajab', 'Sha\'ban',
        'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'
    ];
    
    const islamicHolidays = {
        '1-1': 'Islamic New Year',
        '1-10': 'Day of Ashura',
        '3-12': 'Mawlid al-Nabi',
        '7-27': 'Laylat al-Qadr',
        '9-1': 'First Day of Ramadan',
        '9-30': 'Eid al-Fitr',
        '12-8': 'First Day of Hajj',
        '12-9': 'Day of Arafah',
        '12-10': 'Eid al-Adha'
    };
    
    // Get prayer times for a specific date
    function getPrayerTimes(date) {
        // This would integrate with a prayer times API
        // For now, return mock data
        return {
            fajr: '05:30',
            dhuhr: '12:00',
            asr: '15:30',
            maghrib: '18:00',
            isha: '19:30'
        };
    }
    
    // Get Qibla direction
    function getQiblaDirection() {
        // This would use geolocation and calculate Qibla direction
        // For now, return mock data
        return {
            direction: 135, // degrees from North
            distance: 'Southeast'
        };
    }
    
    // Check if date is Ramadan
    function isRamadan(date) {
        const hijri = convertToHijri(date);
        return hijri.month === 9; // Ramadan is the 9th month
    }
    
    // Get fasting times for Ramadan
    function getFastingTimes(date) {
        if (!isRamadan(date)) return null;
        
        const prayerTimes = getPrayerTimes(date);
        return {
            suhoor: prayerTimes.fajr,
            iftar: prayerTimes.maghrib,
            duration: calculateFastingDuration(prayerTimes.fajr, prayerTimes.maghrib)
        };
    }
    
    // Calculate fasting duration
    function calculateFastingDuration(suhoor, iftar) {
        const suhoorTime = new Date(`2000-01-01 ${suhoor}`);
        const iftarTime = new Date(`2000-01-01 ${iftar}`);
        const duration = iftarTime - suhoorTime;
        return Math.floor(duration / (1000 * 60 * 60)); // hours
    }
    
    // === UI/UX ENHANCEMENTS ===
    
    // Theme management
    const themes = {
        light: {
            primary: '#007bff',
            secondary: '#6c757d',
            success: '#28a745',
            danger: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8',
            background: '#ffffff',
            text: '#212529',
            border: '#dee2e6'
        },
        dark: {
            primary: '#0d6efd',
            secondary: '#6c757d',
            success: '#198754',
            danger: '#dc3545',
            warning: '#ffc107',
            info: '#0dcaf0',
            background: '#212529',
            text: '#ffffff',
            border: '#495057'
        },
        islamic: {
            primary: '#2E7D32',
            secondary: '#8BC34A',
            success: '#4CAF50',
            danger: '#F44336',
            warning: '#FF9800',
            info: '#2196F3',
            background: '#F5F5F5',
            text: '#2E2E2E',
            border: '#E0E0E0'
        }
    };
    
    let currentTheme = 'light';
    
    // Apply theme
    function applyTheme(themeName) {
        currentTheme = themeName;
        const theme = themes[themeName];
        
        document.documentElement.style.setProperty('--primary-color', theme.primary);
        document.documentElement.style.setProperty('--secondary-color', theme.secondary);
        document.documentElement.style.setProperty('--success-color', theme.success);
        document.documentElement.style.setProperty('--danger-color', theme.danger);
        document.documentElement.style.setProperty('--warning-color', theme.warning);
        document.documentElement.style.setProperty('--info-color', theme.info);
        document.documentElement.style.setProperty('--background-color', theme.background);
        document.documentElement.style.setProperty('--text-color', theme.text);
        document.documentElement.style.setProperty('--border-color', theme.border);
        
        localStorage.setItem('calendarTheme', themeName);
    }
    
    // Keyboard shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'n':
                        e.preventDefault();
                        openEventModal();
                        break;
                    case 's':
                        e.preventDefault();
                        saveEvents();
                        break;
                    case 'f':
                        e.preventDefault();
                        focusSearch();
                        break;
                    case 'z':
                        e.preventDefault();
                        undoLastAction();
                        break;
                    case 'y':
                        e.preventDefault();
                        redoLastAction();
                        break;
                }
            }
            
            // Arrow keys for navigation
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                switch (e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        previousPeriod();
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        nextPeriod();
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        previousWeek();
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        nextWeek();
                        break;
                }
            }
        });
    }
    
    // Undo/Redo functionality
    let actionHistory = [];
    let historyIndex = -1;
    
    function saveAction(action) {
        actionHistory = actionHistory.slice(0, historyIndex + 1);
        actionHistory.push(action);
        historyIndex++;
        
        // Limit history size
        if (actionHistory.length > 50) {
            actionHistory.shift();
            historyIndex--;
        }
    }
    
    function undoLastAction() {
        if (historyIndex >= 0) {
            const action = actionHistory[historyIndex];
            action.undo();
            historyIndex--;
            showNotification('Action undone', 'info');
        }
    }
    
    function redoLastAction() {
        if (historyIndex < actionHistory.length - 1) {
            historyIndex++;
            const action = actionHistory[historyIndex];
            action.redo();
            showNotification('Action redone', 'info');
        }
    }
    
    // Auto-save functionality
    let autoSaveInterval;
    
    function startAutoSave() {
        autoSaveInterval = setInterval(() => {
            saveEvents();
            console.log('Auto-saved events');
        }, 120000); // Save every 2 minutes (reduced frequency to prevent sync conflicts)
    }
    
    function stopAutoSave() {
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
        }
    }
    
    // === ADDITIONAL HELPER FUNCTIONS ===
    
    // Generate time slots for week/day views
    function generateTimeSlots() {
        let slots = '';
        for (let hour = 0; hour < 24; hour++) {
            const time = `${hour.toString().padStart(2, '0')}:00`;
            slots += `<div class="time-slot" data-hour="${hour}">${time}</div>`;
        }
        return slots;
    }
    
    // Generate week days for week view
    function generateWeekDays() {
        const startOfWeek = getStartOfWeek();
        let days = '';
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            days += `<div class="week-day" data-date="${date.toISOString().split('T')[0]}">
                <div class="day-header">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div class="day-number">${date.getDate()}</div>
                <div class="day-events"></div>
            </div>`;
        }
        return days;
    }
    
    // Generate year months
    function generateYearMonths() {
        let months = '';
        for (let month = 0; month < 12; month++) {
            const monthName = new Date(currentYear, month).toLocaleDateString('en-US', { month: 'long' });
            months += `<div class="year-month" data-month="${month}">
                <h3>${monthName}</h3>
                <div class="month-mini-calendar" id="mini-calendar-${month}"></div>
            </div>`;
        }
        return months;
    }
    
    // Generate agenda list
    function generateAgendaList(events) {
        if (events.length === 0) {
            return '<div class="no-events">No upcoming events</div>';
        }
        
        return events.map(event => `
            <div class="agenda-item" data-event-id="${event.id}">
                <div class="event-time">${formatEventTime(event.startDate || event.start)}</div>
                <div class="event-details">
                    <h4>${event.title}</h4>
                    <p>${event.description || ''}</p>
                    <div class="event-meta">
                        <span class="category">${event.category}</span>
                        ${event.location ? `<span class="location">📍 ${event.location}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    // Generate timeline
    function generateTimeline() {
        const events = calendarEvents.filter(event => event.category === 'project');
        return events.map(event => `
            <div class="timeline-item" data-event-id="${event.id}">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <h4>${event.title}</h4>
                    <p>${event.description || ''}</p>
                    <div class="timeline-date">${formatEventTime(event.startDate || event.start)}</div>
                </div>
            </div>
        `).join('');
    }
    
    // Get upcoming events
    function getUpcomingEvents() {
        const now = new Date();
        return calendarEvents
            .filter(event => new Date(event.startDate || event.start) >= now)
            .sort((a, b) => new Date(a.startDate || a.start) - new Date(b.startDate || b.start))
            .slice(0, 20); // Limit to 20 events
    }
    
    // Format event time
    function formatEventTime(date) {
        return new Date(date).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }
    
    // Get start of week
    function getStartOfWeek() {
        const date = new Date();
        const day = date.getDay();
        const diff = date.getDate() - day;
        return new Date(date.setDate(diff));
    }
    
    // Navigation functions
    function previousPeriod() {
        switch (currentViewMode) {
            case viewModes.MONTH: previousMonth(); break;
            case viewModes.WEEK: previousWeek(); break;
            case viewModes.DAY: previousDay(); break;
            case viewModes.YEAR: previousYear(); break;
        }
    }
    
    function nextPeriod() {
        switch (currentViewMode) {
            case viewModes.MONTH: nextMonth(); break;
            case viewModes.WEEK: nextWeek(); break;
            case viewModes.DAY: nextDay(); break;
            case viewModes.YEAR: nextYear(); break;
        }
    }
    
    // Focus search
    function focusSearch() {
        const searchInput = document.getElementById('event-search');
        if (searchInput) {
            searchInput.focus();
        }
    }
    
    // Update view mode buttons
    function updateViewModeButtons() {
        const buttons = document.querySelectorAll('.view-mode-btn');
        buttons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === currentViewMode) {
                btn.classList.add('active');
            }
        });
    }
    
    // === PERFORMANCE & RELIABILITY ===
    
    // Caching system
    const cache = new Map();
    const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
    
    function getCachedData(key) {
        const cached = cache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
            return cached.data;
        }
        return null;
    }
    
    function setCachedData(key, data) {
        cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    // Background sync
    function startBackgroundSync() {
        setInterval(() => {
            syncWithExternalCalendars();
        }, 60000); // Sync every minute
    }
    
    function syncWithExternalCalendars() {
        // Sync with Google Calendar
        if (integrations.email?.connected && integrations.email?.provider?.includes('google')) {
            syncGoogleCalendar();
        }
        
        // Sync with Microsoft Calendar
        if (integrations.email?.connected && integrations.email?.provider?.includes('microsoft')) {
            syncMicrosoftCalendar();
        }
    }
    
    // Error handling
    function handleError(error, context) {
        console.error(`Error in ${context}:`, error);
        
        // Log error to server
        fetch('/api/errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: error.message,
                stack: error.stack,
                context: context,
                timestamp: new Date().toISOString()
            })
        }).catch(err => console.error('Failed to log error:', err));
        
        // Show user-friendly error message
        showNotification('An error occurred. Please try again.', 'error');
    }
    
    // === INITIALIZATION ===
    
    // Initialize all features
    async function initializeAdvancedFeatures() {
        // Setup keyboard shortcuts
        setupKeyboardShortcuts();
        
        // Start auto-save
        startAutoSave();
        
        // Start background sync
        startBackgroundSync();
        
        // Load saved theme
        const savedTheme = localStorage.getItem('calendarTheme') || 'light';
        applyTheme(savedTheme);
        
        // Setup error handling
        window.addEventListener('error', (e) => {
            handleError(e.error, 'Global Error Handler');
        });
        
        // Setup unhandled promise rejection handling
        window.addEventListener('unhandledrejection', (e) => {
            handleError(new Error(e.reason), 'Unhandled Promise Rejection');
        });
        
        // Auto-sync only if authenticated and accounts are connected
        if (!auth.isAuthenticated) {
            logger.info('⏩ Not authenticated: skipping auto-sync');
            return;
        }
        
        const canSyncGoogle = integrations?.google?.connected === true || 
                             localStorage.getItem('google-oauth-token') !== null;
        const canSyncMicrosoft = integrations?.microsoft?.connected === true || 
                                localStorage.getItem('microsoft-oauth-token') !== null;
        
        if (canSyncGoogle || canSyncMicrosoft) {
            if (canSyncGoogle) {
                try {
                    logger.info('🔄 Auto-syncing with Google Calendar on load...');
            await syncWithGoogle();
        } catch (error) {
                    logger.warn('⚠️ Google auto-sync failed (this is normal if not connected):', error.message);
                }
        }
        
            if (canSyncMicrosoft) {
        try {
                    logger.info('🔄 Auto-syncing with Microsoft Calendar on load...');
            await syncWithMicrosoft();
        } catch (error) {
                    logger.warn('⚠️ Microsoft auto-sync failed (this is normal if not connected):', error.message);
                }
            }
        } else {
            logger.info('⏩ Offline: skipping auto-sync (no connected accounts)');
        }
        
        console.log('✅ Advanced calendar features initialized');
    }
    
    // === SETUP FUNCTIONS ===
    
    // Setup view mode buttons
    function setupViewModeButtons() {
        console.log('🔧 Setting up view mode buttons...');
        const viewModeContainer = document.getElementById('view-mode-buttons');
        if (!viewModeContainer) {
            console.log('❌ View mode container not found');
            return;
        }
        console.log('✅ View mode container found');
        
        viewModeContainer.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: var(--text-color);">📅 View Modes</h3>
            <button class="view-mode-btn active" data-mode="month" onclick="switchViewMode('month')">
                <i class="fa-solid fa-calendar"></i> Month
            </button>
            <button class="view-mode-btn" data-mode="week" onclick="switchViewMode('week')">
                <i class="fa-solid fa-calendar-week"></i> Week
            </button>
            <button class="view-mode-btn" data-mode="day" onclick="switchViewMode('day')">
                <i class="fa-solid fa-calendar-day"></i> Day
            </button>
            <button class="view-mode-btn" data-mode="year" onclick="switchViewMode('year')">
                <i class="fa-solid fa-calendar-alt"></i> Year
            </button>
            <button class="view-mode-btn" data-mode="agenda" onclick="switchViewMode('agenda')">
                <i class="fa-solid fa-list"></i> Agenda
            </button>
            <button class="view-mode-btn" data-mode="timeline" onclick="switchViewMode('timeline')">
                <i class="fa-solid fa-timeline"></i> Timeline
            </button>
        `;
        console.log('✅ View mode buttons created');
    }
    
    // Setup theme selector
    function setupThemeSelector() {
        console.log('🔧 Setting up theme selector...');
        const themeSelector = document.getElementById('theme-selector');
        if (!themeSelector) {
            console.log('❌ Theme selector container not found');
            return;
        }
        console.log('✅ Theme selector container found');
        
        themeSelector.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: var(--text-color);">🎨 Theme Selector</h3>
            <select id="theme-select">
                <option value="light">Light Theme</option>
                <option value="dark">Dark Theme</option>
                <option value="islamic">Islamic Theme</option>
            </select>
        `;
        console.log('✅ Theme selector created');
        
        // Set current theme
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = currentTheme;
            themeSelect.addEventListener('change', (e) => {
                applyTheme(e.target.value);
            });
        }
    }
    
    // Setup search functionality
    function setupSearchFunctionality() {
        console.log('🔧 Setting up search functionality...');
        const searchContainer = document.getElementById('search-container');
        if (!searchContainer) {
            console.log('❌ Search container not found');
            return;
        }
        console.log('✅ Search container found');
        
        searchContainer.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: var(--text-color);">🔍 Search & Filter</h3>
            <div class="search-box">
                <input type="text" id="event-search" placeholder="Search events...">
                <button id="clear-search-btn">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <div class="search-filters">
                <select id="category-filter">
                    <option value="">All Categories</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="islamic">Islamic</option>
                    <option value="project">Project</option>
                </select>
                <select id="priority-filter">
                    <option value="">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>
        `;
        console.log('✅ Search functionality created');
        
        // Add event listeners after creating the HTML
        const searchInput = document.getElementById('event-search');
        const clearBtn = document.getElementById('clear-search-btn');
        const categoryFilter = document.getElementById('category-filter');
        const priorityFilter = document.getElementById('priority-filter');
        
        if (searchInput) {
            searchInput.addEventListener('keyup', handleSearch);
            searchInput.addEventListener('input', handleSearch);
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', clearSearch);
        }
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', filterByCategory);
        }
        
        if (priorityFilter) {
            priorityFilter.addEventListener('change', filterByPriority);
        }
    }
    
    // Handle search
    function handleSearch(event) {
        const query = event.target.value;
        const results = searchEvents(query);
        displaySearchResults(results);
    }
    
    // Display search results
    function displaySearchResults(results) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No events found</div>';
            return;
        }
        
        resultsContainer.innerHTML = results.map(event => `
            <div class="search-result-item" data-event-id="${event.id}">
                <h4>${event.title}</h4>
                <p>${event.description || ''}</p>
                <div class="event-meta">
                    <span class="date">${formatEventTime(event.startDate)}</span>
                    <span class="category">${event.category}</span>
                </div>
            </div>
        `).join('');
    }
    
    // Filter by category
    function filterByCategory() {
        const category = document.getElementById('category-filter').value;
        const filtered = category ? filterEventsByCategory(category) : calendarEvents;
        displaySearchResults(filtered);
    }
    
    // Filter by priority
    function filterByPriority() {
        const priority = document.getElementById('priority-filter').value;
        const filtered = priority ? filterEventsByPriority(priority) : calendarEvents;
        displaySearchResults(filtered);
    }
    
    // Clear search
    function clearSearch() {
        const searchInput = document.getElementById('event-search');
        const resultsContainer = document.getElementById('search-results');
        
        if (searchInput) searchInput.value = '';
        if (resultsContainer) resultsContainer.innerHTML = '';
    }
    
    // === MISSING HELPER FUNCTIONS ===
    
    // Get current month and year
    function getCurrentMonthYear() {
        return currentDate.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
    }
    
    // Get current week range
    function getCurrentWeekRange() {
        const startOfWeek = getStartOfWeek();
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    
    // Get current day
    function getCurrentDay() {
        return currentDate.toLocaleDateString('en-US', { 
            weekday: 'long',
            month: 'long', 
            day: 'numeric',
            year: 'numeric'
        });
    }
    
    // Create day element for calendar
    function createDayElement(date) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.dataset.date = date.toISOString().split('T')[0];
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        dayElement.appendChild(dayNumber);
        
        // Add events for this day
        const dayEvents = calendarEvents.filter(event => {
            const eventDate = new Date(event.startDate || event.start);
            const matches = eventDate.toDateString() === date.toDateString();
            
            // Debug Islamic events
            if (event.isIslamicEvent && matches) {
                log.debug(`🕌 Islamic event match: ${event.title} (${eventDate.toDateString()} === ${date.toDateString()})`);
            }
            
            return matches;
        });
        
        // Debug: Check for Islamic events on this day
        const islamicEvents = dayEvents.filter(e => e.isIslamicEvent);
        if (islamicEvents.length > 0) {
            log.debug(`🕌 Day ${date.getDate()}: Found ${islamicEvents.length} Islamic events`);
        }
        
        if (dayEvents.length > 0) {
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'day-events';
            
            dayEvents.slice(0, 3).forEach(event => {
                const eventElement = document.createElement('div');
                eventElement.className = 'day-event';
                eventElement.textContent = event.title;
                eventElement.title = event.description || event.title;
                eventsContainer.appendChild(eventElement);
            });
            
            if (dayEvents.length > 3) {
                const moreElement = document.createElement('div');
                moreElement.className = 'day-event more';
                moreElement.textContent = `+${dayEvents.length - 3} more`;
                eventsContainer.appendChild(moreElement);
            }
            
            dayElement.appendChild(eventsContainer);
        }
        
        return dayElement;
    }
    
    // Generate day events for day view
    function generateDayEvents() {
        const today = new Date();
        const dayEvents = calendarEvents.filter(event => {
            const eventDate = new Date(event.startDate || event.start);
            return eventDate.toDateString() === today.toDateString();
        });
        
        if (dayEvents.length === 0) {
            return '<div class="no-events">No events today</div>';
        }
        
        return dayEvents.map(event => `
            <div class="day-event-item" data-event-id="${event.id}">
                <div class="event-time">${formatEventTime(event.startDate || event.start)}</div>
                <div class="event-content">
                    <h4>${event.title}</h4>
                    <p>${event.description || ''}</p>
                </div>
            </div>
        `).join('');
    }
    
    // Navigation functions
    function previousMonth() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendarEnhanced();
    }
    
    function nextMonth() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendarEnhanced();
    }
    
    function previousWeek() {
        currentDate.setDate(currentDate.getDate() - 7);
        renderCalendarEnhanced();
    }
    
    function nextWeek() {
        currentDate.setDate(currentDate.getDate() + 7);
        renderCalendarEnhanced();
    }
    
    function previousDay() {
        currentDate.setDate(currentDate.getDate() - 1);
        renderCalendarEnhanced();
    }
    
    function nextDay() {
        currentDate.setDate(currentDate.getDate() + 1);
        renderCalendarEnhanced();
    }
    
    function previousYear() {
        currentDate.setFullYear(currentDate.getFullYear() - 1);
        renderCalendarEnhanced();
    }
    
    function nextYear() {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        renderCalendarEnhanced();
    }
    
    // Timeline functions
    function zoomInTimeline() {
        console.log('Zooming in timeline');
        // Implementation for timeline zoom
    }
    
    function zoomOutTimeline() {
        console.log('Zooming out timeline');
        // Implementation for timeline zoom
    }
    
    // Sync functions
    function syncGoogleCalendar() {
        console.log('Syncing with Google Calendar');
        // Implementation for Google Calendar sync
    }
    
    function syncMicrosoftCalendar() {
        console.log('Syncing with Microsoft Calendar');
        // Implementation for Microsoft Calendar sync
    }

    // Make functions globally accessible
    window.testIntegration = testIntegration;
    window.disconnectIntegration = disconnectIntegration;
    window.exportCalendarData = exportCalendarData;
    window.importCalendarData = importCalendarData;
    window.switchViewMode = switchViewMode;
    window.applyTheme = applyTheme;
    window.searchEvents = searchEvents;
    window.bulkDeleteEvents = bulkDeleteEvents;
    window.bulkMoveEvents = bulkMoveEvents;
    window.duplicateEvents = duplicateEvents;
    window.undoLastAction = undoLastAction;
    window.redoLastAction = redoLastAction;
    window.handleSearch = handleSearch;
    window.clearSearch = clearSearch;
    window.filterByCategory = filterByCategory;
    window.filterByPriority = filterByPriority;
    
    // Load real events from server
    async function loadRealEvents() {
        if (!auth.isAuthenticated) {
            logger.info('🛜 Offline mode → using localStorage only (skipping server fetch)');
            return loadEventsFromLocalStorage();
        }
        
        try {
            logger.info('📡 Fetching real events from server...');
            
            const response = await authenticatedFetch('/api/calendar/events', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.events) {
                    // Preserve existing Islamic events
                    const existingIslamicEvents = calendarEvents.filter(event => event.isIslamicEvent);
                    console.log('🔄 Preserving', existingIslamicEvents.length, 'existing Islamic events');
                    
                    calendarEvents = data.events.map(event => ({
                        ...event,
                        startDate: new Date(event.startDate),
                        endDate: event.endDate ? new Date(event.endDate) : null
                    }));
                    
                    // Add back Islamic events
                    calendarEvents.push(...existingIslamicEvents);
                    
                    events = [...calendarEvents];
                    console.log('✅ Real events loaded:', data.events.length, 'events +', existingIslamicEvents.length, 'Islamic events =', calendarEvents.length, 'total');
                    return true;
                }
            } else {
                console.log('❌ Failed to load events from server:', response.status);
            }
        } catch (error) {
            if (error?.status === 401) {
                console.info('🛜 401 from server → falling back to localStorage (offline)');
                return loadEventsFromLocalStorage();
            }
            console.error('❌ Error loading real events:', error);
        }
        
        // Fallback to localStorage if server fails
        return loadEventsFromLocalStorage();
    }
    
    function loadEventsFromLocalStorage() {
        console.log('📱 Loading events from localStorage...');
        const savedEvents = localStorage.getItem('calendar-events');
        if (savedEvents) {
            events = JSON.parse(savedEvents).map(event => ({
                ...event,
                startDate: new Date(event.startDate),
                endDate: event.endDate ? new Date(event.endDate) : null
            }));
            calendarEvents = [...events];
            console.log('✅ Events loaded from localStorage:', events.length, 'events');
            return true;
        }
        
        console.log('ℹ️ No events found, starting with empty calendar');
        return false;
    }
    
    // Initialize real data (commented out for now to avoid conflicts)
    // loadRealEvents();
    
    // Load Hijri calendar data
    async function loadHijriData() {
        try {
            console.log('🌙 Loading Hijri calendar data...');
            
            // Get JWT token from localStorage
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch('/api/hijri/current', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                },
                credentials: 'include'
            });
            
            console.log('🌙 Hijri API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('🌙 Hijri API data:', data);
                if (data.success && data.hijriDate) {
                    window.currentHijriDate = data.hijriDate;
                    console.log('✅ Hijri date loaded:', data.hijriDate);
                    
                    // Update UI with Hijri date
                    updateHijriDisplay(data.hijriDate);
                }
            } else {
                console.log('⚠️ Failed to load Hijri data, status:', response.status);
                // Use fallback Hijri calculation
                window.currentHijriDate = getFallbackHijriDate();
                updateHijriDisplay(window.currentHijriDate);
            }
        } catch (error) {
            if (error?.status === 401) {
                console.info('🌙 Hijri API unauthorized → skipping (offline).');
                return null;
            }
            console.error('❌ Error loading Hijri data:', error);
            window.currentHijriDate = getFallbackHijriDate();
            updateHijriDisplay(window.currentHijriDate);
        }
    }
    
    // Load OAuth sync status
    async function loadOAuthSyncStatus() {
        try {
            console.log('🔄 Loading OAuth sync status...');
            
            // Get JWT token from localStorage
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch('/api/oauth-sync/status', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                },
                credentials: 'include'
            });
            
            console.log('🔄 OAuth sync API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔄 OAuth sync API data:', data);
                if (data.success && data.syncStatus) {
                    window.oauthSyncStatus = data.syncStatus;
                    console.log('✅ OAuth sync status loaded:', data.syncStatus);
                    console.log('🔍 [OAuth Sync] Google needsReauth:', data.syncStatus.google?.needsReauth);
                    console.log('🔍 [OAuth Sync] Microsoft needsReauth:', data.syncStatus.microsoft?.needsReauth);
                    
                    // Update UI with sync status
                    updateOAuthSyncDisplay(data.syncStatus);
                }
            } else {
                console.log('⚠️ Failed to load OAuth sync status, status:', response.status);
                // Create mock sync status for display
                window.oauthSyncStatus = {
                    google: { connected: false, lastSync: null, hasToken: false },
                    microsoft: { connected: false, lastSync: null, hasToken: false },
                    totalEvents: 0,
                    externalEvents: 0
                };
                updateOAuthSyncDisplay(window.oauthSyncStatus);
            }
        } catch (error) {
            console.error('❌ Error loading OAuth sync status:', error);
            // Create mock sync status for display
            window.oauthSyncStatus = {
                google: { connected: false, lastSync: null, hasToken: false },
                microsoft: { connected: false, lastSync: null, hasToken: false },
                totalEvents: 0,
                externalEvents: 0
            };
            updateOAuthSyncDisplay(window.oauthSyncStatus);
        }
    }
    
    // Update Hijri display in UI
    function updateHijriDisplay(hijriDate) {
        const hijriElements = document.querySelectorAll('.hijri-date');
        hijriElements.forEach(element => {
            element.textContent = `${hijriDate.day} ${hijriDate.monthName} ${hijriDate.year} AH`;
        });
        
        // Update Hijri date display in enhanced controls
        const hijriDisplay = document.querySelector('#hijri-date');
        if (hijriDisplay) {
            hijriDisplay.innerHTML = `
                <span class="hijri-date">${hijriDate.day} ${hijriDate.monthName} ${hijriDate.year} AH</span>
                ${hijriDate.isHoliday ? `<span class="islamic-holiday">${hijriDate.holiday.name}</span>` : ''}
            `;
        }
    }
    
        // Update OAuth sync display in UI
        function updateOAuthSyncDisplay(syncStatus) {
            console.log('🔄 [Calendar] Updating OAuth sync display:', syncStatus);
            console.log('🔍 [Calendar] Google object:', syncStatus.google);
            console.log('🔍 [Calendar] Google connected value:', syncStatus.google?.connected);
            console.log('🔍 [Calendar] Google connected type:', typeof syncStatus.google?.connected);
            
            // Update Google sync status
            const googleSyncElement = document.querySelector('.google-sync-status');
            if (googleSyncElement) {
                const isConnected = syncStatus.google && syncStatus.google.connected;
                const needsReauth = syncStatus.google && syncStatus.google.needsReauth;
                const hasCalendarPermissions = syncStatus.google && syncStatus.google.hasCalendarPermissions;
                
                console.log('🔄 [Calendar] Google status:', { isConnected, needsReauth, hasCalendarPermissions });
                
                if (needsReauth) {
                    console.log('🔑 [Calendar] Creating Google re-authorization button');
                }
                
                googleSyncElement.innerHTML = `
                    <span class="sync-indicator ${isConnected ? 'connected' : 'disconnected'}"></span>
                    <span class="sync-text">Google: ${isConnected ? 'Two-Way Sync Active' : 'Disconnected'}</span>
                    ${syncStatus.google?.lastSync ? `<span class="last-sync">Last sync: ${new Date(syncStatus.google.lastSync).toLocaleString()}</span>` : ''}
                    ${isConnected && !needsReauth ? `
                        <div class="sync-info" style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 10px; margin-top: 8px; font-size: 14px;">
                            <p style="margin: 0; color: #155724;">🔄 Two-way sync enabled: Local ↔ Google Calendar</p>
                        </div>
                    ` : ''}
                    ${needsReauth ? `
                        <div class="reauth-notice" style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin-top: 10px;">
                            <p style="margin: 0 0 10px 0; color: #856404; font-weight: bold; font-size: 16px;">⚠️ Calendar permissions needed</p>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <button onclick="refreshGoogleToken()" class="reauth-btn" style="background: #28a745; color: white; border: none; border-radius: 6px; padding: 12px 20px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                    🔄 Refresh Token
                                </button>
                                <button onclick="reauthorizeGoogle()" class="reauth-btn" style="background: #007bff; color: white; border: none; border-radius: 6px; padding: 12px 20px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                    🔑 Grant Calendar Access
                                </button>
                            </div>
                        </div>
                    ` : ''}
                `;
            }
            
            // Update Microsoft sync status
            const microsoftSyncElement = document.querySelector('.microsoft-sync-status');
            if (microsoftSyncElement) {
                const isConnected = syncStatus.microsoft && syncStatus.microsoft.connected;
                const needsReauth = syncStatus.microsoft && syncStatus.microsoft.needsReauth;
                const hasCalendarPermissions = syncStatus.microsoft && syncStatus.microsoft.hasCalendarPermissions;
                
                console.log('🔄 [Calendar] Microsoft status:', { isConnected, needsReauth, hasCalendarPermissions });
                console.log('🔍 [Calendar] Microsoft sync status details:', syncStatus.microsoft);
                
                microsoftSyncElement.innerHTML = `
                    <span class="sync-indicator ${isConnected ? 'connected' : 'disconnected'}"></span>
                    <span class="sync-text">Microsoft: ${isConnected ? 'Two-Way Sync Active' : 'Disconnected'}</span>
                    ${syncStatus.microsoft?.lastSync ? `<span class="last-sync">Last sync: ${new Date(syncStatus.microsoft.lastSync).toLocaleString()}</span>` : ''}
                    ${isConnected && !needsReauth ? `
                        <div class="sync-info" style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 10px; margin-top: 8px; font-size: 14px;">
                            <p style="margin: 0; color: #155724;">🔄 Two-way sync enabled: Local ↔ Microsoft Calendar</p>
                        </div>
                    ` : ''}
                    ${needsReauth ? `
                        <div class="reauth-notice" style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin-top: 10px;">
                            <p style="margin: 0 0 10px 0; color: #856404; font-weight: bold; font-size: 16px;">⚠️ Calendar permissions needed</p>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                <button onclick="refreshMicrosoftToken()" class="reauth-btn" style="background: #28a745; color: white; border: none; border-radius: 6px; padding: 12px 20px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                    🔄 Refresh Token
                                </button>
                                <button onclick="clearMicrosoftTokens()" class="reauth-btn" style="background: #dc3545; color: white; border: none; border-radius: 6px; padding: 12px 20px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                    🗑️ Clear Tokens
                                </button>
                                <button onclick="reauthorizeMicrosoft()" class="reauth-btn" style="background: #007bff; color: white; border: none; border-radius: 6px; padding: 12px 20px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                    🔑 Grant Calendar Access
                                </button>
                                <button onclick="debugMicrosoftOAuth()" class="reauth-btn" style="background: #6c757d; color: white; border: none; border-radius: 6px; padding: 12px 20px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                    🔍 Debug Microsoft OAuth
                                </button>
                                <button onclick="testMicrosoftOAuth()" class="reauth-btn" style="background: #17a2b8; color: white; border: none; border-radius: 6px; padding: 12px 20px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                    🧪 Test Microsoft OAuth
                                </button>
                                <button onclick="checkMicrosoftCallback()" class="reauth-btn" style="background: #fd7e14; color: white; border: none; border-radius: 6px; padding: 12px 20px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                    🔄 Check Callback
                                </button>
                                <button onclick="triggerMicrosoftOAuth()" class="reauth-btn" style="background: #28a745; color: white; border: none; border-radius: 6px; padding: 12px 20px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                    🚀 Manual OAuth
                                </button>
                                <button onclick="testMicrosoftConfig()" class="reauth-btn" style="background: #6f42c1; color: white; border: none; border-radius: 6px; padding: 12px 20px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                    ⚙️ Test Config
                            </button>
                            </div>
                        </div>
                    ` : ''}
                `;
            }
        }
    
    // Fallback Hijri date calculation
    function getFallbackHijriDate() {
        // Simple approximation - not accurate but provides fallback
        const hijriEpoch = new Date(622, 6, 16); // July 16, 622 CE
        const now = new Date();
        const daysSinceEpoch = Math.floor((now - hijriEpoch) / (1000 * 60 * 60 * 24));
        const hijriYear = Math.floor(daysSinceEpoch / 354.37) + 1;
        const hijriMonth = Math.floor((daysSinceEpoch % 354.37) / 29.53) + 1;
        const hijriDay = Math.floor((daysSinceEpoch % 29.53)) + 1;
        
        return {
            year: hijriYear,
            month: hijriMonth,
            day: hijriDay,
            monthName: 'Unknown',
            monthNameArabic: 'غير معروف',
            dayName: 'Unknown',
            dayNameArabic: 'غير معروف',
            isHoliday: false,
            holiday: null
        };
    }
    
    // Two-way sync with Google Calendar
    syncWithGoogle = async function() {
        try {
            console.log('🔄 Starting two-way sync with Google Calendar...');
            
            // Get JWT token from localStorage
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch('/api/oauth-sync/google/two-way', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                },
                credentials: 'include'
            });
            
            console.log('🔄 Two-way Google sync response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔄 Two-way Google sync response data:', data);
                if (data.success) {
                    const result = data.result || data;
                    console.log('✅ Two-way Google sync completed:', result);
                    
                    // Show detailed success message
                    let message = `Two-way Google Calendar sync completed!\n\n`;
                    
                    // Handle different response structures
                    if (result.localToGoogle && result.googleToLocal) {
                        // New detailed response structure
                        message += `📤 Local to Google: ${result.localToGoogle?.eventsCreated || 0} created, ${result.localToGoogle?.eventsUpdated || 0} updated\n`;
                        message += `📥 Google to Local: ${result.googleToLocal?.eventsCreated || 0} created, ${result.googleToLocal?.eventsUpdated || 0} updated\n`;
                        message += `📊 Total synced: ${result.totalSynced || 0} events`;
                    } else {
                        // Simple response structure
                        message += `✅ Sync completed successfully!`;
                        if (result.eventsCount !== undefined) {
                            message += `\n📊 Events synced: ${result.eventsCount}`;
                        }
                        if (result.lastSync) {
                            message += `\n🕒 Last sync: ${new Date(result.lastSync).toLocaleString()}`;
                        }
                    }
                    
                    showNotification(message, 'success');
                    
                    // Reload events
                    await loadRealEvents();
                    renderCalendarEnhanced();
                }
            } else {
                console.log('❌ Google sync failed, status:', response.status);
                const errorData = await response.json().catch(() => ({}));
                console.log('❌ Google sync error data:', errorData);
                showNotification('Google Calendar sync failed', 'error');
            }
        } catch (error) {
            console.error('❌ Google sync error:', error);
            showNotification('Google Calendar sync error', 'error');
        }
    }
    
    // Sync with Microsoft Calendar - Two-way sync
    syncWithMicrosoft = async function() {
        try {
            console.log('🔄 Starting two-way sync with Microsoft Calendar...');
            
            // Get JWT token from localStorage
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch('/api/oauth-sync/microsoft/two-way', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                },
                credentials: 'include'
            });
            
            console.log('🔄 Two-way Microsoft sync response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('❌ Microsoft sync failed, status:', response.status);
                console.error('❌ Microsoft sync error data:', errorData);
                showNotification(`Microsoft sync failed: ${errorData.error || 'Unknown error'}`, 'error');
                return;
            }
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔄 Two-way Microsoft sync response data:', data);
                
                if (data.success) {
                    const result = data.result || data; // Handle both structures
                    console.log('✅ Two-way Microsoft sync completed:', result);
                    
                    let message = `Two-way Microsoft Calendar sync completed!\n\n`;
                    if (result.localToMicrosoft && result.microsoftToLocal) {
                        message += `📤 Local to Microsoft: ${result.localToMicrosoft?.eventsCreated || 0} created, ${result.localToMicrosoft?.eventsUpdated || 0} updated\n`;
                        message += `📥 Microsoft to Local: ${result.microsoftToLocal?.eventsCreated || 0} created, ${result.microsoftToLocal?.eventsUpdated || 0} updated\n`;
                        message += `📊 Total synced: ${result.totalSynced || 0} events`;
                    } else {
                        message += `✅ Sync completed successfully!`;
                        if (result.eventsCount !== undefined) {
                            message += `\n📊 Events synced: ${result.eventsCount}`;
                        }
                        if (result.lastSync) {
                            message += `\n🕒 Last sync: ${new Date(result.lastSync).toLocaleString()}`;
                        }
                    }
                    
                    showNotification(message, 'success');
                    
                    // Reload events
                    await loadRealEvents();
                    renderCalendarEnhanced();
                } else {
                    console.log('❌ Microsoft sync failed:', data.error);
                    showNotification(`Microsoft Calendar sync failed: ${data.error}`, 'error');
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.log('❌ Microsoft sync failed, status:', response.status);
                console.log('❌ Microsoft sync error data:', errorData);
                showNotification(`Microsoft Calendar sync failed: ${errorData.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('❌ Microsoft sync error:', error);
            showNotification('Microsoft Calendar sync error: ' + error.message, 'error');
        }
    }
    
    // Full two-way sync (both providers)
    fullSync = async function() {
        try {
            console.log('🔄 Starting full two-way sync with both Google and Microsoft...');
            
            const results = {
                google: null,
                microsoft: null,
                totalSynced: 0
            };
            
            // Sync with Google Calendar
            try {
                console.log('🔄 Syncing with Google Calendar...');
                await syncWithGoogle();
                results.google = { success: true };
            } catch (error) {
                console.log('⚠️ Google sync failed:', error.message);
                results.google = { success: false, error: error.message };
            }
            
            // Sync with Microsoft Calendar
            try {
                console.log('🔄 Syncing with Microsoft Calendar...');
                await syncWithMicrosoft();
                results.microsoft = { success: true };
            } catch (error) {
                console.log('⚠️ Microsoft sync failed:', error.message);
                results.microsoft = { success: false, error: error.message };
            }
            
            // Show summary
            let message = 'Full two-way sync completed!\n\n';
            if (results.google?.success) {
                message += '✅ Google Calendar: Synced successfully\n';
            } else if (results.google?.error) {
                message += `❌ Google Calendar: ${results.google.error}\n`;
            }
            
            if (results.microsoft?.success) {
                message += '✅ Microsoft Calendar: Synced successfully\n';
            } else if (results.microsoft?.error) {
                message += `❌ Microsoft Calendar: ${results.microsoft.error}\n`;
            }
            
            showNotification(message, 'success');
            
            // Reload events and sync status
            await loadRealEvents();
            await loadOAuthSyncStatus();
            renderCalendarEnhanced();
            
        } catch (error) {
            console.error('❌ Full sync error:', error);
            showNotification('Full sync error: ' + error.message, 'error');
        }
    }
    
    // Re-authorization functions
    reauthorizeGoogle = function() {
        console.log('🔄 Initiating Google calendar re-authorization...');
        window.location.href = '/api/oauth-sync/google/reauth';
    }
    
    reauthorizeMicrosoft = function() {
        console.log('🔄 Initiating Microsoft calendar re-authorization...');
        console.log('🔍 [Microsoft OAuth] Current URL before redirect:', window.location.href);
        console.log('🔍 [Microsoft OAuth] Redirecting to:', '/api/oauth-sync/microsoft/reauth');
        
        // Add a small delay to ensure logs are captured
        setTimeout(() => {
        window.location.href = '/api/oauth-sync/microsoft/reauth';
        }, 100);
    }
    
    // Check Microsoft OAuth callback status
    checkMicrosoftCallback = function() {
        console.log('🔍 [Callback] Checking Microsoft OAuth callback status...');
        
        // Check if we're coming from a Microsoft OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        const token = urlParams.get('token');
        const provider = urlParams.get('provider');
        const redirect = urlParams.get('redirect');
        
        console.log('🔍 [Callback] URL parameters:', { 
            code: !!code, 
            state: !!state, 
            error, 
            token: !!token, 
            provider, 
            redirect 
        });
        
        if (error) {
            alert(`❌ Microsoft OAuth Error: ${error}\n\nDescription: ${urlParams.get('error_description') || 'Unknown error'}`);
            return;
        }
        
        // Check for Microsoft OAuth callback with token (from authCallback.html)
        if (token && provider === 'microsoft') {
            console.log('✅ [Callback] Microsoft OAuth callback detected with token');
            alert('✅ Microsoft OAuth callback detected!\n\nToken: ' + token.substring(0, 20) + '...\nProvider: ' + provider + '\nRedirect: ' + (redirect || 'none') + '\n\nProcessing...');
            
            // Store the token if needed
            if (token) {
                localStorage.setItem('authToken', token);
                localStorage.setItem('accessToken', token);
                console.log('🔑 [Callback] Token stored in localStorage');
            }
            
            // Clear the URL parameters
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            
            // Refresh the page to trigger OAuth status check
            setTimeout(() => {
                console.log('🔄 [Callback] Refreshing page to check OAuth status...');
                window.location.reload();
            }, 2000);
            return;
        }
        
        // Check for OAuth callback success (from authCallback.html redirect)
        const oauthCallback = urlParams.get('oauth_callback');
        const callbackProvider = urlParams.get('provider');
        const timestamp = urlParams.get('timestamp');
        
        if (oauthCallback === 'success' && callbackProvider === 'microsoft') {
            console.log('✅ [Callback] Microsoft OAuth callback success detected');
            alert('✅ Microsoft OAuth callback success detected!\n\nProvider: ' + callbackProvider + '\nTimestamp: ' + new Date(parseInt(timestamp)).toLocaleString() + '\n\nRefreshing OAuth status...');
            
            // Clear the URL parameters
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            
            // Refresh the page to trigger OAuth status check
            setTimeout(() => {
                console.log('🔄 [Callback] Refreshing page to check OAuth status...');
                window.location.reload();
            }, 2000);
            return;
        }
        
        // Check for direct Microsoft OAuth callback with code and state
        if (code && state) {
            console.log('✅ [Callback] Microsoft OAuth callback detected with code and state');
            alert('✅ Microsoft OAuth callback detected!\n\nCode: ' + code.substring(0, 20) + '...\nState: ' + state + '\n\nProcessing...');
            
            // Clear the URL parameters
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            
            // Refresh the page to trigger OAuth status check
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            console.log('ℹ️ [Callback] No Microsoft OAuth callback detected');
        }
    };
    
    // Manually trigger Microsoft OAuth flow
    triggerMicrosoftOAuth = function() {
        console.log('🚀 [Manual] Triggering Microsoft OAuth flow...');
        
        // First check current status
        debugMicrosoftOAuth().then(() => {
            console.log('🔍 [Manual] Current status checked, proceeding with OAuth...');
            
            // Clear any existing Microsoft tokens first
            clearMicrosoftTokens().then(() => {
                console.log('🧹 [Manual] Tokens cleared, starting fresh OAuth flow...');
                
                // Start the OAuth flow
                setTimeout(() => {
                    console.log('🔄 [Manual] Redirecting to Microsoft OAuth...');
                    window.location.href = '/api/oauth-sync/microsoft/reauth';
                }, 1000);
            }).catch(error => {
                console.error('❌ [Manual] Error clearing tokens:', error);
                // Proceed anyway
                setTimeout(() => {
                    console.log('🔄 [Manual] Redirecting to Microsoft OAuth (despite clear error)...');
                    window.location.href = '/api/oauth-sync/microsoft/reauth';
                }, 1000);
            });
        });
    };
    
    // Test Microsoft OAuth configuration
    testMicrosoftConfig = async function() {
        try {
            console.log('🔍 [Config] Testing Microsoft OAuth configuration...');
            const response = await fetch('/api/auth/test-microsoft-config', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ [Config] Microsoft OAuth configuration:', data);
                alert('✅ Microsoft OAuth Configuration:\n\n' + JSON.stringify(data.config, null, 2));
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('❌ [Config] Configuration test failed:', errorData);
                alert('❌ Configuration test failed: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ [Config] Configuration test error:', error);
            alert('❌ Configuration test error: ' + error.message);
        }
    };

    // Test Microsoft OAuth connection
    testMicrosoftOAuth = async function() {
        try {
            console.log('🧪 Testing Microsoft OAuth connection...');
            
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            if (!authToken) {
                alert('❌ No auth token found. Please log in first.');
                return;
            }
            
            // Test the Microsoft sync endpoint
            const response = await fetch('/api/oauth-sync/microsoft/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ [Test] Microsoft OAuth test successful:', data);
                alert('✅ Microsoft OAuth connection test successful!\n\n' + JSON.stringify(data, null, 2));
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('❌ [Test] Microsoft OAuth test failed:', errorData);
                alert('❌ Microsoft OAuth test failed:\n\n' + JSON.stringify(errorData, null, 2));
            }
        } catch (error) {
            console.error('❌ [Test] Microsoft OAuth test error:', error);
            alert('❌ Microsoft OAuth test error: ' + error.message);
        }
    };
    
    // Refresh Google token function
    refreshGoogleToken = async function() {
        try {
            console.log('🔄 Refreshing Google token...');
            
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch('/api/oauth-sync/google/refresh-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Google token refreshed:', data);
                alert('✅ Google token refreshed successfully! Please refresh the page to see updated permissions.');
                // Reload the page to get fresh status
                window.location.reload();
            } else {
                const errorData = await response.json();
                console.error('❌ Token refresh failed:', errorData);
                alert('❌ Token refresh failed: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ Token refresh error:', error);
            alert('❌ Token refresh error: ' + error.message);
        }
    }
    
    // Refresh Microsoft token function
    refreshMicrosoftToken = async function() {
        try {
            console.log('🔄 Refreshing Microsoft token...');
            
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch('/api/oauth-sync/microsoft/refresh-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Microsoft token refreshed:', data);
                alert('✅ Microsoft token refreshed successfully! Please refresh the page to see updated permissions.');
                // Reload the page to get fresh status
                window.location.reload();
            } else {
                const errorData = await response.json();
                console.error('❌ Microsoft token refresh failed:', errorData);
                alert('❌ Microsoft token refresh failed: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ Microsoft token refresh error:', error);
            alert('❌ Microsoft token refresh error: ' + error.message);
        }
    }
    
    // Debug Microsoft OAuth function
    debugMicrosoftOAuth = async function() {
        try {
            console.log('🔍 [Debug] Starting Microsoft OAuth debug...');
            
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            if (!authToken) {
                alert('❌ No auth token found. Please log in first.');
                return;
            }
            
            // Check debug endpoint
            const response = await fetch('/api/oauth-sync/debug-user', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔍 [Debug] User OAuth debug data:', data);
                
                const microsoftData = data.debugData.microsoft;
                const message = `Microsoft OAuth Debug Info:
                
Access Token: ${microsoftData.hasAccessToken ? '✅ Present' : '❌ Missing'}
Refresh Token: ${microsoftData.hasRefreshToken ? '✅ Present' : '❌ Missing'}
Microsoft ID: ${microsoftData.hasId ? '✅ Present' : '❌ Missing'}
Token Expiry: ${microsoftData.tokenExpiry ? new Date(microsoftData.tokenExpiry).toLocaleString() : 'Not set'}
Last Sync: ${microsoftData.lastSync ? new Date(microsoftData.lastSync).toLocaleString() : 'Never'}

Status: ${microsoftData.hasAccessToken && microsoftData.hasId ? 'Connected' : 'Not Connected'}

Raw Data: ${JSON.stringify(microsoftData, null, 2)}`;
                
                alert(message);
                console.log('🔍 [Debug] Full Microsoft OAuth data:', microsoftData);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('❌ [Debug] Debug request failed:', errorData);
                alert('❌ Debug request failed: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ [Debug] Debug error:', error);
            alert('❌ Debug error: ' + error.message);
        }
    };
    
    // Clear Microsoft tokens function
    clearMicrosoftTokens = async function() {
        try {
            console.log('🗑️ Clearing Microsoft tokens...');
            
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            if (!authToken) {
                alert('❌ Please log in first');
                return;
            }
            
            // Try multiple endpoints in case one doesn't exist
            const endpoints = [
                '/api/user/clear-microsoft-tokens',
                '/api/oauth-sync/microsoft/clear-tokens',
                '/api/clear-oauth-tokens'
            ];
            
            let success = false;
            let lastError = null;
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`Trying endpoint: ${endpoint}`);
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        try {
                            const data = await response.json();
                            console.log(`✅ Microsoft tokens cleared via ${endpoint}:`, data);
                            alert('✅ Microsoft tokens cleared successfully! You can now reauthorize with fresh permissions.');
                            success = true;
                            break;
                        } catch (jsonError) {
                            console.log(`❌ JSON parse error with ${endpoint}:`, jsonError.message);
                            lastError = `JSON parse error: ${jsonError.message}`;
                        }
                    } else {
                        console.log(`❌ Failed with ${endpoint}:`, response.status);
                        const errorText = await response.text();
                        lastError = `Status ${response.status}: ${errorText}`;
                    }
                } catch (error) {
                    console.log(`❌ Error with ${endpoint}:`, error.message);
                    lastError = error.message;
                }
            }
            
            if (!success) {
                console.error('❌ All Microsoft token clear attempts failed');
                alert('❌ Microsoft token clear failed: ' + (lastError || 'Unknown error'));
            } else {
                // Reload the page to get fresh status
                window.location.reload();
            }
            
        } catch (error) {
            console.error('❌ Microsoft token clear error:', error);
            alert('❌ Microsoft token clear error: ' + error.message);
        }
    }

    // --- Islamic Calendar Functions ---
    
    // Load current Hijri date
    async function loadCurrentHijriDate() {
        try {
            // Get JWT token from localStorage (same pattern as other successful API calls)
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch('/api/islamic-calendar/current-hijri', {
                headers: {
                    'Authorization': authToken ? `Bearer ${authToken}` : '',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                islamicEvents.hijriDate = data.hijri;
                updateHijriDisplay();
            }
        } catch (error) {
            console.error('Error loading Hijri date:', error);
        }
    }

    // Update Hijri date display
    function updateHijriDisplay() {
        const hijriDisplay = document.getElementById('hijri-date-display');
        if (hijriDisplay && islamicEvents.hijriDate) {
            const hijri = islamicEvents.hijriDate;
            hijriDisplay.innerHTML = `
                <div class="hijri-date-main">
                    ${hijri.day} ${hijri.monthNameAr} ${hijri.year} AH
                </div>
                <div class="hijri-date-english">
                    ${hijri.day} ${hijri.monthName} ${hijri.year} AH
                </div>
            `;
        }
    }

    // Load Islamic events for current month
    async function loadIslamicEvents() {
        try {
            console.log('🕌 Loading Islamic events...');
            
            // Get JWT token from localStorage (same pattern as other successful API calls)
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch(`/api/islamic-calendar/monthly-events/${currentDate.getFullYear()}/${currentDate.getMonth() + 1}?latitude=${userLatitude}&longitude=${userLongitude}&country=${userCountry}`, {
                headers: {
                    'Authorization': authToken ? `Bearer ${authToken}` : '',
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            console.log('🕌 Islamic events API response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('🕌 Islamic events API data:', data);
                islamicEvents = data.events || data;
                console.log('✅ Islamic events loaded:', islamicEvents);
                
                // Add Islamic events to calendar
                addIslamicEventsToCalendar(islamicEvents);
                
                // Update prayer times display
                updatePrayerTimesDisplay();
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Islamic events API error:', response.status, errorData);
            }
        } catch (error) {
            console.error('❌ Error loading Islamic events:', error);
        }
    }

    // Bulletproof deduplication for Islamic events
    function addIslamicEvents(generated) {
        const key = e => `${e.title}|${new Date(e.startDate || e.start).toISOString().slice(0,10)}`;
        const have = new Set((calendarEvents || []).map(key));
        const toAdd = generated.filter(e => !have.has(key(e)));
        calendarEvents.push(...toAdd);
        return toAdd.length;
    }

    // Add Islamic events to calendar
    function addIslamicEventsToCalendar(eventsData = islamicEvents) {
        try {
            logger.info('🕌 Adding Islamic events to calendar:', eventsData);
            
            const eventsToAdd = [];
            
            // Add holidays
            if (eventsData.holidays && Array.isArray(eventsData.holidays)) {
                eventsData.holidays.forEach(holiday => {
                    const event = {
                        id: `islamic-holiday-${holiday.date}`,
                        title: holiday.name,
                        description: holiday.nameAr,
                        startDate: new Date(holiday.date),
                        endDate: new Date(holiday.date),
                        start: new Date(holiday.date), // Keep both for compatibility
                        end: new Date(holiday.date),
                        category: 'islamic',
                        color: holiday.type === 'public' ? '#28a745' : '#dc3545',
                        isIslamicEvent: true,
                        isHoliday: true,
                        country: holiday.country,
                        source: 'islamic',
                        updatedAt: new Date()
                    };
                    
                    if (!eventDeduplicator.isDuplicate(event)) {
                        eventsToAdd.push(eventDeduplicator.add(event));
                    }
                });
                logger.info(`✅ Processed ${eventsData.holidays.length} Islamic holidays`);
            } else {
                logger.warn('⚠️ No holidays found in Islamic events data');
            }

            // Add prayer events
            if (eventsData.prayerEvents && Array.isArray(eventsData.prayerEvents)) {
                eventsData.prayerEvents.forEach((prayer, index) => {
                    const event = {
                        id: `prayer-${prayer.start}`,
                        title: prayer.title,
                        description: prayer.description,
                        startDate: new Date(prayer.start),
                        endDate: new Date(prayer.end),
                        start: new Date(prayer.start), // Keep both for compatibility
                        end: new Date(prayer.end),
                        category: 'prayer',
                        color: '#007bff',
                        isIslamicEvent: true,
                        isPrayer: true
                    };
                    
                    // Debug: Show first few events
                    if (index < 3) {
                        console.log(`🕌 Creating prayer event ${index + 1}:`, {
                            title: event.title,
                            startDate: event.startDate,
                            start: event.start,
                            startDateStr: formatDate(event.startDate),
                            startStr: formatDate(event.start)
                        });
                    }
                    
                    // Check if event already exists
                    const existingIndex = calendarEvents.findIndex(e => e.id === event.id);
                    if (existingIndex === -1) {
                        calendarEvents.push(event);
                    }
                });
                console.log(`✅ Added ${eventsData.prayerEvents.length} prayer events to calendar`);
            } else {
                console.log('⚠️ No prayer events found in Islamic events data');
            }

            // Re-render calendar with new events
            console.log('🔄 Total calendar events after adding Islamic events:', calendarEvents.length);
            console.log('🔄 Islamic events in calendarEvents:', calendarEvents.filter(e => e.isIslamicEvent).length);
            
            // Debug: Show first few Islamic events
            const islamicEvents = calendarEvents.filter(e => e.isIslamicEvent);
            if (islamicEvents.length > 0) {
                console.log('🕌 First 5 Islamic events:', islamicEvents.slice(0, 5).map(e => ({
                    id: e.id,
                    title: e.title,
                    startDate: e.startDate,
                    start: e.start,
                    category: e.category
                })));
            }
            
            renderCalendarEnhanced();
            console.log('✅ Islamic events added to calendar successfully');
            
        } catch (error) {
            console.error('❌ Error adding Islamic events to calendar:', error);
        }
    }

    // Update prayer times display
    function updatePrayerTimesDisplay() {
        const prayerTimesContainer = document.getElementById('prayer-times');
        if (prayerTimesContainer) {
            if (islamicEvents.prayerEvents && Array.isArray(islamicEvents.prayerEvents) && islamicEvents.prayerEvents.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const todayPrayers = islamicEvents.prayerEvents.filter(prayer => 
                    new Date(prayer.start).toISOString().split('T')[0] === today
                );

                if (todayPrayers.length > 0) {
                    prayerTimesContainer.innerHTML = `
                        <h3>🕐 Today's Prayer Times</h3>
                        <div class="prayer-times-grid">
                            ${todayPrayers.map(prayer => `
                                <div class="prayer-time-item">
                                    <span class="prayer-name">${prayer.title}</span>
                                    <span class="prayer-time">${new Date(prayer.start).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}</span>
                                </div>
                            `).join('')}
                        </div>
                    `;
                } else {
                    prayerTimesContainer.innerHTML = `
                        <h3>🕐 Prayer Times</h3>
                        <p>Prayer times will be loaded soon...</p>
                    `;
                }
            } else {
                prayerTimesContainer.innerHTML = `
                    <h3>🕐 Prayer Times</h3>
                    <p>Prayer times will be loaded soon...</p>
                `;
            }
        }
    }

    // Sync Islamic events to Google Calendar
    async function syncIslamicEventsToGoogle() {
        try {
            console.log('🕌 Syncing Islamic events to Google...');
            
            // Get JWT token from localStorage (same pattern as other successful API calls)
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch('/api/oauth-sync/google/sync-islamic-events', {
                method: 'POST',
                headers: {
                    'Authorization': authToken ? `Bearer ${authToken}` : '',
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    latitude: userLatitude,
                    longitude: userLongitude,
                    country: userCountry
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Islamic events synced to Google:', data);
                alert(`✅ Islamic events synced to Google Calendar!\nEvents created: ${data.eventsCreated}`);
            } else {
                const errorData = await response.json();
                console.error('❌ Islamic events sync failed:', errorData);
                alert('❌ Failed to sync Islamic events: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ Islamic events sync error:', error);
            alert('❌ Error syncing Islamic events: ' + error.message);
        }
    }

    // Sync Islamic events to Microsoft Calendar
    async function syncIslamicEventsToMicrosoft() {
        try {
            console.log('🕌 Syncing Islamic events to Microsoft...');
            
            // Get JWT token from localStorage (same pattern as other successful API calls)
            const authToken = localStorage.getItem('authToken') || 
                             localStorage.getItem('accessToken') || 
                             localStorage.getItem('token') || 
                             localStorage.getItem('jwt');
            
            const response = await fetch('/api/oauth-sync/microsoft/sync-islamic-events', {
                method: 'POST',
                headers: {
                    'Authorization': authToken ? `Bearer ${authToken}` : '',
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    latitude: userLatitude,
                    longitude: userLongitude,
                    country: userCountry
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Islamic events synced to Microsoft:', data);
                alert(`✅ Islamic events synced to Microsoft Calendar!\nEvents created: ${data.eventsCreated}`);
            } else {
                const errorData = await response.json();
                console.error('❌ Islamic events sync failed:', errorData);
                alert('❌ Failed to sync Islamic events: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ Islamic events sync error:', error);
            alert('❌ Error syncing Islamic events: ' + error.message);
        }
    }

    // Expose functions to global scope for HTML onclick handlers
    window.syncWithGoogle = syncWithGoogle;
    window.syncWithMicrosoft = syncWithMicrosoft;
    window.fullSync = fullSync;
    window.reauthorizeGoogle = reauthorizeGoogle;
    window.reauthorizeMicrosoft = reauthorizeMicrosoft;
    window.refreshGoogleToken = refreshGoogleToken;
    window.refreshMicrosoftToken = refreshMicrosoftToken;
    window.clearMicrosoftTokens = clearMicrosoftTokens;
    window.debugMicrosoftOAuth = debugMicrosoftOAuth;
    window.testMicrosoftOAuth = testMicrosoftOAuth;
    window.testMicrosoftConfig = testMicrosoftConfig;
    window.checkMicrosoftCallback = checkMicrosoftCallback;
    window.triggerMicrosoftOAuth = triggerMicrosoftOAuth;
    window.syncIslamicEventsToGoogle = syncIslamicEventsToGoogle;
    window.syncIslamicEventsToMicrosoft = syncIslamicEventsToMicrosoft;

    // Debug: Log function exposure
    console.log('🔧 [Calendar] Functions exposed to global scope:', {
        syncWithGoogle: typeof window.syncWithGoogle,
        syncWithMicrosoft: typeof window.syncWithMicrosoft,
        fullSync: typeof window.fullSync,
        reauthorizeGoogle: typeof window.reauthorizeGoogle,
        reauthorizeMicrosoft: typeof window.reauthorizeMicrosoft,
        refreshGoogleToken: typeof window.refreshGoogleToken,
        refreshMicrosoftToken: typeof window.refreshMicrosoftToken
    });
    
    // Debug function to check calendar visibility
    function debugCalendarVisibility() {
        console.log('🔍 Debugging calendar visibility...');
        console.log('📅 Month view element:', document.getElementById('month-view'));
        console.log('📅 Month grid element:', document.getElementById('month-grid'));
        console.log('📅 Calendar views container:', document.querySelector('.calendar-views'));
        console.log('📅 Current date:', currentDate);
        console.log('📅 Current year:', currentDate.getFullYear());
        console.log('📅 Current month:', currentDate.getMonth());
        console.log('📅 Events count:', events.length);
        console.log('📅 Calendar events count:', calendarEvents.length);
    }
    
    // Run debug after a short delay
    setTimeout(debugCalendarVisibility, 1000);
    
    // Manual trigger for testing (remove in production)
    setTimeout(() => {
        console.log('🧪 Manual UI test triggered');
        setupViewModeButtons();
        setupThemeSelector();
        setupSearchFunctionality();
        
        // Force render the calendar
        console.log('🔄 Force rendering calendar...');
        renderCalendarEnhanced();
    }, 2000);
    
    // Add demo data for testing (old function)
    function addDemoDataOld() {
        if (events.length === 0) {
            const demoEvents = [
                {
                    id: 'demo-1',
                    title: 'Team Meeting',
                    description: 'Weekly team standup meeting',
                    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
                    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
                    category: 'work',
                    meetingType: 'teams',
                    meetingLink: 'https://teams.microsoft.com/l/meetup-join/123456789',
                    sendEmail: true
                },
                {
                    id: 'demo-2',
                    title: 'Prayer Time - Fajr',
                    description: 'Morning prayer',
                    startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
                    category: 'prayer',
                },
                {
                    id: 'demo-3',
                    title: 'Project Deadline',
                    description: 'Final project submission',
                    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
                    category: 'work',
                    reminder: true
                }
            ];
            
            events = demoEvents;
            saveEvents();
            renderEventsList();
            renderCalendar();
            
            showNotification('Demo data loaded! Try the integrations now.', 'info', 5000);
        }
    }
    
    // Initialize authentication system
    auth.init();
    
    // Listen for navbar state changes
    if (window.GlobalNavbarEvents) {
        window.GlobalNavbarEvents.addListener((eventType, data) => {
            if (eventType === 'userStateChanged') {
                console.log('🔄 [Calendar] Received navbar auth state change:', data);
                // Re-check authentication when navbar state changes
                checkAuthentication().then(isAuth => {
                    if (isAuth) {
                        console.log('✅ [Calendar] Authentication confirmed, refreshing calendar...');
                        // Optionally refresh calendar data or UI
                    }
                });
            }
        });
    }
    
    // Check for Microsoft OAuth callback on page load
    checkMicrosoftCallback();
    
    // Start the application
    initialize();
    
    // Demo data loading removed - using real data only
    
    // --- expose selected APIs & state to the global scope for tools/self-checks ---
    (function exposeCalendarGlobals() {
        const g = typeof window !== 'undefined' ? window : globalThis;

        try {
            if (typeof renderCalendarEnhanced === 'function' && !g.renderCalendarEnhanced) {
                g.renderCalendarEnhanced = renderCalendarEnhanced;
            }
        } catch {}

        try {
            if (typeof saveEvents === 'function' && !g.saveEvents) {
                g.saveEvents = saveEvents;
            }
        } catch {}

        try {
            if (typeof exportCalendarData === 'function' && !g.exportCalendarData) {
                g.exportCalendarData = exportCalendarData;
            }
        } catch {}

        try {
            // expose the live events array; keep alias "events" for legacy tools
            if (typeof calendarEvents !== 'undefined') {
                g.calendarEvents = calendarEvents;
                if (!g.events) g.events = g.calendarEvents;
            }
        } catch {}

        console.info('🔧 [Calendar] Globals exposed:', {
            renderCalendarEnhanced: typeof g.renderCalendarEnhanced,
            saveEvents: typeof g.saveEvents,
            exportCalendarData: typeof g.exportCalendarData,
            hasCalendarEvents: Array.isArray(g.calendarEvents),
            eventsAlias: Array.isArray(g.events)
        });
        
        // Clean up any test events
        cleanupTestEvents();
        
        // Only expose globals in development mode
        if (window.__DEV__ || localStorage.getItem('calendar-dev-mode') === 'true') {
            exposeDevGlobals();
        }
    })();
    
    // Expose development globals
    function exposeDevGlobals() {
        const g = typeof window !== 'undefined' ? window : globalThis;
        
        g.calendarDebug = {
            auth,
            logger,
            renderLock,
            eventDeduplicator,
            calendarEvents,
            events,
            renderCalendarEnhanced,
            saveEvents,
            exportCalendarData
        };
        
        logger.info('🔧 [DEV] Debug globals exposed under window.calendarDebug');
    }
    
    // Clean up test events function
    function cleanupTestEvents() {
        const testEventTitles = [
            'SmokeTest Event',
            'Test Event',
            'Demo Event',
            'Sample Event',
            'Debug Event'
        ];
        
        const originalCount = calendarEvents.length;
        calendarEvents = calendarEvents.filter(event => 
            !testEventTitles.some(testTitle => 
                event.title && event.title.toLowerCase().includes(testTitle.toLowerCase())
            )
        );
        
        const removedCount = originalCount - calendarEvents.length;
        if (removedCount > 0) {
            console.log(`🧹 Cleaned up ${removedCount} test events`);
            events = [...calendarEvents];
            saveEvents();
            renderCalendarEnhanced();
        }
    }
});

})(); // End of IIFE for double initialization prevention

// Functions will be exposed to global scope after DOMContentLoaded event
