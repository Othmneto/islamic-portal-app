/* Islamic Calendar - Full Integration
   — Wired to real backend APIs
   — Event CRUD, Islamic overlays, OAuth sync
   — Month/Week/Day/Year views
*/

// ===== STATE =====
const CalendarState = {
  currentView: 'month',
  currentDate: new Date(),
  events: [],
  renderer: null,
  api: null,
  location: null,
  integrationStatus: null,
  isLoading: false
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Calendar] Initializing...');
  
  // Note: Authentication is handled by the backend API
  // The calendar page is accessible, but API calls will require auth
  // This allows the page to load and show appropriate UI based on auth status
  
  // Wait for API to be ready
  if (!window.calendarAPI) {
    console.error('[Calendar] CalendarAPI not loaded!');
    return;
  }
  
  CalendarState.api = window.calendarAPI;
  CalendarState.renderer = new window.CalendarRenderers();
  
  // Get user location
  CalendarState.location = CalendarState.api.getUserLocation();
  console.log('[Calendar] Location:', CalendarState.location);
  
  // Setup UI
  setupTheme();
  setupViewSwitcher();
  setupNavigation();
  setupModals();
  setupOAuthButtons();
  setupKeyboardShortcuts();
  setupGlobalSearch();
  
  // Load data and render
  await loadAndRender();
  
  // Update OAuth status
  await updateOAuthStatus();
  
  // Update Hijri date
  await updateCurrentHijri();
  
  console.log('[Calendar] Initialization complete');
});

// ===== THEME =====
function setupTheme() {
const html = document.documentElement;
  const darkBtn = document.getElementById('theme-dark');
  const lightBtn = document.getElementById('theme-light');

  if (darkBtn) {
    darkBtn.addEventListener('click', () => {
      html.setAttribute('data-theme', 'dark');
      darkBtn.classList.add('active');
      if (lightBtn) lightBtn.classList.remove('active');
      localStorage.setItem('theme', 'dark');
    });
  }
  
  if (lightBtn) {
    lightBtn.addEventListener('click', () => {
      html.setAttribute('data-theme', 'light');
      lightBtn.classList.add('active');
      if (darkBtn) darkBtn.classList.remove('active');
      localStorage.setItem('theme', 'light');
    });
  }
  
  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);
  if (savedTheme === 'dark' && darkBtn) darkBtn.classList.add('active');
  if (savedTheme === 'light' && lightBtn) lightBtn.classList.add('active');
}

// ===== VIEW SWITCHING =====
function setupViewSwitcher() {
  const viewButtons = document.querySelectorAll('.view-btn');
  
  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      if (view) {
        switchView(view);
        
        // Update active state
        viewButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
    });
  });
}

function switchView(view) {
  CalendarState.currentView = view;
  console.log('[Calendar] Switching to view:', view);
  render();
}

// ===== NAVIGATION =====
function setupNavigation() {
  const prevBtn = document.getElementById('prev-button');
  const nextBtn = document.getElementById('next-button');
  const todayBtn = document.getElementById('go-today');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => navigatePeriod(-1));
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => navigatePeriod(1));
  }
  
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      CalendarState.currentDate = new Date();
      loadAndRender();
    });
  }
}

function navigatePeriod(direction) {
  const date = CalendarState.currentDate;
  
  switch (CalendarState.currentView) {
    case 'month':
      date.setMonth(date.getMonth() + direction);
      break;
    case 'week':
      date.setDate(date.getDate() + (direction * 7));
      break;
    case 'day':
      date.setDate(date.getDate() + direction);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() + direction);
      break;
  }
  
  loadAndRender();
}

// ===== DATA LOADING & RENDERING =====
async function loadAndRender() {
  if (CalendarState.isLoading) return;
  
  CalendarState.isLoading = true;
  showLoading();
  
  try {
    await loadMonthData();
    render();
    await loadTodayPanel();
  } catch (error) {
    console.error('[Calendar] Error loading data:', error);
    showError('Failed to load calendar data');
  } finally {
    CalendarState.isLoading = false;
    hideLoading();
  }
}

async function loadMonthData() {
  const year = CalendarState.currentDate.getFullYear();
  const month = CalendarState.currentDate.getMonth() + 1;
  const { lat, lon, tz, country } = CalendarState.location;
  const prefs = CalendarState.api.getPrayerPreferences();
  
  console.log('📅 [Calendar] ========== LOADING MONTH DATA ==========');
  console.log('📅 [Calendar] Date:', year, month);
  console.log('📅 [Calendar] Location:', { lat, lon, tz, country });
  console.log('📅 [Calendar] Prayer prefs:', prefs);
  
  // Load all data in parallel
  console.log('📅 [Calendar] Starting parallel data fetch...');
  const [userEvents, islamicEvents, prayerTimes] = await Promise.all([
    CalendarState.api.getUserEvents(),
    CalendarState.api.getMonthlyIslamicEvents(year, month, lat, lon, country),
    CalendarState.api.getMonthlyPrayerTimes(year, month, lat, lon, tz, prefs.method, prefs.madhab)
  ]);
  
  console.log('✅ [Calendar] All data loaded successfully');
  
  // Filter out Islamic/Prayer events from user events (we'll generate them fresh)
  const pureUserEvents = userEvents.filter(event => 
    !event.isIslamicEvent && 
    !event.prayerName && 
    event.category !== 'prayer' && 
    event.category !== 'holiday'
  );
  
  console.log('📊 [Calendar] Data summary:', {
    totalUserEvents: userEvents.length,
    pureUserEvents: pureUserEvents.length,
    filteredOutIslamicEvents: userEvents.length - pureUserEvents.length,
    holidays: islamicEvents.holidays?.length || 0,
    prayerDays: prayerTimes.days?.length || 0,
    totalPrayerEvents: (prayerTimes.days?.length || 0) * 5 // 5 prayers per day
  });
  
  // Merge all events
  console.log('📅 [Calendar] Converting and merging events...');
  const islamicHolidayEvents = convertIslamicHolidaysToEvents(islamicEvents.holidays || []);
  const prayerEvents = convertPrayerTimesToEvents(prayerTimes.days || []);
  
  console.log('📅 [Calendar] Converted:', {
    islamicHolidayEvents: islamicHolidayEvents.length,
    prayerEvents: prayerEvents.length
  });
  
  // Merge and deduplicate by ID and by date+title
  const allEventsWithDuplicates = [
    ...pureUserEvents, // Use filtered user events
    ...islamicHolidayEvents,
    ...prayerEvents
  ];
  
  // Advanced deduplication: by ID and by date+title+category
  const eventMap = new Map();
  allEventsWithDuplicates.forEach(event => {
    const dateKey = new Date(event.startDate).toISOString().split('T')[0];
    const uniqueKey = `${event.id || ''}-${dateKey}-${event.title}-${event.category || ''}`;
    
    if (!eventMap.has(event.id) && !eventMap.has(uniqueKey)) {
      eventMap.set(event.id, event);
      eventMap.set(uniqueKey, event);
    }
  });
  
  // Extract unique events only (remove the duplicate keys)
  const uniqueEvents = new Set();
  allEventsWithDuplicates.forEach(event => {
    const dateKey = new Date(event.startDate).toISOString().split('T')[0];
    const uniqueKey = `${event.id || ''}-${dateKey}-${event.title}-${event.category || ''}`;
    if (eventMap.get(event.id) === event || eventMap.get(uniqueKey) === event) {
      uniqueEvents.add(event);
    }
  });
  
  const allEvents = Array.from(uniqueEvents);
  
  console.log(`✅ [Calendar] Total events before dedup: ${allEventsWithDuplicates.length}`);
  console.log(`✅ [Calendar] Total events after dedup: ${allEvents.length}`);
  console.log(`📊 [Calendar] Removed ${allEventsWithDuplicates.length - allEvents.length} duplicates`);
  
  CalendarState.events = allEvents;
  CalendarState.renderer.setEvents(allEvents);
  
  // Update global for compatibility
  window.calendarEvents = allEvents;
  console.log('📅 [Calendar] ========== MONTH DATA LOADED ==========');
}

