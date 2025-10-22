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
  }

  /**
   * Set events data
   */
  setEvents(events) {
    this.events = events || [];
  }

  /**
   * Toggle layer visibility
   */
  toggleLayer(layerName) {
    if (layerName in this.layers) {
      this.layers[layerName] = !this.layers[layerName];
      return this.layers[layerName];
    }
    return false;
  }

  /**
   * Filter events by active layers
   */
  getFilteredEvents() {
    return this.events.filter(event => {
      if (event.isIslamicEvent && event.category === 'holiday') {
        return this.layers.islamicHolidays;
      }
      if (event.isIslamicEvent && event.category === 'prayer') {
        return this.layers.prayerEvents;
      }
      return this.layers.userEvents;
    });
  }

  /**
   * Get events for a specific date
   */
  getEventsForDate(date) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    return this.getFilteredEvents().filter(event => {
      const eventDate = new Date(event.startDate || event.start);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === targetDate.getTime();
    });
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
   * Render week view
   */
  renderWeek(container, date) {
    console.log('🎨 [Renderer] Rendering week view');
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Start on Sunday

    let html = '';
    
    // Day headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    html += '<div class="week-header">';
    days.forEach(day => {
      html += `<div class="day-header">${day}</div>`;
    });
    html += '</div>';

    // Week days with events
    html += '<div class="week-days">';
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayEvents = this.getEventsForDate(currentDate);

      html += `<div class="day-column" data-date="${dateStr}">`;
      html += `<div class="day-number">${currentDate.getDate()}</div>`;
      
      dayEvents.forEach(event => {
        const time = this.formatTime(event.startDate || event.start);
        const catClass = this.getCategoryClass(event);
        const title = event.title || event.name || 'Event';
        
        html += `<div class="event-block ${catClass}" data-id="${event.id}">`;
        html += `<div class="event-time">${time}</div>`;
        html += `<div class="event-title">${title}</div>`;
        html += `</div>`;
      });
      
      html += '</div>';
    }
    
    html += '</div>';
    
    console.log('✅ [Renderer] Week view rendered');
    
    if (container) {
      container.innerHTML = html;
    }
    
    return html;
  }

  /**
   * Render day view
   */
  renderDay(container, date) {
    console.log('🎨 [Renderer] Rendering day view');
    const dateStr = date.toISOString().split('T')[0];
    const dayEvents = this.getEventsForDate(date);

    // Sort events by time
    dayEvents.sort((a, b) => {
      const aTime = new Date(a.startDate || a.start).getTime();
      const bTime = new Date(b.startDate || b.start).getTime();
      return aTime - bTime;
    });

    let html = '';
    html += `<div class="day-view-header">`;
    html += `<div class="day-view-date">${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>`;
    html += `<div class="day-view-hijri">${dateStr}</div>`;
    html += `</div>`;

    if (dayEvents.length === 0) {
      html += `<div style="padding: 40px; text-align: center; color: var(--muted); font-size: 14px;">No events scheduled for this day</div>`;
    } else {
      dayEvents.forEach(event => {
        const time = this.formatTime(event.startDate || event.start);
        const catClass = this.getCategoryClass(event);
        const title = event.title || event.name || 'Event';
        
        html += `<div class="time-slot">`;
        html += `<div class="slot-time">${time}</div>`;
        html += `<div class="slot-events">`;
        html += `<div class="slot-event ${catClass}" data-id="${event.id}">`;
        html += `<div class="slot-event-title">${title}</div>`;
        html += `<div class="slot-event-meta">${event.category || 'Event'}</div>`;
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
      });
    }
    
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

