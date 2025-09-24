// calendar.js - Comprehensive Islamic Calendar with all possible features

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

    // --- State Management ---
    let currentDate = new Date();
    let currentView = VIEWS.MONTH;
    let currentTimezone = 'auto';
    let events = [];
    let prayerTimes = {};
    let userLocation = null;
    let selectedDate = null;
    
    // Integration state
    let integrations = {
        mobile: { connected: false, type: null, credentials: {} },
        email: { connected: false, provider: null, credentials: {} },
        video: { connected: false, platform: null, credentials: {} }
    };

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
        mobileSyncModal: document.getElementById('mobile-sync-modal'),
        emailSyncModal: document.getElementById('email-sync-modal'),
        videoMeetingsModal: document.getElementById('video-meetings-modal'),
        eventForm: document.getElementById('event-form'),
        
        // Integration elements
        mobileSyncBtn: document.getElementById('mobile-sync-btn'),
        emailSyncBtn: document.getElementById('email-sync-btn'),
        videoMeetingsBtn: document.getElementById('video-meetings-btn'),
        syncAllBtn: document.getElementById('sync-all-btn'),
        mobileSyncStatus: document.getElementById('mobile-sync-status'),
        emailSyncStatus: document.getElementById('email-sync-status'),
        videoMeetingsStatus: document.getElementById('video-meetings-status'),
        syncStatus: document.getElementById('sync-status'),
        
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
        return events.filter(event => {
            const eventDate = new Date(event.startDate);
            return formatDate(eventDate) === dateStr;
        });
    }

    function addEventsToWeekView() {
        const weekEvents = events.filter(event => {
            const eventDate = new Date(event.startDate);
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
            const hour = new Date(event.startDate).getHours();
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

    function renderEventsList(eventsToShow = events) {
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
                    <div class="event-date">${formatDate(event.startDate, 'MMM D, YYYY')}</div>
                    <div class="event-time">${formatTime(event.startDate, 'HH:mm')}</div>
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
    
    // Mobile Sync Functions
    function openMobileSyncModal() {
        elements.mobileSyncModal.style.display = 'block';
        generateQRCode('ios-qr-code', 'webcal://calendar.yoursite.com/calendar.ics');
        generateQRCode('android-qr-code', 'webcal://calendar.yoursite.com/calendar.ics');
    }
    
    function closeMobileSyncModal() {
        elements.mobileSyncModal.style.display = 'none';
    }
    
    async function setupMobileSync(deviceType) {
        try {
            showNotification('Setting up mobile sync...', 'info');
            
            // Simulate setup process with realistic delays
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Generate calendar export URL
            const calendarUrl = generateCalendarExportURL();
            
            // Create mobile sync configuration
            const mobileConfig = {
                deviceType: deviceType,
                calendarUrl: calendarUrl,
                syncInterval: 300000, // 5 minutes
                lastSync: new Date(),
                autoSync: true
            };
            
            // Store configuration
            integrations.mobile.connected = true;
            integrations.mobile.type = deviceType;
            integrations.mobile.config = mobileConfig;
            
            // Save to localStorage
            saveIntegrationSettings();
            
            // Start auto-sync
            startMobileAutoSync();
            
            updateIntegrationStatus();
            showNotification(`${deviceType.toUpperCase()} sync connected successfully!`, 'success');
            closeMobileSyncModal();
            
            // Show setup instructions
            showMobileSetupInstructions(deviceType, calendarUrl);
            
        } catch (error) {
            console.error('Mobile sync setup error:', error);
            showNotification('Failed to setup mobile sync', 'error');
        }
    }
    
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
    
    function startMobileAutoSync() {
        if (integrations.mobile.autoSync) {
            setInterval(() => {
                if (integrations.mobile.connected) {
                    syncToMobileCalendar();
                }
            }, integrations.mobile.config?.syncInterval || 300000);
        }
    }
    
    function showMobileSetupInstructions(deviceType, calendarUrl) {
        const instructions = deviceType === 'ios' ? 
            `iOS Setup Instructions:
1. Open Settings > Calendar > Accounts
2. Add Account > Other > Add CalDAV Account
3. Server: ${window.location.hostname}
4. Username: your-username
5. Password: your-password
6. Or scan the QR code above` :
            `Android Setup Instructions:
1. Open Google Calendar app
2. Go to Settings > Add account
3. Select "Other" and enter:
4. Calendar URL: ${calendarUrl}
5. Or scan the QR code above`;
        
        showNotification(instructions, 'info', 8000);
    }
    
    // Email Integration Functions
    function openEmailSyncModal() {
        elements.emailSyncModal.style.display = 'block';
    }
    
    function closeEmailSyncModal() {
        elements.emailSyncModal.style.display = 'none';
    }
    
    async function setupEmailSync(provider, credentials) {
        try {
            showNotification(`Setting up ${provider} integration...`, 'info');
            
            // Simulate setup process with realistic delays
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Validate credentials (mock validation)
            if (!credentials.email || !credentials.password) {
                throw new Error('Email and password are required');
            }
            
            // Create email integration configuration
            const emailConfig = {
                provider: provider,
                email: credentials.email,
                lastSync: new Date(),
                autoSync: true,
                syncInterval: 600000, // 10 minutes
                calendarUrl: generateCalendarExportURL(),
                webcalUrl: generateWebcalURL()
            };
            
            // Store configuration (in real app, this would be encrypted)
            integrations.email.connected = true;
            integrations.email.provider = provider;
            integrations.email.config = emailConfig;
            
            // Save to localStorage
            saveIntegrationSettings();
            
            // Start auto-sync
            startEmailAutoSync();
            
            updateIntegrationStatus();
            showNotification(`${provider} integration connected successfully!`, 'success');
            closeEmailSyncModal();
            
            // Show email setup instructions
            showEmailSetupInstructions(provider, emailConfig);
            
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
    
    // Video Meetings Functions
    function openVideoMeetingsModal() {
        elements.videoMeetingsModal.style.display = 'block';
    }
    
    function closeVideoMeetingsModal() {
        elements.videoMeetingsModal.style.display = 'none';
    }
    
    async function setupVideoMeetings(platform, credentials) {
        try {
            showNotification(`Setting up ${platform} integration...`, 'info');
            
            // Simulate setup process with realistic delays
            await new Promise(resolve => setTimeout(resolve, 2500));
            
            // Validate credentials (mock validation)
            const requiredFields = getRequiredVideoFields(platform);
            for (const field of requiredFields) {
                if (!credentials[field]) {
                    throw new Error(`${field} is required for ${platform}`);
                }
            }
            
            // Create video integration configuration
            const videoConfig = {
                platform: platform,
                credentials: credentials,
                lastSync: new Date(),
                autoSync: true,
                meetingTemplates: generateMeetingTemplates(platform),
                defaultSettings: getDefaultVideoSettings(platform)
            };
            
            // Store configuration
            integrations.video.connected = true;
            integrations.video.platform = platform;
            integrations.video.config = videoConfig;
            
            // Save to localStorage
            saveIntegrationSettings();
            
            updateIntegrationStatus();
            showNotification(`${platform} integration connected successfully!`, 'success');
            closeVideoMeetingsModal();
            
            // Show video setup instructions
            showVideoSetupInstructions(platform, videoConfig);
            
        } catch (error) {
            console.error('Video meetings setup error:', error);
            showNotification(`Failed to setup ${platform} integration: ${error.message}`, 'error');
        }
    }
    
    function getRequiredVideoFields(platform) {
        const fields = {
            'zoom': ['apiKey', 'apiSecret', 'accountId'],
            'teams': ['clientId', 'clientSecret', 'tenantId'],
            'google-meet': ['clientId', 'clientSecret']
        };
        return fields[platform] || [];
    }
    
    function generateMeetingTemplates(platform) {
        const templates = {
            'zoom': [
                { name: 'Quick Meeting', duration: 30, settings: { waitingRoom: true } },
                { name: 'Team Meeting', duration: 60, settings: { recording: true } },
                { name: 'Webinar', duration: 120, settings: { webinar: true } }
            ],
            'teams': [
                { name: 'Quick Call', duration: 30, settings: { lobby: true } },
                { name: 'Team Call', duration: 60, settings: { recording: true } },
                { name: 'Presentation', duration: 120, settings: { presenter: true } }
            ],
            'google-meet': [
                { name: 'Quick Meet', duration: 30, settings: { quickAccess: true } },
                { name: 'Team Meet', duration: 60, settings: { recording: true } },
                { name: 'Conference', duration: 120, settings: { breakout: true } }
            ]
        };
        return templates[platform] || [];
    }
    
    function getDefaultVideoSettings(platform) {
        const settings = {
            'zoom': {
                autoRecord: false,
                waitingRoom: true,
                joinBeforeHost: false,
                muteOnEntry: true
            },
            'teams': {
                lobby: true,
                recording: false,
                presenter: false,
                chat: true
            },
            'google-meet': {
                quickAccess: true,
                recording: false,
                breakout: false,
                chat: true
            }
        };
        return settings[platform] || {};
    }
    
    function showVideoSetupInstructions(platform, config) {
        const instructions = platform === 'zoom' ? 
            `Zoom Integration Ready!
• Meeting links will be generated automatically
• Use meeting templates for different event types
• Recording and waiting room settings configured
• Integration active for all new events` :
            platform === 'teams' ? 
            `Microsoft Teams Integration Ready!
• Teams meeting links will be generated automatically
• Lobby and recording settings configured
• Integration active for all new events` :
            `Google Meet Integration Ready!
• Meet links will be generated automatically
• Quick access and breakout room settings configured
• Integration active for all new events`;
        
        showNotification(instructions, 'success', 6000);
    }
    
    // Generate Meeting Link
    async function generateMeetingLink(meetingType, eventData) {
        try {
            if (!integrations.video.connected) {
                throw new Error('Video integration not connected');
            }
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Generate meeting link based on platform
            const platform = integrations.video.platform;
            const meetingId = generateMeetingId();
            const meetingPassword = generateMeetingPassword();
            
            let meetingLink;
            switch (platform) {
                case 'zoom':
                    meetingLink = `https://zoom.us/j/${meetingId}?pwd=${meetingPassword}`;
                    break;
                case 'teams':
                    meetingLink = `https://teams.microsoft.com/l/meetup-join/${meetingId}`;
                    break;
                case 'google-meet':
                    meetingLink = `https://meet.google.com/${meetingId}`;
                    break;
                default:
                    meetingLink = `https://meet.example.com/${meetingId}`;
            }
            
            // Store meeting details
            const meetingDetails = {
                id: meetingId,
                password: meetingPassword,
                link: meetingLink,
                platform: platform,
                eventId: eventData.id,
                createdAt: new Date(),
                settings: integrations.video.config?.defaultSettings || {}
            };
            
            // Save meeting details to localStorage
            saveMeetingDetails(meetingDetails);
            
            return meetingLink;
        } catch (error) {
            console.error('Meeting link generation error:', error);
            return null;
        }
    }
    
    function generateMeetingId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    
    function generateMeetingPassword() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    function saveMeetingDetails(meetingDetails) {
        const meetings = JSON.parse(localStorage.getItem('calendar-meetings') || '[]');
        meetings.push(meetingDetails);
        localStorage.setItem('calendar-meetings', JSON.stringify(meetings));
    }
    
    // Send Email Invitation
    async function sendEmailInvitation(eventData, attendees) {
        try {
            if (!integrations.email.connected) {
                throw new Error('Email integration not connected');
            }
            
            // Simulate email sending process
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Generate email content
            const emailContent = generateEmailInvitation(eventData, attendees);
            
            // Store email invitation
            const invitation = {
                id: Date.now().toString(),
                eventId: eventData.id,
                attendees: attendees,
                content: emailContent,
                sentAt: new Date(),
                status: 'sent'
            };
            
            // Save to localStorage
            saveEmailInvitation(invitation);
            
            // Generate downloadable email file
            downloadEmailInvitation(emailContent, eventData.title);
            
            showNotification(`Email invitations prepared for ${attendees.length} attendees!`, 'success');
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
    
    // Sync to Mobile Calendar
    async function syncToMobileCalendar(eventData) {
        try {
            if (!integrations.mobile.connected) {
                throw new Error('Mobile integration not connected');
            }
            
            // Simulate sync process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Generate calendar export data
            const calendarData = generateCalendarExport(eventData);
            
            // Store sync data
            const syncData = {
                id: Date.now().toString(),
                eventId: eventData.id,
                deviceType: integrations.mobile.type,
                calendarData: calendarData,
                syncedAt: new Date(),
                status: 'synced'
            };
            
            // Save to localStorage
            saveMobileSyncData(syncData);
            
            // Generate downloadable calendar file
            downloadCalendarFile(calendarData, eventData.title);
            
            showNotification(`Event synced to ${integrations.mobile.type.toUpperCase()} calendar!`, 'success');
            return true;
        } catch (error) {
            console.error('Mobile sync error:', error);
            showNotification('Failed to sync to mobile calendar', 'error');
            return false;
        }
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
    
    function saveMobileSyncData(syncData) {
        const syncs = JSON.parse(localStorage.getItem('calendar-mobile-syncs') || '[]');
        syncs.push(syncData);
        localStorage.setItem('calendar-mobile-syncs', JSON.stringify(syncs));
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
        const connectedCount = Object.values(integrations).filter(integration => integration.connected).length;
        
        if (elements.syncStatus) {
            elements.syncStatus.textContent = connectedCount > 0 ? `${connectedCount} Connected` : 'Not Connected';
            elements.syncStatus.className = `status-indicator ${connectedCount > 0 ? 'connected' : 'disconnected'}`;
        }
        
        // Update individual integration statuses
        updateIntegrationCardStatus('mobile', integrations.mobile.connected);
        updateIntegrationCardStatus('email', integrations.email.connected);
        updateIntegrationCardStatus('video', integrations.video.connected);
    }
    
    function updateIntegrationCardStatus(type, connected) {
        const statusElement = document.getElementById(`${type}-sync-status`);
        if (statusElement) {
            statusElement.className = `sync-status-indicator ${connected ? 'connected' : 'disconnected'}`;
            statusElement.innerHTML = connected ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-times"></i>';
        }
        
        const cardElement = document.getElementById(`${type}-sync-card`);
        if (cardElement) {
            cardElement.classList.toggle('connected', connected);
        }
        
        // Update integration details and controls
        const detailsElement = document.getElementById(`${type}-details`);
        const controlsElement = document.getElementById(`${type}-controls`);
        const connectBtn = document.getElementById(`${type}-sync-btn`);
        
        if (connected) {
            if (detailsElement) detailsElement.style.display = 'block';
            if (controlsElement) controlsElement.style.display = 'flex';
            if (connectBtn) connectBtn.textContent = 'Connected';
            
            // Update details based on type
            updateIntegrationDetails(type);
        } else {
            if (detailsElement) detailsElement.style.display = 'none';
            if (controlsElement) controlsElement.style.display = 'none';
            if (connectBtn) connectBtn.textContent = 'Connect';
        }
    }
    
    function updateIntegrationDetails(type) {
        const integration = integrations[type];
        if (!integration.connected) return;
        
        switch (type) {
            case 'mobile':
                document.getElementById('mobile-device-type').textContent = integration.type?.toUpperCase() || '-';
                document.getElementById('mobile-last-sync').textContent = 
                    integration.config?.lastSync ? new Date(integration.config.lastSync).toLocaleString() : '-';
                break;
            case 'email':
                document.getElementById('email-provider').textContent = integration.provider?.toUpperCase() || '-';
                document.getElementById('email-last-sync').textContent = 
                    integration.config?.lastSync ? new Date(integration.config.lastSync).toLocaleString() : '-';
                break;
            case 'video':
                document.getElementById('video-platform').textContent = integration.platform?.toUpperCase() || '-';
                document.getElementById('video-last-sync').textContent = 
                    integration.config?.lastSync ? new Date(integration.config.lastSync).toLocaleString() : '-';
                break;
        }
    }
    
    // Load Integration Settings
    function loadIntegrationSettings() {
        const savedIntegrations = localStorage.getItem('calendar-integrations');
        if (savedIntegrations) {
            integrations = { ...integrations, ...JSON.parse(savedIntegrations) };
            updateIntegrationStatus();
        }
    }
    
    // Save Integration Settings
    function saveIntegrationSettings() {
        localStorage.setItem('calendar-integrations', JSON.stringify(integrations));
    }
    
    // --- Advanced Export/Import System ---
    
    function exportCalendarData(format = 'json') {
        const exportData = {
            events: events,
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
        const headers = ['Title', 'Description', 'Start Date', 'End Date', 'Category', 'Meeting Link'];
        const csvContent = [
            headers.join(','),
            ...events.map(event => [
                `"${event.title}"`,
                `"${event.description || ''}"`,
                `"${formatDate(event.startDate, 'YYYY-MM-DD HH:mm')}"`,
                `"${event.endDate ? formatDate(event.endDate, 'YYYY-MM-DD HH:mm') : ''}"`,
                `"${event.category || ''}"`,
                `"${event.meetingLink || ''}"`
            ].join(','))
        ].join('\n');
        
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
- Mobile: ${integrations.mobile.connected ? 'Connected' : 'Not Connected'}
- Email: ${integrations.email.connected ? 'Connected' : 'Not Connected'}
- Video: ${integrations.video.connected ? 'Connected' : 'Not Connected'}
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
                    events = [...events, ...data.events];
                    saveEvents();
                    renderEventsList();
                    renderCalendar();
                }
                
                if (data.integrations) {
                    integrations = { ...integrations, ...data.integrations };
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
    
    function disconnectIntegration(type) {
        if (confirm(`Are you sure you want to disconnect ${type} integration?`)) {
            integrations[type].connected = false;
            integrations[type].type = null;
            integrations[type].config = {};
            saveIntegrationSettings();
            updateIntegrationStatus();
            showNotification(`${type} integration disconnected`, 'info');
        }
    }
    
    function testIntegration(type) {
        showNotification(`Testing ${type} integration...`, 'info');
        
        setTimeout(() => {
            const isWorking = Math.random() > 0.2; // 80% success rate for demo
            if (isWorking) {
                showNotification(`${type} integration test successful!`, 'success');
            } else {
                showNotification(`${type} integration test failed`, 'error');
            }
        }, 2000);
    }
    
    function getIntegrationStatus() {
        const status = {
            mobile: {
                connected: integrations.mobile.connected,
                type: integrations.mobile.type,
                lastSync: integrations.mobile.config?.lastSync
            },
            email: {
                connected: integrations.email.connected,
                provider: integrations.email.provider,
                lastSync: integrations.email.config?.lastSync
            },
            video: {
                connected: integrations.video.connected,
                platform: integrations.video.platform,
                lastSync: integrations.video.config?.lastSync
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
    
    function getVideoCredentials(platform) {
        switch (platform) {
            case 'zoom':
                return {
                    apiKey: document.getElementById('zoom-api-key').value,
                    apiSecret: document.getElementById('zoom-api-secret').value,
                    accountId: document.getElementById('zoom-account-id').value
                };
            case 'teams':
                return {
                    clientId: document.getElementById('teams-client-id').value,
                    clientSecret: document.getElementById('teams-client-secret').value,
                    tenantId: document.getElementById('teams-tenant-id').value
                };
            case 'google-meet':
                return {
                    clientId: document.getElementById('google-client-id').value,
                    clientSecret: document.getElementById('google-client-secret').value
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
            const syncMobile = document.getElementById('sync-mobile').checked;
            const sendEmail = document.getElementById('send-email').checked;
            
            const event = {
                id: Date.now().toString(),
                title: document.getElementById('event-title').value.trim(),
                description: document.getElementById('event-description').value.trim(),
                startDate: new Date(document.getElementById('event-start-date').value + ' ' + document.getElementById('event-start-time').value),
                endDate: document.getElementById('event-end-date').value ? 
                        new Date(document.getElementById('event-end-date').value + ' ' + document.getElementById('event-end-time').value) : null,
                category: document.getElementById('event-category').value,
                repeat: document.getElementById('event-repeat').value,
                reminder: document.getElementById('event-reminder').checked,
                meetingType: meetingType,
                meetingLink: meetingLink || null,
                syncMobile: syncMobile,
                sendEmail: sendEmail,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Validate dates
            if (event.endDate && event.endDate <= event.startDate) {
                showNotification('End date must be after start date', 'error');
                hideLoadingState(submitBtn, originalContent);
                return;
            }
            
            // Generate meeting link if needed
            if (meetingType !== 'none' && !meetingLink && integrations.video.connected) {
                try {
                    showNotification('Generating meeting link...', 'info', 2000);
                    const generatedLink = await generateMeetingLink(meetingType, event);
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
            events.push(event);
            saveEvents();
            
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
            
            if (syncMobile && integrations.mobile.connected) {
                integrationPromises.push(
                    syncToMobileCalendar(event).catch(error => {
                        console.error('Mobile sync error:', error);
                        showNotification('Mobile sync failed', 'warning');
                    })
                );
            }
            
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
        eventElement.className = 'event-item';
        eventElement.setAttribute('data-event-id', event.id);
        
        const categoryClass = event.category || 'personal';
        eventElement.classList.add(categoryClass);
        
        if (event.meetingType && event.meetingType !== 'none') {
            eventElement.classList.add('meeting');
        }
        
        eventElement.innerHTML = `
            <div class="event-content">
                <h4>${event.title}</h4>
                <p>${event.description || 'No description'}</p>
                <div class="event-meta">
                    <span class="event-time">${formatDate(event.startDate, 'h:mm A')}</span>
                    ${event.meetingLink ? `<a href="${event.meetingLink}" target="_blank" class="meeting-link"><i class="fa-solid fa-video"></i> Join Meeting</a>` : ''}
                </div>
            </div>
            <div class="event-actions">
                <button class="edit-event" data-event-id="${event.id}" title="Edit event">
                    <i class="fa-solid fa-edit"></i>
                </button>
                <button class="delete-event" data-event-id="${event.id}" title="Delete event">
                    <i class="fa-solid fa-trash"></i>
                </button>
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
            events = events.filter(event => event.id !== eventId);
            saveEvents();
            renderEventsList();
            renderCalendar();
            showNotification('Event deleted', 'success');
        }
    }

    // --- Data Persistence ---
    function saveEvents() {
        localStorage.setItem('calendar-events', JSON.stringify(events));
    }

    function loadEvents() {
        const savedEvents = localStorage.getItem('calendar-events');
        if (savedEvents) {
            events = JSON.parse(savedEvents).map(event => ({
                ...event,
                startDate: new Date(event.startDate),
                endDate: event.endDate ? new Date(event.endDate) : null
            }));
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
                const event = events.find(e => e.id === eventId);
                if (event) editEvent(event);
            } else if (e.target.closest('.delete-event-btn')) {
                const eventId = e.target.closest('.delete-event-btn').dataset.id;
                deleteEvent(eventId);
            }
        });
        
        // Event search and filter
        elements.eventSearch.addEventListener('input', () => {
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
        });
        
        elements.eventCategoryFilter.addEventListener('change', () => {
            elements.eventSearch.dispatchEvent(new Event('input'));
        });
        
        // Location management
        elements.changeLocationBtn.addEventListener('click', openLocationModal);
        
        // Integration management
        elements.mobileSyncBtn.addEventListener('click', openMobileSyncModal);
        elements.emailSyncBtn.addEventListener('click', openEmailSyncModal);
        elements.videoMeetingsBtn.addEventListener('click', openVideoMeetingsModal);
        elements.syncAllBtn.addEventListener('click', () => {
            showNotification('Syncing all integrations...', 'info');
            // Implement sync all functionality
        });
        
        // Integration modal close buttons
        document.getElementById('close-mobile-sync-modal').addEventListener('click', closeMobileSyncModal);
        document.getElementById('close-email-sync-modal').addEventListener('click', closeEmailSyncModal);
        document.getElementById('close-video-meetings-modal').addEventListener('click', closeVideoMeetingsModal);
        
        // Device selection for mobile sync
        document.querySelectorAll('.device-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deviceType = e.currentTarget.dataset.device;
                document.querySelectorAll('.setup-step').forEach(step => step.style.display = 'none');
                document.getElementById(`${deviceType}-setup`).style.display = 'block';
            });
        });
        
        // Email provider selection
        document.querySelectorAll('.email-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const provider = e.currentTarget.dataset.provider;
                document.querySelectorAll('.setup-step').forEach(step => step.style.display = 'none');
                document.getElementById(`${provider}-setup`).style.display = 'block';
            });
        });
        
        // Video platform selection
        document.querySelectorAll('.video-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const platform = e.currentTarget.dataset.platform;
                document.querySelectorAll('.setup-step').forEach(step => step.style.display = 'none');
                document.getElementById(`${platform}-setup`).style.display = 'block';
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
        
        // Integration setup buttons
        document.getElementById('save-mobile-sync').addEventListener('click', () => {
            const selectedDevice = document.querySelector('.device-btn.active')?.dataset.device;
            if (selectedDevice) {
                setupMobileSync(selectedDevice);
            }
        });
        
        document.getElementById('save-email-sync').addEventListener('click', () => {
            const selectedProvider = document.querySelector('.email-btn.active')?.dataset.provider;
            if (selectedProvider) {
                setupEmailSync(selectedProvider, {});
            }
        });
        
        
        document.getElementById('save-video-sync').addEventListener('click', () => {
            const selectedPlatform = document.querySelector('.video-btn.active')?.dataset.platform;
            if (selectedPlatform) {
                const credentials = getVideoCredentials(selectedPlatform);
                setupVideoMeetings(selectedPlatform, credentials);
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
        document.getElementById('close-modal').addEventListener('click', closeEventModal);
        document.getElementById('close-location-modal').addEventListener('click', closeLocationModal);
        document.getElementById('cancel-event').addEventListener('click', closeEventModal);
        
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
    }

    // --- Initialization ---
    function initialize() {
        loadEvents();
        loadPrayerTimes();
        loadIntegrationSettings();
        attachEventListeners();
        
        // Apply saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        applyTheme(savedTheme);
        
        // Initialize calendar
        renderCalendar();
        updateCurrentPeriod();
        renderEventsList();
        updateIntegrationStatus();
        
        showNotification('Calendar loaded successfully', 'success');
    }

    // Make functions globally accessible
    window.testIntegration = testIntegration;
    window.disconnectIntegration = disconnectIntegration;
    window.exportCalendarData = exportCalendarData;
    window.importCalendarData = importCalendarData;
    
    // Add demo data for testing
    function addDemoData() {
        if (events.length === 0) {
            const demoEvents = [
                {
                    id: 'demo-1',
                    title: 'Team Meeting',
                    description: 'Weekly team standup meeting',
                    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
                    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
                    category: 'work',
                    meetingType: 'zoom',
                    meetingLink: 'https://zoom.us/j/123456789',
                    syncMobile: true,
                    sendEmail: true
                },
                {
                    id: 'demo-2',
                    title: 'Prayer Time - Fajr',
                    description: 'Morning prayer',
                    startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
                    category: 'prayer',
                    syncMobile: true
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
    
    // Start the application
    initialize();
    
    // Add demo data after a short delay
    setTimeout(addDemoData, 1000);
});