function convertIslamicHolidaysToEvents(holidays) {
  return holidays.map(holiday => ({
    id: `holiday-${holiday.date}`,
    title: holiday.name,
    description: holiday.nameAr || '',
    startDate: new Date(holiday.date),
    endDate: new Date(holiday.date),
    category: 'holiday',
    isIslamicEvent: true,
    type: holiday.type,
    country: holiday.country
  }));
}

function convertPrayerTimesToEvents(days) {
  const events = [];
  const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  
  days.forEach(day => {
    prayerNames.forEach(prayer => {
      if (day.times && day.times[prayer]) {
        events.push({
          id: `prayer-${day.date}-${prayer}`,
          title: `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} Prayer`,
          startDate: new Date(day.times[prayer]),
          endDate: new Date(new Date(day.times[prayer]).getTime() + 30 * 60000),
          category: 'prayer',
          isIslamicEvent: true,
          prayerName: prayer
        });
      }
    });
  });
  
  return events;
}

function render() {
  console.log('🎨 [Calendar] Rendering view:', CalendarState.currentView);
  
  const container = document.getElementById('month-grid');
  if (!container) {
    console.error('❌ [Calendar] Container #month-grid not found!');
    return;
  }
  
  const year = CalendarState.currentDate.getFullYear();
  const month = CalendarState.currentDate.getMonth() + 1;
  
  console.log('🎨 [Calendar] Rendering', CalendarState.currentView, 'view for', year, month);
  console.log('🎨 [Calendar] Total events to render:', CalendarState.events.length);
  
  // Update container class based on view
  container.className = '';
  switch (CalendarState.currentView) {
    case 'month':
      container.className = 'month-grid';
      CalendarState.renderer.renderMonth(container, year, month);
      break;
    case 'week':
      // Use internal week containers; avoid assigning grid class to outer container
      container.className = '';
      CalendarState.renderer.renderWeek(container, CalendarState.currentDate);
      break;
    case 'day':
      // Use internal day containers; avoid assigning class to outer container
      container.className = '';
      CalendarState.renderer.renderDay(container, CalendarState.currentDate);
      break;
    case 'year':
      container.className = 'year-grid';
      CalendarState.renderer.renderYear(container, year);
      break;
  }
  
  console.log('✅ [Calendar] View rendered');
  
  // Update period label
  const periodLabel = document.getElementById('period-label');
  CalendarState.renderer.updatePeriodLabel(periodLabel, CalendarState.currentView, CalendarState.currentDate);
  
  // Setup day click handlers
  setupDayClickHandlers();
  console.log('✅ [Calendar] Day click handlers setup');
}

function setupDayClickHandlers() {
  const days = document.querySelectorAll('.day[data-date]');
  
  days.forEach(day => {
    day.addEventListener('click', (e) => {
      const dateStr = day.getAttribute('data-date');
      if (dateStr) {
        openDayModal(new Date(dateStr));
      }
    });
  });
}

// ===== TODAY PANEL =====
async function loadTodayPanel() {
  const todayList = document.getElementById('today-list');
  const todayLabel = document.getElementById('today-label');
  
  if (!todayList) return;
  
  const today = new Date();
  
  // Update the today label with current date
  if (todayLabel) {
    const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
    todayLabel.textContent = today.toLocaleDateString('en-US', options).replace(',', ' •');
  }
  
  const todayEvents = CalendarState.renderer.getEventsForDate(today);
  
  // Sort by time
  todayEvents.sort((a, b) => {
    const aTime = new Date(a.startDate || a.start).getTime();
    const bTime = new Date(b.startDate || b.start).getTime();
    return aTime - bTime;
  });
  
  todayList.innerHTML = '';
  
  if (todayEvents.length === 0) {
    todayList.innerHTML = '<div style="color: var(--muted); padding: 1rem; text-align: center;">No events today</div>';
    return;
  }
  
  todayEvents.slice(0, 5).forEach(event => {
    const time = CalendarState.renderer.formatTime(event.startDate || event.start);
    const catClass = CalendarState.renderer.getCategoryClass(event);
    
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <div class="time">${time}</div>
      <div>
        <div style="font-weight:700;">${event.title}</div>
        <div class="meta"><span class="cat ${catClass}"></span>${event.category || ''}</div>
      </div>
    `;
    todayList.appendChild(item);
  });
}

// ===== EVENT CLICK HANDLER =====
window.handleEventClick = function(element) {
  try {
    console.log('🖱️ [Calendar] Event clicked:', element);
    const eventId = element.getAttribute('data-event-id');
    const eventJson = element.getAttribute('data-event-json');
    
    if (!eventJson) {
      console.warn('⚠️ [Calendar] No event data found');
      return;
    }
    
    const eventData = JSON.parse(eventJson);
    console.log('📋 [Calendar] Opening event for edit:', eventData);
    
    // Open event modal in edit mode
    if (window.eventModal) {
      window.eventModal.openModal(eventData);
    } else {
      console.error('❌ [Calendar] Event modal not initialized');
    }
  } catch (error) {
    console.error('❌ [Calendar] Error handling event click:', error);
  }
};

// ===== OAUTH SYNC =====
function setupOAuthSync() {
  console.log('🔗 [Calendar] Setting up OAuth sync');
  
  // Google sync button
  const googleSyncBtn = document.getElementById('google-sync-btn');
  if (googleSyncBtn) {
    googleSyncBtn.addEventListener('click', async () => {
      try {
        console.log('🔄 [Calendar] Starting Google sync');
        googleSyncBtn.textContent = 'Syncing...';
        googleSyncBtn.disabled = true;
        
        const result = await window.calendarAPI.syncGoogle();
        
        console.log('✅ [Calendar] Google sync completed:', result);
        showNotification('Google Calendar synced successfully!', 'success');
        
        // Refresh calendar
        if (window.CalendarState && window.CalendarState.render) {
          window.CalendarState.render();
        }
      } catch (error) {
        console.error('❌ [Calendar] Google sync error:', error);
        showNotification('Google sync failed: ' + error.message, 'error');
      } finally {
        googleSyncBtn.textContent = 'Sync';
        googleSyncBtn.disabled = false;
      }
    });
  }

  // Microsoft sync button
  const microsoftSyncBtn = document.getElementById('microsoft-sync-btn');
  if (microsoftSyncBtn) {
    microsoftSyncBtn.addEventListener('click', async () => {
      try {
        console.log('🔄 [Calendar] Starting Microsoft sync');
        microsoftSyncBtn.textContent = 'Syncing...';
        microsoftSyncBtn.disabled = true;
        
        const result = await window.calendarAPI.syncMicrosoft();
        
        console.log('✅ [Calendar] Microsoft sync completed:', result);
        showNotification('Microsoft Calendar synced successfully!', 'success');
        
        // Refresh calendar
        if (window.CalendarState && window.CalendarState.render) {
          window.CalendarState.render();
        }
      } catch (error) {
        console.error('❌ [Calendar] Microsoft sync error:', error);
        showNotification('Microsoft sync failed: ' + error.message, 'error');
      } finally {
        microsoftSyncBtn.textContent = 'Sync';
        microsoftSyncBtn.disabled = false;
      }
    });
  }

  // Load OAuth status on page load
  loadOAuthStatus();
}

async function loadOAuthStatus() {
  try {
    console.log('🔗 [Calendar] Loading OAuth status');
    const status = await window.calendarAPI.getIntegrationStatus();
    
    // Update Google status
    const googleStatus = document.getElementById('oauth-google-status');
    const googleSyncBtn = document.getElementById('google-sync-btn');
    if (googleStatus && googleSyncBtn) {
      if (status.google && status.google.connected) {
        googleStatus.classList.remove('disconnected');
        googleStatus.classList.add('connected');
        googleSyncBtn.style.display = 'inline-block';
        googleSyncBtn.textContent = 'Sync';
      } else {
        googleStatus.classList.remove('connected');
        googleStatus.classList.add('disconnected');
        googleSyncBtn.style.display = 'none';
      }
    }

    // Update Microsoft status
    const microsoftStatus = document.getElementById('oauth-microsoft-status');
    const microsoftSyncBtn = document.getElementById('microsoft-sync-btn');
    if (microsoftStatus && microsoftSyncBtn) {
      if (status.microsoft && status.microsoft.connected) {
        microsoftStatus.classList.remove('disconnected');
        microsoftStatus.classList.add('connected');
        microsoftSyncBtn.style.display = 'inline-block';
        microsoftSyncBtn.textContent = 'Sync';
      } else {
        microsoftStatus.classList.remove('connected');
        microsoftStatus.classList.add('disconnected');
        microsoftSyncBtn.style.display = 'none';
      }
    }

    console.log('✅ [Calendar] OAuth status loaded:', status);
  } catch (error) {
    console.error('❌ [Calendar] Error loading OAuth status:', error);
  }
}

// ===== TODAY PANEL =====
function setupTodayPanel() {
  console.log('📅 [Calendar] Setting up today panel');
  
  // Refresh button
  const refreshBtn = document.getElementById('refresh-today');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadTodayPanel();
    });
  }

  // Load today panel on page load
  loadTodayPanel();
  
  // Update time every minute
  setInterval(updateCurrentTime, 60000);
}

async function loadTodayPanel() {
  try {
    console.log('📅 [Calendar] Loading today panel');
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Update date display
    updateTodayDate(today);
    
    // Load prayer times for today
    await loadTodayPrayerTimes(todayStr);
    
    // Load today's events
    await loadTodayEvents(todayStr);
    
    // Load upcoming events
    await loadUpcomingEvents(todayStr);
    
    console.log('✅ [Calendar] Today panel loaded');
  } catch (error) {
    console.error('❌ [Calendar] Error loading today panel:', error);
  }
}

function updateTodayDate(date) {
  console.log('📅 [Calendar] Updating today date:', date);
  
  const todayDate = document.getElementById('today-date');
  const todayDayName = document.getElementById('today-day-name');
  const todayHijri = document.getElementById('today-hijri');
  const todayHijriDay = document.getElementById('today-hijri-day');
  const todayTime = document.getElementById('today-time');
  const todayTimezone = document.getElementById('today-timezone');
  
  console.log('📅 [Calendar] Today elements found:', {
    todayDate: !!todayDate,
    todayDayName: !!todayDayName,
    todayHijri: !!todayHijri,
    todayHijriDay: !!todayHijriDay,
    todayTime: !!todayTime,
    todayTimezone: !!todayTimezone
  });
  
  // Update Gregorian date
  if (todayDate) {
    const dateString = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    todayDate.textContent = dateString;
    console.log('📅 [Calendar] Updated today-date:', dateString);
  }
  
  // Update day name
  if (todayDayName) {
    const dayName = date.toLocaleDateString('en-US', {
      weekday: 'long'
    });
    todayDayName.textContent = dayName;
    console.log('📅 [Calendar] Updated day name:', dayName);
  }
  
  // Update timezone
  if (todayTimezone) {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    todayTimezone.textContent = timezone;
    console.log('📅 [Calendar] Updated timezone:', timezone);
  }
  
  // Update Hijri date
  if (todayHijri) {
    loadHijriDate(date);
  }
  
  // Update time
  if (todayTime) {
    updateTime();
    if (!window.timeUpdateInterval) {
      window.timeUpdateInterval = setInterval(updateTime, 60000);
    }
  }
}

function updateTime() {
  const todayTime = document.getElementById('today-time');
  if (todayTime) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    todayTime.textContent = timeString;
    console.log('🕐 [Calendar] Updated time:', timeString);
  } else {
    console.warn('⚠️ [Calendar] today-time element not found');
  }
}

async function loadHijriDate(gregorianDate) {
  try {
    console.log('🕌 [Calendar] Loading Hijri date for:', gregorianDate);
    const todayHijri = document.getElementById('today-hijri');
    const todayHijriDay = document.getElementById('today-hijri-day');
    
    if (!todayHijri) {
      console.warn('⚠️ [Calendar] today-hijri element not found');
      return;
    }
    
    // Use the existing API to get Hijri date
    const response = await window.calendarAPI.getCurrentHijri();
    console.log('🕌 [Calendar] Hijri API response:', response);
    
    if (response && response.hijri) {
      const hijri = response.hijri;
      const hijriString = `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
      todayHijri.textContent = hijriString;
      console.log('🕌 [Calendar] Updated Hijri date:', hijriString);
      
      // Update Hijri day name - always use Arabic day names
      if (todayHijriDay) {
        const hijriDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayOfWeek = gregorianDate.getDay();
        todayHijriDay.textContent = hijriDayNames[dayOfWeek];
        console.log('🕌 [Calendar] Updated Hijri day:', hijriDayNames[dayOfWeek]);
      }
    } else {
      // Fallback: Use a simple conversion library or show placeholder
      todayHijri.textContent = 'Hijri date unavailable';
      if (todayHijriDay) {
        const hijriDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dayOfWeek = gregorianDate.getDay();
        todayHijriDay.textContent = hijriDayNames[dayOfWeek];
      }
      console.log('🕌 [Calendar] Hijri date unavailable, showing day name only');
    }
  } catch (error) {
    console.error('❌ [Calendar] Error loading Hijri date:', error);
    const todayHijri = document.getElementById('today-hijri');
    const todayHijriDay = document.getElementById('today-hijri-day');
    
    if (todayHijri) {
      todayHijri.textContent = 'Hijri date unavailable';
    }
    if (todayHijriDay) {
      todayHijriDay.textContent = 'Unavailable';
    }
  }
}

