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
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    let html = '<div class="month-grid">';
    
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

    html += '</div>';
    
    if (container) {
      container.innerHTML = html;
    }
    
    return html;
  }

  /**
   * Render week view
   */
  renderWeek(container, date) {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay()); // Start on Sunday

    let html = '<div class="week-grid">';
    html += '<div class="week-header">';
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(day => {
      html += `<div class="day-header">${day}</div>`;
    });
    html += '</div>';

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
    html += '</div>';
    
    if (container) {
      container.innerHTML = html;
    }
    
    return html;
  }

  /**
   * Render day view
   */
  renderDay(container, date) {
    const dateStr = date.toISOString().split('T')[0];
    const dayEvents = this.getEventsForDate(date);

    // Sort events by time
    dayEvents.sort((a, b) => {
      const aTime = new Date(a.startDate || a.start).getTime();
      const bTime = new Date(b.startDate || b.start).getTime();
      return aTime - bTime;
    });

    let html = '<div class="day-view">';
    html += `<div class="day-header">`;
    html += `<h3>${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>`;
    html += `</div>`;

    html += '<div class="day-timeline">';
    
    // Show 24-hour timeline
    for (let hour = 0; hour < 24; hour++) {
      const hourStr = hour.toString().padStart(2, '0');
      const hourDisplay = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
      
      html += `<div class="hour-block" data-hour="${hour}">`;
      html += `<div class="hour-label">${hourDisplay}</div>`;
      html += `<div class="hour-events">`;
      
      // Filter events for this hour
      const hourEvents = dayEvents.filter(event => {
        const eventDate = new Date(event.startDate || event.start);
        return eventDate.getHours() === hour;
      });
      
      hourEvents.forEach(event => {
        const time = this.formatTime(event.startDate || event.start);
        const catClass = this.getCategoryClass(event);
        const title = event.title || event.name || 'Event';
        
        html += `<div class="event-item ${catClass}" data-id="${event.id}">`;
        html += `<span class="event-time">${time}</span>`;
        html += `<span class="event-title">${title}</span>`;
        html += `</div>`;
      });
      
      html += '</div>';
      html += '</div>';
    }
    
    html += '</div>';
    html += '</div>';
    
    if (container) {
      container.innerHTML = html;
    }
    
    return html;
  }

  /**
   * Render year view
   */
  renderYear(container, year) {
    let html = '<div class="year-grid">';
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    for (let month = 1; month <= 12; month++) {
      html += `<div class="mini-month" data-month="${month}">`;
      html += `<div class="mini-month-header">${monthNames[month - 1]}</div>`;
      
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const daysInMonth = lastDay.getDate();
      const startDayOfWeek = firstDay.getDay();
      
      html += '<div class="mini-month-grid">';
      
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
        
        html += `<div class="mini-day ${hasEvents ? 'has-events' : ''}" data-date="${dateStr}">`;
        html += day;
        html += '</div>';
      }
      
      html += '</div>';
      html += '</div>';
    }
    
    html += '</div>';
    
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

