// services/recurrenceService.js - Recurring Events Service

const User = require('../models/User');
const { logger } = require('../config/logger');
const crypto = require('crypto');

class RecurrenceService {
  /**
   * Generate occurrences for a recurring event
   * @param {Object} event - Parent event with recurrence rule
   * @param {Date} startDate - Start date for generation
   * @param {Date} endDate - End date for generation
   * @returns {Array} Array of event occurrences
   */
  generateOccurrences(event, startDate, endDate) {
    if (!event.isRecurring || !event.recurrenceRule) {
      return [event];
    }

    const rule = event.recurrenceRule;
    const occurrences = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const eventStart = new Date(event.startDate);

    let currentDate = new Date(eventStart);
    let count = 0;
    const maxOccurrences = rule.count || 365; // Limit to prevent infinite loops

    while (currentDate <= end && count < maxOccurrences) {
      // Check if current date is within range
      if (currentDate >= start) {
        // Check if this date is an exception
        const isException = rule.exceptions && rule.exceptions.some(
          ex => this.isSameDay(new Date(ex), currentDate)
        );

        if (!isException) {
          // Create occurrence
          const occurrence = this.createOccurrence(event, currentDate, count);
          occurrences.push(occurrence);
        }
      }

      // Move to next occurrence
      currentDate = this.getNextOccurrence(currentDate, rule);
      count++;

      // Check if we've reached the until date
      if (rule.until && currentDate > new Date(rule.until)) {
        break;
      }
    }

    return occurrences;
  }

  /**
   * Create a single occurrence from parent event
   * @private
   */
  createOccurrence(parentEvent, occurrenceDate, index) {
    const eventDuration = parentEvent.endDate 
      ? new Date(parentEvent.endDate) - new Date(parentEvent.startDate)
      : 0;

    const occurrence = {
      ...parentEvent,
      id: `${parentEvent.id}-occurrence-${index}`,
      recurrenceParentId: parentEvent.id,
      startDate: new Date(occurrenceDate),
      endDate: eventDuration 
        ? new Date(occurrenceDate.getTime() + eventDuration)
        : occurrenceDate,
      isRecurring: false, // Mark occurrence as non-recurring
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return occurrence;
  }

  /**
   * Get next occurrence date based on recurrence rule
   * @private
   */
  getNextOccurrence(currentDate, rule) {
    const next = new Date(currentDate);
    const interval = rule.interval || 1;

    switch (rule.frequency) {
      case 'daily':
        next.setDate(next.getDate() + interval);
        break;

      case 'weekly':
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          // Move to next day of week in the list
          const currentDay = next.getDay();
          const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b);
          
          let nextDay = sortedDays.find(day => day > currentDay);
          if (!nextDay) {
            // Wrap to next week
            nextDay = sortedDays[0];
            next.setDate(next.getDate() + (7 - currentDay + nextDay));
          } else {
            next.setDate(next.getDate() + (nextDay - currentDay));
          }
        } else {
          // No specific days, just add weeks
          next.setDate(next.getDate() + (7 * interval));
        }
        break;

      case 'monthly':
        if (rule.dayOfMonth) {
          // Specific day of month
          next.setMonth(next.getMonth() + interval);
          next.setDate(Math.min(rule.dayOfMonth, this.getDaysInMonth(next)));
        } else {
          // Same day of month
          const targetDay = currentDate.getDate();
          next.setMonth(next.getMonth() + interval);
          next.setDate(Math.min(targetDay, this.getDaysInMonth(next)));
        }
        break;

      case 'yearly':
        if (rule.monthOfYear && rule.dayOfMonth) {
          // Specific month and day
          next.setFullYear(next.getFullYear() + interval);
          next.setMonth(rule.monthOfYear - 1);
          next.setDate(rule.dayOfMonth);
        } else {
          // Same date next year
          next.setFullYear(next.getFullYear() + interval);
        }
        break;

      case 'custom':
        // For custom rules, implement specific logic
        logger.warn('[Recurrence] Custom recurrence rules not fully implemented');
        next.setDate(next.getDate() + 1);
        break;

      default:
        logger.warn(`[Recurrence] Unknown frequency: ${rule.frequency}`);
        next.setDate(next.getDate() + 1);
    }