async function loadTodayPrayerTimes(date) {
  try {
    console.log('🕌 [Calendar] Loading prayer times for:', date, typeof date);
    
    // Get user location from global state
    const location = CalendarState?.location || { lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai' };
    console.log('🕌 [Calendar] Location for prayer times:', location);
    
    const prayerTimes = await window.calendarAPI.getPrayerTimesForDay(
      date, // Pass date string directly
      location.lat,
      location.lon,
      location.tz
    );
    
    if (prayerTimes && prayerTimes.success) {
      const times = prayerTimes.data;
      
      // Update prayer time displays
      updatePrayerTime('fajr-time', times.fajr);
      updatePrayerTime('dhuhr-time', times.dhuhr);
      updatePrayerTime('asr-time', times.asr);
      updatePrayerTime('maghrib-time', times.maghrib);
      updatePrayerTime('isha-time', times.isha);
      
      console.log('✅ [Calendar] Prayer times loaded');
      return;
    }

    // Fallback: compute from already-fetched monthly data in memory/cache
    console.warn('⚠️ [Calendar] Daily API 404 – falling back to monthly cache');
    const today = new Date(date);
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const monthly = await window.calendarAPI.getPrayerTimesForMonth(
      year,
      month,
      location.lat,
      location.lon,
      location.tz
    );
    if (monthly && Array.isArray(monthly.days)) {
      const iso = `${year}-${String(month).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const day = monthly.days.find(d => d.date === iso);
      if (day && day.times) {
        updatePrayerTime('fajr-time', day.times.fajr);
        updatePrayerTime('dhuhr-time', day.times.dhuhr);
        updatePrayerTime('asr-time', day.times.asr);
        updatePrayerTime('maghrib-time', day.times.maghrib);
        updatePrayerTime('isha-time', day.times.isha);
        console.log('✅ [Calendar] Prayer times loaded from monthly cache');
      }
    }
  } catch (error) {
    console.error('❌ [Calendar] Error loading prayer times:', error);
  }
}

function updatePrayerTime(elementId, time) {
  const element = document.getElementById(elementId);
  if (element && time) {
    const date = new Date(time);
    element.textContent = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

async function loadTodayEvents(date) {
  try {
    console.log('📅 [Calendar] Loading today\'s events for:', date);
    
    const events = await window.calendarAPI.getUserEvents();
    const todayEvents = events.filter(event => {
      const eventDate = new Date(event.startDate).toISOString().split('T')[0];
      return eventDate === date;
    });
    
    const container = document.getElementById('today-events');
    if (container) {
      if (todayEvents.length === 0) {
        container.innerHTML = '<div class="no-events">No events today</div>';
    } else {
        container.innerHTML = todayEvents.map(event => `
          <div class="event-item" onclick="handleEventClick(this)" data-event-json='${JSON.stringify(event)}'>
            <div class="event-time">${formatEventTime(event.startDate, event.endDate)}</div>
            <div class="event-title">${event.title}</div>
            ${event.location ? `<div class="event-location">📍 ${event.location}</div>` : ''}
          </div>
        `).join('');
      }
    }
    
    console.log('✅ [Calendar] Today\'s events loaded:', todayEvents.length);
  } catch (error) {
    console.error('❌ [Calendar] Error loading today\'s events:', error);
  }
}

async function loadUpcomingEvents(date) {
  try {
    console.log('📅 [Calendar] Loading upcoming events from:', date);
    
    const events = await window.calendarAPI.getUserEvents();
    const today = new Date(date);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const upcomingEvents = events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate > today && eventDate <= nextWeek;
    }).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    const container = document.getElementById('upcoming-events');
    if (container) {
      if (upcomingEvents.length === 0) {
        container.innerHTML = '<div class="no-events">No upcoming events</div>';
      } else {
        container.innerHTML = upcomingEvents.slice(0, 5).map(event => `
          <div class="event-item" onclick="handleEventClick(this)" data-event-json='${JSON.stringify(event)}'>
            <div class="event-date">${formatEventDate(event.startDate)}</div>
            <div class="event-title">${event.title}</div>
            <div class="event-time">${formatEventTime(event.startDate, event.endDate)}</div>
          </div>
        `).join('');
      }
    }
    
    console.log('✅ [Calendar] Upcoming events loaded:', upcomingEvents.length);
  } catch (error) {
    console.error('❌ [Calendar] Error loading upcoming events:', error);
  }
}

function updateCurrentTime() {
  const todayTime = document.getElementById('today-time');
  if (todayTime) {
    const now = new Date();
    todayTime.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function formatEventTime(startDate, endDate) {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  
  const startTime = start.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  if (end) {
    const endTime = end.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${startTime} - ${endTime}`;
  }
  
  return startTime;
}

function formatEventDate(date) {
  const eventDate = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  if (eventDate.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (eventDate.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return eventDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
}

// ===== MULTI-LANGUAGE SUPPORT =====
function setupMultiLanguage() {
  console.log('🌐 [Calendar] Setting up multi-language support');
  
  // Language switcher
  const languageSelect = document.getElementById('language-select');
  if (languageSelect) {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('calendar-language') || 'en';
    languageSelect.value = savedLanguage;
    
    // Apply language on change
    languageSelect.addEventListener('change', (e) => {
      const selectedLanguage = e.target.value;
      localStorage.setItem('calendar-language', selectedLanguage);
      applyLanguage(selectedLanguage);
    });
    
    // Apply initial language
    applyLanguage(savedLanguage);
  }
}

function applyLanguage(language) {
  console.log('🌐 [Calendar] Applying language:', language);
  
  // Update document language
  document.documentElement.lang = language;
  
  // Don't automatically change direction - let user control it
  // Keep current direction setting
  
  // Update UI text based on language
  updateUIText(language);
  
  // Reload calendar data with new language
  if (window.CalendarState && window.CalendarState.render) {
    window.CalendarState.render();
  }
}

function updateUIText(language) {
  const translations = {
    en: {
      'today': 'Today',
      'occasions': 'Occasions',
      'prayer-reminders': 'Prayer Reminders',
      'import': 'Import',
      'add-event': 'Add Event',
      'prayer-times': 'Prayer Times',
      'todays-events': 'Today\'s Events',
      'upcoming': 'Upcoming',
      'no-events-today': 'No events today',
      'no-upcoming-events': 'No upcoming events',
      'refresh': 'Refresh',
      'fajr': 'Fajr',
      'dhuhr': 'Dhuhr',
      'asr': 'Asr',
      'maghrib': 'Maghrib',
      'isha': 'Isha'
    },
    ar: {
      'today': 'اليوم',
      'occasions': 'المناسبات',
      'prayer-reminders': 'تذكير الصلاة',
      'import': 'استيراد',
      'add-event': 'إضافة حدث',
      'prayer-times': 'أوقات الصلاة',
      'todays-events': 'أحداث اليوم',
      'upcoming': 'القادم',
      'no-events-today': 'لا توجد أحداث اليوم',
      'no-upcoming-events': 'لا توجد أحداث قادمة',
      'refresh': 'تحديث',
      'fajr': 'الفجر',
      'dhuhr': 'الظهر',
      'asr': 'العصر',
      'maghrib': 'المغرب',
      'isha': 'العشاء'
    },
    fr: {
      'today': 'Aujourd\'hui',
      'occasions': 'Occasions',
      'prayer-reminders': 'Rappels de Prière',
      'import': 'Importer',
      'add-event': 'Ajouter un Événement',
      'prayer-times': 'Heures de Prière',
      'todays-events': 'Événements d\'Aujourd\'hui',
      'upcoming': 'À Venir',
      'no-events-today': 'Aucun événement aujourd\'hui',
      'no-upcoming-events': 'Aucun événement à venir',
      'refresh': 'Actualiser',
      'fajr': 'Fajr',
      'dhuhr': 'Dhuhr',
      'asr': 'Asr',
      'maghrib': 'Maghrib',
      'isha': 'Isha'
    },
    es: {
      'today': 'Hoy',
      'occasions': 'Ocasiones',
      'prayer-reminders': 'Recordatorios de Oración',
      'import': 'Importar',
      'add-event': 'Agregar Evento',
      'prayer-times': 'Horarios de Oración',
      'todays-events': 'Eventos de Hoy',
      'upcoming': 'Próximos',
      'no-events-today': 'No hay eventos hoy',
      'no-upcoming-events': 'No hay eventos próximos',
      'refresh': 'Actualizar',
      'fajr': 'Fajr',
      'dhuhr': 'Dhuhr',
      'asr': 'Asr',
      'maghrib': 'Maghrib',
      'isha': 'Isha'
    }
  };
  
  const t = translations[language] || translations.en;
  
  // Update button texts
  const elements = {
    'go-today': t['today'],
    'open-occasions': t['occasions'],
    'open-reminders': t['prayer-reminders'],
    'import-events': t['import'],
    'add-event': t['add-event'],
    'refresh-today': t['refresh']
  };
  
  Object.entries(elements).forEach(([id, text]) => {
    const element = document.getElementById(id);
    if (element) {
      if (id === 'import-events') {
        element.innerHTML = `<i class="fa-solid fa-upload"></i> ${text}`;
      } else if (id === 'add-event') {
        element.textContent = `+ ${text}`;
      } else {
        element.textContent = text;
      }
    }
  });
  
  // Update section headers
  const sections = {
    'prayer-times': t['prayer-times'],
    'todays-events': t['todays-events'],
    'upcoming-events': t['upcoming']
  };
  
  Object.entries(sections).forEach(([id, text]) => {
    const element = document.querySelector(`#${id} h4`);
    if (element) {
      element.textContent = text;
    }
  });
  
  // Update prayer names
  const prayerNames = {
    'fajr': t['fajr'],
    'dhuhr': t['dhuhr'],
    'asr': t['asr'],
    'maghrib': t['maghrib'],
    'isha': t['isha']
  };
  
  Object.entries(prayerNames).forEach(([prayer, name]) => {
    const element = document.querySelector(`.prayer-time-item .prayer-name`);
    if (element && element.textContent.includes(prayer.charAt(0).toUpperCase() + prayer.slice(1))) {
      element.textContent = name;
    }
  });
  
  console.log('✅ [Calendar] UI text updated for language:', language);
}

// ===== TIMEZONE DETECTION =====
function setupTimezoneDetection() {
  console.log('🌍 [Calendar] Setting up timezone detection');
  
  // Timezone switcher
  const timezoneSelect = document.getElementById('timezone-select');
  if (timezoneSelect) {
    // Load saved timezone preference
    const savedTimezone = localStorage.getItem('calendar-timezone') || 'auto';
    timezoneSelect.value = savedTimezone;
    
    // Apply timezone on change
    timezoneSelect.addEventListener('change', async (e) => {
      const selectedTimezone = e.target.value;
      localStorage.setItem('calendar-timezone', selectedTimezone);
      await applyTimezone(selectedTimezone);
    });
    
    // Apply initial timezone
    applyTimezone(savedTimezone);
  }
  
  // Auto-detect timezone on first visit
  if (!localStorage.getItem('calendar-timezone')) {
    autoDetectTimezone();
  }
}

async function applyTimezone(timezone) {
  console.log('🌍 [Calendar] Applying timezone:', timezone);
  
  if (timezone === 'auto') {
    await autoDetectTimezone();
  } else {
    // Update user's timezone preference
    try {
      await window.calendarAPI.updateTimezonePreference(timezone);
      console.log('✅ [Calendar] Timezone preference updated');
    } catch (error) {
      console.error('❌ [Calendar] Error updating timezone preference:', error);
    }
    
    // Reload calendar data with new timezone
    if (window.CalendarState && window.CalendarState.render) {
      window.CalendarState.render();
    }
    
    // Reload today panel
    if (typeof loadTodayPanel === 'function') {
      loadTodayPanel();
    }
  }
}

async function autoDetectTimezone() {
  try {
    console.log('🌍 [Calendar] Auto-detecting timezone');
    
    // Try to get user's location and timezone
    const location = await window.calendarAPI.getUserLocation();
    console.log('📍 [Calendar] Location detected:', location);
    
    // Update timezone select to show detected timezone
    const timezoneSelect = document.getElementById('timezone-select');
    if (timezoneSelect) {
      // Add detected timezone to options if not present
      const existingOption = Array.from(timezoneSelect.options).find(option => option.value === location.timezone);
      if (!existingOption) {
        const option = document.createElement('option');
        option.value = location.timezone;
        option.textContent = location.timezone;
        timezoneSelect.appendChild(option);
      }
      timezoneSelect.value = location.timezone;
    }
    
    // Update user's timezone preference
    await window.calendarAPI.updateTimezonePreference(location.timezone, location.lat, location.lon);
    
    // Reload calendar data
    if (window.CalendarState && window.CalendarState.render) {
      window.CalendarState.render();
    }
    
    // Reload today panel
    if (typeof loadTodayPanel === 'function') {
      loadTodayPanel();
    }
    
    console.log('✅ [Calendar] Timezone auto-detection completed');
  } catch (error) {
    console.error('❌ [Calendar] Error auto-detecting timezone:', error);
    
    // Fallback to browser timezone
    const browserTimezone = window.calendarAPI.getCurrentTimezone();
    console.log('🌍 [Calendar] Using browser timezone as fallback:', browserTimezone);
    
    const timezoneSelect = document.getElementById('timezone-select');
    if (timezoneSelect) {
      timezoneSelect.value = browserTimezone;
    }
    
    await applyTimezone(browserTimezone);
  }
}


// ===== PWA FUNCTIONALITY =====
function setupPWA() {
  console.log('📱 [Calendar] Setting up PWA functionality');
  
  // Initialize PWA manager
  if (window.PWAManager) {
    window.pwaManager = new window.PWAManager();
    console.log('✅ [Calendar] PWA manager initialized');
    } else {
    console.warn('⚠️ [Calendar] PWAManager not found');
  }
  
  // Initialize offline manager
  if (window.OfflineManager) {
    window.offlineManager = new window.OfflineManager();
    console.log('✅ [Calendar] Offline manager initialized');
  } else {
    console.warn('⚠️ [Calendar] OfflineManager not found');
  }
  
  // Setup offline/online indicators
  setupOfflineIndicators();
  
  // Setup offline data sync
  setupOfflineSync();
}

function setupOfflineIndicators() {
  // Create offline indicator
  const offlineIndicator = document.createElement('div');
  offlineIndicator.id = 'offline-indicator';
  offlineIndicator.className = 'offline-indicator';
  offlineIndicator.innerHTML = `
    <div class="offline-content">
      <i class="fa-solid fa-wifi"></i>
      <span>You're offline</span>
    </div>
  `;
  document.body.appendChild(offlineIndicator);
  
  // Update indicator based on online status
  function updateOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      if (navigator.onLine) {
        indicator.style.display = 'none';
      } else {
        indicator.style.display = 'block';
      }
    }
  }
  
  // Listen for online/offline events
  window.addEventListener('online', () => {
    console.log('🌐 [Calendar] Back online');
    updateOfflineIndicator();
    showNotification('You\'re back online!', 'success');
    
    // Sync pending data
    if (window.offlineManager) {
      window.offlineManager.syncPendingActions();
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('📱 [Calendar] Gone offline');
    updateOfflineIndicator();
    showNotification('You\'re offline. Some features may be limited.', 'warning');
  });
  
  // Initial update
  updateOfflineIndicator();
}

function setupOfflineSync() {
  // Cache calendar data when online
  if (navigator.onLine && window.offlineManager) {
    cacheCalendarData();
  }
}

async function cacheCalendarData() {
  try {
    console.log('📦 [Calendar] Caching calendar data for offline use');
    
    // Cache events
    const events = await window.calendarAPI.getUserEvents();
    if (events && events.length > 0) {
      for (const event of events) {
        await window.offlineManager.saveEvent(event);
      }
      console.log('✅ [Calendar] Events cached:', events.length);
    }
    
    // Cache prayer times for current month
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    
    // Get user location from global state
    const location = CalendarState?.location || { lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai' };
    
    const prayerTimes = await window.calendarAPI.getPrayerTimesForMonth(
      year,
      month,
      location.lat,
      location.lon,
      location.tz
    );
    
    if (prayerTimes && prayerTimes.days) {
      for (const dayData of prayerTimes.days) {
        await window.offlineManager.savePrayerTimes(
          dayData.date,
          dayData.times,
          { lat: location.lat, lon: location.lon }
        );
      }
      console.log('✅ [Calendar] Prayer times cached for month');
    }
    
  // Cache holidays for current year
  const holidaysResp = await window.calendarAPI.getHolidaysForYear(year);
  const holidayList = Array.isArray(holidaysResp?.holidays) ? holidaysResp.holidays
                    : Array.isArray(holidaysResp?.data) ? holidaysResp.data
                    : [];
  if (holidayList.length) {
    await window.offlineManager.saveHolidays(holidayList);
    console.log('✅ [Calendar] Holidays cached:', holidayList.length);
  }
    
    console.log('✅ [Calendar] Calendar data cached successfully');
  } catch (error) {
    console.error('❌ [Calendar] Error caching calendar data:', error);
  }
}

// ===== DEBUG & TEST FUNCTIONS =====
window.testCalendarFeatures = function() {
  console.log('🧪 [Calendar] Testing all calendar features...');
  
  
  // Test layout elements
  const mainLayoutEl = document.querySelector('.main-layout');
  const todayPanelEl = document.getElementById('today-panel');
  const calendarMainEl = document.querySelector('.calendar-main');
  
  if (mainLayoutEl) {
    console.log('✅ [Calendar] Main layout found');
    console.log('📋 [Calendar] Main layout classes:', mainLayoutEl.className);
    console.log('📋 [Calendar] Main layout grid:', getComputedStyle(mainLayoutEl).gridTemplateColumns);
  } else {
    console.error('❌ [Calendar] Main layout not found');
  }
  
  if (todayPanelEl) {
    console.log('✅ [Calendar] Today panel found');
    console.log('📋 [Calendar] Today panel order:', getComputedStyle(todayPanelEl).order);
  } else {
    console.error('❌ [Calendar] Today panel not found');
  }
  
  if (calendarMainEl) {
    console.log('✅ [Calendar] Calendar main found');
    console.log('📋 [Calendar] Calendar main order:', getComputedStyle(calendarMainEl).order);
  } else {
    console.error('❌ [Calendar] Calendar main not found');
  }
  
  // Test language support
  const languageSelect = document.getElementById('language-select');
  if (languageSelect) {
    console.log('✅ [Calendar] Language selector found');
    console.log('📋 [Calendar] Current language:', languageSelect.value);
  } else {
    console.error('❌ [Calendar] Language selector not found');
  }
  
  // Test timezone support
  const timezoneSelect = document.getElementById('timezone-select');
  if (timezoneSelect) {
    console.log('✅ [Calendar] Timezone selector found');
    console.log('📋 [Calendar] Current timezone:', timezoneSelect.value);
  } else {
    console.error('❌ [Calendar] Timezone selector not found');
  }
  
  // Test API
  if (window.calendarAPI) {
    console.log('✅ [Calendar] Calendar API loaded');
  } else {
    console.error('❌ [Calendar] Calendar API not loaded');
  }
  
  // Test PWA features
  if (window.PWAManager) {
    console.log('✅ [Calendar] PWA Manager loaded');
  } else {
    console.error('❌ [Calendar] PWA Manager not loaded');
  }
  
  if (window.OfflineManager) {
    console.log('✅ [Calendar] Offline Manager loaded');
  } else {
    console.error('❌ [Calendar] Offline Manager not loaded');
  }
  
  console.log('✅ [Calendar] Feature test completed!');
};


// ===== MODALS =====
function setupModals() {
  // Initialize advanced event modal
  if (window.CalendarEventModal) {
    window.eventModal = new window.CalendarEventModal(window.calendarAPI);
    console.log('✅ [Calendar] Event modal initialized');
    } else {
    console.warn('⚠️ [Calendar] CalendarEventModal not found');
  }

  // Initialize import modal
  if (window.CalendarImportModal) {
    window.importModal = new window.CalendarImportModal(window.calendarAPI);
    console.log('✅ [Calendar] Import modal initialized');
  } else {
    console.warn('⚠️ [Calendar] CalendarImportModal not found');
  }
  
  // Close modal on backdrop or X click
  document.addEventListener('click', (e) => {
    const closeAttr = e.target.getAttribute('data-close');
    if (closeAttr) {
      closeModal(closeAttr + '-modal');
    }
  });
  
  // Add event button (opens new modal)
  const addEventBtn = document.getElementById('add-event');
  if (addEventBtn) {
    addEventBtn.addEventListener('click', () => {
      if (window.eventModal) {
        window.eventModal.openModal();
      } else {
        openEventModal(); // Fallback to old modal
    }
  });
}

  // Import events button
  const importBtn = document.getElementById('import-events');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      if (window.importModal) {
        window.importModal.openModal();
      } else {
        console.error('❌ [Calendar] Import modal not initialized');
      }
    });
  }
  
  // Setup occasions modal
  setupOccasionsModal();
  
  // Setup reminders modal
  setupRemindersModal();
  
  // Setup OAuth sync
  setupOAuthSync();
  
  // Setup today panel
  setupTodayPanel();
  
  // Setup multi-language support
  setupMultiLanguage();
  
  // Setup timezone detection
  setupTimezoneDetection();
  
  
  // Setup PWA functionality
  setupPWA();
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function openDayModal(date) {
  const modal = document.getElementById('day-modal');
  const titleEl = document.getElementById('day-title');
  const listEl = document.getElementById('day-events-list');
  
  if (!modal || !listEl) return;
  
  // Set title
  if (titleEl) {
    titleEl.textContent = `Events on ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;
  }
  
  // Get events for this day
  const dayEvents = CalendarState.renderer.getEventsForDate(date);
  
  listEl.innerHTML = '';
  
  if (dayEvents.length === 0) {
    listEl.innerHTML = '<li><div>No events for this day.</div></li>';
    } else {
    dayEvents.forEach(event => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div>
          <div style="font-weight:700;">${event.title}</div>
          <div class="meta">
            ${CalendarState.renderer.formatTime(event.startDate || event.start)} • 
            ${event.category || 'Event'}
          </div>
            </div>
          <div>
          ${!event.isIslamicEvent ? `
            <button class="btn ghost small" data-action="edit" data-id="${event.id}">Edit</button>
            <button class="btn ghost small danger" data-action="delete" data-id="${event.id}">Delete</button>
          ` : ''}
        </div>
      `;
      listEl.appendChild(li);
    });
  }
  
  // Setup event handlers
  listEl.addEventListener('click', handleDayModalAction);
  
  // Store selected date
  modal.dataset.selectedDate = date.toISOString();
  
  openModal('day-modal');
}

