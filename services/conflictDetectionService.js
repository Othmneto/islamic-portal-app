// services/conflictDetectionService.js - Event Conflict Detection Service

const User = require('../models/User');
const { logger } = require('../config/logger');

class ConflictDetectionService {
  /**
   * Detect conflicts for a new or updated event
   * @param {Object} newEvent - Event to check for conflicts
   * @param {String} userId - User ID
   * @param {String} excludeEventId - Event ID to exclude (for updates)
   * @returns {Array} Array of conflicting events
   */
  async detectConflicts(newEvent, userId, excludeEventId = null) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const overlappingEvents = await this.findOverlappingEvents(
        user,
        newEvent.startDate,
        newEvent.endDate || newEvent.startDate,
        excludeEventId
      );

      // Calculate severity for each conflict
      const conflicts = overlappingEvents.map(event => ({
        conflictId: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate || event.startDate,
        category: event.category,
        location: event.location,
        severity: this.calculateConflictSeverity(newEvent, event),
        severityLevel: this.getSeverityLevel(newEvent, event)
      }));

      logger.info(`[ConflictDetection] Found ${conflicts.length} conflicts for user ${userId}`);
      return conflicts;
    } catch (error) {
      logger.error('[ConflictDetection] Error detecting conflicts:', error);
      throw error;
    }
  }

  /**
   * Find events that overlap with given time range
   * @private
   */
  async findOverlappingEvents(user, startDate, endDate, excludeEventId) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Filter events that overlap with the time range
    const overlapping = user.calendarEvents.filter(event => {
      // Skip the event being edited
      if (excludeEventId && event.id === excludeEventId) {
        return false;
      }

      // Skip all-day events (they don't cause time conflicts)
      if (event.allDay) {
        return false;
      }

      const eventStart = new Date(event.startDate);
      const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;

      // Check for overlap: (start1 < end2) && (end1 > start2)
      return (start < eventEnd) && (end > eventStart);
    });

    return overlapping;
  }

  /**
   * Calculate conflict severity score
   * @private
   */
  calculateConflictSeverity(event1, event2) {
    const start1 = new Date(event1.startDate);
    const end1 = event1.endDate ? new Date(event1.endDate) : start1;
    const start2 = new Date(event2.startDate);
    const end2 = event2.endDate ? new Date(event2.endDate) : start2;

    // Calculate overlap duration in minutes
    const overlapStart = new Date(Math.max(start1, start2));
    const overlapEnd = new Date(Math.min(end1, end2));
    const overlapMinutes = (overlapEnd - overlapStart) / (1000 * 60);

    // Calculate event durations
    const duration1 = (end1 - start1) / (1000 * 60);
    const duration2 = (end2 - start2) / (1000 * 60);

    // Overlap percentage relative to shorter event
    const shorterDuration = Math.min(duration1, duration2);
    const overlapPercentage = (overlapMinutes / shorterDuration) * 100;

    return {
      overlapMinutes,
      overlapPercentage: Math.round(overlapPercentage),
      duration1,
      duration2
    };
  }

  /**
   * Get severity level based on overlap
   * @private
   */
  getSeverityLevel(event1, event2) {
    const severity = this.calculateConflictSeverity(event1, event2);

    // Hard conflict: 80%+ overlap
    if (severity.overlapPercentage >= 80) {
      return 'hard';
    }

    // Soft conflict: 30-80% overlap
    if (severity.overlapPercentage >= 30) {
      return 'soft';
    }

    // Warning: Minor overlap or back-to-back
    return 'warning';
  }

  /**
   * Check if two events are back-to-back (within buffer time)
   * @private
   */
  areBackToBack(event1, event2, bufferMinutes = 15) {
    const end1 = event1.endDate ? new Date(event1.endDate) : new Date(event1.startDate);
    const start2 = new Date(event2.startDate);

    const timeDiff = Math.abs((start2 - end1) / (1000 * 60));
    return timeDiff <= bufferMinutes;
  }

  /**
   * Suggest alternative times for an event
   * @param {Object} newEvent - Event to find time for
   * @param {String} userId - User ID
   * @param {Number} durationMinutes - Event duration in minutes
   * @returns {Array} Array of suggested time slots
   */
  async suggestAlternativeTimes(newEvent, userId, durationMinutes = 60) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const requestedDate = new Date(newEvent.startDate);
      requestedDate.setHours(0, 0, 0, 0);

      const suggestions = [];
      const workingHours = { start: 9, end: 18 }; // 9 AM to 6 PM

      // Check time slots throughout the day
      for (let hour = workingHours.start; hour < workingHours.end; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotStart = new Date(requestedDate);
          slotStart.setHours(hour, minute, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

          // Check if this slot has any conflicts
          const conflicts = await this.findOverlappingEvents(
            user,
            slotStart,
            slotEnd,
            null
          );

          if (conflicts.length === 0) {
            suggestions.push({
              startDate: slotStart,
              endDate: slotEnd,
              available: true
            });

            // Limit to 5 suggestions
            if (suggestions.length >= 5) {
              return suggestions;
            }
          }
        }
      }

      return suggestions;
    } catch (error) {
      logger.error('[ConflictDetection] Error suggesting alternative times:', error);
      return [];
    }
  }

  /**
   * Get user's busy/free status for a specific time range
   * @param {String} userId - User ID
   * @param {Date} startDate - Start of range
   * @param {Date} endDate - End of range
   * @returns {Array} Array of busy time blocks
   */
  async getBusyTimes(userId, startDate, endDate) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Get all events in the date range
      const busyEvents = user.calendarEvents.filter(event => {
        const eventStart = new Date(event.startDate);
        const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;

        // Check if event is within range
        return (eventStart <= end) && (eventEnd >= start);
      });

      // Convert to busy time blocks
      const busyTimes = busyEvents.map(event => ({
        startDate: event.startDate,
        endDate: event.endDate || event.startDate,
        title: event.title,
        category: event.category
      }));

      return busyTimes;
    } catch (error) {
      logger.error('[ConflictDetection] Error getting busy times:', error);
      throw error;
    }
  }
}

module.exports = new ConflictDetectionService();






