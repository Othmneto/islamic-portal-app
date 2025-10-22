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
  console.log('📊 [Calendar] Data summary:', {
    userEvents: userEvents.length,
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
  
  const allEvents = [
    ...userEvents,
    ...islamicHolidayEvents,
    ...prayerEvents
  ];
  
  console.log(`✅ [Calendar] Total merged events: ${allEvents.length}`);
  
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
      container.className = 'week-grid';
      CalendarState.renderer.renderWeek(container, CalendarState.currentDate);
      break;
    case 'day':
      container.className = 'day-view';
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
  if (!todayList) return;
  
  const today = new Date();
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
  
  // Update prayer times in side panel
  await updatePrayerTimesPanel();
}

async function updatePrayerTimesPanel() {
  const prayerTimesContainer = document.getElementById('prayer-times');
  if (!prayerTimesContainer) return;
  
  const today = new Date();
  const prayerEvents = CalendarState.events.filter(e => 
    e.isIslamicEvent && 
    e.category === 'prayer' &&
    new Date(e.startDate).toDateString() === today.toDateString()
  );
  
  const prayerOrder = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const prayerTimes = {};
  
  prayerEvents.forEach(event => {
    if (event.prayerName) {
      prayerTimes[event.prayerName] = CalendarState.renderer.formatTime(event.startDate);
    }
  });
  
  // Update the prayer time displays
  const prayerElements = prayerTimesContainer.querySelectorAll('.prayer-time');
  prayerElements.forEach(element => {
    const nameElement = element.querySelector('.prayer-name');
    if (nameElement) {
      const prayerName = nameElement.textContent.toLowerCase().trim();
      const matchingPrayer = prayerOrder.find(p => prayerName.includes(p));
      if (matchingPrayer && prayerTimes[matchingPrayer]) {
        const timeValue = element.querySelector('.prayer-time-value');
        if (timeValue) {
          timeValue.textContent = prayerTimes[matchingPrayer];
        }
      }
    }
  });
}

// ===== MODALS =====
function setupModals() {
  // Close modal on backdrop or X click
  document.addEventListener('click', (e) => {
    const closeAttr = e.target.getAttribute('data-close');
    if (closeAttr) {
      closeModal(closeAttr + '-modal');
    }
  });
  
  // Add event button
  const addEventBtn = document.getElementById('add-event');
  if (addEventBtn) {
    addEventBtn.addEventListener('click', () => openEventModal());
  }
  
  // Setup occasions modal
  setupOccasionsModal();
  
  // Setup reminders modal
  setupRemindersModal();
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
function setupOccasionsModal() {
  const openButtons = [
    document.getElementById('open-occasions'),
    document.getElementById('quick-occasions')
  ].filter(Boolean);
  
  openButtons.forEach(btn => {
    btn.addEventListener('click', () => openModal('occasions-modal'));
  });
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
      hijriEl.textContent = `${hijri.day} ${hijri.monthName} ${hijri.year} ${hijri.designation}`;
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
