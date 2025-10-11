// ==========================
// Modern Islamic Calendar - JavaScript Integration
// ==========================

// Prevent double initialization
(function() {
    if (window.__calendarInit) return;
    window.__calendarInit = true;

    // Global state
    let currentDate = new Date();
    let currentView = 'month';
    let calendarEvents = window.calendarEvents || [];
    
    // Constants
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

    // ==========================
    // Utility Functions
    // ==========================
    
    function toDate(x) {
        if (!x) return null;
        try {
            if (x instanceof Date) return x;
            if (typeof x === 'number') return new Date(x);
            if (typeof x === 'object' && x.date) return new Date(`${x.date}${x.time ? 'T' + x.time : ''}`);
            return new Date(x);
        } catch { 
            return null; 
        }
    }

    function isSameDay(a, b) {
        return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    function getHijriDate(date) {
        // Simple Hijri date conversion (placeholder - integrate with proper hijri.js later)
        const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الآخرة',
                           'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
        const day = date.getDate();
        const month = date.getMonth();
        const hijriDay = Math.max(1, day - 10); // Rough approximation
        const hijriMonth = hijriMonths[month] || hijriMonths[0];
        return `${hijriDay} ${hijriMonth}`;
    }

    // ==========================
    // Calendar Rendering
    // ==========================
    
    function renderCalendar() {
        const monthGrid = document.getElementById('month-grid');
        if (!monthGrid) return;

        monthGrid.innerHTML = '';
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // Generate 42 days (6 weeks)
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dayElement = createDayElement(date);
            monthGrid.appendChild(dayElement);
        }

        updatePeriodLabel();
        renderSidebar();
    }

    function createDayElement(date) {
        const dayElement = document.createElement('div');
        dayElement.className = 'day';
        dayElement.dataset.date = date.toISOString().split('T')[0];
        dayElement.setAttribute('tabindex', '0');
        dayElement.setAttribute('role', 'gridcell');
        dayElement.setAttribute('aria-label', `Date ${date.toLocaleDateString()}`);

        // Gregorian date number
        const gNum = document.createElement('div');
        gNum.className = 'g-num';
        gNum.textContent = date.getDate();
        dayElement.appendChild(gNum);

        // Hijri date
        const hNum = document.createElement('div');
        hNum.className = 'h-num';
        hNum.textContent = getHijriDate(date);
        dayElement.appendChild(hNum);

        // Add today ring if it's today
        if (isSameDay(date, new Date())) {
            const todayRing = document.createElement('div');
            todayRing.className = 'today-ring';
            dayElement.appendChild(todayRing);
        }

        // Events container
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'events';

        // Add events for this day
        const dayEvents = calendarEvents.filter(event => {
            const eventDate = toDate(event.startDate || event.start);
            return isSameDay(eventDate, date);
        });

        // Create event pills
        dayEvents.forEach(event => {
            const eventPill = document.createElement('div');
            eventPill.className = 'event-pill';
            eventPill.dataset.id = event.id || event.title.toLowerCase().replace(/\s+/g, '-');

            // Category indicator
            const cat = document.createElement('span');
            cat.className = `cat ${event.category || 'personal'}`;
            eventPill.appendChild(cat);

            // Event title
            const title = document.createElement('strong');
            title.textContent = event.title;
            eventPill.appendChild(title);

            eventsContainer.appendChild(eventPill);
        });

        dayElement.appendChild(eventsContainer);
        return dayElement;
    }

    function updatePeriodLabel() {
        const periodLabel = document.getElementById('period-label');
        if (!periodLabel) return;

        let label = '';
        switch (currentView) {
            case 'month':
                label = currentDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                });
                break;
            case 'week':
                const weekStart = new Date(currentDate);
                weekStart.setDate(currentDate.getDate() - currentDate.getDay());
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                label = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                break;
            case 'day':
                label = currentDate.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                });
                break;
            case 'year':
                label = currentDate.getFullYear().toString();
                break;
        }
        periodLabel.textContent = label;
    }

    // ==========================
    // Sidebar Functions
    // ==========================
    
    function renderSidebar() {
        updateTodayList();
        updatePrayerTimes();
        updateTodayLabel();
        updateTimezoneLabel();
    }

    function updateTodayList() {
        const todayList = document.getElementById('today-list');
        if (!todayList) return;

        const today = new Date();
        const todayEvents = calendarEvents.filter(event => {
            const eventDate = toDate(event.startDate || event.start);
            return isSameDay(eventDate, today);
        });

        todayList.innerHTML = '';

        if (todayEvents.length === 0) {
            todayList.innerHTML = '<div class="item"><div>No events today</div></div>';
            return;
        }

        todayEvents.forEach(event => {
            const listItem = document.createElement('div');
            listItem.className = 'item';

            const time = event.startTime ? event.startTime : 'All day';
            const category = event.category || 'personal';

            listItem.innerHTML = `
                <div class="time">${time}</div>
                <div>
                    <div style="font-weight:700;">${event.title}</div>
                    <div class="meta">${category}</div>
                </div>
            `;

            todayList.appendChild(listItem);
        });
    }

    function updatePrayerTimes() {
        const prayerTimes = document.getElementById('prayer-times');
        if (!prayerTimes) return;

        // Sample prayer times (replace with actual calculation)
        const times = {
            'Fajr': '05:30',
            'Sunrise': '06:45',
            'Dhuhr': '12:15',
            'Asr': '15:30',
            'Maghrib': '18:20',
            'Isha': '19:45'
        };

        Object.entries(times).forEach(([prayer, time]) => {
            const prayerElement = prayerTimes.querySelector(`[data-prayer="${prayer.toLowerCase()}"]`);
            if (prayerElement) {
                const timeElement = prayerElement.querySelector('.prayer-time-value');
                if (timeElement) {
                    timeElement.textContent = time;
                }
            }
        });
    }

    function updateTodayLabel() {
        const todayLabel = document.getElementById('today-label');
        if (!todayLabel) return;

        const today = new Date();
        const label = today.toLocaleDateString('en-US', { 
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        todayLabel.textContent = label;
    }

    function updateTimezoneLabel() {
        const tzLabel = document.getElementById('tz-label');
        if (!tzLabel) return;

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dubai';
        tzLabel.textContent = timezone;
    }

    // ==========================
    // Navigation Functions
    // ==========================
    
    function navigateCalendar(direction) {
        switch (currentView) {
            case 'month':
                currentDate.setMonth(currentDate.getMonth() + direction);
                break;
            case 'week':
                currentDate.setDate(currentDate.getDate() + (direction * 7));
                break;
            case 'day':
                currentDate.setDate(currentDate.getDate() + direction);
                break;
            case 'year':
                currentDate.setFullYear(currentDate.getFullYear() + direction);
                break;
        }
        renderCalendar();
    }

    function switchToView(view) {
        currentView = view;
        
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        const activeButton = document.querySelector(`[data-view="${view}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }

        renderCalendar();
    }

    function goToToday() {
        currentDate = new Date();
        renderCalendar();
    }

    // ==========================
    // Modal Functions
    // ==========================
    
    function openModal(modalName) {
        const modal = document.getElementById(`${modalName}-modal`);
        if (modal) {
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            
            // Focus management
            const firstFocusable = modal.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }
    }

    function closeModal(modalName) {
        const modal = document.getElementById(`${modalName}-modal`);
        if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    }

    function openDayModal(date) {
        const modal = document.getElementById('day-modal');
        const dayEventsList = document.getElementById('day-events-list');
        const dayTitle = document.getElementById('day-title');

        if (modal && dayEventsList) {
            // Update modal title
            if (dayTitle) {
                const fmt = new Intl.DateTimeFormat(undefined, { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                dayTitle.textContent = `Events on ${fmt.format(date)}`;
            }

            // Populate day events
            const dayEvents = calendarEvents.filter(event => {
                const eventDate = toDate(event.startDate || event.start);
                return isSameDay(eventDate, date);
            });

            dayEventsList.innerHTML = '';

            if (dayEvents.length === 0) {
                const li = document.createElement('li');
                li.innerHTML = '<div>No events for this day.</div>';
                dayEventsList.appendChild(li);
            } else {
                dayEvents.forEach(event => {
                    const li = document.createElement('li');
                    const id = event.id || event._id || event.uuid || 'unknown';
                    const title = event.title || event.name || '(untitled)';
                    
                    li.innerHTML = `
                        <div>
                            <div style="font-weight:700;">${title}</div>
                            <div class="meta">ID: ${id}</div>
                        </div>
                        <div>
                            <button class="btn ghost small" data-action="edit" data-id="${id}">Edit</button>
                            <button class="btn ghost small danger" data-action="delete" data-id="${id}">Delete</button>
                        </div>
                    `;
                    dayEventsList.appendChild(li);
                });
            }

            openModal('day');
        }
    }

    // ==========================
    // Theme Functions
    // ==========================
    
    function switchTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update theme buttons
        document.querySelectorAll('.toggle button').forEach(btn => btn.classList.remove('active'));
        const activeButton = document.getElementById(`theme-${theme}`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    // ==========================
    // Event Listeners
    // ==========================
    
    function setupEventListeners() {
        // Navigation
        const prevButton = document.getElementById('prev-button');
        const nextButton = document.getElementById('next-button');
        const todayButton = document.getElementById('go-today');

        if (prevButton) {
            prevButton.addEventListener('click', () => navigateCalendar(-1));
        }
        if (nextButton) {
            nextButton.addEventListener('click', () => navigateCalendar(1));
        }
        if (todayButton) {
            todayButton.addEventListener('click', goToToday);
        }

        // View toggles
        document.querySelectorAll('.view-btn').forEach(button => {
            button.addEventListener('click', () => {
                const view = button.dataset.view;
                switchToView(view);
            });
        });

        // Calendar type
        const calendarType = document.getElementById('calendarType');
        if (calendarType) {
            calendarType.addEventListener('change', (e) => {
                localStorage.setItem('calendarType', e.target.value);
                renderCalendar();
            });
        }

        // Theme switching
        const themeDark = document.getElementById('theme-dark');
        const themeLight = document.getElementById('theme-light');

        if (themeDark) {
            themeDark.addEventListener('click', () => switchTheme('dark'));
        }
        if (themeLight) {
            themeLight.addEventListener('click', () => switchTheme('light'));
        }

        // Modals
        const openOccasions = document.getElementById('open-occasions');
        const openReminders = document.getElementById('open-reminders');
        const quickOccasions = document.getElementById('quick-occasions');
        const quickReminders = document.getElementById('quick-reminders');

        if (openOccasions) {
            openOccasions.addEventListener('click', () => openModal('occasions'));
        }
        if (openReminders) {
            openReminders.addEventListener('click', () => openModal('reminders'));
        }
        if (quickOccasions) {
            quickOccasions.addEventListener('click', () => openModal('occasions'));
        }
        if (quickReminders) {
            quickReminders.addEventListener('click', () => openModal('reminders'));
        }

        // Close modals
        document.addEventListener('click', (e) => {
            const closeId = e.target.getAttribute('data-close');
            if (closeId) {
                closeModal(closeId);
            }
        });

        // Day clicks
        document.getElementById('month-grid')?.addEventListener('click', (e) => {
            const cell = e.target.closest('.day');
            if (!cell) return;
            const date = toDate(cell.dataset.date);
            if (date) {
                openDayModal(date);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
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
                case 'Escape':
                    // Close any open modals
                    document.querySelectorAll('.modal.open').forEach(modal => {
                        const modalName = modal.id.replace('-modal', '');
                        closeModal(modalName);
                    });
                    break;
            }
        });

        // Day keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.target.classList.contains('day')) {
                switch (e.key) {
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        const date = toDate(e.target.dataset.date);
                        if (date) {
                            openDayModal(date);
                        }
                        break;
                }
            }
        });
    }

    // ==========================
    // Initialization
    // ==========================
    
    function initialize() {
        // Load saved preferences
        const savedTheme = localStorage.getItem('theme') || 'dark';
        switchTheme(savedTheme);

        const savedCalendarType = localStorage.getItem('calendarType') || 'both';
        const calendarTypeSelect = document.getElementById('calendarType');
        if (calendarTypeSelect) {
            calendarTypeSelect.value = savedCalendarType;
        }

        // Setup event listeners
        setupEventListeners();

        // Initial render
        renderCalendar();

        console.log('🎉 Modern Islamic Calendar initialized successfully!');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Expose functions globally for integration
    window.calendarAPI = {
        renderCalendar,
        switchToView,
        navigateCalendar,
        goToToday,
        openModal,
        closeModal,
        switchTheme,
        addEvent: (event) => {
            calendarEvents.push(event);
            renderCalendar();
        },
        removeEvent: (id) => {
            calendarEvents = calendarEvents.filter(e => e.id !== id);
            renderCalendar();
        }
    };

})();