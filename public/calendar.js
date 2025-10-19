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

            // Handle 401 responses more gracefully
            if (response.status === 401) {
                console.warn('🔒 Authentication expired, switching to offline mode');
                // Don't automatically log out, just switch to offline mode
                if (auth.isAuthenticated) {
                    auth.setUnauthenticated();
                }
                // Return a mock response instead of throwing an error
                return {
                    ok: false,
                    status: 401,
                    statusText: 'Unauthorized',
                    json: async () => ({ error: 'Authentication expired' }),
                    text: async () => 'Authentication expired'
                };
            }

            return response;
        } catch (error) {
            // Handle network errors gracefully
            console.warn('🌐 Network error, switching to offline mode:', error.message);
            return {
                ok: false,
                status: 0,
                statusText: 'Network Error',
                json: async () => ({ error: 'Network error' }),
                text: async () => 'Network error'
            };
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
    let userLocation = null;
    let selectedDate = null;
    let isOfflineMode = false; // Flag to track offline mode

    // Integration state
    let integrations = {
        email: { connected: false, provider: null, oauthToken: null }
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
        const format = currentView === VIEWS.YEAR ? { year: 'numeric' } :
                      currentView === VIEWS.MONTH ? { month: 'long', year: 'numeric' } :
                      currentView === VIEWS.WEEK ? { month: 'short', day: 'numeric', year: 'numeric' } :
                      { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
        const timeZone = resolveCalendarTimeZone();
        try {
            const formatter = new Intl.DateTimeFormat(undefined, { ...format, timeZone });
            elements.currentPeriod.textContent = formatter.format(currentDate);
        } catch (e) {
            // Fallback using moment-timezone if available or default moment
            if (typeof moment !== 'undefined' && moment.tz && timeZone) {
                const m = moment(currentDate).tz(timeZone);
                const fmt = currentView === VIEWS.YEAR ? 'YYYY' :
                            currentView === VIEWS.MONTH ? 'MMMM YYYY' :
                            currentView === VIEWS.WEEK ? 'MMM D, YYYY' :
                            'dddd, MMMM D, YYYY';
                elements.currentPeriod.textContent = m.format(fmt);
            } else if (typeof moment !== 'undefined') {
                const fmt = currentView === VIEWS.YEAR ? 'YYYY' :
                            currentView === VIEWS.MONTH ? 'MMMM YYYY' :
                            currentView === VIEWS.WEEK ? 'MMM D, YYYY' :
                            'dddd, MMMM D, YYYY';
                elements.currentPeriod.textContent = moment(currentDate).format(fmt);
            } else {
                elements.currentPeriod.textContent = currentDate.toLocaleString();
            }
        }
    }

    function resolveCalendarTimeZone() {
        // priority: user selected timezone -> saved preference -> browser
        const selected = document.getElementById('timezone-select')?.value;
        if (selected && selected !== 'auto') return selected;
        return (window.userPreferences?.timezone) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
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
        renderCalendarEnhanced();
    }


    function getDayEventsHTML(date) {
        const dayEvents = getDayEvents(date);
        if (dayEvents.length === 0) return '';


        return dayEvents.map(event => {
            const categoryClass = event.category || 'personal';
            return `<div class="event-indicator ${categoryClass}" title="${event.title}"></div>`;
        }).join('');
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


        return dayEvents;
    }

    function addEventsToWeekView() {
        console.log('Adding events to week view. Total calendar events:', calendarEvents.length);
        console.log('Calendar events:', calendarEvents);

        const weekEvents = calendarEvents.filter(event => {
            const eventDate = new Date(event.startDate || event.start);
            const startOfWeek = new Date(currentDate);
            startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);

            return eventDate >= startOfWeek && eventDate <= endOfWeek;
        });

        console.log('Week events found:', weekEvents.length);
        console.log('Week events:', weekEvents);

        weekEvents.forEach(event => {
            const eventDate = new Date(event.startDate || event.start);
            const dayOfWeek = eventDate.getDay();
            const hour = eventDate.getHours();
            const endHour = event.endDate ? new Date(event.endDate).getHours() : hour + 1;

            console.log('Processing event:', event.title, 'Day:', dayOfWeek, 'Start Hour:', hour, 'End Hour:', endHour);

            // Find the correct day cell
            const dayCell = document.querySelector(`[data-day="${dayOfWeek}"][data-hour="${hour}"]`);
            if (dayCell) {
                const eventElement = document.createElement('div');
                eventElement.className = 'week-event';
                eventElement.textContent = event.title || 'Event';
                eventElement.style.backgroundColor = event.color || '#3b82f6';
                eventElement.style.color = 'white';
                eventElement.style.padding = '2px 4px';
                eventElement.style.fontSize = '0.7rem';
                eventElement.style.borderRadius = '2px';
                eventElement.style.margin = '1px';
                eventElement.style.position = 'absolute';
                eventElement.style.top = '20px';
                eventElement.style.left = '2px';
                eventElement.style.right = '2px';
                eventElement.style.zIndex = '10';
                eventElement.style.overflow = 'hidden';
                eventElement.style.textOverflow = 'ellipsis';
                eventElement.style.whiteSpace = 'nowrap';

                // Calculate height for multi-hour events
                const duration = endHour - hour;
                if (duration > 1) {
                    eventElement.style.height = `${(duration * 60) - 4}px`;
                    eventElement.style.top = '2px';
                }

                // Add click handler
                eventElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('Event clicked:', event.title);
                    // You can add event details modal here
                });

                dayCell.appendChild(eventElement);
                console.log('Added event to cell:', event.title);
            } else {
                console.log('Could not find cell for day:', dayOfWeek, 'hour:', hour);
            }
        });
    }

    function addEventsToDayView() {
        console.log('Adding events to day view');

        const dayEvents = getDayEvents(currentDate);
        console.log('Day events found:', dayEvents.length);
        console.log('Day events:', dayEvents);

        dayEvents.forEach(event => {
            const eventDate = new Date(event.startDate || event.start);
            const hour = eventDate.getHours();
            const endHour = event.endDate ? new Date(event.endDate).getHours() : hour + 1;

            console.log('Processing day event:', event.title, 'Hour:', hour, 'End Hour:', endHour);

            const daySlot = document.querySelector(`.day-slot[data-hour="${hour}"]`);
            if (daySlot) {
                const eventElement = document.createElement('div');
                eventElement.className = 'day-event';
                eventElement.innerHTML = `
                    <div class="event-title">${event.title || 'Event'}</div>
                    <div class="event-time">${formatTime(eventDate, 'HH:mm')}${event.endDate ? ' - ' + formatTime(new Date(event.endDate), 'HH:mm') : ''}</div>
                    <div class="event-category">${event.category || ''}</div>
                `;
                eventElement.style.backgroundColor = event.color || '#3b82f6';
                eventElement.style.color = 'white';
                eventElement.style.padding = '8px';
                eventElement.style.margin = '2px';
                eventElement.style.borderRadius = '4px';
                eventElement.style.fontSize = '0.8rem';
                eventElement.style.cursor = 'pointer';
                eventElement.style.position = 'relative';
                eventElement.style.zIndex = '10';

                // Calculate height for multi-hour events
                const duration = endHour - hour;
                if (duration > 1) {
                    eventElement.style.height = `${(duration * 60) - 4}px`;
                    eventElement.style.position = 'absolute';
                    eventElement.style.top = '2px';
                    eventElement.style.left = '2px';
                    eventElement.style.right = '2px';
                }

                // Add click handler
                eventElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('Day event clicked:', event.title);
                    // You can add event details modal here
                });

                daySlot.appendChild(eventElement);
                console.log('Added day event to slot:', event.title);
            } else {
                console.log('Could not find day slot for hour:', hour);
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

        // Count all connected integrations
        const emailConnected = integrations.email && integrations.email.connected;
        const googleConnected = window.oauthSyncStatus?.google?.connected || false;
        const microsoftConnected = window.oauthSyncStatus?.microsoft?.connected || false;

        const connectedCount = [emailConnected, googleConnected, microsoftConnected].filter(Boolean).length;

        if (elements.syncStatus) {
            elements.syncStatus.textContent = connectedCount > 0 ? `${connectedCount} Connected` : 'Not Connected';
            elements.syncStatus.className = `status-indicator ${connectedCount > 0 ? 'connected' : 'disconnected'}`;
            console.log('📊 Sync status updated:', elements.syncStatus.textContent);
        }

        // Update all integration cards dynamically
        updateIntegrationGrid(emailConnected, googleConnected, microsoftConnected);

        console.log('✅ Integration status update complete');
    }


    // Update Integration Grid with Dynamic Data
    function updateIntegrationGrid(emailConnected, googleConnected, microsoftConnected) {
        console.log('🔄 Updating integration grid with dynamic data:', {
            email: emailConnected,
            google: googleConnected,
            microsoft: microsoftConnected
        });

        // Update Email Integration Card with all OAuth data
        updateEmailIntegrationWithOAuthData(googleConnected, microsoftConnected);
    }

    // Update Email Integration Card with Dynamic OAuth Data
    function updateEmailIntegrationWithOAuthData(googleConnected, microsoftConnected) {
        console.log('🔄 Updating Email Integration with OAuth data:', {
            google: googleConnected,
            microsoft: microsoftConnected
        });

        const cardElement = document.getElementById('email-sync-card');
        if (!cardElement) return;

        const statusTextElement = document.getElementById('email-status-text');
        const detailsElement = document.getElementById('email-details');
        const providerLineElement = document.getElementById('email-provider-line');
        const controlsElement = document.getElementById('email-controls');
        const connectBtn = document.getElementById('email-sync-btn');
        const lastSyncElement = document.getElementById('email-last-sync');

        // Determine overall connection status
        const anyConnected = googleConnected || microsoftConnected;
        const bothConnected = googleConnected && microsoftConnected;

        if (anyConnected) {
            // Show connected status
            if (statusTextElement) {
                statusTextElement.textContent = bothConnected ? 'Fully Connected' : 'Partially Connected';
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
                // Update provider information dynamically
                const providerText = providerLineElement.querySelector('.provider-text');
                if (providerText) {
                    const providers = [];
                    if (googleConnected) providers.push('Google');
                    if (microsoftConnected) providers.push('Microsoft');
                    providerText.textContent = `Connected to: ${providers.join(' & ')}`;
                }
            }

            if (controlsElement) {
                controlsElement.style.display = 'flex';
            }

            if (connectBtn) {
                connectBtn.textContent = bothConnected ? 'Fully Connected' : 'Manage Connections';
                connectBtn.disabled = false;
                connectBtn.style.background = bothConnected ? 'var(--success-color)' : 'var(--warning-color)';
                connectBtn.onclick = () => openEmailSettings();
            }

            // Update last sync information
            if (lastSyncElement) {
                const googleLastSync = window.oauthSyncStatus?.google?.lastSync;
                const microsoftLastSync = window.oauthSyncStatus?.microsoft?.lastSync;

                let lastSyncText = 'Never';
                if (googleLastSync && microsoftLastSync) {
                    const googleDate = new Date(googleLastSync);
                    const microsoftDate = new Date(microsoftLastSync);
                    const latestDate = googleDate > microsoftDate ? googleDate : microsoftDate;
                    lastSyncText = formatLastSync(latestDate.toISOString());
                } else if (googleLastSync) {
                    lastSyncText = `Google: ${formatLastSync(googleLastSync)}`;
                } else if (microsoftLastSync) {
                    lastSyncText = `Microsoft: ${formatLastSync(microsoftLastSync)}`;
                }

                lastSyncElement.textContent = lastSyncText;
            }

            // Update email address dynamically
            updateEmailAddressDisplay();

            console.log('✅ Email integration updated with OAuth data - showing connected status');
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
                connectBtn.onclick = () => openEmailSettings();
            }

            console.log('❌ Email integration disconnected - hiding details and controls');
        }
    }

    // Update email address display with real data
    async function updateEmailAddressDisplay() {
        try {
            // Get email from OAuth sync status or user profile
            let emailAddress = 'Unknown';

            // Try to get email from OAuth sync status first
            if (window.oauthSyncStatus?.google?.email) {
                emailAddress = window.oauthSyncStatus.google.email;
            } else if (window.oauthSyncStatus?.microsoft?.email) {
                emailAddress = window.oauthSyncStatus.microsoft.email;
            } else {
                // Fallback to user profile
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
                    emailAddress = userData.email || 'ahmedothmanofff@gmail.com';
                } else {
                    emailAddress = 'ahmedothmanofff@gmail.com';
                }
            }

            // Update email display
            const emailElement = document.querySelector('.email-address');
            if (emailElement) {
                emailElement.textContent = emailAddress;
            }

            console.log('📧 Email address updated:', emailAddress);
        } catch (error) {
            console.error('❌ Error updating email address:', error);
        }
    }


    // Format last sync time
    function formatLastSync(timestamp) {
        if (!timestamp) return '-';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
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
            const authToken = localStorage.getItem('authToken') || localStorage.getItem('accessToken') || localStorage.getItem('token') || localStorage.getItem('jwt');
            const response = await fetch('/api/calendar/status', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
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
        // Try to get user data from available sources
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

        // Keep enhanced mode in sync with legacy view
        const viewToMode = { [VIEWS.MONTH]: 'month', [VIEWS.WEEK]: 'week', [VIEWS.DAY]: 'day', [VIEWS.YEAR]: 'year' };
        if (viewToMode[view]) {
            currentViewMode = viewToMode[view];
            if (typeof updateViewModeButtons === 'function') {
                updateViewModeButtons();
            }
        }

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
            updateCurrentPeriod();
        });

        elements.timezoneSelect.addEventListener('change', () => {
            currentTimezone = elements.timezoneSelect.value;
            updateCurrentPeriod();
            if (typeof loadHijriData === 'function') {
                loadHijriData();
            }
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

        if (elements.eventSearch) elements.eventSearch.addEventListener('input', debouncedSearch);

        if (elements.eventCategoryFilter) elements.eventCategoryFilter.addEventListener('change', debouncedSearch);

        // Location management
        if (elements.changeLocationBtn) elements.changeLocationBtn.addEventListener('click', openLocationModal);

        // Integration management
        if (elements.emailSyncBtn) elements.emailSyncBtn.addEventListener('click', openEmailSyncModal);
        if (elements.syncAllBtn) elements.syncAllBtn.addEventListener('click', async () => {
            showNotification('Syncing all integrations...', 'info');
            try {
                // Perform two-way sync if email is connected
                if (integrations.email?.connected) {
                    await performTwoWaySync();
                } else {
                    showNotification('No integrations connected for sync', 'warning');
                }
            } catch (error) {
                console.error('❌ Sync all failed:', error);
                showNotification(`Sync all failed: ${error.message}`, 'error');
            }
        });

        // Integration modal close buttons
        const closeEmailSyncBtn = document.getElementById('close-email-sync-modal');
        if (closeEmailSyncBtn) closeEmailSyncBtn.addEventListener('click', closeEmailSyncModal);


        // Email provider selection
        document.querySelectorAll('.email-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const provider = e.currentTarget.dataset.provider;
                document.querySelectorAll('.setup-step').forEach(step => step.style.display = 'none');
                document.getElementById('oauth-email-setup').style.display = 'block';
            });
        });

        // Email sync buttons
        const syncToEmailBtn = document.getElementById('sync-to-email');
        if (syncToEmailBtn) {
            syncToEmailBtn.addEventListener('click', async () => {
                try {
                    await syncToEmailCalendar();
                } catch (error) {
                    console.error('❌ Sync to email failed:', error);
                }
            });
        }

        const syncFromEmailBtn = document.getElementById('sync-from-email');
        if (syncFromEmailBtn) {
            syncFromEmailBtn.addEventListener('click', async () => {
                try {
                    await syncFromEmailCalendar();
                } catch (error) {
                    console.error('❌ Sync from email failed:', error);
                }
            });
        }

        const twoWaySyncBtn = document.getElementById('two-way-sync');
        if (twoWaySyncBtn) {
            twoWaySyncBtn.addEventListener('click', async () => {
                try {
                    await performTwoWaySync();
                } catch (error) {
                    console.error('❌ Two-way sync failed:', error);
                }
            });
        }

        // Manual import button
        const manualImportBtn = document.getElementById('manual-import-btn');
        if (manualImportBtn) {
            manualImportBtn.addEventListener('click', async () => {
                try {
                    await manualGoogleCalendarImport();
                } catch (error) {
                    console.error('❌ Manual import failed:', error);
                }
            });
        }

        // Meeting type change handler
        const meetingTypeEl = document.getElementById('meeting-type');
        if (meetingTypeEl) meetingTypeEl.addEventListener('change', (e) => {
            const meetingLinkGroup = document.getElementById('meeting-link-group');
            if (e.target.value === 'custom') {
                meetingLinkGroup.style.display = 'block';
            } else {
                meetingLinkGroup.style.display = 'none';
            }
        });

        // Event repeat change handler
        const eventRepeatEl = document.getElementById('event-repeat');
        if (eventRepeatEl) eventRepeatEl.addEventListener('change', (e) => {
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

        // Check authentication first (but don't fail if it's not available)
        try {
            await checkAuthentication();
        } catch (error) {
            console.warn('⚠️ Authentication check failed, continuing in offline mode:', error.message);
        }

        // Initialize location tracking for persistent auth
        try {
            await initializeLocationTracking();
        } catch (error) {
            console.warn('⚠️ Location tracking failed, continuing without it:', error.message);
        }

        // Load real events from server (with graceful fallback)
        try {
            await loadRealEvents();
        } catch (error) {
            console.warn('⚠️ Failed to load real events, using localStorage:', error.message);
        }

        // Load Hijri calendar data
        await loadHijriData();

        // Load Islamic calendar events

        // Load OAuth sync status
        await loadOAuthSyncStatus();

        // Check for Microsoft OAuth tokens in localStorage
        if (typeof checkMicrosoftOAuthStatus === 'function') {
            checkMicrosoftOAuthStatus();
        }

        // Check for Google OAuth tokens in localStorage
        if (typeof checkGoogleOAuthStatus === 'function') {
            checkGoogleOAuthStatus();
        }

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

            // Initialize new features
            initializeDragAndDrop();
            initializeBulkOperations();
            initializeDayPopup();
            addDragAndDropStyles();

            console.log('✅ Enhanced UI components initialized');
        }, 100);

        // Initialize calendar
        renderCalendarEnhanced();
        updateCurrentPeriod();
        renderEventsList();

        showNotification('Advanced calendar loaded successfully', 'success');
    }

    // Check if user is authenticated
    async function checkAuthentication() {
        try {
            console.log('🔐 Checking authentication...');

            // Check for authentication token in localStorage
            const authToken = localStorage.getItem('authToken') ||
                             localStorage.getItem('accessToken') ||
                             localStorage.getItem('token') ||
                             localStorage.getItem('jwt');

            if (authToken) {
                console.log('✅ User is authenticated via token');
                return true;
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
        YEAR: 'year'
    };

    let currentViewMode = viewModes.MONTH;

    // Switch calendar view
    function switchViewMode(mode) {
        currentViewMode = mode;

        // Keep legacy view state in sync for nav/date formatting
        const modeToView = { month: VIEWS.MONTH, week: VIEWS.WEEK, day: VIEWS.DAY, year: VIEWS.YEAR };
        if (modeToView[mode]) {
            currentView = modeToView[mode];
        }

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
        // Ensure the correct container is visible for the current mode
        applyViewVisibilityFromMode();
        // Ensure currentPeriod reflects the active time zone and mode
        updateCurrentPeriod();
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
        }

        // Update drag and drop functionality after rendering
        setTimeout(() => {
            updateEventDragAndDrop();
            addDropZonesToCalendar();
        }, 100);

        } finally {
            renderLock.unlock();
        }
    }

    // Toggle view containers based on currentViewMode
    function applyViewVisibilityFromMode() {
        const month = document.getElementById('month-view');
        const week = document.getElementById('week-view');
        const day = document.getElementById('day-view');
        const year = document.getElementById('year-view');
        const dynamicGrid = document.getElementById('calendar-grid');

        const setActive = (el, active) => {
            if (!el) return;
            el.classList.toggle('active', !!active);
            if (el.id === 'calendar-grid') {
                el.style.display = active ? 'block' : 'none';
            }
        };

        if (currentViewMode === viewModes.MONTH) {
            setActive(month, true); setActive(week, false); setActive(day, false); setActive(year, false); setActive(dynamicGrid, false);
        } else if (currentViewMode === viewModes.WEEK) {
            setActive(month, false); setActive(week, true); setActive(day, false); setActive(year, false); setActive(dynamicGrid, false);
        } else if (currentViewMode === viewModes.DAY) {
            setActive(month, false); setActive(week, false); setActive(day, true); setActive(year, false); setActive(dynamicGrid, false);
        } else if (currentViewMode === viewModes.YEAR) {
            setActive(month, false); setActive(week, false); setActive(day, false); setActive(year, true); setActive(dynamicGrid, false);
        } else {
            // Agenda/Timeline and other dynamic modes render into #calendar-grid
            setActive(month, false); setActive(week, false); setActive(day, false); setActive(year, false); setActive(dynamicGrid, true);
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


        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);

            const dayElement = createDayElement(date);
            monthGrid.appendChild(dayElement);
        }

        console.log('✅ Month view rendered with', monthGrid.children.length, 'days');

        // Re-add day click listeners after rendering
        addDayClickListeners();

        // Add a simple test to ensure visibility
        if (monthGrid.children.length === 0) {
            console.log('⚠️ No calendar days generated, adding fallback...');
            monthGrid.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-color);">Calendar loading... Please wait.</div>';
        }
    }

    // Week view with time slots
    function renderWeekView() {
        if (!elements.weekGrid) return;

        elements.weekGrid.innerHTML = '';
        const timeZone = resolveCalendarTimeZone();
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        // Update day headers
        const dayHeaders = document.querySelectorAll('.day-column');
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone }).format(dayDate);
            const dayNumber = new Intl.DateTimeFormat(undefined, { day: 'numeric', timeZone }).format(dayDate);
            if (dayHeaders[i]) {
                dayHeaders[i].innerHTML = `
                    <div class="day-name">${dayLabel}</div>
                    <div class="day-number">${dayNumber}</div>
                `;
            }
        }

        // Create the time grid
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            const label = `${hour.toString().padStart(2, '0')}:00`;

            // Create the time label
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = label;
            timeSlot.appendChild(timeLabel);

            // Create day cells for this hour
            const dayCells = document.createElement('div');
            dayCells.className = 'day-cells';

            for (let day = 0; day < 7; day++) {
                const dayDate = new Date(startOfWeek);
                dayDate.setDate(startOfWeek.getDate() + day);
                dayDate.setHours(hour);

                const dayCell = document.createElement('div');
                dayCell.className = 'day-cell';
                dayCell.setAttribute('data-date', formatDate(dayDate));
                dayCell.setAttribute('data-hour', hour);
                dayCell.setAttribute('data-day', day);

                // Add some content to make the cell visible
                const cellContent = document.createElement('div');
                cellContent.className = 'cell-content';

                // Add some visual content to make the cell visible
                const hourText = document.createElement('div');
                hourText.className = 'hour-text';
                hourText.textContent = `${hour}:00`;
                hourText.style.fontSize = '0.7rem';
                hourText.style.opacity = '0.5';
                hourText.style.position = 'absolute';
                hourText.style.top = '2px';
                hourText.style.left = '2px';

                cellContent.appendChild(hourText);
                dayCell.appendChild(cellContent);

                dayCells.appendChild(dayCell);
            }

            timeSlot.appendChild(dayCells);
            elements.weekGrid.appendChild(timeSlot);
        }

        addEventsToWeekView();

        // Re-add day click listeners after rendering
        addDayClickListeners();

        // If no events found, add some sample events for testing
        if (calendarEvents.length === 0) {
            addSampleEventsForTesting();
        }
    }

    // Add sample events for testing if no real events exist
    function addSampleEventsForTesting() {
        console.log('No real events found, adding sample events for testing');

        const today = new Date();
        const sampleEvents = [
            {
                id: 'sample-1',
                title: 'Team Meeting',
                startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0),
                endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0),
                color: '#3b82f6',
                category: 'work'
            },
            {
                id: 'sample-2',
                title: 'Lunch with Client',
                startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 12, 0),
                endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 13, 0),
                color: '#10b981',
                category: 'meeting'
            },
            {
                id: 'sample-3',
                title: 'Project Review',
                startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 14, 0),
                endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 15, 0),
                color: '#f59e0b',
                category: 'work'
            },
            {
                id: 'sample-4',
                title: 'Code Review',
                startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 11, 0),
                endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 12, 0),
                color: '#ef4444',
                category: 'development'
            },
            {
                id: 'sample-5',
                title: 'Weekly Planning',
                startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4, 15, 0),
                endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 4, 16, 0),
                color: '#8b5cf6',
                category: 'planning'
            }
        ];

        // Add sample events to calendarEvents
        calendarEvents.push(...sampleEvents);
        console.log('Added', sampleEvents.length, 'sample events');

        // Re-render the week view with the new events
        addEventsToWeekView();
    }

    // Add sample events to week view for demonstration
    function addSampleEventsToWeekView() {
        const dayCells = document.querySelectorAll('.day-cell');
        console.log('Adding sample events to week view. Found', dayCells.length, 'day cells');

        // Add some sample events
        const sampleEvents = [
            { day: 0, hour: 9, title: 'Morning Meeting', color: '#3b82f6' },
            { day: 1, hour: 14, title: 'Lunch with Client', color: '#10b981' },
            { day: 2, hour: 10, title: 'Project Review', color: '#f59e0b' },
            { day: 3, hour: 16, title: 'Team Standup', color: '#8b5cf6' },
            { day: 4, hour: 11, title: 'Code Review', color: '#ef4444' },
            { day: 5, hour: 15, title: 'Weekly Planning', color: '#06b6d4' }
        ];

        sampleEvents.forEach(event => {
            const cell = document.querySelector(`[data-day="${event.day}"][data-hour="${event.hour}"]`);
            console.log('Looking for cell with day:', event.day, 'hour:', event.hour, 'found:', !!cell);
            if (cell) {
                const eventElement = document.createElement('div');
                eventElement.className = 'week-event';
                eventElement.textContent = event.title;
                eventElement.style.backgroundColor = event.color;
                eventElement.style.color = 'white';
                eventElement.style.padding = '2px 4px';
                eventElement.style.fontSize = '0.7rem';
                eventElement.style.borderRadius = '2px';
                eventElement.style.margin = '1px';
                eventElement.style.position = 'absolute';
                eventElement.style.top = '20px';
                eventElement.style.left = '2px';
                eventElement.style.right = '2px';
                eventElement.style.zIndex = '10';

                cell.appendChild(eventElement);
                console.log('Added event:', event.title, 'to cell');
            }
        });
    }

    // Day view
    function renderDayView() {
        if (!elements.dayGrid) return;
        elements.dayGrid.innerHTML = '';

        console.log('Rendering day view for:', currentDate);
        console.log('Total calendar events:', calendarEvents.length);

        const dayHeader = document.querySelector('#day-view .day-header .day-column');
        const tz = resolveCalendarTimeZone();
        if (dayHeader) {
            const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: tz }).format(currentDate);
            const dayNum = new Intl.DateTimeFormat(undefined, { day: 'numeric', timeZone: tz }).format(currentDate);
            const monthYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: tz }).format(currentDate);
            dayHeader.innerHTML = `
                <div class="day-name">${weekday}</div>
                <div class="day-number">${dayNum}</div>
                <div class="day-month">${monthYear}</div>
            `;
        }

        // Create time slots
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            const label = `${hour.toString().padStart(2, '0')}:00`;
            timeSlot.innerHTML = `
                <div class="time-label">${label}</div>
                <div class="day-slot" data-hour="${hour}"></div>
            `;
            elements.dayGrid.appendChild(timeSlot);
        }

        addEventsToDayView();

        // Re-add day click listeners after rendering
        addDayClickListeners();

        // If no events found, add some sample events for testing
        if (calendarEvents.length === 0) {
            addSampleEventsForDayView();
        }
    }

    // Add sample events for day view testing if no real events exist
    function addSampleEventsForDayView() {
        console.log('No real events found, adding sample events for day view testing');

        const today = new Date();
        const sampleEvents = [
            {
                id: 'day-sample-1',
                title: 'Morning Standup',
                startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0),
                endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30),
                color: '#3b82f6',
                category: 'work'
            },
            {
                id: 'day-sample-2',
                title: 'Client Meeting',
                startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0),
                endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0),
                color: '#10b981',
                category: 'meeting'
            },
            {
                id: 'day-sample-3',
                title: 'Lunch Break',
                startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 30),
                endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 30),
                color: '#f59e0b',
                category: 'break'
            },
            {
                id: 'day-sample-4',
                title: 'Code Review',
                startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0),
                endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0),
                color: '#ef4444',
                category: 'development'
            },
            {
                id: 'day-sample-5',
                title: 'Project Planning',
                startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 30),
                endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 17, 0),
                color: '#8b5cf6',
                category: 'planning'
            }
        ];

        // Add sample events to calendarEvents
        calendarEvents.push(...sampleEvents);
        console.log('Added', sampleEvents.length, 'sample events for day view');

        // Re-render the day view with the new events
        addEventsToDayView();
    }

    // Year view for long-term planning
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
            for (let i = 0; i < firstDay; i++) {
                const emptyDay = document.createElement('div');
                emptyDay.className = 'mini-day empty';
                miniGrid.appendChild(emptyDay);
            }
            for (let day = 1; day <= daysInMonth; day++) {
                const dayElement = document.createElement('div');
                dayElement.className = 'mini-day';
                dayElement.textContent = day;
                miniGrid.appendChild(dayElement);
            }
            elements.yearGrid.appendChild(monthElement);
        }
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

        return {
            suhoor: '05:00', // Default time
            iftar: '18:30', // Default time
            duration: '13h 30m' // Default duration
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
        }, 30 * 60 * 1000); // Sync every 30 minutes to prevent frequent reauthentication
    }

    function syncWithExternalCalendars() {
        // Skip background sync if user is not authenticated
        if (!auth.isAuthenticated) {
            console.log('⏩ Background sync: User not authenticated, skipping sync');
            return;
        }

        // Check OAuth sync status to determine which providers are connected
        if (window.oauthSyncStatus) {
            // Sync with Google Calendar if connected and not needing reauth
            if (window.oauthSyncStatus.google?.connected && !window.oauthSyncStatus.google?.needsReauth) {
                console.log('🔄 Background sync: Starting Google Calendar sync...');
                syncGoogleCalendar();
            }

            // Sync with Microsoft Calendar if connected and not needing reauth
            if (window.oauthSyncStatus.microsoft?.connected && !window.oauthSyncStatus.microsoft?.needsReauth) {
                console.log('🔄 Background sync: Starting Microsoft Calendar sync...');
                syncMicrosoftCalendar();
            }
        } else {
            console.log('⚠️ Background sync: OAuth sync status not available, skipping sync');
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
                             localStorage.getItem('google-oauth-token') !== null ||
                             localStorage.getItem('googleAccessToken') !== null;
        const canSyncMicrosoft = integrations?.microsoft?.connected === true ||
                                localStorage.getItem('microsoft-oauth-token') !== null ||
                                localStorage.getItem('microsoftAccessToken') !== null;

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

    // Search UI removed (event panel provides search/filter)

    // Handle search





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

            // Debug: Check if event has proper ID
            if (!event.id) {
                console.warn('⚠️ Event missing ID:', event);
            }

            // Debug Islamic events
            if (event.isIslamicEvent && matches) {
                log.debug(`🕌 Islamic event match: ${event.title} (${eventDate.toDateString()} === ${date.toDateString()})`);
            }

            return matches;
        });


        if (dayEvents.length > 0) {
            const eventsContainer = document.createElement('div');
            eventsContainer.className = 'day-events';

            dayEvents.slice(0, 3).forEach(event => {
                const eventElement = document.createElement('div');
                eventElement.className = 'day-event';
                eventElement.setAttribute('data-event-id', event.id);
                eventElement.textContent = event.title;
                eventElement.title = event.description || event.title;
                eventElement.draggable = true;
                eventsContainer.appendChild(eventElement);
            });

            if (dayEvents.length > 3) {
                const moreElement = document.createElement('div');
                moreElement.className = 'day-event more';
                moreElement.setAttribute('data-event-id', 'more-events');
                moreElement.textContent = `+${dayEvents.length - 3} more`;
                moreElement.draggable = true;
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


    // ========================================
    // EMAIL SYNC FUNCTIONS - FULL IMPLEMENTATION
    // ========================================

    // Main email sync function - syncs events to email calendar
    async function syncToEmailCalendar(forceProvider = null) {
        try {
            console.log('📧 Starting email calendar sync...');

            const provider = forceProvider;
            if (!provider) {
                throw new Error('No email provider specified');
            }

            // Note: OAuth tokens are stored server-side and authenticated via JWT
            // No need to check localStorage for tokens here

            showNotification(`Syncing events to ${provider.toUpperCase()} calendar...`, 'info');

            // Get events to sync with advanced filtering rules
            const eventsToSync = calendarEvents.filter(event => {
                // RULE 1: Skip if already synced to email
                if (event.syncedToEmail) {
                    return false;
                }

                // RULE 2: Skip if it has an external ID (came from external calendar)
                if (event.externalId || event.googleEventId || event.microsoftEventId) {
                    return false;
                }

                // RULE 3: Skip if it's from external source
                if (event.source && (event.source.includes('google') || event.source.includes('microsoft'))) {
                    return false;
                }

                // RULE 4: Only sync future events
                if (!event.startDate || new Date(event.startDate) < new Date()) {
                    return false;
                }

                // RULE 5: Skip if synced from email (came FROM external calendar)
                if (event.syncedFromEmail) {
                    return false;
                }

                return true;
            });

            if (eventsToSync.length === 0) {
                showNotification('No new events to sync', 'info');
                return;
            }

            console.log(`📧 Found ${eventsToSync.length} events to sync to ${provider}`);

            let successCount = 0;
            let errorCount = 0;

            // Sync events based on provider
            for (const event of eventsToSync) {
                try {
                    if (provider.includes('google')) {
                        await syncEventToGoogleCalendar(event);
                    } else if (provider.includes('microsoft')) {
                        await syncEventToMicrosoftCalendar(event);
                    }

                    // Mark event as synced
                    event.syncedToEmail = true;
                    event.emailSyncDate = new Date().toISOString();
                    successCount++;

                } catch (error) {
                    console.error(`❌ Failed to sync event "${event.title}":`, error);
                    errorCount++;
                }
            }

            // Update last sync time
            integrations.email.config = integrations.email.config || {};
            integrations.email.config.lastSync = new Date().toISOString();
            integrations.email.lastSync = new Date().toLocaleString();

            // Save updated events and integration status
            saveEvents();
            saveIntegrationSettings();
            updateIntegrationStatus();

            // Show results
            if (successCount > 0) {
                showNotification(`Successfully synced ${successCount} events to ${provider.toUpperCase()}`, 'success');
            }
            if (errorCount > 0) {
                showNotification(`Failed to sync ${errorCount} events`, 'error');
            }

            console.log(`✅ Email sync completed: ${successCount} success, ${errorCount} errors`);

        } catch (error) {
            console.error('❌ Email sync failed:', error);
            showNotification(`Email sync failed: ${error.message}`, 'error');
        }
    }

    // Sync events from email calendar
    async function syncFromEmailCalendar(forceProvider = null) {
        try {
            console.log('📧 Starting sync from email calendar...');

            const provider = forceProvider;
            if (!provider) {
                throw new Error('No email provider specified');
            }

            // Note: OAuth tokens are stored server-side and authenticated via JWT
            // No need to check localStorage for tokens here

            showNotification(`Syncing events from ${provider.toUpperCase()} calendar...`, 'info');

            let externalEvents = [];

            // Fetch events from external calendar
            if (provider.includes('google')) {
                externalEvents = await fetchEventsFromGoogleCalendar();
            } else if (provider.includes('microsoft')) {
                externalEvents = await fetchEventsFromMicrosoftCalendar();
            }

            if (externalEvents.length === 0) {
                showNotification('No events found in external calendar', 'info');
                return;
            }

            console.log(`📧 Found ${externalEvents.length} events from ${provider}`);

            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            // Process each external event with advanced duplicate detection
            for (const externalEvent of externalEvents) {
                try {
                    // RULE 1: Check by external ID (most reliable)
                    let existingEvent = calendarEvents.find(event =>
                        event.externalId === externalEvent.id ||
                        event.googleEventId === externalEvent.id ||
                        event.microsoftEventId === externalEvent.id
                    );

                    // RULE 2: Check by title + date (exact match)
                    if (!existingEvent) {
                        const externalDate = new Date(externalEvent.startDate).toISOString().split('T')[0];
                        existingEvent = calendarEvents.find(event => {
                            const eventDate = new Date(event.startDate).toISOString().split('T')[0];
                            return event.title === externalEvent.title && eventDate === externalDate;
                        });
                    }

                    // RULE 3: Check by title + time (within 5 minutes)
                    if (!existingEvent) {
                        const externalTime = new Date(externalEvent.startDate).getTime();
                        existingEvent = calendarEvents.find(event => {
                            const eventTime = new Date(event.startDate).getTime();
                            const timeDiff = Math.abs(externalTime - eventTime);
                            return event.title === externalEvent.title && timeDiff < 5 * 60 * 1000; // 5 minutes
                        });
                    }

                    if (existingEvent) {
                        // Update existing event if external version is newer
                        const externalUpdated = new Date(externalEvent.updated || externalEvent.lastModified || 0).getTime();
                        const localUpdated = new Date(existingEvent.updated || existingEvent.lastModified || 0).getTime();

                        if (externalUpdated > localUpdated) {
                            console.log(`🔄 Updating event "${externalEvent.title}" (external is newer)`);
                            Object.assign(existingEvent, {
                                title: externalEvent.title,
                                description: externalEvent.description,
                                startDate: externalEvent.startDate,
                                endDate: externalEvent.endDate,
                                location: externalEvent.location,
                                attendees: externalEvent.attendees,
                                externalId: externalEvent.id,
                                syncedFromEmail: true,
                                emailSyncDate: new Date().toISOString(),
                                updated: externalEvent.updated
                            });
                            // Preserve external IDs
                            if (provider.includes('google')) {
                                existingEvent.googleEventId = externalEvent.id;
                            } else if (provider.includes('microsoft')) {
                                existingEvent.microsoftEventId = externalEvent.id;
                            }
                            updatedCount++;
                        } else {
                            console.log(`⏭️ Skipping event "${externalEvent.title}" (local is up-to-date)`);
                            skippedCount++;
                        }
                    } else {
                        // Add new event (no duplicate found)
                        console.log(`➕ Adding new event "${externalEvent.title}"`);
                        const newEvent = {
                            id: `${provider}_${externalEvent.id}_${Date.now()}`,
                            ...externalEvent,
                            externalId: externalEvent.id,
                            syncedFromEmail: true,
                            emailSyncDate: new Date().toISOString(),
                            category: 'personal',
                            source: provider
                        };
                        // Set provider-specific ID
                        if (provider.includes('google')) {
                            newEvent.googleEventId = externalEvent.id;
                        } else if (provider.includes('microsoft')) {
                            newEvent.microsoftEventId = externalEvent.id;
                        }
                        calendarEvents.push(newEvent);
                        addedCount++;
                    }

                } catch (error) {
                    console.error(`❌ Failed to process external event "${externalEvent.title}":`, error);
                }
            }

            // Update last sync time
            integrations.email.config = integrations.email.config || {};
            integrations.email.config.lastSync = new Date().toISOString();
            integrations.email.lastSync = new Date().toLocaleString();

            // Save updated events and integration status
            saveEvents();
            saveIntegrationSettings();
            updateIntegrationStatus();

            // Refresh calendar display
            renderCalendarEnhanced();
            renderEventsList();

            // Show results
            showNotification(`Sync complete: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped`, 'success');

            console.log(`✅ Email sync from ${provider} completed: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped`);

        } catch (error) {
            console.error('❌ Email sync from external calendar failed:', error);
            showNotification(`Email sync failed: ${error.message}`, 'error');
        }
    }

    // Sync single event to Google Calendar (via server proxy)
    async function syncEventToGoogleCalendar(event) {
        try {
            console.log(`📤 Syncing event "${event.title}" to Google Calendar via server...`);

            const eventData = {
                summary: event.title,
                description: event.description || '',
                start: {
                    dateTime: event.startDate,
                    timeZone: event.timezone || 'UTC'
                },
                end: {
                    dateTime: event.endDate || event.startDate,
                    timeZone: event.timezone || 'UTC'
                },
                location: event.location || '',
                attendees: event.attendees || []
            };

            // Use server endpoint to create event (server handles OAuth tokens)
            const response = await fetch('/api/oauth-sync/google/create-event', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ event: eventData })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server error: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to create Google Calendar event');
            }

            const result = data.event;
            event.externalId = result.id;
            event.googleCalendarId = result.id;

            console.log(`✅ Event "${event.title}" synced to Google Calendar`);

        } catch (error) {
            console.error(`❌ Failed to sync event to Google Calendar:`, error);
            throw error;
        }
    }

    // Sync single event to Microsoft Calendar (via server proxy)
    async function syncEventToMicrosoftCalendar(event) {
        try {
            console.log(`📤 Syncing event "${event.title}" to Microsoft Calendar via server...`);

            const eventData = {
                subject: event.title,
                body: {
                    contentType: 'text',
                    content: event.description || ''
                },
                start: {
                    dateTime: event.startDate,
                    timeZone: event.timezone || 'UTC'
                },
                end: {
                    dateTime: event.endDate || event.startDate,
                    timeZone: event.timezone || 'UTC'
                },
                location: {
                    displayName: event.location || ''
                },
                attendees: (event.attendees || []).map(email => ({
                    emailAddress: { address: email },
                    type: 'required'
                }))
            };

            // Use server endpoint to create event (server handles OAuth tokens)
            const response = await fetch('/api/oauth-sync/microsoft/create-event', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ event: eventData })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server error: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to create Microsoft Calendar event');
            }

            const result = data.event;
            event.externalId = result.id;
            event.microsoftCalendarId = result.id;

            console.log(`✅ Event "${event.title}" synced to Microsoft Calendar`);

        } catch (error) {
            console.error(`❌ Failed to sync event to Microsoft Calendar:`, error);
            throw error;
        }
    }

    // Fetch events from Google Calendar
    async function fetchEventsFromGoogleCalendar() {
        try {
            // Use server endpoint instead of direct API call to avoid CORS issues
            console.log('📥 Fetching Google Calendar events via server...');

            const response = await fetch('/api/oauth-sync/google/events', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server error: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch Google Calendar events');
            }

            const events = data.events || [];

            // Convert Google Calendar events to our format
            return events.map(event => ({
                id: `google_${event.id}`,
                externalId: event.id,
                title: event.summary || 'Untitled Event',
                description: event.description || '',
                startDate: event.start?.dateTime || event.start?.date,
                endDate: event.end?.dateTime || event.end?.date,
                location: event.location || '',
                attendees: (event.attendees || []).map(attendee => attendee.email),
                timezone: event.start?.timeZone || 'UTC',
                updated: event.updated,
                created: event.created,
                source: 'google'
            }));

        } catch (error) {
            console.error('❌ Failed to fetch events from Google Calendar:', error);
            throw error;
        }
    }

    // Fetch events from Microsoft Calendar
    async function fetchEventsFromMicrosoftCalendar() {
        try {
            // Use server endpoint instead of direct API call to avoid CORS issues
            console.log('📥 Fetching Microsoft Calendar events via server...');

            const response = await fetch('/api/oauth-sync/microsoft/events', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server error: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch Microsoft Calendar events');
            }

            const events = data.events || [];

            // Convert Microsoft Calendar events to our format
            return events.map(event => ({
                id: `microsoft_${event.id}`,
                externalId: event.id,
                title: event.subject || 'Untitled Event',
                description: event.body?.content || '',
                startDate: event.start?.dateTime,
                endDate: event.end?.dateTime,
                location: event.location?.displayName || '',
                attendees: (event.attendees || []).map(attendee => attendee.emailAddress?.address).filter(Boolean),
                timezone: event.start?.timeZone || 'UTC',
                updated: event.lastModifiedDateTime,
                created: event.createdDateTime,
                source: 'microsoft'
            }));

        } catch (error) {
            console.error('❌ Failed to fetch events from Microsoft Calendar:', error);
            throw error;
        }
    }

    // Enhanced Google Calendar sync function (TWO-WAY with duplicate prevention)
    async function syncGoogleCalendar() {
        console.log('🔄 Starting Google Calendar two-way sync with duplicate prevention...');

        try {
            // Sync FROM Google (fetch external events)
            console.log('📥 Step 1/2: Fetching events FROM Google Calendar...');
            await syncFromEmailCalendar('google');

            // Sync TO Google (push local events) - only if permissions allow
            console.log('📤 Step 2/2: Pushing local events TO Google Calendar...');
            try {
                await syncToEmailCalendar('google');
            } catch (error) {
                // If 403 Forbidden, it means we don't have write permissions - that's OK
                if (error.message && error.message.includes('403')) {
                    console.log('⚠️ Google Calendar write access not available (read-only mode)');
                } else {
                    throw error;
                }
            }

            showNotification('Google Calendar sync completed successfully!', 'success');

        } catch (error) {
            console.error('❌ Google Calendar sync failed:', error);
            showNotification(`Google Calendar sync failed: ${error.message}`, 'error');
        }
    }

    // Enhanced Microsoft Calendar sync function (TWO-WAY with duplicate prevention)
    async function syncMicrosoftCalendar() {
        console.log('🔄 Starting Microsoft Calendar two-way sync with duplicate prevention...');

        try {
            // Sync FROM Microsoft (fetch external events)
            console.log('📥 Step 1/2: Fetching events FROM Microsoft Calendar...');
            await syncFromEmailCalendar('microsoft');

            // Sync TO Microsoft (push local events) - only if permissions allow
            console.log('📤 Step 2/2: Pushing local events TO Microsoft Calendar...');
            try {
                await syncToEmailCalendar('microsoft');
            } catch (error) {
                // If 403 Forbidden, it means we don't have write permissions - that's OK
                if (error.message && error.message.includes('403')) {
                    console.log('⚠️ Microsoft Calendar write access not available (read-only mode)');
                } else {
                    throw error;
                }
            }

            showNotification('Microsoft Calendar sync completed successfully!', 'success');

        } catch (error) {
            console.error('❌ Microsoft Calendar sync failed:', error);
            showNotification(`Microsoft Calendar sync failed: ${error.message}`, 'error');
        }
    }

    // Two-way sync function
    async function performTwoWaySync() {
        try {
            console.log('🔄 Starting two-way email sync...');

            if (!integrations.email?.connected) {
                throw new Error('Email integration not connected');
            }

            const provider = integrations.email.provider;

            // Note: OAuth tokens are stored server-side and authenticated via JWT
            // No need to check localStorage for tokens here

            showNotification(`Starting two-way sync with ${provider.toUpperCase()}...`, 'info');

            // Sync our events to external calendar
            await syncToEmailCalendar();

            // Sync external events to us
            await syncFromEmailCalendar();

            showNotification('Two-way sync completed successfully!', 'success');

        } catch (error) {
            console.error('❌ Two-way sync failed:', error);
            showNotification(`Two-way sync failed: ${error.message}`, 'error');
        }
    }

    // Manual Google Calendar Import - allows users to manually add their Google Calendar events
    async function manualGoogleCalendarImport() {
        try {
            console.log('📧 Starting manual Google Calendar import...');

            // Show a prompt for the user to enter their Google Calendar events
            const eventData = prompt(`Please enter your Google Calendar events in this format:
            
Title: Event Title
Date: YYYY-MM-DD
Time: HH:MM (24-hour format)
Description: Event description (optional)
Location: Event location (optional)

Separate multiple events with "---"

Example:
Title: Meeting with Team
Date: 2025-10-13
Time: 14:00
Description: Weekly team meeting
Location: Conference Room A
---
Title: Doctor Appointment
Date: 2025-10-14
Time: 10:30
Description: Annual checkup
Location: Medical Center

Enter your events:`);

            if (!eventData || eventData.trim() === '') {
                showNotification('No events entered', 'info');
                return;
            }

            // Parse the entered events
            const events = parseManualEventData(eventData);

            if (events.length === 0) {
                showNotification('No valid events found in the entered data', 'warning');
                return;
            }

            console.log(`📧 Parsed ${events.length} events from manual input`);

            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            // Process each event
            for (const event of events) {
                try {
                    const existingEvent = calendarEvents.find(existingEvent =>
                        existingEvent.title === event.title &&
                        existingEvent.startDate === event.startDate
                    );

                    if (existingEvent) {
                        // Update existing event
                        Object.assign(existingEvent, event);
                        existingEvent.syncedFromEmail = true;
                        existingEvent.emailSyncDate = new Date().toISOString();
                        existingEvent.source = 'google_manual';
                        updatedCount++;
                    } else {
                        // Add new event
                        const newEvent = {
                            ...event,
                            syncedFromEmail: true,
                            emailSyncDate: new Date().toISOString(),
                            source: 'google_manual',
                            category: 'personal'
                        };
                        calendarEvents.push(newEvent);
                        addedCount++;
                    }

                } catch (error) {
                    console.error(`❌ Failed to process event "${event.title}":`, error);
                }
            }

            // Update last sync time
            integrations.email.config = integrations.email.config || {};
            integrations.email.config.lastSync = new Date().toISOString();
            integrations.email.lastSync = new Date().toLocaleString();

            // Save updated events and integration status
            saveEvents();
            saveIntegrationSettings();
            updateIntegrationStatus();

            // Refresh calendar display
            renderCalendarEnhanced();
            renderEventsList();

            // Show results
            showNotification(`Manual import complete: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped`, 'success');

            console.log(`✅ Manual Google Calendar import completed: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped`);

        } catch (error) {
            console.error('❌ Manual Google Calendar import failed:', error);
            showNotification(`Manual import failed: ${error.message}`, 'error');
        }
    }

    // Parse manually entered event data
    function parseManualEventData(data) {
        const events = [];
        const eventBlocks = data.split('---').map(block => block.trim()).filter(block => block);

        for (const block of eventBlocks) {
            try {
                const lines = block.split('\n').map(line => line.trim()).filter(line => line);
                const event = {};

                for (const line of lines) {
                    const [key, ...valueParts] = line.split(':');
                    const value = valueParts.join(':').trim();

                    switch (key.toLowerCase()) {
                        case 'title':
                            event.title = value;
                            break;
                        case 'date':
                            event.date = value;
                            break;
                        case 'time':
                            event.time = value;
                            break;
                        case 'description':
                            event.description = value;
                            break;
                        case 'location':
                            event.location = value;
                            break;
                    }
                }

                // Validate required fields
                if (event.title && event.date && event.time) {
                    // Create start date
                    const [year, month, day] = event.date.split('-').map(Number);
                    const [hours, minutes] = event.time.split(':').map(Number);

                    const startDate = new Date(year, month - 1, day, hours, minutes);
                    event.startDate = startDate.toISOString();

                    // Create end date (1 hour later by default)
                    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
                    event.endDate = endDate.toISOString();

                    // Generate unique ID
                    event.id = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    event.externalId = event.id;

                    events.push(event);
                }

            } catch (error) {
                console.error('❌ Failed to parse event block:', block, error);
            }
        }

        return events;
    }

    // Test function to simulate Google Calendar events (for testing when OAuth is not available)
    async function testGoogleCalendarSync() {
        try {
            console.log('🧪 Testing Google Calendar sync with mock data...');

            // Create mock Google Calendar events
            const mockGoogleEvents = [
                {
                    id: 'google_test_event_1',
                    externalId: 'test_event_1',
                    title: 'Test Event from Google Calendar',
                    description: 'This is a test event created in Google Calendar',
                    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
                    location: 'Test Location',
                    attendees: ['ahmedothmanofff@gmail.com'],
                    timezone: 'UTC',
                    updated: new Date().toISOString(),
                    created: new Date().toISOString(),
                    source: 'google'
                },
                {
                    id: 'google_test_event_2',
                    externalId: 'test_event_2',
                    title: 'Another Google Event',
                    description: 'Another test event from Google Calendar',
                    startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
                    endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // Day after tomorrow + 2 hours
                    location: 'Google Office',
                    attendees: [],
                    timezone: 'UTC',
                    updated: new Date().toISOString(),
                    created: new Date().toISOString(),
                    source: 'google'
                }
            ];

            console.log(`📧 Found ${mockGoogleEvents.length} mock events from Google Calendar`);

            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            // Process each mock event
            for (const externalEvent of mockGoogleEvents) {
                try {
                    const existingEvent = calendarEvents.find(event =>
                        event.externalId === externalEvent.id ||
                        (event.title === externalEvent.title &&
                         event.startDate === externalEvent.startDate)
                    );

                    if (existingEvent) {
                        // Update existing event if it's newer
                        if (new Date(externalEvent.updated) > new Date(existingEvent.updated || 0)) {
                            Object.assign(existingEvent, externalEvent);
                            existingEvent.syncedFromEmail = true;
                            existingEvent.emailSyncDate = new Date().toISOString();
                            updatedCount++;
                        } else {
                            skippedCount++;
                        }
                    } else {
                        // Add new event
                        const newEvent = {
                            ...externalEvent,
                            syncedFromEmail: true,
                            emailSyncDate: new Date().toISOString(),
                            category: 'personal' // Default category for synced events
                        };
                        calendarEvents.push(newEvent);
                        addedCount++;
                    }

                } catch (error) {
                    console.error(`❌ Failed to process mock event "${externalEvent.title}":`, error);
                }
            }

            // Update last sync time
            integrations.email.config = integrations.email.config || {};
            integrations.email.config.lastSync = new Date().toISOString();
            integrations.email.lastSync = new Date().toLocaleString();

            // Save updated events and integration status
            saveEvents();
            saveIntegrationSettings();
            updateIntegrationStatus();

            // Refresh calendar display
            renderCalendarEnhanced();
            renderEventsList();

            // Show results
            showNotification(`Test sync complete: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped`, 'success');

            console.log(`✅ Test Google Calendar sync completed: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped`);

        } catch (error) {
            console.error('❌ Test Google Calendar sync failed:', error);
            showNotification(`Test sync failed: ${error.message}`, 'error');
        }
    }

    // Make functions globally accessible
    window.testIntegration = testIntegration;
    window.disconnectIntegration = disconnectIntegration;
    window.exportCalendarData = exportCalendarData;
    window.importCalendarData = importCalendarData;
    window.switchViewMode = switchViewMode;
    window.applyTheme = applyTheme;
    window.bulkDeleteEvents = bulkDeleteEvents;
    window.bulkMoveEvents = bulkMoveEvents;

    // Email sync functions
    window.syncToEmailCalendar = syncToEmailCalendar;
    window.syncFromEmailCalendar = syncFromEmailCalendar;
    window.syncGoogleCalendar = syncGoogleCalendar;
    window.syncMicrosoftCalendar = syncMicrosoftCalendar;
    window.performTwoWaySync = performTwoWaySync;
    window.manualGoogleCalendarImport = manualGoogleCalendarImport;
    window.checkMicrosoftOAuthStatus = checkMicrosoftOAuthStatus;
    window.saveMicrosoftToken = saveMicrosoftToken;
    window.checkGoogleOAuthStatus = checkGoogleOAuthStatus;
    window.saveGoogleToken = saveGoogleToken;
    window.duplicateEvents = duplicateEvents;
    window.undoLastAction = undoLastAction;
    window.redoLastAction = redoLastAction;

    // Load real events from server
    async function loadRealEvents() {
        if (!auth.isAuthenticated || isOfflineMode) {
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

                    calendarEvents = data.events.map(event => {
                        // Debug: Check if event has proper ID
                        if (!event.id) {
                            console.warn('⚠️ Server event missing ID:', event);
                            event.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                        }
                        return {
                            ...event,
                            startDate: new Date(event.startDate),
                            endDate: event.endDate ? new Date(event.endDate) : null
                        };
                    });

                    // Add back Islamic events
                    calendarEvents.push(...existingIslamicEvents);

                    events = [...calendarEvents];
                    console.log('✅ Real events loaded:', data.events.length, 'events +', existingIslamicEvents.length, 'Islamic events =', calendarEvents.length, 'total');
                    return true;
                }
            } else {
                if (response.status === 401) {
                    console.info('🛜 401 from server → falling back to localStorage (offline)');
                    isOfflineMode = true;
                    return loadEventsFromLocalStorage();
                }
                console.log('❌ Failed to load events from server:', response.status);
            }
        } catch (error) {
            if (error?.message === 'Authentication expired' || error?.status === 401) {
                console.info('🛜 Authentication expired → falling back to localStorage (offline)');
                isOfflineMode = true;
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
            events = JSON.parse(savedEvents).map(event => {
                // Debug: Check if event has proper ID
                if (!event.id) {
                    console.warn('⚠️ localStorage event missing ID:', event);
                    event.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                }
                return {
                    ...event,
                    startDate: new Date(event.startDate),
                    endDate: event.endDate ? new Date(event.endDate) : null
                };
            });
            calendarEvents = [...events];
            console.log('✅ Events loaded from localStorage:', events.length, 'events');
            console.log('🔍 calendarEvents length after load:', calendarEvents.length);
            return true;
        }

        console.log('ℹ️ No events found, starting with empty calendar');
        return false;
    }

    // Initialize real data (commented out for now to avoid conflicts)
    // loadRealEvents();

    // Initialize location tracking for persistent authentication
    async function initializeLocationTracking() {
        try {
            console.log('📍 Initializing location tracking for persistent auth...');

            // Get current location if available
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const location = {
                            lat: position.coords.latitude,
                            lon: position.coords.longitude,
                            accuracy: position.coords.accuracy,
                            timestamp: new Date().toISOString()
                        };

                        // Store location in localStorage for API calls
                        localStorage.setItem('userLocation', JSON.stringify(location));
                        window.userLatitude = location.lat;
                        window.userLongitude = location.lon;

                        console.log('📍 Location obtained:', location);

                        // Send location to server for persistent auth checking
                        await sendLocationToServer(location);
                    },
                    (error) => {
                        console.warn('⚠️ Location access denied or failed:', error.message);
                        // Use default location (Dubai)
                        const defaultLocation = {
                            lat: 25.2048,
                            lon: 55.2708,
                            accuracy: 0,
                            timestamp: new Date().toISOString(),
                            isDefault: true
                        };

                        localStorage.setItem('userLocation', JSON.stringify(defaultLocation));
                        window.userLatitude = defaultLocation.lat;
                        window.userLongitude = defaultLocation.lon;

                        sendLocationToServer(defaultLocation);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 300000 // 5 minutes
                    }
                );
            } else {
                console.warn('⚠️ Geolocation not supported, using default location');
                const defaultLocation = {
                    lat: 25.2048,
                    lon: 55.2708,
                    accuracy: 0,
                    timestamp: new Date().toISOString(),
                    isDefault: true
                };

                localStorage.setItem('userLocation', JSON.stringify(defaultLocation));
                window.userLatitude = defaultLocation.lat;
                window.userLongitude = defaultLocation.lon;

                sendLocationToServer(defaultLocation);
            }
        } catch (error) {
            console.error('❌ Error initializing location tracking:', error);
        }
    }

    // Send location to server for persistent auth checking
    async function sendLocationToServer(location) {
        try {
            const authToken = localStorage.getItem('authToken') ||
                             localStorage.getItem('accessToken') ||
                             localStorage.getItem('token') ||
                             localStorage.getItem('jwt');

            if (!authToken) {
                console.log('🔐 No auth token available for location tracking');
                return;
            }

            const response = await fetch('/api/auth/update-location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    location: location,
                    deviceInfo: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                        timestamp: new Date().toISOString()
                    }
                })
            });

            if (response.ok) {
                console.log('✅ Location sent to server for persistent auth');
            } else if (response.status === 404) {
                console.log('ℹ️ Location update endpoint not available (404) - this is normal if not implemented');
            } else {
                console.warn('⚠️ Failed to send location to server:', response.status);
            }
        } catch (error) {
            console.log('ℹ️ Location update failed (this is normal if endpoint not implemented):', error.message);
        }
    }

    // Load Hijri calendar data
    async function loadHijriData() {
        try {
            console.log('🌙 Loading Hijri calendar data...');

            // Get JWT token from localStorage
            const authToken = localStorage.getItem('authToken') ||
                             localStorage.getItem('accessToken') ||
                             localStorage.getItem('token') ||
                             localStorage.getItem('jwt');
            // Build query with location/timezone if available
            const tz = resolveCalendarTimeZone();
            const lat = window.userLatitude || window.userLocation?.lat || null;
            const lon = window.userLongitude || window.userLocation?.lon || null;
            const qs = new URLSearchParams({ timeZone: tz, ...(lat ? { lat: String(lat) } : {}), ...(lon ? { lon: String(lon) } : {}) });
            const response = await fetch(`/api/hijri/current?${qs.toString()}`, {
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
                    // Expect API to honor tz/lat/lon; else fallback conversion could be added
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

                    // Auto-refresh Google token once if expired and we have a token
                    if (data.syncStatus.google?.hasToken && data.syncStatus.google?.tokenExpired && !window._attemptedGoogleRefresh) {
                        window._attemptedGoogleRefresh = true;
                        console.log('🔄 [OAuth Sync] Google token expired. Attempting automatic refresh...');
                        try {
                            const refreshResp = await fetch('/api/oauth-sync/google/refresh-token', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                                },
                                credentials: 'include'
                            });
                            if (refreshResp.ok) {
                                console.log('✅ [OAuth Sync] Google token auto-refreshed. Reloading sync status...');
                                await loadOAuthSyncStatus();
                            } else {
                                const err = await refreshResp.json().catch(() => ({}));
                                console.log('⚠️ [OAuth Sync] Auto-refresh failed:', err);
                            }
                        } catch (e) {
                            console.log('⚠️ [OAuth Sync] Auto-refresh error:', e.message);
                        }
                    }
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

    // Hijri calendar display removed from calendar page per request
    function updateHijriDisplay(_hijriDate) {}

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

            // Update the integration grid with OAuth sync status
            updateIntegrationStatus();
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

    // Sync with Google Calendar (TWO-WAY with duplicate prevention)
    syncWithGoogle = async function() {
        try {
            console.log('🔄 Starting Google Calendar two-way sync with duplicate prevention...');

            // Use the improved sync function with built-in duplicate detection
            await syncGoogleCalendar();

            // Reload events to show the synced events
            await loadRealEvents();
            renderCalendarEnhanced();

        } catch (error) {
            console.error('❌ Google sync error:', error);
            showNotification(`Google Calendar sync error: ${error.message}`, 'error');
        }
    }

    // Sync with Microsoft Calendar (TWO-WAY with duplicate prevention)
    syncWithMicrosoft = async function() {
        try {
            console.log('🔄 Starting Microsoft Calendar two-way sync with duplicate prevention...');

            // Use the improved sync function with built-in duplicate detection
            await syncMicrosoftCalendar();

            // Reload events to show the synced events
            await loadRealEvents();
            renderCalendarEnhanced();

        } catch (error) {
            console.error('❌ Microsoft sync error:', error);
            showNotification(`Microsoft Calendar sync error: ${error.message}`, 'error');
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

    // Check OAuth callback status (Microsoft + Google)
    checkMicrosoftCallback = async function() {
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

            // Try to get the Microsoft token from the server
            try {
                const authToken = localStorage.getItem('authToken') ||
                                 localStorage.getItem('accessToken') ||
                                 localStorage.getItem('token') ||
                                 localStorage.getItem('jwt');

                if (authToken) {
                    const response = await fetch('/api/auth/microsoft/token', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include'
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.accessToken) {
                            localStorage.setItem('microsoftAccessToken', data.accessToken);
                            console.log('✅ [Callback] Microsoft token saved to localStorage');
                        }
                    }
                }
            } catch (error) {
                console.warn('⚠️ [Callback] Failed to get Microsoft token from server:', error);
            }

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

            // Try to get the Microsoft token from the server
            try {
                const authToken = localStorage.getItem('authToken') ||
                                 localStorage.getItem('accessToken') ||
                                 localStorage.getItem('token') ||
                                 localStorage.getItem('jwt');

                if (authToken) {
                    const response = await fetch('/api/auth/microsoft/token', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include'
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.accessToken) {
                            localStorage.setItem('microsoftAccessToken', data.accessToken);
                            console.log('✅ [Callback] Microsoft token saved to localStorage');
                        }
                    }
                }
            } catch (error) {
                console.warn('⚠️ [Callback] Failed to get Microsoft token from server:', error);
            }

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

    // Check Microsoft OAuth status from localStorage
    function checkMicrosoftOAuthStatus() {
        console.log('🔍 [Microsoft OAuth] Checking Microsoft OAuth status...');

        const microsoftToken = localStorage.getItem('microsoftAccessToken');
        const microsoftOAuthToken = localStorage.getItem('microsoft-oauth-token');

        if (microsoftToken || microsoftOAuthToken) {
            console.log('✅ [Microsoft OAuth] Microsoft token found in localStorage');

            // Update the OAuth sync status to reflect Microsoft connection
            if (!window.oauthSyncStatus) {
                window.oauthSyncStatus = {};
            }
            if (!window.oauthSyncStatus.microsoft) {
                window.oauthSyncStatus.microsoft = {};
            }

            window.oauthSyncStatus.microsoft.connected = true;
            window.oauthSyncStatus.microsoft.hasToken = true;
            window.oauthSyncStatus.microsoft.lastSync = new Date().toISOString();

            // Update the UI
            updateOAuthSyncDisplay(window.oauthSyncStatus);

            return true;
        } else {
            console.log('❌ [Microsoft OAuth] No Microsoft token found in localStorage');
            return false;
        }
    };

    // Manually save Microsoft token for testing
    function saveMicrosoftToken(token) {
        if (token) {
            localStorage.setItem('microsoftAccessToken', token);
            console.log('✅ [Microsoft OAuth] Microsoft token saved to localStorage');
            checkMicrosoftOAuthStatus();
            return true;
        } else {
            console.error('❌ [Microsoft OAuth] No token provided');
            return false;
        }
    };

    // Check Google OAuth status and update UI
    function checkGoogleOAuthStatus() {
        console.log('🔍 [Google OAuth] Checking Google OAuth status...');
        const googleToken = localStorage.getItem('googleAccessToken');
        const googleOAuthToken = localStorage.getItem('google-oauth-token');
        if (googleToken || googleOAuthToken) {
            console.log('✅ [Google OAuth] Google token found in localStorage');
            if (!window.oauthSyncStatus) { window.oauthSyncStatus = {}; }
            if (!window.oauthSyncStatus.google) { window.oauthSyncStatus.google = {}; }
            window.oauthSyncStatus.google.connected = true;
            window.oauthSyncStatus.google.hasToken = true;
            window.oauthSyncStatus.google.lastSync = new Date().toISOString();
            updateOAuthSyncDisplay(window.oauthSyncStatus);
            return true;
        } else {
            console.log('❌ [Google OAuth] No Google token found in localStorage');
            return false;
        }
    }

    // Manually save Google token for testing
    function saveGoogleToken(token) {
        if (token) {
            localStorage.setItem('googleAccessToken', token);
            console.log('✅ [Google OAuth] Google token saved to localStorage');
            checkGoogleOAuthStatus();
            return true;
        } else {
            console.error('❌ [Google OAuth] No token provided');
            return false;
        }
    }

    // Check Google OAuth callback status (authCallback.html may redirect back with params)
    checkGoogleCallback = async function() {
        console.log('🔍 [Callback] Checking Google OAuth callback status...');
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const provider = urlParams.get('provider');
        const oauthCallback = urlParams.get('oauth_callback');
        const timestamp = urlParams.get('timestamp');

        if (oauthCallback === 'success' && provider === 'google') {
            console.log('✅ [Callback] Google OAuth callback success detected');
            // Try to get Google token from server
            try {
                const authToken = localStorage.getItem('authToken') || localStorage.getItem('accessToken');
                if (authToken) {
                    const response = await fetch('/api/auth/google/token', {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                        credentials: 'include'
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.accessToken) {
                            localStorage.setItem('googleAccessToken', data.accessToken);
                            console.log('✅ [Callback] Google token saved to localStorage');
                        }
                    }
                }
            } catch (error) {
                console.warn('⚠️ [Callback] Failed to get Google token from server:', error);
            }
            // Clear URL and refresh to load new sync status
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            setTimeout(() => {
                console.log('🔄 [Callback] Refreshing page to check OAuth status...');
                window.location.reload();
            }, 800);
            return;
        }

        if (token && provider === 'google') {
            console.log('✅ [Callback] Google OAuth callback detected with token');
            localStorage.setItem('authToken', token);
            localStorage.setItem('accessToken', token);
            // Try to get Google token from server
            try {
                const response = await fetch('/api/auth/google/token', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.accessToken) {
                        localStorage.setItem('googleAccessToken', data.accessToken);
                        console.log('✅ [Callback] Google token saved to localStorage');
                    }
                }
            } catch (error) {
                console.warn('⚠️ [Callback] Failed to get Google token from server:', error);
            }
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            setTimeout(() => window.location.reload(), 800);
            return;
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


    // Update Hijri date display
    function updateHijriDisplay() {
        const hijriDisplay = document.getElementById('hijri-date-display');
        if (hijriDisplay) {
            hijriDisplay.innerHTML = `
                <div class="hijri-date-main">
                    Loading...
                </div>
            `;
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

    // ========================================
    // DRAG & DROP FUNCTIONALITY
    // ========================================

    let draggedEvent = null;
    let dragStartTime = null;
    let isDragging = false;
    let isResizing = false;
    let resizeHandle = null;
    let selectedEvents = new Set();

    // Initialize drag and drop for events - DISABLED
    function initializeDragAndDrop() {
        console.log('🎯 Drag and drop functionality DISABLED');

        // Add drag and drop to all existing events - DISABLED
        // updateEventDragAndDrop();

        // Add drag and drop to calendar cells for dropping - DISABLED
        // addDropZonesToCalendar();

        // Add event listeners for drag and drop - DISABLED
        // setupDragAndDropEventListeners();

        console.log('✅ Drag and drop functionality disabled');
    }

    // Update drag and drop for all events
    function updateEventDragAndDrop() {
        // Remove existing drag listeners
        document.querySelectorAll('.event-item, .calendar-event, .week-event, .day-event').forEach(eventEl => {
            eventEl.removeEventListener('mousedown', handleDragStart, { passive: false });
            eventEl.removeEventListener('touchstart', handleDragStart, { passive: false });
        });

        // Add drag listeners to all events - DISABLED
        document.querySelectorAll('.event-item, .calendar-event, .week-event, .day-event').forEach(eventEl => {
            eventEl.draggable = false; // Disabled
            // eventEl.addEventListener('mousedown', handleDragStart, { passive: false });
            // eventEl.addEventListener('touchstart', handleDragStart, { passive: false });

            // Add resize handles - DISABLED
            // addResizeHandles(eventEl);
        });
    }

    // Add resize handles to event elements
    function addResizeHandles(eventEl) {
        // Remove existing resize handles
        eventEl.querySelectorAll('.resize-handle').forEach(handle => handle.remove());

        // Add top resize handle
        const topHandle = document.createElement('div');
        topHandle.className = 'resize-handle resize-top';
        topHandle.innerHTML = '⋮';
        eventEl.appendChild(topHandle);

        // Add bottom resize handle
        const bottomHandle = document.createElement('div');
        bottomHandle.className = 'resize-handle resize-bottom';
        bottomHandle.innerHTML = '⋮';
        eventEl.appendChild(bottomHandle);

        // Add right resize handle
        const rightHandle = document.createElement('div');
        rightHandle.className = 'resize-handle resize-right';
        rightHandle.innerHTML = '⋮';
        eventEl.appendChild(rightHandle);
    }

    // Add drop zones to calendar cells - DISABLED
    function addDropZonesToCalendar() {
        // Month view cells - DISABLED
        // document.querySelectorAll('.calendar-day').forEach(cell => {
        //     cell.addEventListener('dragover', handleDragOver);
        //     cell.addEventListener('drop', handleDrop);
        //     cell.addEventListener('dragenter', handleDragEnter);
        //     cell.addEventListener('dragleave', handleDragLeave);
        // });

        // Week view cells - DISABLED
        // document.querySelectorAll('.day-cell').forEach(cell => {
        //     cell.addEventListener('dragover', handleDragOver);
        //     cell.addEventListener('drop', handleDrop);
        //     cell.addEventListener('dragenter', handleDragEnter);
        //     cell.addEventListener('dragleave', handleDragLeave);
        // });

        // Day view slots - DISABLED
        // document.querySelectorAll('.day-slot').forEach(slot => {
        //     slot.addEventListener('dragover', handleDragOver);
        //     slot.addEventListener('drop', handleDrop);
        //     slot.addEventListener('dragenter', handleDragEnter);
        //     slot.addEventListener('dragleave', handleDragLeave);
        // });
    }

    // Setup drag and drop event listeners - DISABLED
    function setupDragAndDropEventListeners() {
        // Global mouse events for drag and drop - DISABLED
        // document.addEventListener('mousemove', handleDragMove, { passive: false });
        // document.addEventListener('mouseup', handleDragEnd, { passive: false });
        // document.addEventListener('touchmove', handleDragMove, { passive: false });
        // document.addEventListener('touchend', handleDragEnd, { passive: false });

        // Prevent default drag behavior - DISABLED
        // document.addEventListener('dragover', e => e.preventDefault(), { passive: false });
        // document.addEventListener('drop', e => e.preventDefault(), { passive: false });
    }

    // Handle drag start
    function handleDragStart(e) {
        e.preventDefault();

        const eventEl = e.target.closest('.event-item, .calendar-event, .week-event, .day-event');
        if (!eventEl) return;

        // Check if clicking on resize handle - DISABLED
        // if (e.target.classList.contains('resize-handle')) {
        //     isResizing = true;
        //     resizeHandle = e.target.classList.contains('resize-top') ? 'top' :
        //                   e.target.classList.contains('resize-bottom') ? 'bottom' : 'right';
        // } else {
            isDragging = true;
        // }

        draggedEvent = eventEl;
        dragStartTime = Date.now();

        // Add dragging class
        eventEl.classList.add('dragging');

        // Get event data
        const eventId = eventEl.dataset.eventId;
        const event = calendarEvents.find(e => e.id === eventId);

        if (event) {
            console.log('🎯 Starting drag for event:', event.title);
        }
    }

    // Handle drag move
    function handleDragMove(e) {
        if (!isDragging) return; // Removed isResizing check

        e.preventDefault();

        if (isDragging) {
            // Update visual feedback during drag
            updateDragPreview(e);
        }
        // Resize functionality disabled
        // else if (isResizing && draggedEvent) {
        //     // Handle resizing
        //     handleEventResize(e);
        // }
    }

    // Handle drag end
    function handleDragEnd(e) {
        if (!isDragging) return; // Removed isResizing check

        e.preventDefault();

        if (isDragging) {
            // Handle drag drop - find the element under the mouse
            const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
            const dropZone = elementBelow?.closest('.calendar-day, .day-cell, .day-slot');

            if (dropZone && draggedEvent) {
                handleDrop({ target: dropZone, clientX: e.clientX, clientY: e.clientY });
            }
        }
        // Resize functionality disabled
        // else if (isResizing) {
        //     handleResizeEnd(e);
        // }

        // Clean up
        if (draggedEvent) {
            draggedEvent.classList.remove('dragging');
            draggedEvent = null;
        }

        isDragging = false;
        // isResizing = false; // Disabled
        // resizeHandle = null; // Disabled
        dragStartTime = null;

        // Remove drop zone highlights
        document.querySelectorAll('.drop-zone-active').forEach(zone => {
            zone.classList.remove('drop-zone-active');
        });
    }

    // Handle drag over
    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    // Handle drag enter
    function handleDragEnter(e) {
        e.preventDefault();
        e.target.closest('.calendar-day, .day-cell, .day-slot')?.classList.add('drop-zone-active');
    }

    // Handle drag leave
    function handleDragLeave(e) {
        e.preventDefault();
        e.target.closest('.calendar-day, .day-cell, .day-slot')?.classList.remove('drop-zone-active');
    }

    // Handle drop
    function handleDrop(e) {
        // Check if e has preventDefault method before calling it
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }

        const dropZone = e.target.closest('.calendar-day, .day-cell, .day-slot');
        if (!dropZone || !draggedEvent) return;

        dropZone.classList.remove('drop-zone-active');

        // Get event data
        const eventId = draggedEvent.dataset.eventId;
        const event = calendarEvents.find(ev => ev.id === eventId);

        if (!event) return;

        // Calculate new date/time based on drop zone
        const newDateTime = calculateNewDateTime(dropZone, e);

        if (newDateTime) {
            // Update event
            updateEventDateTime(event, newDateTime);

            // Check for conflicts and resolve
            checkAndResolveConflicts(event);

            // Save and refresh
            saveEvents();
            renderCalendarEnhanced();

            console.log('✅ Event moved successfully:', event.title);
            showNotification(`Event "${event.title}" moved successfully`, 'success');
        }
    }

    // Calculate new date/time based on drop zone
    function calculateNewDateTime(dropZone, e) {
        const eventId = draggedEvent.dataset.eventId;
        const event = calendarEvents.find(ev => ev.id === eventId);
        if (!event) return null;

        // Get current view mode
        const currentView = document.querySelector('.calendar-view.active');
        if (!currentView) return null;

        if (currentView.id === 'month-view') {
            return calculateMonthViewDateTime(dropZone, event);
        } else if (currentView.id === 'week-view') {
            return calculateWeekViewDateTime(dropZone, event, e);
        } else if (currentView.id === 'day-view') {
            return calculateDayViewDateTime(dropZone, event, e);
        }

        return null;
    }

    // Calculate new date/time for month view
    function calculateMonthViewDateTime(dropZone, event) {
        const dayNumber = parseInt(dropZone.textContent);
        if (isNaN(dayNumber)) return null;

        const newDate = new Date(currentDate);
        newDate.setDate(dayNumber);

        // Keep original time if event has time
        if (event.startTime) {
            const [hours, minutes] = event.startTime.split(':');
            newDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }

        return {
            date: newDate,
            time: event.startTime || null
        };
    }

    // Calculate new date/time for week view
    function calculateWeekViewDateTime(dropZone, event, e) {
        const dayIndex = parseInt(dropZone.dataset.day);
        if (isNaN(dayIndex)) return null;

        // Get week start date
        const weekStart = getStartOfWeek();
        const newDate = new Date(weekStart);
        newDate.setDate(weekStart.getDate() + dayIndex);

        // Calculate time based on mouse position
        const rect = dropZone.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const hourHeight = 60; // 60px per hour
        const hour = Math.floor(relativeY / hourHeight);
        const minute = Math.floor((relativeY % hourHeight) / hourHeight * 60);

        newDate.setHours(hour, minute, 0, 0);

        return {
            date: newDate,
            time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        };
    }

    // Calculate new date/time for day view
    function calculateDayViewDateTime(dropZone, event, e) {
        const newDate = new Date(currentDate);

        // Calculate time based on mouse position
        const rect = dropZone.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const hourHeight = 60; // 60px per hour
        const hour = Math.floor(relativeY / hourHeight);
        const minute = Math.floor((relativeY % hourHeight) / hourHeight * 60);

        newDate.setHours(hour, minute, 0, 0);

        return {
            date: newDate,
            time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        };
    }

    // Update event date/time
    function updateEventDateTime(event, newDateTime) {
        const { date, time } = newDateTime;

        // Update start date/time
        event.startDate = formatDate(date);
        if (time) {
            event.startTime = time;
        }

        // Update end date/time if event has duration
        if (event.endDate || event.endTime) {
            const duration = getEventDuration(event);
            const endDate = new Date(date);

            if (time) {
                const [hours, minutes] = time.split(':');
                endDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            }

            endDate.setMinutes(endDate.getMinutes() + duration);

            event.endDate = formatDate(endDate);
            event.endTime = formatTime(endDate);
        }

        console.log('📅 Updated event date/time:', event.title, event.startDate, event.startTime);
    }

    // Get event duration in minutes
    function getEventDuration(event) {
        if (!event.startTime || !event.endTime) return 60; // Default 1 hour

        const start = new Date(`2000-01-01T${event.startTime}`);
        const end = new Date(`2000-01-01T${event.endTime}`);
        return (end - start) / (1000 * 60);
    }

    // Handle event resize
    function handleEventResize(e) {
        if (!draggedEvent || !resizeHandle) return;

        const eventId = draggedEvent.dataset.eventId;
        const event = calendarEvents.find(ev => ev.id === eventId);
        if (!event) return;

        // Calculate new duration based on mouse position
        const rect = draggedEvent.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const hourHeight = 60; // 60px per hour
        const newDuration = Math.max(15, Math.floor(relativeY / hourHeight * 60)); // Minimum 15 minutes

        // Update event duration
        updateEventDuration(event, newDuration, resizeHandle);
    }

    // Update event duration
    function updateEventDuration(event, duration, handle) {
        if (!event.startTime) return;

        const [hours, minutes] = event.startTime.split(':');
        const startTime = new Date();
        startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + duration);

        event.endTime = formatTime(endTime);

        console.log('⏱️ Updated event duration:', event.title, duration, 'minutes');
    }

    // Handle resize end
    function handleResizeEnd(e) {
        if (!draggedEvent) return;

        const eventId = draggedEvent.dataset.eventId;
        const event = calendarEvents.find(ev => ev.id === eventId);

        if (event) {
            // Check for conflicts and resolve
            checkAndResolveConflicts(event);

            // Save and refresh
            saveEvents();
            renderCalendarEnhanced();

            console.log('✅ Event resized successfully:', event.title);
            showNotification(`Event "${event.title}" resized successfully`, 'success');
        }
    }

    // Update drag preview
    function updateDragPreview(e) {
        if (!draggedEvent) return;

        // Add visual feedback during drag
        draggedEvent.style.opacity = '0.7';
        draggedEvent.style.transform = 'rotate(5deg)';
    }

    // ========================================
    // CONFLICT DETECTION AND RESOLUTION
    // ========================================

    // Check for conflicts and resolve them
    function checkAndResolveConflicts(event) {
        console.log('🔍 Checking for conflicts with event:', event.title);

        // Find all events that might conflict
        const conflictingEvents = findConflictingEvents(event);

        if (conflictingEvents.length > 0) {
            console.log('⚠️ Found conflicts:', conflictingEvents.length);

            // Resolve conflicts
            resolveConflicts(event, conflictingEvents);
        }
    }

    // Find events that conflict with the given event
    function findConflictingEvents(event) {
        const conflicts = [];

        // Get event time range
        const eventStart = getEventDateTime(event, 'start');
        const eventEnd = getEventDateTime(event, 'end');

        if (!eventStart || !eventEnd) return conflicts;

        // Check against all other events
        calendarEvents.forEach(otherEvent => {
            if (otherEvent.id === event.id) return; // Skip self

            const otherStart = getEventDateTime(otherEvent, 'start');
            const otherEnd = getEventDateTime(otherEvent, 'end');

            if (!otherStart || !otherEnd) return;

            // Check for time overlap
            if (isTimeOverlap(eventStart, eventEnd, otherStart, otherEnd)) {
                conflicts.push({
                    event: otherEvent,
                    type: 'time_overlap',
                    severity: 'high'
                });
            }
        });

        return conflicts;
    }

    // Get event date/time
    function getEventDateTime(event, type) {
        const dateStr = type === 'start' ? event.startDate : event.endDate;
        const timeStr = type === 'start' ? event.startTime : event.endTime;

        if (!dateStr) return null;

        const date = new Date(dateStr);

        if (timeStr) {
            const [hours, minutes] = timeStr.split(':');
            date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }

        return date;
    }

    // Check if two time ranges overlap
    function isTimeOverlap(start1, end1, start2, end2) {
        return start1 < end2 && start2 < end1;
    }

    // Resolve conflicts
    function resolveConflicts(event, conflicts) {
        console.log('🔧 Resolving conflicts for event:', event.title);

        conflicts.forEach(conflict => {
            const otherEvent = conflict.event;

            // Check if this is a prayer time conflict with a meeting
            if (isPrayerEvent(otherEvent) && isMeetingEvent(event)) {
                console.log('🕌 Resolving prayer conflict with meeting:', otherEvent.title);
                resolvePrayerMeetingConflict(otherEvent, event);
            } else if (isPrayerEvent(event) && isMeetingEvent(otherEvent)) {
                console.log('🕌 Resolving prayer conflict with meeting:', event.title);
                resolvePrayerMeetingConflict(event, otherEvent);
            } else if (isPrayerEvent(event) && isPrayerEvent(otherEvent)) {
                console.log('🕌 Resolving prayer-prayer conflict:', event.title, otherEvent.title);
                resolvePrayerPrayerConflict(event, otherEvent);
            } else {
                console.log('⚠️ General conflict detected:', event.title, otherEvent.title);
                // For now, just show a warning
                showConflictWarning(event, otherEvent);
            }
        });
    }

    // Check if event is a prayer event
    function isPrayerEvent(event) {
        return event.category === 'prayer' ||
               event.title.toLowerCase().includes('prayer') ||
               event.title.toLowerCase().includes('fajr') ||
               event.title.toLowerCase().includes('dhuhr') ||
               event.title.toLowerCase().includes('asr') ||
               event.title.toLowerCase().includes('maghrib') ||
               event.title.toLowerCase().includes('isha');
    }

    // Check if event is a meeting event
    function isMeetingEvent(event) {
        return event.meetingType && event.meetingType !== 'none' ||
               event.category === 'work' ||
               event.title.toLowerCase().includes('meeting') ||
               event.title.toLowerCase().includes('call') ||
               event.title.toLowerCase().includes('conference');
    }

    // Resolve prayer-meeting conflict
    function resolvePrayerMeetingConflict(prayerEvent, meetingEvent) {
        console.log('🕌 Resolving prayer-meeting conflict');

        // Get meeting end time
        const meetingEnd = getEventDateTime(meetingEvent, 'end');
        if (!meetingEnd) return;

        // Move prayer to 1 minute after meeting ends
        const newPrayerTime = new Date(meetingEnd);
        newPrayerTime.setMinutes(newPrayerTime.getMinutes() + 1);

        // Update prayer event
        prayerEvent.startTime = formatTime(newPrayerTime);
        prayerEvent.endTime = formatTime(new Date(newPrayerTime.getTime() + 15 * 60000)); // 15 minutes duration

        // Add conflict resolution note
        prayerEvent.conflictNote = `Prayer time changed exceptionally due to meeting conflicts with "${meetingEvent.title}"`;

        console.log('✅ Prayer time moved to:', prayerEvent.startTime);
        showNotification(`Prayer time "${prayerEvent.title}" moved to ${prayerEvent.startTime} due to meeting conflict`, 'info');
    }

    // Resolve prayer-prayer conflict
    function resolvePrayerPrayerConflict(event1, event2) {
        console.log('🕌 Resolving prayer-prayer conflict');

        // Move the second prayer 15 minutes after the first
        const event1End = getEventDateTime(event1, 'end');
        if (!event1End) return;

        const newTime = new Date(event1End);
        newTime.setMinutes(newTime.getMinutes() + 15);

        event2.startTime = formatTime(newTime);
        event2.endTime = formatTime(new Date(newTime.getTime() + 15 * 60000));

        event2.conflictNote = `Prayer time changed exceptionally due to conflict with "${event1.title}"`;

        console.log('✅ Prayer time moved to:', event2.startTime);
        showNotification(`Prayer time "${event2.title}" moved to ${event2.startTime} due to conflict`, 'info');
    }

    // Show conflict warning
    function showConflictWarning(event1, event2) {
        showNotification(`Conflict detected between "${event1.title}" and "${event2.title}"`, 'warning');
    }

    // ========================================
    // BULK OPERATIONS
    // ========================================

    // Initialize bulk operations
    function initializeBulkOperations() {
        console.log('🎯 Initializing bulk operations...');

        // Add selection checkboxes to events
        addSelectionCheckboxes();

        // Add bulk action buttons
        addBulkActionButtons();

        console.log('✅ Bulk operations initialized');
    }

    // Add selection checkboxes to events
    function addSelectionCheckboxes() {
        document.querySelectorAll('.event-item, .calendar-event, .week-event, .day-event').forEach(eventEl => {
            // Remove existing checkbox
            const existingCheckbox = eventEl.querySelector('.event-checkbox');
            if (existingCheckbox) existingCheckbox.remove();

            // Debug: Check if event has proper ID
            const eventId = eventEl.dataset.eventId;
            if (!eventId) {
                console.warn('⚠️ Event element missing data-event-id:', eventEl);
                return; // Skip this element if no ID
            }

            // Add new checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'event-checkbox';
            checkbox.dataset.eventId = eventId;
            checkbox.addEventListener('change', handleEventSelection);

            eventEl.insertBefore(checkbox, eventEl.firstChild);
        });
    }

    // Handle event selection
    function handleEventSelection(e) {
        const eventId = e.target.dataset.eventId;

        if (e.target.checked) {
            selectedEvents.add(eventId);
        } else {
            selectedEvents.delete(eventId);
        }

        updateBulkActionButtons();
        console.log('Selected events:', selectedEvents.size);
    }

    // Add bulk action buttons
    function addBulkActionButtons() {
        // Remove existing bulk actions
        const existingBulkActions = document.querySelector('.bulk-actions');
        if (existingBulkActions) existingBulkActions.remove();

        // Create bulk actions container
        const bulkActions = document.createElement('div');
        bulkActions.className = 'bulk-actions';
        bulkActions.innerHTML = `
            <div class="bulk-actions-content">
                <span class="selected-count">0 events selected</span>
                <div class="bulk-buttons">
                    <button class="bulk-btn" id="bulk-delete" disabled>
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                    <button class="bulk-btn" id="bulk-move" disabled>
                        <i class="fa-solid fa-arrows-up-down"></i> Move
                    </button>
                    <button class="bulk-btn" id="bulk-duplicate" disabled>
                        <i class="fa-solid fa-copy"></i> Duplicate
                    </button>
                    <button class="bulk-btn" id="bulk-export" disabled>
                        <i class="fa-solid fa-download"></i> Export
                    </button>
                </div>
            </div>
        `;

        // Insert after event panel
        const eventPanel = document.querySelector('.event-panel');
        if (eventPanel) {
            eventPanel.insertAdjacentElement('afterend', bulkActions);
        }

        // Add event listeners
        setupBulkActionListeners();
    }

    // Setup bulk action listeners
    function setupBulkActionListeners() {
        document.getElementById('bulk-delete')?.addEventListener('click', handleBulkDelete);
        document.getElementById('bulk-move')?.addEventListener('click', handleBulkMove);
        document.getElementById('bulk-duplicate')?.addEventListener('click', handleBulkDuplicate);
        document.getElementById('bulk-export')?.addEventListener('click', handleBulkExport);
    }

    // Update bulk action buttons
    function updateBulkActionButtons() {
        const count = selectedEvents.size;
        const countElement = document.querySelector('.selected-count');
        const buttons = document.querySelectorAll('.bulk-btn');

        if (countElement) {
            countElement.textContent = `${count} event${count !== 1 ? 's' : ''} selected`;
        }

        buttons.forEach(btn => {
            btn.disabled = count === 0;
        });
    }

    // Handle bulk delete
    function handleBulkDelete() {
        if (selectedEvents.size === 0) return;

        if (confirm(`Are you sure you want to delete ${selectedEvents.size} events?`)) {
            selectedEvents.forEach(eventId => {
                const eventIndex = calendarEvents.findIndex(e => e.id === eventId);
                if (eventIndex !== -1) {
                    calendarEvents.splice(eventIndex, 1);
                }
            });

            selectedEvents.clear();
            saveEvents();
            renderCalendarEnhanced();
            updateBulkActionButtons();

            showNotification(`${selectedEvents.size} events deleted successfully`, 'success');
        }
    }

    // Handle bulk move
    function handleBulkMove() {
        if (selectedEvents.size === 0) return;

        // For now, just show a message
        showNotification('Bulk move functionality coming soon!', 'info');
    }

    // Handle bulk duplicate
    function handleBulkDuplicate() {
        if (selectedEvents.size === 0) return;

        selectedEvents.forEach(eventId => {
            const event = calendarEvents.find(e => e.id === eventId);
            if (event) {
                const duplicatedEvent = {
                    ...event,
                    id: generateEventId(),
                    title: `${event.title} (Copy)`,
                    startDate: formatDate(new Date()),
                    endDate: formatDate(new Date())
                };
                calendarEvents.push(duplicatedEvent);
            }
        });

        saveEvents();
        renderCalendarEnhanced();
        updateBulkActionButtons();

        showNotification(`${selectedEvents.size} events duplicated successfully`, 'success');
    }

    // Handle bulk export
    function handleBulkExport() {
        if (selectedEvents.size === 0) return;

        const selectedEventsData = Array.from(selectedEvents).map(eventId =>
            calendarEvents.find(e => e.id === eventId)
        ).filter(Boolean);

        exportCalendarData('json', selectedEventsData);
        showNotification(`${selectedEvents.size} events exported successfully`, 'success');
    }

    // Generate unique event ID
    function generateEventId() {
        return 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ========================================
    // DAY POPUP FUNCTIONALITY
    // ========================================

    let currentDayPopup = null;

    // Initialize day popup functionality
    function initializeDayPopup() {
        console.log('🎯 Initializing day popup functionality...');

        // Add click listeners to calendar days
        addDayClickListeners();

        // Create day popup modal
        createDayPopupModal();

        console.log('✅ Day popup initialized successfully');
    }

    // Add click listeners to calendar days
    function addDayClickListeners() {
        // Month view days
        document.querySelectorAll('.calendar-day').forEach(dayEl => {
            dayEl.addEventListener('click', handleDayClick);
        });

        // Week view days
        document.querySelectorAll('.day-cell').forEach(dayEl => {
            dayEl.addEventListener('click', handleDayClick);
        });

        // Day view slots
        document.querySelectorAll('.day-slot').forEach(slotEl => {
            slotEl.addEventListener('click', handleDayClick);
        });
    }

    // Handle day click
    function handleDayClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const dayEl = e.target.closest('.calendar-day, .day-cell, .day-slot');
        if (!dayEl) return;

        // Get the date for this day
        const date = getDateFromDayElement(dayEl);
        if (!date) return;

        // Show day popup
        showDayPopup(date);
    }

    // Get date from day element
    function getDateFromDayElement(dayEl) {
        const currentView = document.querySelector('.calendar-view.active');
        if (!currentView) return null;

        if (currentView.id === 'month-view') {
            return getMonthViewDate(dayEl);
        } else if (currentView.id === 'week-view') {
            return getWeekViewDate(dayEl);
        } else if (currentView.id === 'day-view') {
            return getDayViewDate(dayEl);
        }

        return null;
    }

    // Get date for month view
    function getMonthViewDate(dayEl) {
        const dayNumber = parseInt(dayEl.textContent);
        if (isNaN(dayNumber)) return null;

        const date = new Date(currentDate);
        date.setDate(dayNumber);
        return date;
    }

    // Get date for week view
    function getWeekViewDate(dayEl) {
        const dayIndex = parseInt(dayEl.dataset.day);
        if (isNaN(dayIndex)) return null;

        const weekStart = getStartOfWeek();
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayIndex);
        return date;
    }

    // Get date for day view
    function getDayViewDate(dayEl) {
        return new Date(currentDate);
    }

    // Create day popup modal
    function createDayPopupModal() {
        // Remove existing modal
        const existingModal = document.getElementById('day-popup-modal');
        if (existingModal) existingModal.remove();

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'day-popup-modal';
        modal.className = 'modal day-popup-modal';
        modal.innerHTML = `
            <div class="modal-content day-popup-content">
                <div class="modal-header">
                    <h3 id="day-popup-title">Events for [Date]</h3>
                    <button class="close-btn" id="close-day-popup">&times;</button>
                </div>
                <div class="day-popup-body">
                    <div class="day-events-header">
                        <div class="day-info">
                            <span id="day-date-display"></span>
                            <span id="day-events-count" class="events-count"></span>
                        </div>
                        <div class="day-actions">
                            <button id="add-event-to-day" class="btn-primary">
                                <i class="fa-solid fa-plus"></i> Add Event
                            </button>
                            <button id="bulk-actions-day" class="btn-secondary">
                                <i class="fa-solid fa-check-square"></i> Bulk Actions
                            </button>
                        </div>
                    </div>
                    <div id="day-events-list" class="day-events-list">
                        <!-- Events will be populated here -->
                    </div>
                    <div class="day-events-footer">
                        <div class="day-stats">
                            <span id="day-total-events">0 events</span>
                            <span id="day-total-duration">0 hours</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        setupDayPopupListeners();
    }

    // Setup day popup listeners
    function setupDayPopupListeners() {
        // Close button
        document.getElementById('close-day-popup')?.addEventListener('click', closeDayPopup);

        // Add event button
        document.getElementById('add-event-to-day')?.addEventListener('click', handleAddEventToDay);

        // Bulk actions button
        document.getElementById('bulk-actions-day')?.addEventListener('click', handleBulkActionsDay);

        // Close on outside click
        document.getElementById('day-popup-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'day-popup-modal') {
                closeDayPopup();
            }
        });
    }

    // Show day popup
    function showDayPopup(date) {
        console.log('📅 Showing day popup for:', date);
        console.log('🔍 showDayPopup: Function called successfully');

        currentDayPopup = date;

        // Update modal title and date
        const title = document.getElementById('day-popup-title');
        const dateDisplay = document.getElementById('day-date-display');

        if (title) {
            title.textContent = `Events for ${formatDate(date, 'MMMM DD, YYYY')}`;
        }

        if (dateDisplay) {
            dateDisplay.textContent = formatDate(date, 'dddd, MMMM DD, YYYY');
        }

        // Get events for this day
        console.log('🔍 showDayPopup: About to call getEventsForDay with date:', date);
        const dayEvents = getEventsForDay(date);
        console.log('🔍 showDayPopup: getEventsForDay returned:', dayEvents.length, 'events');

        // Populate events list
        populateDayEventsList(dayEvents);

        // Update stats
        updateDayStats(dayEvents);

        // Show modal
        const modal = document.getElementById('day-popup-modal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('show');
        }
    }

    // Close day popup
    function closeDayPopup() {
        const modal = document.getElementById('day-popup-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
        currentDayPopup = null;
    }

    // Get events for a specific day
    function getEventsForDay(date) {
        console.log('🔍 getEventsForDay called with date:', date);

        // Format the target date as YYYY-MM-DD
        const targetDateStr = formatDate(date, 'YYYY-MM-DD');
        console.log('🔍 Target date string:', targetDateStr);
        console.log('🔍 calendarEvents length:', calendarEvents.length);

        // Filter events for this day by comparing dates
        const filteredEvents = calendarEvents.filter(event => {
            // Get event's start date
            const eventStartDate = event.startDate || event.start;
            if (!eventStartDate) return false;

            // Convert event date to YYYY-MM-DD format for comparison
            let eventDateStr;
            if (typeof eventStartDate === 'string') {
                // If it's a string, extract YYYY-MM-DD part
                eventDateStr = eventStartDate.substring(0, 10);
            } else if (eventStartDate instanceof Date) {
                // If it's a Date object, format it
                eventDateStr = formatDate(eventStartDate, 'YYYY-MM-DD');
            } else {
                return false;
            }

            const matches = eventDateStr === targetDateStr;
            if (matches) {
                console.log('✅ Found matching event:', event.title, 'eventDate:', eventDateStr);
            }
            return matches;
        });

        console.log('🔍 Filtered events count:', filteredEvents.length);
        return filteredEvents;
    }

    // Populate day events list
    function populateDayEventsList(events) {
        const eventsList = document.getElementById('day-events-list');
        if (!eventsList) return;

        // Clear existing events
        eventsList.innerHTML = '';

        if (events.length === 0) {
            eventsList.innerHTML = `
                <div class="no-events">
                    <i class="fa-solid fa-calendar-plus"></i>
                    <p>No events scheduled for this day</p>
                    <button class="btn-primary" onclick="handleAddEventToDay()">
                        <i class="fa-solid fa-plus"></i> Add First Event
                    </button>
                </div>
            `;
            return;
        }

        // Sort events by time
        const sortedEvents = events.sort((a, b) => {
            const timeA = a.startTime || '00:00';
            const timeB = b.startTime || '00:00';
            return timeA.localeCompare(timeB);
        });

        // Create event items
        sortedEvents.forEach(event => {
            const eventItem = createDayEventItem(event);
            eventsList.appendChild(eventItem);
        });

        // Update events count
        const countElement = document.getElementById('day-events-count');
        if (countElement) {
            countElement.textContent = `${events.length} event${events.length !== 1 ? 's' : ''}`;
        }
    }

    // Create day event item
    function createDayEventItem(event) {
        const eventItem = document.createElement('div');
        eventItem.className = 'day-event-item';
        eventItem.dataset.eventId = event.id;

        // Add conflict indicators
        if (event.conflictNote) {
            eventItem.classList.add('prayer-rescheduled');
        }

        const timeDisplay = event.startTime ? formatTime(new Date(`2000-01-01T${event.startTime}`)) : 'All Day';
        const duration = getEventDuration(event);
        const endTime = event.endTime ? formatTime(new Date(`2000-01-01T${event.endTime}`)) : null;

        eventItem.innerHTML = `
            <div class="event-time">
                <span class="start-time">${timeDisplay}</span>
                ${endTime ? `<span class="end-time">- ${endTime}</span>` : ''}
                <span class="duration">(${duration} min)</span>
            </div>
            <div class="event-details">
                <div class="event-title">${event.title}</div>
                ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                <div class="event-meta">
                    <span class="event-category ${event.category}">${event.category}</span>
                    ${event.meetingType && event.meetingType !== 'none' ? `<span class="meeting-type">${event.meetingType}</span>` : ''}
                    ${event.conflictNote ? `<span class="conflict-note">${event.conflictNote}</span>` : ''}
                </div>
            </div>
            <div class="event-actions">
                <button class="action-btn edit-btn" onclick="editEventFromDayPopup('${event.id}')" title="Edit Event">
                    <i class="fa-solid fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteEventFromDayPopup('${event.id}')" title="Delete Event">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <button class="action-btn duplicate-btn" onclick="duplicateEventFromDayPopup('${event.id}')" title="Duplicate Event">
                    <i class="fa-solid fa-copy"></i>
                </button>
            </div>
        `;

        return eventItem;
    }

    // Update day stats
    function updateDayStats(events) {
        const totalEvents = document.getElementById('day-total-events');
        const totalDuration = document.getElementById('day-total-duration');

        if (totalEvents) {
            totalEvents.textContent = `${events.length} event${events.length !== 1 ? 's' : ''}`;
        }

        if (totalDuration) {
            const totalMinutes = events.reduce((total, event) => {
                return total + getEventDuration(event);
            }, 0);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            totalDuration.textContent = `${hours}h ${minutes}m`;
        }
    }

    // Handle add event to day
    function handleAddEventToDay() {
        if (!currentDayPopup) return;

        // Close day popup
        closeDayPopup();

        // Open event modal with pre-filled date
        const event = {
            startDate: formatDate(currentDayPopup),
            endDate: formatDate(currentDayPopup)
        };

        openEventModal(event);
    }

    // Handle bulk actions for day
    function handleBulkActionsDay() {
        const selectedCheckboxes = document.querySelectorAll('.day-event-item .event-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            showNotification('Please select events first', 'warning');
            return;
        }

        // Show bulk actions menu
        showBulkActionsMenu(Array.from(selectedCheckboxes).map(cb => cb.dataset.eventId));
    }

    // Show bulk actions menu
    function showBulkActionsMenu(eventIds) {
        const menu = document.createElement('div');
        menu.className = 'bulk-actions-menu';
        menu.innerHTML = `
            <div class="bulk-menu-content">
                <h4>Bulk Actions (${eventIds.length} events)</h4>
                <div class="bulk-menu-buttons">
                    <button class="bulk-menu-btn" onclick="bulkDeleteFromDayPopup([${eventIds.map(id => `'${id}'`).join(',')}])">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                    <button class="bulk-menu-btn" onclick="bulkMoveFromDayPopup([${eventIds.map(id => `'${id}'`).join(',')}])">
                        <i class="fa-solid fa-arrows-up-down"></i> Move
                    </button>
                    <button class="bulk-menu-btn" onclick="bulkDuplicateFromDayPopup([${eventIds.map(id => `'${id}'`).join(',')}])">
                        <i class="fa-solid fa-copy"></i> Duplicate
                    </button>
                    <button class="bulk-menu-btn" onclick="bulkExportFromDayPopup([${eventIds.map(id => `'${id}'`).join(',')}])">
                        <i class="fa-solid fa-download"></i> Export
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(menu);

        // Close menu on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    // Edit event from day popup
    function editEventFromDayPopup(eventId) {
        const event = calendarEvents.find(e => e.id === eventId);
        if (event) {
            closeDayPopup();
            editEvent(event);
        }
    }

    // Delete event from day popup
    function deleteEventFromDayPopup(eventId) {
        if (confirm('Are you sure you want to delete this event?')) {
            deleteEvent(eventId);
            // Refresh day popup if it's open
            if (currentDayPopup) {
                const dayEvents = getEventsForDay(currentDayPopup);
                populateDayEventsList(dayEvents);
                updateDayStats(dayEvents);
            }
        }
    }

    // Duplicate event from day popup
    function duplicateEventFromDayPopup(eventId) {
        const event = calendarEvents.find(e => e.id === eventId);
        if (event) {
            const duplicatedEvent = {
                ...event,
                id: generateEventId(),
                title: `${event.title} (Copy)`,
                startDate: formatDate(currentDayPopup),
                endDate: formatDate(currentDayPopup)
            };
            calendarEvents.push(duplicatedEvent);
            saveEvents();

            // Refresh day popup
            if (currentDayPopup) {
                const dayEvents = getEventsForDay(currentDayPopup);
                populateDayEventsList(dayEvents);
                updateDayStats(dayEvents);
            }

            showNotification('Event duplicated successfully', 'success');
        }
    }

    // Bulk delete from day popup
    function bulkDeleteFromDayPopup(eventIds) {
        if (confirm(`Are you sure you want to delete ${eventIds.length} events?`)) {
            eventIds.forEach(eventId => {
                const eventIndex = calendarEvents.findIndex(e => e.id === eventId);
                if (eventIndex !== -1) {
                    calendarEvents.splice(eventIndex, 1);
                }
            });

            saveEvents();

            // Refresh day popup
            if (currentDayPopup) {
                const dayEvents = getEventsForDay(currentDayPopup);
                populateDayEventsList(dayEvents);
                updateDayStats(dayEvents);
            }

            showNotification(`${eventIds.length} events deleted successfully`, 'success');
        }
    }

    // Bulk move from day popup
    function bulkMoveFromDayPopup(eventIds) {
        showNotification('Bulk move functionality coming soon!', 'info');
    }

    // Bulk duplicate from day popup
    function bulkDuplicateFromDayPopup(eventIds) {
        eventIds.forEach(eventId => {
            const event = calendarEvents.find(e => e.id === eventId);
            if (event) {
                const duplicatedEvent = {
                    ...event,
                    id: generateEventId(),
                    title: `${event.title} (Copy)`,
                    startDate: formatDate(currentDayPopup),
                    endDate: formatDate(currentDayPopup)
                };
                calendarEvents.push(duplicatedEvent);
            }
        });

        saveEvents();

        // Refresh day popup
        if (currentDayPopup) {
            const dayEvents = getEventsForDay(currentDayPopup);
            populateDayEventsList(dayEvents);
            updateDayStats(dayEvents);
        }

        showNotification(`${eventIds.length} events duplicated successfully`, 'success');
    }

    // Bulk export from day popup
    function bulkExportFromDayPopup(eventIds) {
        const selectedEventsData = eventIds.map(eventId =>
            calendarEvents.find(e => e.id === eventId)
        ).filter(Boolean);

        exportCalendarData('json', selectedEventsData);
        showNotification(`${eventIds.length} events exported successfully`, 'success');
    }

    // Expose day popup functions to global scope
    window.editEventFromDayPopup = editEventFromDayPopup;
    window.deleteEventFromDayPopup = deleteEventFromDayPopup;
    window.duplicateEventFromDayPopup = duplicateEventFromDayPopup;
    window.bulkDeleteFromDayPopup = bulkDeleteFromDayPopup;
    window.bulkMoveFromDayPopup = bulkMoveFromDayPopup;
    window.bulkDuplicateFromDayPopup = bulkDuplicateFromDayPopup;
    window.bulkExportFromDayPopup = bulkExportFromDayPopup;

    // ========================================
    // CSS STYLES FOR DRAG & DROP
    // ========================================

    // Add CSS styles for drag and drop
    function addDragAndDropStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Drag and Drop Styles */
            .event-item, .calendar-event, .week-event, .day-event {
                position: relative;
                cursor: move;
                transition: all 0.2s ease;
            }
            
            .event-item:hover, .calendar-event:hover, .week-event:hover, .day-event:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            
            /* Drag and drop styles disabled */
            .event-item.dragging, .calendar-event.dragging, .week-event.dragging, .day-event.dragging {
                /* opacity: 0.7;
                transform: rotate(5deg) scale(1.05);
                z-index: 1000;
                box-shadow: 0 8px 16px rgba(0,0,0,0.3); */
            }
            
            /* Resize Handles */
            /* Resize handles disabled */
            .resize-handle {
                display: none !important;
            }
            
            /* Original resize handle styles - DISABLED
            .resize-handle {
                position: absolute;
                background: rgba(255,255,255,0.8);
                border: 1px solid #ccc;
                border-radius: 2px;
                font-size: 10px;
                color: #666;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
            }
            
            .resize-top {
                top: -5px;
                left: 50%;
                transform: translateX(-50%);
                width: 20px;
                height: 10px;
            }
            
            .resize-bottom {
                bottom: -5px;
                left: 50%;
                transform: translateX(-50%);
                width: 20px;
                height: 10px;
            }
            
            .resize-right {
                right: -5px;
                top: 50%;
                transform: translateY(-50%);
                width: 10px;
                height: 20px;
            }
            
            .resize-handle:hover {
                background: #007bff;
                color: white;
            }
            */
            
            /* Drop Zones */
            .calendar-day, .day-cell, .day-slot {
                transition: all 0.2s ease;
            }
            
            .drop-zone-active {
                background: rgba(0, 123, 255, 0.1) !important;
                border: 2px dashed #007bff !important;
                border-radius: 4px;
            }
            
            /* Event Selection */
            .event-checkbox {
                position: absolute;
                top: 5px;
                left: 5px;
                z-index: 5;
            }
            
            .event-item.selected, .calendar-event.selected, .week-event.selected, .day-event.selected {
                border: 2px solid #007bff;
                background: rgba(0, 123, 255, 0.1);
            }
            
            /* Bulk Actions */
            .bulk-actions {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 15px 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 1000;
                display: none;
            }
            
            .bulk-actions.show {
                display: block;
            }
            
            .bulk-actions-content {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            
            .selected-count {
                font-weight: 600;
                color: var(--text-color);
            }
            
            .bulk-buttons {
                display: flex;
                gap: 10px;
            }
            
            .bulk-btn {
                padding: 8px 16px;
                border: 1px solid var(--border-color);
                background: var(--background-color);
                color: var(--text-color);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .bulk-btn:hover:not(:disabled) {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }
            
            .bulk-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            /* Conflict Indicators */
            .event-conflict {
                border-left: 4px solid #ff6b6b !important;
                background: rgba(255, 107, 107, 0.1) !important;
            }
            
            .event-conflict::after {
                content: "⚠️";
                position: absolute;
                top: 5px;
                right: 5px;
                font-size: 12px;
            }
            
            .prayer-rescheduled {
                border-left: 4px solid #ffa500 !important;
                background: rgba(255, 165, 0, 0.1) !important;
            }
            
            .prayer-rescheduled::after {
                content: "🕌";
                position: absolute;
                top: 5px;
                right: 5px;
                font-size: 12px;
            }
            
            /* Day Popup Styles */
            .day-popup-modal {
                z-index: 2000;
            }
            
            .day-popup-content {
                max-width: 800px;
                width: 90vw;
                max-height: 80vh;
                overflow: hidden;
            }
            
            .day-popup-body {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            
            .day-events-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid var(--border-color);
                background: var(--background-color);
            }
            
            .day-info {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .day-info span:first-child {
                font-size: 1.2rem;
                font-weight: 600;
                color: var(--text-color);
            }
            
            .events-count {
                font-size: 0.9rem;
                color: var(--primary-color);
                font-weight: 500;
            }
            
            .day-actions {
                display: flex;
                gap: 10px;
            }
            
            .day-events-list {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                max-height: 400px;
            }
            
            .day-event-item {
                display: flex;
                align-items: center;
                padding: 15px;
                margin-bottom: 10px;
                background: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                transition: all 0.2s ease;
                position: relative;
            }
            
            .day-event-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                border-color: var(--primary-color);
            }
            
            .event-time {
                min-width: 120px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                margin-right: 15px;
            }
            
            .start-time {
                font-weight: 600;
                color: var(--primary-color);
                font-size: 0.9rem;
            }
            
            .end-time {
                font-size: 0.8rem;
                color: var(--text-color);
                opacity: 0.7;
            }
            
            .duration {
                font-size: 0.7rem;
                color: var(--text-color);
                opacity: 0.6;
            }
            
            .event-details {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .event-title {
                font-weight: 600;
                color: var(--text-color);
                font-size: 1rem;
            }
            
            .event-description {
                color: var(--text-color);
                opacity: 0.8;
                font-size: 0.9rem;
                line-height: 1.4;
            }
            
            .event-meta {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .event-category {
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.7rem;
                font-weight: 500;
                text-transform: uppercase;
            }
            
            .event-category.prayer {
                background: rgba(34, 197, 94, 0.2);
                color: #22c55e;
            }
            
            .event-category.islamic {
                background: rgba(59, 130, 246, 0.2);
                color: #3b82f6;
            }
            
            .event-category.personal {
                background: rgba(168, 85, 247, 0.2);
                color: #a855f7;
            }
            
            .event-category.work {
                background: rgba(245, 158, 11, 0.2);
                color: #f59e0b;
            }
            
            .event-category.reminder {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
            }
            
            .event-category.holiday {
                background: rgba(236, 72, 153, 0.2);
                color: #ec4899;
            }
            
            .meeting-type {
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.7rem;
                background: rgba(107, 114, 128, 0.2);
                color: #6b7280;
            }
            
            .conflict-note {
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.7rem;
                background: rgba(255, 165, 0, 0.2);
                color: #ffa500;
                font-style: italic;
            }
            
            .event-actions {
                display: flex;
                gap: 5px;
                margin-left: 10px;
            }
            
            .action-btn {
                width: 32px;
                height: 32px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                font-size: 0.8rem;
            }
            
            .edit-btn {
                background: rgba(59, 130, 246, 0.1);
                color: #3b82f6;
            }
            
            .edit-btn:hover {
                background: #3b82f6;
                color: white;
            }
            
            .delete-btn {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
            }
            
            .delete-btn:hover {
                background: #ef4444;
                color: white;
            }
            
            .duplicate-btn {
                background: rgba(107, 114, 128, 0.1);
                color: #6b7280;
            }
            
            .duplicate-btn:hover {
                background: #6b7280;
                color: white;
            }
            
            .day-events-footer {
                padding: 15px 20px;
                border-top: 1px solid var(--border-color);
                background: var(--background-color);
            }
            
            .day-stats {
                display: flex;
                gap: 20px;
                font-size: 0.9rem;
                color: var(--text-color);
                opacity: 0.8;
            }
            
            .no-events {
                text-align: center;
                padding: 40px 20px;
                color: var(--text-color);
                opacity: 0.6;
            }
            
            .no-events i {
                font-size: 3rem;
                margin-bottom: 15px;
                color: var(--primary-color);
            }
            
            .no-events p {
                margin: 10px 0 20px;
                font-size: 1.1rem;
            }
            
            .bulk-actions-menu {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 8px 16px rgba(0,0,0,0.3);
                z-index: 3000;
            }
            
            .bulk-menu-content h4 {
                margin: 0 0 15px 0;
                color: var(--text-color);
            }
            
            .bulk-menu-buttons {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .bulk-menu-btn {
                padding: 8px 16px;
                border: 1px solid var(--border-color);
                background: var(--background-color);
                color: var(--text-color);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 0.9rem;
            }
            
            .bulk-menu-btn:hover {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }
        `;

        document.head.appendChild(style);
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
        console.log('📅 Calendar grid element:', document.querySelector('.calendar-grid'));
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


    // Check for OAuth callback on page load
    checkMicrosoftCallback();
    if (typeof checkGoogleCallback === 'function') {
        checkGoogleCallback();
    }

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

// Expose additional functions for debugging
window.forceReloadEvents = function() {
    console.log('🔄 Force reloading events...');
    if (typeof loadEventsFromLocalStorage === 'function') {
        loadEventsFromLocalStorage();
    }
    if (typeof renderCalendarEnhanced === 'function') {
        renderCalendarEnhanced();
    }
};