async function handleDayModalAction(e) {
  const action = e.target.getAttribute('data-action');
  const id = e.target.getAttribute('data-id');
  
  if (!action || !id) return;

  if (action === 'edit') {
    const event = CalendarState.events.find(e => e.id === id);
    if (event) {
      openEventModal(event);
    }
  } else if (action === 'delete') {
    if (confirm('Delete this event?')) {
      try {
        await CalendarState.api.deleteEvent(id);
        await loadAndRender();
        closeModal('day-modal');
        showSuccess('Event deleted');
      } catch (error) {
        showError('Failed to delete event');
      }
    }
  }
}

function openEventModal(event = null) {
  // For now, use a simple prompt-based interface
  // In a full implementation, you'd create a proper modal form
  const modal = document.getElementById('day-modal');
  const selectedDate = modal?.dataset.selectedDate || new Date().toISOString();
  
  if (event) {
    // Edit mode
    const title = prompt('Event title:', event.title);
    if (title === null) return;
    
    const description = prompt('Description (optional):', event.description || '');
    
    updateEvent(event.id, { title, description });
  } else {
    // Create mode
    const title = prompt('Event title:');
    if (!title) return;
    
    const description = prompt('Description (optional):');
    const timeStr = prompt('Time (HH:MM, optional):');
    
    const startDate = new Date(selectedDate);
    if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      startDate.setHours(hours, minutes);
    }
    
    createEvent({ title, description, startDate });
  }
}

