// services/icsImportService.js - ICS Calendar Import Service

const { logger } = require('../config/logger');
const crypto = require('crypto');

class ICSImportService {
  /**
   * Parse ICS file content
   * @param {String} icsContent - Raw ICS file content
   * @returns {Object} Parsed calendar data
   */
  parseICS(icsContent) {
    try {
      const events = [];
      const lines = icsContent.split(/\r?\n/);
      let currentEvent = null;
      let inEvent = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Start of event
        if (line === 'BEGIN:VEVENT') {
          inEvent = true;
          currentEvent = {
            id: crypto.randomUUID(),
            isImported: true,
            source: 'ics'
          };
          continue;
        }

        // End of event
        if (line === 'END:VEVENT') {
          if (currentEvent) {
            events.push(currentEvent);
          }
          currentEvent = null;
          inEvent = false;
          continue;
        }

        // Parse event properties
        if (inEvent && currentEvent) {
          this.parseEventProperty(line, currentEvent);
        }
      }

      logger.info(`[ICSImport] Parsed ${events.length} events from ICS file`);
      return {
        success: true,
        events: events,
        totalEvents: events.length
      };
    } catch (error) {
      logger.error('[ICSImport] Error parsing ICS file:', error);
      throw new Error('Failed to parse ICS file: ' + error.message);
    }
  }

  /**
   * Parse individual event property
   * @private
   */
  parseEventProperty(line, event) {
    // Handle multi-line properties (continuation)
    if (line.startsWith(' ') || line.startsWith('\t')) {
      return; // Skip continuation lines for now
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const property = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);

    // Parse property name and parameters
    const [propName, ...params] = property.split(';');

    switch (propName) {
      case 'SUMMARY':
        event.title = this.decodeValue(value);
        break;

      case 'DESCRIPTION':
        event.description = this.decodeValue(value);
        break;

      case 'DTSTART':
        event.startDate = this.parseDateTime(value, params);
        event.allDay = this.isAllDay(params);
        break;

      case 'DTEND':
        event.endDate = this.parseDateTime(value, params);
        break;

      case 'LOCATION':
        event.location = this.decodeValue(value);
        break;

      case 'STATUS':
        event.status = value;
        break;

      case 'PRIORITY':
        event.priority = this.mapPriority(value);
        break;

      case 'CATEGORIES':
        event.tags = value.split(',').map(t => t.trim());
        event.category = event.tags[0] || 'personal';
        break;

      case 'UID':
        event.externalId = value;
        break;

      case 'RRULE':
        event.isRecurring = true;
        event.recurrenceRule = this.parseRecurrenceRule(value);
        break;

      case 'ORGANIZER':
        event.organizer = this.parseOrganizer(value, params);
        break;

      case 'ATTENDEE':
        if (!event.attendees) event.attendees = [];
        const attendee = this.parseAttendee(value, params);
        if (attendee) event.attendees.push(attendee);
        break;

      case 'VALARM':
      case 'BEGIN:VALARM':
        if (!event.reminders) event.reminders = [];
        // Parse reminder in next lines
        break;
    }
  }

  /**
   * Parse date/time from ICS format
   * @private
   */
  parseDateTime(value, params) {
    try {
      // Check if it's a date-only value (YYYYMMDD)
      if (value.length === 8) {
        const year = value.substring(0, 4);
        const month = value.substring(4, 6);
        const day = value.substring(6, 8);
        return new Date(`${year}-${month}-${day}`);
      }

      // Parse datetime (YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
      const year = value.substring(0, 4);
      const month = value.substring(4, 6);
      const day = value.substring(6, 8);
      const hour = value.substring(9, 11);
      const minute = value.substring(11, 13);
      const second = value.substring(13, 15);

      // Check if UTC (ends with Z)
      const isUTC = value.endsWith('Z');
      
      if (isUTC) {
        return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      } else {
        return new Date(year, month - 1, day, hour, minute, second);
      }
    } catch (error) {
      logger.warn('[ICSImport] Error parsing date/time:', value);
      return new Date();
    }
  }

  /**
   * Check if event is all-day
   * @private
   */
  isAllDay(params) {
    return params.some(p => p.includes('VALUE=DATE'));
  }

  /**
   * Decode ICS value (handle escaping)
   * @private
   */
  decodeValue(value) {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Map ICS priority to internal priority
   * @private
   */
  mapPriority(icsProperty) {
    const priority = parseInt(icsProperty);
    if (priority >= 1 && priority <= 4) return 'urgent';
    if (priority === 5) return 'high';
    if (priority >= 6 && priority <= 7) return 'medium';
    return 'low';
  }

  /**
   * Parse recurrence rule (RRULE)
   * @private
   */
  parseRecurrenceRule(rruleValue) {
    const rule = {};
    const parts = rruleValue.split(';');

    parts.forEach(part => {
      const [key, value] = part.split('=');
      
      switch (key) {
        case 'FREQ':
          rule.frequency = value.toLowerCase();
          break;
        case 'INTERVAL':
          rule.interval = parseInt(value);
          break;
        case 'COUNT':
          rule.count = parseInt(value);
          break;
        case 'UNTIL':
          rule.until = this.parseDateTime(value, []);
          break;
        case 'BYDAY':
          rule.daysOfWeek = this.parseDaysOfWeek(value);
          break;
        case 'BYMONTHDAY':
          rule.dayOfMonth = parseInt(value);
          break;
        case 'BYMONTH':
          rule.monthOfYear = parseInt(value);
          break;
      }
    });

    return rule;
  }

  /**
   * Parse BYDAY values to day numbers
   * @private
   */
  parseDaysOfWeek(byDay) {
    const dayMap = {
      'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
    };

    return byDay.split(',').map(day => {
      // Remove any prefix numbers (like -1MO or 2TU)
      const cleanDay = day.replace(/^[-+]?\d+/, '');
      return dayMap[cleanDay];
    }).filter(d => d !== undefined);
  }

  /**
   * Parse organizer
   * @private
   */
  parseOrganizer(value, params) {
    // Extract email from MAILTO:email format
    const email = value.replace('mailto:', '').replace('MAILTO:', '');
    
    // Look for CN (Common Name) parameter
    const cnParam = params.find(p => p.startsWith('CN='));
    const name = cnParam ? cnParam.substring(3).replace(/"/g, '') : email;

    return { email, name };
  }

  /**
   * Parse attendee
   * @private
   */
  parseAttendee(value, params) {
    const email = value.replace('mailto:', '').replace('MAILTO:', '');
    return email;
  }

  /**
   * Detect duplicate events
   * @param {Array} importedEvents - Events from ICS file
   * @param {Array} existingEvents - User's existing events
   * @returns {Object} Categorized events
   */
  detectDuplicates(importedEvents, existingEvents) {
    const newEvents = [];
    const duplicates = [];
    const conflicts = [];

    importedEvents.forEach(importedEvent => {
      let isDuplicate = false;
      let matchedEvent = null;

      // Check for duplicates using multiple criteria
      for (const existingEvent of existingEvents) {
        // Tier 1: External ID match
        if (importedEvent.externalId && existingEvent.externalId === importedEvent.externalId) {
          isDuplicate = true;
          matchedEvent = existingEvent;
          break;
        }

        // Tier 2: Title + Date match
        const sameTitle = existingEvent.title === importedEvent.title;
        const sameDate = this.isSameDay(
          new Date(existingEvent.startDate),
          new Date(importedEvent.startDate)
        );

        if (sameTitle && sameDate) {
          isDuplicate = true;
          matchedEvent = existingEvent;
          break;
        }

        // Tier 3: Title + Time match (within 5 minutes)
        if (sameTitle) {
          const timeDiff = Math.abs(
            new Date(existingEvent.startDate) - new Date(importedEvent.startDate)
          );
          if (timeDiff < 5 * 60 * 1000) {
            isDuplicate = true;
            matchedEvent = existingEvent;
            break;
          }
        }
      }

      if (isDuplicate) {
        duplicates.push({
          importedEvent,
          matchedEvent
        });
      } else {
        newEvents.push(importedEvent);
      }
    });

    logger.info(`[ICSImport] Duplicate detection: ${newEvents.length} new, ${duplicates.length} duplicates`);

    return {
      newEvents,
      duplicates,
      conflicts,
      totalImported: importedEvents.length
    };
  }

  /**
   * Check if two dates are the same day
   * @private
   */
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Convert imported events to internal format
   * @param {Array} events - Parsed ICS events
   * @returns {Array} Events in internal format
   */
  convertToInternalFormat(events) {
    return events.map(event => ({
      id: event.id || crypto.randomUUID(),
      title: event.title || 'Untitled Event',
      description: event.description || '',
      startDate: event.startDate,
      endDate: event.endDate || event.startDate,
      allDay: event.allDay || false,
      location: event.location || '',
      category: event.category || 'personal',
      priority: event.priority || 'medium',
      tags: event.tags || [],
      attendees: event.attendees || [],
      isRecurring: event.isRecurring || false,
      recurrenceRule: event.recurrenceRule || null,
      isExternal: true,
      externalId: event.externalId,
      source: 'ics-import',
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  /**
   * Get import summary statistics
   * @param {Object} detectionResult - Result from detectDuplicates
   * @returns {Object} Summary statistics
   */
  getImportSummary(detectionResult) {
    const { newEvents, duplicates, conflicts } = detectionResult;

    return {
      totalEvents: newEvents.length + duplicates.length,
      newEvents: newEvents.length,
      duplicates: duplicates.length,
      conflicts: conflicts.length,
      dateRange: this.getDateRange(newEvents),
      categories: this.getCategorySummary(newEvents)
    };
  }

  /**
   * Get date range of events
   * @private
   */
  getDateRange(events) {
    if (events.length === 0) {
      return { start: null, end: null };
    }

    const dates = events.map(e => new Date(e.startDate));
    const start = new Date(Math.min(...dates));
    const end = new Date(Math.max(...dates));

    return { start, end };
  }

  /**
   * Get category summary
   * @private
   */
  getCategorySummary(events) {
    const summary = {};
    events.forEach(event => {
      const category = event.category || 'uncategorized';
      summary[category] = (summary[category] || 0) + 1;
    });
    return summary;
  }
}

module.exports = new ICSImportService();