    return next;
  }

  /**
   * Update a recurring event series
   * @param {String} userId - User ID
   * @param {String} eventId - Parent event ID
   * @param {Object} changes - Changes to apply
   * @param {String} scope - 'this', 'future', or 'all'
   * @returns {Object} Update result
   */
  async updateRecurringSeries(userId, eventId, changes, scope = 'all') {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const eventIndex = user.calendarEvents.findIndex(e => e.id === eventId);
      if (eventIndex === -1) {
        throw new Error('Event not found');
      }

      const event = user.calendarEvents[eventIndex];

      if (!event.isRecurring) {
        // Not a recurring event, just update normally
        Object.assign(event, changes);
        event.updatedAt = new Date();
        await user.save();
        return { updated: 1, message: 'Event updated' };
      }

      switch (scope) {
        case 'this':
          // Add this date as an exception and create a new single event
          if (!event.recurrenceRule.exceptions) {
            event.recurrenceRule.exceptions = [];
          }
          event.recurrenceRule.exceptions.push(event.startDate);

          // Create new single event with changes
          const newEvent = {
            ...event.toObject(),
            ...changes,
            id: crypto.randomUUID(),
            isRecurring: false,
            recurrenceParentId: eventId,
            updatedAt: new Date()
          };
          user.calendarEvents.push(newEvent);
          break;

        case 'future':
          // End current series and create new series from this date forward
          event.recurrenceRule.until = new Date(event.startDate);

          // Create new recurring event starting from this date
          const futureEvent = {
            ...event.toObject(),
            ...changes,
            id: crypto.randomUUID(),
            recurrenceParentId: eventId,
            updatedAt: new Date()
          };
          user.calendarEvents.push(futureEvent);
          break;

        case 'all':
        default:
          // Update the parent event
          Object.assign(event, changes);
          event.updatedAt = new Date();
          break;
      }

      await user.save();
      logger.info(`[Recurrence] Updated recurring series ${eventId} with scope ${scope}`);

      return {
        updated: scope === 'all' ? 'series' : 1,
        message: 'Recurring event updated successfully'
      };
    } catch (error) {
      logger.error('[Recurrence] Error updating recurring series:', error);
      throw error;
    }
  }

  /**
   * Delete a recurring event series
   * @param {String} userId - User ID
   * @param {String} eventId - Parent event ID or occurrence ID
   * @param {String} scope - 'this', 'future', or 'all'
   * @returns {Object} Delete result
   */
  async deleteRecurringSeries(userId, eventId, scope = 'all') {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const eventIndex = user.calendarEvents.findIndex(e => e.id === eventId);
      if (eventIndex === -1) {
        throw new Error('Event not found');
      }

      const event = user.calendarEvents[eventIndex];
      const parentId = event.recurrenceParentId || eventId;

      switch (scope) {
        case 'this':
          // Add this date as an exception
          const parentIndex = user.calendarEvents.findIndex(e => e.id === parentId);
          if (parentIndex !== -1) {
            const parentEvent = user.calendarEvents[parentIndex];
            if (!parentEvent.recurrenceRule.exceptions) {
              parentEvent.recurrenceRule.exceptions = [];
            }
            parentEvent.recurrenceRule.exceptions.push(event.startDate);
          }
          break;

        case 'future':
          // End the series at this date
          const futureParentIndex = user.calendarEvents.findIndex(e => e.id === parentId);
          if (futureParentIndex !== -1) {
            const parentEvent = user.calendarEvents[futureParentIndex];
            parentEvent.recurrenceRule.until = new Date(event.startDate);
            parentEvent.recurrenceRule.until.setDate(parentEvent.recurrenceRule.until.getDate() - 1);
          }
          break;

        case 'all':
        default:
          // Delete the parent event (all occurrences)
          user.calendarEvents = user.calendarEvents.filter(e => 
            e.id !== parentId && e.recurrenceParentId !== parentId
          );
          break;
      }

      await user.save();
      logger.info(`[Recurrence] Deleted recurring series ${eventId} with scope ${scope}`);

      return {
        deleted: scope === 'all' ? 'series' : 1,
        message: 'Recurring event deleted successfully'
      };
    } catch (error) {
      logger.error('[Recurrence] Error deleting recurring series:', error);
      throw error;
    }
  }

  /**
   * Helper: Check if two dates are the same day
   * @private
   */
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Helper: Get number of days in a month
   * @private
   */
  getDaysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * Parse RRule string (basic implementation)
   * @param {String} rrule - RRule string (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR")
   * @returns {Object} Recurrence rule object
   */
  parseRRule(rrule) {
    const rule = {};
    const parts = rrule.split(';');

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
          rule.until = new Date(value);
          break;
        case 'BYDAY':
          rule.daysOfWeek = this.parseDaysOfWeek(value);
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

    return byDay.split(',').map(day => dayMap[day.slice(-2)]).filter(d => d !== undefined);
  }
}

module.exports = new RecurrenceService();