async function createEvent(eventData) {
  try {
    const newEvent = {
      title: eventData.title,
      description: eventData.description || '',
      startDate: eventData.startDate,
      endDate: eventData.endDate || new Date(new Date(eventData.startDate).getTime() + 60 * 60000),
      category: eventData.category || 'personal',
      priority: 'medium'
    };
    
    await CalendarState.api.createEvent(newEvent);
    await loadAndRender();
    closeModal('day-modal');
    showSuccess('Event created');
  } catch (error) {
    console.error('[Calendar] Create error:', error);
    showError('Failed to create event');
  }
}

async function updateEvent(eventId, updates) {
  try {
    await CalendarState.api.updateEvent(eventId, updates);
    await loadAndRender();
    closeModal('day-modal');
    showSuccess('Event updated');
  } catch (error) {
    console.error('[Calendar] Update error:', error);
    showError('Failed to update event');
  }
}

// ===== OCCASIONS MODAL =====
let occasionsData = [];
let occasionPreferences = {};

function setupOccasionsModal() {
  const openButtons = [
    document.getElementById('open-occasions'),
    document.getElementById('quick-occasions')
  ].filter(Boolean);
  
  openButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      openModal('occasions-modal');
      loadOccasionsModal();
    });
  });

  // Setup modal controls
  setupOccasionsControls();
}

