// routes/importRoutes.js - Calendar Import Routes

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');
const icsImportService = require('../services/icsImportService');
const { logger } = require('../config/logger');

// Configure multer for file upload (memory storage for ICS files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only .ics files
    if (file.mimetype === 'text/calendar' || file.originalname.endsWith('.ics')) {
      cb(null, true);
    } else {
      cb(new Error('Only .ics calendar files are allowed'));
    }
  }
});

// POST /api/import/ics - Upload and parse ICS file
router.post('/ics', requireAuth, upload.single('icsFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please upload an .ics calendar file.'
      });
    }

    logger.info(`[Import] Processing ICS file for user ${req.user.id}: ${req.file.originalname}`);

    // Parse ICS file content
    const icsContent = req.file.buffer.toString('utf-8');
    const parseResult = icsImportService.parseICS(icsContent);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to parse ICS file. Please ensure it is a valid calendar file.'
      });
    }

    // Get user's existing events
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Detect duplicates
    const detectionResult = icsImportService.detectDuplicates(
      parseResult.events,
      user.calendarEvents
    );

    // Convert to internal format
    const convertedEvents = icsImportService.convertToInternalFormat(detectionResult.newEvents);

    // Get import summary
    const summary = icsImportService.getImportSummary({
      ...detectionResult,
      newEvents: convertedEvents
    });

    // Store preview in session or temporary storage
    req.session.importPreview = {
      events: convertedEvents,
      duplicates: detectionResult.duplicates,
      summary: summary,
      timestamp: new Date()
    };

    logger.info(`[Import] ICS preview ready for user ${req.user.id}: ${summary.newEvents} new events, ${summary.duplicates} duplicates`);

    res.json({
      success: true,
      preview: true,
      summary: summary,
      newEvents: convertedEvents,
      duplicates: detectionResult.duplicates.map(d => ({
        importedEvent: {
          title: d.importedEvent.title,
          startDate: d.importedEvent.startDate,
          location: d.importedEvent.location
        },
        existingEvent: {
          id: d.matchedEvent.id,
          title: d.matchedEvent.title,
          startDate: d.matchedEvent.startDate
        }
      })),
      message: `Found ${summary.totalEvents} events. ${summary.newEvents} new, ${summary.duplicates} duplicates.`
    });

  } catch (error) {
    logger.error('[Import] Error processing ICS file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process ICS file: ' + error.message
    });
  }
});

// POST /api/import/ics/confirm - Confirm and complete import
router.post('/ics/confirm', requireAuth, async (req, res) => {
  try {
    const { importSelected, selectedEventIds } = req.body;

    // Get preview from session
    const importPreview = req.session.importPreview;
    if (!importPreview) {
      return res.status(400).json({
        success: false,
        error: 'No import preview found. Please upload the file again.'
      });
    }

    // Check if preview is still valid (within 30 minutes)
    const previewAge = Date.now() - new Date(importPreview.timestamp).getTime();
    if (previewAge > 30 * 60 * 1000) {
      delete req.session.importPreview;
      return res.status(400).json({
        success: false,
        error: 'Import preview expired. Please upload the file again.'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let eventsToImport = importPreview.events;

    // If user selected specific events, filter them
    if (importSelected && selectedEventIds && Array.isArray(selectedEventIds)) {
      eventsToImport = importPreview.events.filter(e => 
        selectedEventIds.includes(e.id)
      );
      logger.info(`[Import] User selected ${eventsToImport.length} of ${importPreview.events.length} events`);
    }

    // Add events to user's calendar
    user.calendarEvents.push(...eventsToImport);
    await user.save();

    // Clear import preview from session
    delete req.session.importPreview;

    logger.info(`[Import] Successfully imported ${eventsToImport.length} events for user ${req.user.id}`);

    res.json({
      success: true,
      imported: eventsToImport.length,
      events: eventsToImport,
      message: `Successfully imported ${eventsToImport.length} event${eventsToImport.length !== 1 ? 's' : ''}`
    });

  } catch (error) {
    logger.error('[Import] Error confirming import:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import events: ' + error.message
    });
  }
});

// POST /api/import/ics/cancel - Cancel import
router.post('/ics/cancel', requireAuth, (req, res) => {
  try {
    if (req.session.importPreview) {
      delete req.session.importPreview;
    }

    res.json({
      success: true,
      message: 'Import cancelled'
    });
  } catch (error) {
    logger.error('[Import] Error cancelling import:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel import'
    });
  }
});

// GET /api/import/formats - Get supported import formats
router.get('/formats', requireAuth, (req, res) => {
  res.json({
    success: true,
    formats: [
      {
        name: 'ICS',
        extension: '.ics',
        mimeType: 'text/calendar',
        description: 'iCalendar format (compatible with Google Calendar, Outlook, Apple Calendar)',
        supported: true
      },
      {
        name: 'CSV',
        extension: '.csv',
        mimeType: 'text/csv',
        description: 'Comma-separated values',
        supported: false,
        comingSoon: true
      }
    ]
  });
});

module.exports = router;






