const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const recurrenceService = require('../services/recurrenceService');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate recurring event occurrences
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { event, startDate, endDate } = req.body;
    
    if (!event || !startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Event, startDate, and endDate are required' 
      });
    }

    const occurrences = recurrenceService.generateOccurrences(
      event, 
      new Date(startDate), 
      new Date(endDate)
    );

    res.json({ 
      success: true, 
      occurrences,
      count: occurrences.length 
    });
  } catch (error) {
    console.error('Error generating recurring occurrences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate recurring occurrences' 
    });
  }
});

/**
 * Update a recurring event series
 */
router.put('/series/:parentId', requireAuth, async (req, res) => {
  try {
    const { parentId } = req.params;
    const { changes } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const allUserEvents = user.calendarEvents;
    const updatedEvents = await recurrenceService.updateRecurringSeries(
      parentId, 
      changes, 
      allUserEvents
    );

    // Update user's events
    user.calendarEvents = updatedEvents;
    await user.save();

    res.json({ 
      success: true, 
      events: updatedEvents,
      message: 'Recurring series updated successfully' 
    });
  } catch (error) {
    console.error('Error updating recurring series:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update recurring series' 
    });
  }
});

/**
 * Delete recurring event occurrences
 */
router.delete('/series/:parentId', requireAuth, async (req, res) => {
  try {
    const { parentId } = req.params;
    const { scope, occurrenceDate } = req.body; // 'this', 'future', 'all'

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const allUserEvents = user.calendarEvents;
    const remainingEvents = await recurrenceService.deleteRecurringSeries(
      parentId, 
      scope, 
      occurrenceDate ? new Date(occurrenceDate) : null, 
      allUserEvents
    );

    // Update user's events
    user.calendarEvents = remainingEvents;
    await user.save();

    res.json({ 
      success: true, 
      events: remainingEvents,
      message: 'Recurring series deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting recurring series:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete recurring series' 
    });
  }
});

/**
 * Get recurring event occurrences for a date range
 */
router.get('/occurrences', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, parentId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'startDate and endDate are required' 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let events = user.calendarEvents;
    
    // Filter by parent ID if provided
    if (parentId) {
      events = events.filter(event => 
        event.recurrenceParentId === parentId || event.id === parentId
      );
    }

    // Filter by date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    events = events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate >= start && eventDate <= end;
    });

    res.json({ 
      success: true, 
      events,
      count: events.length 
    });
  } catch (error) {
    console.error('Error fetching recurring occurrences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch recurring occurrences' 
    });
  }
});

module.exports = router;