function setupOccasionsControls() {
  const countrySelect = document.getElementById('country-select');
  const yearSelect = document.getElementById('year-select');
  const searchInput = document.getElementById('occasions-search');
  const selectAllCheckbox = document.getElementById('select-all-occasions');
  const autoUpdateCheckbox = document.getElementById('auto-update-occasions');
  const addToCalendarBtn = document.getElementById('add-occasions-to-calendar');

  // Country/Year change handlers
  if (countrySelect) {
    countrySelect.addEventListener('change', () => loadOccasionsModal());
  }
  if (yearSelect) {
    yearSelect.addEventListener('change', () => loadOccasionsModal());
  }

  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      filterOccasionsList(query);
    });
  }

  // Select All functionality
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', handleSelectAll);
  }

  // Add to Calendar button
  if (addToCalendarBtn) {
    addToCalendarBtn.addEventListener('click', handleAddToCalendar);
  }
}

async function loadOccasionsModal() {
  try {
    const country = document.getElementById('country-select')?.value || 'AE';
    const year = parseInt(document.getElementById('year-select')?.value || new Date().getFullYear());
    
    console.log('🎉 [Occasions] Loading occasions for:', { country, year });

    // Load user preferences
    occasionPreferences = await CalendarState.api.loadOccasionPreferences();
    console.log('🎉 [Occasions] Loaded preferences:', occasionPreferences);

    // Fetch holidays
    const data = await CalendarState.api.getYearlyHolidays(year, country, true, true);
    occasionsData = data.holidays || [];
    
    console.log(`🎉 [Occasions] Loaded ${occasionsData.length} occasions`);
    
    // Debug: Log first few occasions to see their structure
    if (occasionsData.length > 0) {
      console.log('🔍 [Occasions] Sample occasions data:', occasionsData.slice(0, 3));
    }

    // Render occasions list
    renderOccasionsList();
    
    // Update controls
    updateOccasionsControls();

  } catch (error) {
    console.error('❌ [Occasions] Error loading occasions:', error);
    showError('Failed to load occasions');
  }
}

