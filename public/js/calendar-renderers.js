/**
 * Calendar Renderers
 * Month/Week/Day view renderers with layer support
 */

class CalendarRenderers {
  constructor() {
    this.currentView = 'month';
    this.currentDate = new Date();
    this.layers = {
      userEvents: true,
      islamicHolidays: true,
      prayerEvents: true
    };
    this.events = [];
    this.activeCategoryFilters = []; // Empty = show all
    this.dateRangeFilter = null; // { start: Date, end: Date }
    this.loadLayerPreferences();
  }

  /**
   * Load layer preferences from localStorage
   */
  loadLayerPreferences() {
    try {
      const saved = localStorage.getItem('calendarLayerPreferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        this.layers = { ...this.layers, ...prefs };
        console.log('📋 [Renderer] Loaded layer preferences:', this.layers);
      }
    } catch (error) {
      console.warn('[Renderer] Failed to load layer preferences:', error);
    }
  }

  /**
   * Save layer preferences to localStorage
   */
  saveLayerPreferences() {
    try {
      localStorage.setItem('calendarLayerPreferences', JSON.stringify(this.layers));
      console.log('💾 [Renderer] Saved layer preferences');
    } catch (error) {
      console.warn('[Renderer] Failed to save layer preferences:', error);
    }
  }

  /**
   * Set events data
   */
  setEvents(events) {
    this.events = events || [];
    console.log('🎨 [Renderer] Events set:', {
      totalEvents: this.events.length,
      sampleEvents: this.events.slice(0, 3).map(e => ({
        id: e.id,
        title: e.title,
        startDate: e.startDate,
        category: e.category,
        isIslamicEvent: e.isIslamicEvent
      }))
    });
  }

  /**
   * Toggle layer visibility
   */
  toggleLayer(layerName) {
    if (layerName in this.layers) {
      this.layers[layerName] = !this.layers[layerName];
      this.saveLayerPreferences();
      console.log(`🔄 [Renderer] Toggled layer ${layerName}: ${this.layers[layerName]}`);
      return this.layers[layerName];
    }
    return false;
  }

  /**
   * Toggle all layers on/off
   */
  toggleAllLayers(state) {
    Object.keys(this.layers).forEach(key => {
      this.layers[key] = state;
    });
    this.saveLayerPreferences();
    console.log(`🔄 [Renderer] ${state ? 'Enabled' : 'Disabled'} all layers`);
  }

  /**
   * Set category filters
   */
  setCategoryFilters(categories) {
    this.activeCategoryFilters = Array.isArray(categories) ? categories : [];
    console.log(`🔍 [Renderer] Category filters set:`, this.activeCategoryFilters);
  }

  /**
   * Toggle category filter
   */
  toggleCategoryFilter(category) {
    const index = this.activeCategoryFilters.indexOf(category);
    if (index === -1) {
      this.activeCategoryFilters.push(category);
    } else {
      this.activeCategoryFilters.splice(index, 1);
    }
    console.log(`🔄 [Renderer] Toggled category filter ${category}:`, this.activeCategoryFilters);
  }

  /**
   * Set date range filter
   */
  setDateRangeFilter(startDate, endDate) {
    if (startDate && endDate) {
      this.dateRangeFilter = {
        start: new Date(startDate),
        end: new Date(endDate)
      };
      console.log(`📅 [Renderer] Date range filter set:`, this.dateRangeFilter);
    } else {
      this.dateRangeFilter = null;
      console.log(`📅 [Renderer] Date range filter cleared`);
    }
  }

  /**
   * Clear all filters
   */
  clearAllFilters() {
    this.activeCategoryFilters = [];
    this.dateRangeFilter = null;
    console.log(`🗑️ [Renderer] All filters cleared`);
  }