function renderOccasionsList(filteredData = null) {
  const occasionsList = document.getElementById('occasions-list');
  if (!occasionsList) return;

  occasionsList.innerHTML = '';

  const dataToRender = filteredData || occasionsData;

  if (dataToRender.length === 0) {
    const message = filteredData ? 'No occasions match your search.' : 'No occasions found for this year and country.';
    occasionsList.innerHTML = `<li style="text-align: center; color: var(--muted); padding: 20px;">${message}</li>`;
    return;
  }

  dataToRender.forEach(occasion => {
        const li = document.createElement('li');
    const isSelected = occasionPreferences.selectedOccasions?.includes(occasion.id) || false;
    
          li.innerHTML = `
      <label class="chk">
        <input type="checkbox" data-occasion-id="${occasion.id}" ${isSelected ? 'checked' : ''} />
            <div>
          <strong>${occasion.name}</strong>
          <div class="meta">
            <span>${formatOccasionDate(occasion.date)}</span>
            <span class="pill ${occasion.type}">${occasion.type === 'religious' || occasion.type === 'islamic' ? 'Religious' : 'National'}</span>
            ${occasion.duration > 1 ? `<span>${occasion.duration} days</span>` : ''}
            </div>
        </div>
      </label>
    `;
    
    occasionsList.appendChild(li);
  });

  // Update select all checkbox
  updateSelectAllCheckbox();

  // Add event listeners for individual checkboxes
  const occasionCheckboxes = document.querySelectorAll('#occasions-list input[type="checkbox"]');
  occasionCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectAllCheckbox);
  });
}

function formatOccasionDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

function filterOccasionsList(query) {
  console.log(`🔍 [Occasions] Filtering with query: "${query}"`);
  console.log(`🔍 [Occasions] Total occasions data:`, occasionsData.length);
  
  if (!query) {
    renderOccasionsList(); // Show all
    return;
  }

  const filtered = occasionsData.filter(occasion => {
    const searchText = [
      occasion.name || '',
      occasion.nameAr || '',
      occasion.type || '',
      formatOccasionDate(occasion.date),
      occasion.description || ''
    ].join(' ').toLowerCase();

    const matches = searchText.includes(query);
    if (matches) {
      console.log(`✅ [Occasions] Match found:`, { name: occasion.name, searchText });
    }
    return matches;
  });

  console.log(`🔍 [Occasions] Filtered results:`, filtered.length);
  renderOccasionsList(filtered);
}

function updateOccasionsControls() {
  const autoUpdateCheckbox = document.getElementById('auto-update-occasions');
  if (autoUpdateCheckbox && occasionPreferences.autoUpdate !== undefined) {
    autoUpdateCheckbox.checked = occasionPreferences.autoUpdate;
  }
}

function handleSelectAll() {
  const selectAllCheckbox = document.getElementById('select-all-occasions');
  const occasionCheckboxes = document.querySelectorAll('#occasions-list input[type="checkbox"]');
  
  occasionCheckboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
  });
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all-occasions');
  const occasionCheckboxes = document.querySelectorAll('#occasions-list input[type="checkbox"]');
  
  if (occasionCheckboxes.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }

  const checkedCount = Array.from(occasionCheckboxes).filter(cb => cb.checked).length;
  
  if (checkedCount === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (checkedCount === occasionCheckboxes.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
    } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

async function handleAddToCalendar() {
  try {
    const selectedOccasions = getSelectedOccasions();
    const autoUpdate = document.getElementById('auto-update-occasions')?.checked || false;
    const country = document.getElementById('country-select')?.value || 'AE';
    
    if (selectedOccasions.length === 0) {
      showError('Please select at least one occasion to add to your calendar.');
      return;
    }

    console.log('🎉 [Occasions] Adding to calendar:', { selectedOccasions, autoUpdate, country });

    // Create calendar events for selected occasions
    let addedCount = 0;
    for (const occasionId of selectedOccasions) {
      const occasion = occasionsData.find(o => o.id === occasionId);
      if (!occasion) continue;

      try {
        const eventData = {
          title: occasion.name,
          description: `Islamic occasion: ${occasion.name}${occasion.nameAr ? ` (${occasion.nameAr})` : ''}`,
          startDate: new Date(occasion.date),
          endDate: occasion.duration > 1 ? 
            new Date(new Date(occasion.date).getTime() + (occasion.duration - 1) * 24 * 60 * 60 * 1000) : 
            new Date(occasion.date),
          category: occasion.type === 'religious' ? 'holiday' : 'personal',
          priority: 'high',
          isIslamicEvent: true,
          tags: [occasion.type, 'occasion']
        };

        await CalendarState.api.createEvent(eventData);
        addedCount++;
      } catch (error) {
        console.error(`❌ [Occasions] Error creating event for ${occasion.name}:`, error);
      }
    }

    // Save preferences
    const preferences = {
      selectedOccasions,
      autoUpdate,
      country,
      includeIslamic: true,
      includeNational: true
    };

    await CalendarState.api.saveOccasionPreferences(preferences);
    occasionPreferences = preferences;

    // Show success and refresh calendar
    showSuccess(`Successfully added ${addedCount} occasions to your calendar!`);
    closeModal('occasions-modal');
    await loadAndRender();

  } catch (error) {
    console.error('❌ [Occasions] Error adding to calendar:', error);
    showError('Failed to add occasions to calendar');
  }
}

function getSelectedOccasions() {
  const checkboxes = document.querySelectorAll('#occasions-list input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.dataset.occasionId);
}

// ===== REMINDERS MODAL =====
function setupRemindersModal() {
  const openButtons = [
    document.getElementById('open-reminders'),
    document.getElementById('quick-reminders')
  ].filter(Boolean);
  
  openButtons.forEach(btn => {
    btn.addEventListener('click', () => openModal('reminders-modal'));
  });
}

// ===== OAUTH INTEGRATION =====
function setupOAuthButtons() {
  const googlePill = document.getElementById('oauth-google-status');
  const microsoftPill = document.getElementById('oauth-microsoft-status');
  
  if (googlePill) {
    googlePill.addEventListener('click', () => handleOAuthAction('google'));
  }
  
  if (microsoftPill) {
    microsoftPill.addEventListener('click', () => handleOAuthAction('microsoft'));
  }
}

async function handleOAuthAction(provider) {
  const status = CalendarState.integrationStatus;
  const isConnected = status?.email?.provider?.includes(provider);
  
  if (isConnected) {
    // Show sync options
    if (confirm(`Sync with ${provider}?`)) {
      await syncWithProvider(provider);
    }
  } else {
    // Connect
    if (confirm(`Connect ${provider} Calendar?`)) {
      try {
        await CalendarState.api.connectProvider(provider);
      } catch (error) {
        console.error(`[Calendar] ${provider} connect error:`, error);
        showError(`Failed to connect ${provider}`);
      }
    }
  }
}

async function syncWithProvider(provider) {
  showLoading();
  try {
    const result = await CalendarState.api.syncProvider(provider);
    console.log(`[Calendar] ${provider} sync result:`, result);
    await loadAndRender();
    showSuccess(`Synced with ${provider}`);
  } catch (error) {
    console.error(`[Calendar] ${provider} sync error:`, error);
    showError(`Failed to sync with ${provider}: ${error.message}`);
  } finally {
    hideLoading();
  }
}

async function updateOAuthStatus() {
  try {
    const status = await CalendarState.api.getIntegrationStatus();
    CalendarState.integrationStatus = status;
    
    const googlePill = document.getElementById('oauth-google-status');
    const microsoftPill = document.getElementById('oauth-microsoft-status');
    
    if (googlePill) {
      const isGoogleConnected = status.email?.provider?.includes('google');
      googlePill.classList.toggle('connected', isGoogleConnected);
      googlePill.classList.toggle('disconnected', !isGoogleConnected);
      googlePill.title = isGoogleConnected ? 'Google connected - Click to sync' : 'Click to connect Google';
    }
    
    if (microsoftPill) {
      const isMicrosoftConnected = status.email?.provider?.includes('microsoft');
      microsoftPill.classList.toggle('connected', isMicrosoftConnected);
      microsoftPill.classList.toggle('disconnected', !isMicrosoftConnected);
      microsoftPill.title = isMicrosoftConnected ? 'Microsoft connected - Click to sync' : 'Click to connect Microsoft';
    }
  } catch (error) {
    console.error('[Calendar] OAuth status error:', error);
  }
}

// ===== HIJRI DATE =====
async function updateCurrentHijri() {
  try {
    const hijri = await CalendarState.api.getCurrentHijri();
    const hijriEl = document.getElementById('today-hijri');
    
    if (hijri && hijriEl) {
      // Show both English and Arabic: "30 Rabi' al-Thani (ربيع الثاني) 1447 AH"
      hijriEl.textContent = `${hijri.day} ${hijri.monthName} (${hijri.monthNameAr}) ${hijri.year} ${hijri.designation}`;
    }
  } catch (error) {
    console.error('[Calendar] Hijri date error:', error);
  }
}

// ===== KEYBOARD SHORTCUTS =====
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch(e.key) {
      case 'ArrowLeft':
        navigatePeriod(-1);
        break;
      case 'ArrowRight':
        navigatePeriod(1);
        break;
      case 't':
      case 'T':
        CalendarState.currentDate = new Date();
        loadAndRender();
        break;
      case '1':
        switchView('month');
        document.getElementById('view-month')?.click();
        break;
      case '2':
        switchView('week');
        document.getElementById('view-week')?.click();
        break;
      case '3':
        switchView('day');
        document.getElementById('view-day')?.click();
        break;
      case '4':
        switchView('year');
        document.getElementById('view-year')?.click();
        break;
    }
  });
}