  /**
   * Filter events by active layers, categories, and date range
   */
  getFilteredEvents() {
    const filtered = this.events.filter(event => {
      // Layer filtering
      if (event.isIslamicEvent && event.category === 'holiday') {
        // Hide observances by default
        if (event.type === 'observance') return false;
        if (!this.layers.islamicHolidays) return false;
      } else if (event.isIslamicEvent && event.category === 'prayer') {
        if (!this.layers.prayerEvents) return false;
      } else {
        // User events
        if (!this.layers.userEvents) return false;
      }
      
      // Category filtering (only for user events)
      if (!event.isIslamicEvent && this.activeCategoryFilters.length > 0) {
        if (!this.activeCategoryFilters.includes(event.category)) {
          return false;
        }
      }
      
      // Date range filtering
      if (this.dateRangeFilter) {
        const eventDate = new Date(event.startDate || event.start);
        if (eventDate < this.dateRangeFilter.start || eventDate > this.dateRangeFilter.end) {
          return false;
        }
      }
      
      return true;
    });
    
    console.log('🔍 [Renderer] getFilteredEvents:', {
      totalEvents: this.events.length,
      filteredEvents: filtered.length,
      layers: this.layers,
      categoryFilters: this.activeCategoryFilters,
      dateRangeFilter: this.dateRangeFilter,
      eventTypes: {
        holidays: this.events.filter(e => e.isIslamicEvent && e.category === 'holiday').length,
        prayers: this.events.filter(e => e.isIslamicEvent && e.category === 'prayer').length,
        user: this.events.filter(e => !e.isIslamicEvent).length
      }
    });
    
    return filtered;
  }

  /**
   * Get events for a specific date
   */
  getEventsForDate(date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const filteredEvents = this.getFilteredEvents();
    const dayEvents = filteredEvents.filter(event => {
      const eventDate = new Date(event.startDate || event.start);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === targetDate.getTime();
    });
    
    // Debug logging for first few days
    if (targetDate.getDate() <= 3) {
      console.log(`🔍 [Renderer] getEventsForDate(${targetDate.toDateString()}):`, {
        totalFilteredEvents: filteredEvents.length,
        dayEvents: dayEvents.length,
        sampleEvents: dayEvents.slice(0, 2).map(e => ({
          id: e.id,
          title: e.title,
          startDate: e.startDate,
          category: e.category
        }))
      });
    }
    
    return dayEvents;
  }

  /**
   * Format time for display
   */
  formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }

  /**
   * Get category color class
   */
  getCategoryClass(event) {
    if (event.isIslamicEvent) {
      if (event.category === 'holiday') return 'islamic';
      if (event.category === 'prayer') return 'prayer';
    }
    return event.category || 'personal';
  }

  /**
   * Render month view
   */
  renderMonth(container, year, month) {
    console.log('🎨 [Renderer] Rendering month view:', year, month);
    console.log('🎨 [Renderer] Total events available:', this.events.length);
    console.log('🎨 [Renderer] Active layers:', this.layers);
    
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    console.log('🎨 [Renderer] Month details:', {
      daysInMonth,
      startDayOfWeek,
      firstDay: firstDay.toDateString(),
      lastDay: lastDay.toDateString()
    });

    let html = '';
    
    // Add day headers (Sun, Mon, Tue, etc.)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(name => {
      html += `<div class="day-header">${name}</div>`;
    });
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      html += '<div class="day empty"></div>';
    }

    // Add days of the month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = currentDate.getTime() === today.getTime();
      const dayEvents = this.getEventsForDate(currentDate);

      html += `<div class="day" data-date="${dateStr}">`;
      html += `<div class="g-num">${day}</div>`;
      
      // Hijri date placeholder (can be enhanced with actual Hijri conversion)
      html += `<div class="h-num"></div>`;
      
      if (isToday) {
        html += '<div class="today-ring"></div>';
      }

      if (dayEvents.length > 0) {
        html += '<div class="events">';
        dayEvents.slice(0, 3).forEach(event => {
          const time = this.formatTime(event.startDate || event.start);
          const catClass = this.getCategoryClass(event);
          const title = event.title || event.name || 'Event';
          
          html += `<div class="event-pill" data-id="${event.id}">`;
          html += `<span class="cat ${catClass}"></span>`;
          html += `${title}${time ? ' • ' + time : ''}`;
          html += `</div>`;
        });
        
        if (dayEvents.length > 3) {
          html += `<div class="event-pill more">+${dayEvents.length - 3} more</div>`;
        }
        
        html += '</div>';
      }

      html += '</div>';
    }
    
    console.log('✅ [Renderer] Month view HTML generated');
    
    if (container) {
      container.innerHTML = html;
      console.log('✅ [Renderer] Month view rendered to container');
    }
    
    return html;
  }

  /**
   * Render week view with time slots
   */
  renderWeek(container, date) {
    console.log('🎨 [Renderer] Rendering week view with time slots', { date, container: !!container });
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Start on Sunday

    let html = '';
    
    // Time slot configuration
    const startHour = 0; // Midnight
    const endHour = 23; // 11 PM
    
    console.log('📅 [Renderer] Week view config:', { startOfWeek, startHour, endHour });
    
    // Week grid container
    html += '<div class="week-view-container">';
    
    // Time column header (empty top-left corner)
    html += '<div class="week-grid">';
    html += '<div class="time-column-header"></div>';
    
    // Day headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayDates = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      dayDates.push(currentDate);
      
      const isToday = this.isToday(currentDate);
      html += `<div class="week-day-header ${isToday ? 'today' : ''}" data-date="${currentDate.toISOString().split('T')[0]}">`;
      html += `<div class="day-name">${days[i]}</div>`;
      html += `<div class="day-date">${currentDate.getDate()}</div>`;
      html += `</div>`;
    }
    
    // Get all events for the week grouped by day and hour
    const weekEvents = {};
    for (let i = 0; i < 7; i++) {
      const currentDate = dayDates[i];
      const dateStr = currentDate.toISOString().split('T')[0];
      weekEvents[dateStr] = this.getEventsForDate(currentDate);
    }
    
    // Time slots - one row per hour
    for (let hour = startHour; hour <= endHour; hour++) {
      // Time label (only for full hours)
      const displayTime = this.formatHour(hour, 0);
      html += `<div class="time-label">${displayTime}</div>`;
      
      // Day columns for this hour
      for (let i = 0; i < 7; i++) {
        const currentDate = dayDates[i];
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Get events starting in this hour
        const hourEvents = (weekEvents[dateStr] || []).filter(event => {
          const eventStart = new Date(event.startDate || event.start);
          return eventStart.getHours() === hour;
        });
        
        const isCurrentTime = this.isToday(currentDate) && new Date().getHours() === hour;
        
        html += `<div class="week-time-slot ${isCurrentTime ? 'current-time' : ''}" data-date="${dateStr}" data-hour="${hour}">`;
        
        // Render events in this hour
        if (hourEvents.length > 0) {
          hourEvents.forEach(event => {
            const catClass = this.getCategoryClass(event);
            const title = event.title || event.name || 'Event';
            const time = this.formatTime(event.startDate || event.start);
            
            html += `<div class="week-event ${catClass} clickable-event" data-event-id="${event.id}" data-event-json='${JSON.stringify(event).replace(/'/g, "&apos;")}' onclick="window.handleEventClick(this)">`;
            html += `<div class="event-title-compact"><strong>${time}</strong> ${title}</div>`;
            html += `</div>`;
          });
        }
        
        html += '</div>';
      }
    }
    
    html += '</div>'; // Close week-grid
    html += '</div>'; // Close week-view-container
    
    console.log('✅ [Renderer] Week view rendered');
    
    if (container) {
      container.innerHTML = html;
    }
    
    return html;
  }

  /**
   * Get events in a specific time slot
   * @private
   */
  getEventsInTimeSlot(date, slotTime, slotDuration) {
    const slotStart = new Date(slotTime);
    const slotEnd = new Date(slotTime);
    slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);
    
    const dayEvents = this.getEventsForDate(date);
    
    return dayEvents.filter(event => {
      const eventStart = new Date(event.startDate || event.start);
      const eventHour = eventStart.getHours();
      const eventMinute = eventStart.getMinutes();
      
      // Check if event starts in this slot
      const eventStartMinutes = eventHour * 60 + eventMinute;
      const slotStartMinutes = slotStart.getHours() * 60 + slotStart.getMinutes();
      const slotEndMinutes = slotEnd.getHours() * 60 + slotEnd.getMinutes();
      
      return eventStartMinutes >= slotStartMinutes && eventStartMinutes < slotEndMinutes;
    });
  }

  /**
   * Check if time slot is current time
   * @private
   */
  isCurrentTimeSlot(slotTime, slotDuration) {
    const now = new Date();
    const slotEnd = new Date(slotTime);
    slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);
    
    return now >= slotTime && now < slotEnd;
  }

  /**
   * Format hour for display
   * @private
   */
  formatHour(hour, minute) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}${period}`;
  }

  /**
   * Get event duration in minutes
   * @private
   */
  getEventDuration(event) {
    const start = new Date(event.startDate || event.start);
    const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 60 * 60000);
    return (end - start) / 60000;
  }

  /**
   * Check if date is today
   * @private
   */
  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * Render day view with hourly time slots
   */
  renderDay(container, date) {
    console.log('🎨 [Renderer] Rendering day view with hourly time slots');
    const dateStr = date.toISOString().split('T')[0];
    const dayEvents = this.getEventsForDate(date);

    // Sort events by time
    dayEvents.sort((a, b) => {
      const aTime = new Date(a.startDate || a.start).getTime();
      const bTime = new Date(b.startDate || b.start).getTime();
      return aTime - bTime;
    });

    let html = '';
    
    // Day view container
    html += `<div class="day-view-container">`;
    
    // Header with date and mini calendar
    html += `<div class="day-view-header">`;
    html += `<div class="day-view-main-info">`;
    html += `<div class="day-view-date">${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>`;
    html += `<div class="day-view-hijri">${dateStr}</div>`;
    html += `<div class="day-view-event-count">${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}</div>`;
    html += `</div>`;
    html += `</div>`;

    // Time slots grid
    html += `<div class="day-view-grid">`;
    
    const startHour = 0; // Midnight
    const endHour = 23; // 11 PM
    const now = new Date();
    const isToday = this.isToday(date);
    
    for (let hour = startHour; hour <= endHour; hour++) {
      const hourDate = new Date(date);
      hourDate.setHours(hour, 0, 0, 0);
      
      // Check if this is the current hour
      const isCurrentHour = isToday && now.getHours() === hour;
      
      // Get events starting in this hour
      const hourEvents = dayEvents.filter(event => {
        const eventStart = new Date(event.startDate || event.start);
        return eventStart.getHours() === hour && eventStart.getDate() === date.getDate();
      });
      
      // Skip empty hours before 4 AM and after 11 PM unless they have events
      if (hourEvents.length === 0 && !isCurrentHour && (hour < 4 || hour > 23)) {
        continue;
      }
      
      html += `<div class="day-hour-slot ${isCurrentHour ? 'current-hour' : ''}" data-hour="${hour}">`;
      
      // Time label
      html += `<div class="day-hour-label">`;
      html += `<span class="hour-text">${this.formatHour(hour, 0)}</span>`;
      if (isCurrentHour) {
        html += `<span class="hour-indicator">now</span>`;
      }
      html += `</div>`;
      
      // Events column
      html += `<div class="day-hour-events">`;
      
      if (hourEvents.length > 0) {
        hourEvents.forEach(event => {
          const time = this.formatTime(event.startDate || event.start);
          const catClass = this.getCategoryClass(event);
          const title = event.title || event.name || 'Event';
          const description = event.description || '';
          const location = event.location || '';
          const duration = this.getEventDuration(event);
          
          html += `<div class="day-event-card ${catClass} clickable-event" data-event-id="${event.id}" data-event-json='${JSON.stringify(event).replace(/'/g, "&apos;")}' onclick="window.handleEventClick(this)">`;
          html += `<div class="day-event-header">`;
          html += `<span class="day-event-time">${time}</span>`;
          html += `<span class="day-event-duration">${Math.round(duration)} min</span>`;
          html += `</div>`;
          html += `<div class="day-event-title">${title}</div>`;
          if (description) {
            html += `<div class="day-event-description">${description.substring(0, 100)}${description.length > 100 ? '...' : ''}</div>`;
          }
          if (location) {
            html += `<div class="day-event-location">📍 ${location}</div>`;
          }
          html += `<div class="day-event-category">${event.category || 'Event'}</div>`;
          html += `</div>`;
        });
      }
      
      html += `</div>`; // Close day-hour-events
      html += `</div>`; // Close day-hour-slot
      
      // Current time indicator line
      if (isCurrentHour) {
        const currentMinute = now.getMinutes();
        const offsetPercent = (currentMinute / 60) * 100;
        html += `<div class="day-current-time-line" style="top: ${offsetPercent}%">`;
        html += `<div class="time-marker"></div>`;
        html += `</div>`;
      }
    }
    
    html += `</div>`; // Close day-view-grid
    html += `</div>`; // Close day-view-container
    
    console.log('✅ [Renderer] Day view rendered');
    
    if (container) {
      container.innerHTML = html;
    }
    
    return html;
  }

  /**
   * Render year view
   */
  renderYear(container, year) {
    console.log('🎨 [Renderer] Rendering year view:', year);
    let html = '';
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let month = 1; month <= 12; month++) {
      html += `<div class="mini-month" data-month="${month}">`;
      html += `<div class="mini-month-header">${monthNames[month - 1]}</div>`;
      
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const daysInMonth = lastDay.getDate();
      const startDayOfWeek = firstDay.getDay();
      
      html += '<div class="mini-month-grid">';
      
      // Day headers
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      dayNames.forEach(d => {
        html += `<div class="mini-day-header">${d}</div>`;
      });
      
      // Empty cells before first day
      for (let i = 0; i < startDayOfWeek; i++) {
        html += '<div class="mini-day empty"></div>';
      }
      
      // Days of month
      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayEvents = this.getEventsForDate(currentDate);
        const hasEvents = dayEvents.length > 0;
        const isToday = currentDate.getTime() === today.getTime();
        
        let classes = 'mini-day';
        if (hasEvents) classes += ' has-events';
        if (isToday) classes += ' today';
        
        html += `<div class="${classes}" data-date="${dateStr}">`;
        html += day;
        html += '</div>';
      }
      
      html += '</div>';
      html += '</div>';
    }
    
    console.log('✅ [Renderer] Year view rendered');
    
    if (container) {
      container.innerHTML = html;
    }
    
    return html;
  }

  /**
   * Update period label
   */
  updatePeriodLabel(labelElement, view, date) {
    if (!labelElement) return;

    const year = date.getFullYear();
    const month = date.getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];

    switch (view) {
      case 'month':
        labelElement.textContent = `${monthNames[month]} ${year}`;
        break;
      case 'week':
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        labelElement.textContent = `${startOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()]} - ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()]} ${year}`;
        break;
      case 'day':
        labelElement.textContent = `${monthNames[month]} ${date.getDate()}, ${year}`;
        break;
      case 'year':
        labelElement.textContent = `${year}`;
        break;
    }
  }
}

// Export for global access
window.CalendarRenderers = CalendarRenderers;