// ===== GLOBAL SEARCH =====
let searchTimeout = null;
let searchResultsOpen = false;

function setupGlobalSearch() {
  const searchInput = document.getElementById('global-search');
  const searchResults = document.createElement('div');
  searchResults.id = 'global-search-results';
  searchResults.className = 'search-results';
  
  console.log('🔍 [Calendar] Setting up global search...');
  console.log('🔍 [Calendar] Search input found:', !!searchInput);
  
  if (!searchInput) {
    console.warn('[Calendar] Global search input not found');
    return;
  }

  // Insert results container after search input
  searchInput.parentNode.style.position = 'relative';
  searchInput.parentNode.appendChild(searchResults);

  // Debounced search on input
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
      hideSearchResults();
      return;
    }

    searchTimeout = setTimeout(() => performSearch(query), 300);
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideSearchResults();
      searchInput.blur();
    } else if (e.key === 'Enter' && searchResults.children.length > 0) {
      const firstResult = searchResults.querySelector('.search-result-item');
      if (firstResult) {
        firstResult.click();
      }
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      hideSearchResults();
    }
  });

  // Focus search with Ctrl+K or Cmd+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

async function performSearch(query) {
  try {
    console.log(`🔍 [Calendar] Searching for: "${query}"`);
    console.log(`🔍 [Calendar] Search location:`, CalendarState.location);
    showSearchLoading();

    const results = await CalendarState.api.searchCalendar(query, {
      year: CalendarState.currentDate.getFullYear(),
      country: CalendarState.location.country
    });

    console.log(`🔍 [Calendar] Search results:`, results);
    renderSearchResults(results, query);
  } catch (error) {
    console.error('[Calendar] Search error:', error);
    showSearchError();
  }
}

function renderSearchResults(results, query) {
  const container = document.getElementById('global-search-results');
  if (!container) return;

  container.innerHTML = '';

  if (!results.results || results.results.length === 0) {
    container.innerHTML = `
      <div class="search-no-results">
        <i class="fa-solid fa-search"></i>
        <p>No results found for "${query}"</p>
      </div>
    `;
    showSearchResults();
    return;
  }

  // Group results by type
  const grouped = {
    'Upcoming Events': results.grouped.userEvents.filter(r => isUpcoming(r.startDate || r.date)),
    'Prayer Times': results.grouped.prayerTimes,
    'Holidays & Occasions': results.grouped.holidays.filter(r => isUpcoming(r.date)),
    'Past Events': results.grouped.userEvents.filter(r => !isUpcoming(r.startDate || r.date))
  };

  // Render each group
  Object.keys(grouped).forEach(groupName => {
    const items = grouped[groupName];
    if (items.length === 0) return;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'search-group';
    
    const groupHeader = document.createElement('div');
    groupHeader.className = 'search-group-header';
    groupHeader.textContent = `${groupName} (${items.length})`;
    groupDiv.appendChild(groupHeader);

    items.slice(0, 5).forEach(item => {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'search-result-item';
      
      const title = item.title || item.name;
      const date = item.startDate || item.date;
      const dateStr = date ? new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      }) : '';

      const icon = getSearchResultIcon(item.resultType);
      const highlightedTitle = highlightMatch(title, query);

      resultDiv.innerHTML = `
        <div class="search-result-icon">${icon}</div>
        <div class="search-result-content">
          <div class="search-result-title">${highlightedTitle}</div>
          <div class="search-result-meta">
            ${dateStr ? `<span>${dateStr}</span>` : ''}
            ${item.location ? `<span><i class="fa-solid fa-location-dot"></i> ${item.location}</span>` : ''}
            ${item.type ? `<span class="cat ${item.type}">${item.type}</span>` : ''}
          </div>
        </div>
      `;

      resultDiv.addEventListener('click', () => {
        handleSearchResultClick(item);
      });

      groupDiv.appendChild(resultDiv);
    });

    container.appendChild(groupDiv);
  });

  showSearchResults();
}

function getSearchResultIcon(type) {
  const icons = {
    'user_event': '<i class="fa-solid fa-calendar-days"></i>',
    'prayer_time': '<i class="fa-solid fa-mosque"></i>',
    'holiday': '<i class="fa-solid fa-gift"></i>'
  };
  return icons[type] || '<i class="fa-solid fa-circle"></i>';
}

function highlightMatch(text, query) {
  if (!text || !query) return text;
  
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function handleSearchResultClick(item) {
  console.log('[Calendar] Selected search result:', item);
  hideSearchResults();
  
  // Navigate to the date of the event
  if (item.date || item.startDate) {
    const date = new Date(item.date || item.startDate);
    CalendarState.currentDate = date;
    
    // Switch to day view for better focus
    switchView('day');
    loadAndRender();
  }
  
  // Show event details if it's a user event or holiday
  if (item.resultType === 'user_event' || item.resultType === 'holiday') {
    showEventDetails(item);
  }
}

function showSearchResults() {
  const container = document.getElementById('global-search-results');
  if (container) {
    container.classList.add('active');
    searchResultsOpen = true;
  }
}

function hideSearchResults() {
  const container = document.getElementById('global-search-results');
  if (container) {
    container.classList.remove('active');
    searchResultsOpen = false;
  }
}

function showSearchLoading() {
  const container = document.getElementById('global-search-results');
  if (container) {
    container.innerHTML = `
      <div class="search-loading">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Searching...</p>
      </div>
    `;
    showSearchResults();
  }
}

function showSearchError() {
  const container = document.getElementById('global-search-results');
  if (container) {
    container.innerHTML = `
      <div class="search-error">
        <i class="fa-solid fa-exclamation-triangle"></i>
        <p>Search failed. Please try again.</p>
      </div>
    `;
    showSearchResults();
  }
}

function showEventDetails(event) {
  // For now, just log - you can implement a modal later
  console.log('[Calendar] Event details:', event);
  alert(`${event.title || event.name}\n\n${event.description || 'No description available'}`);
}

function isUpcoming(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return date >= new Date();
}

// ===== UI FEEDBACK =====
function showLoading() {
  const container = document.getElementById('month-grid');
  if (container) {
    container.style.opacity = '0.5';
    container.style.pointerEvents = 'none';
  }
}

function hideLoading() {
  const container = document.getElementById('month-grid');
  if (container) {
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
  }
}

function showSuccess(message) {
  console.log('[Calendar] Success:', message);
  // Could add toast notification here
  alert(message);
}

function showError(message) {
  console.error('[Calendar] Error:', message);
  alert('Error: ' + message);
}
