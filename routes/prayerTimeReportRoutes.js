/**
 * Prayer Time Report API Routes
 * User reporting and admin review system for prayer time accuracy
 */

const express = require('express');
const router = express.Router();
const PrayerTimeReport = require('../models/PrayerTimeReport');
const authMiddleware = require('../middleware/auth');

/**
 * POST /api/prayer-time-reports
 * Submit a new prayer time inaccuracy report
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      location,
      date,
      prayer,
      calculatedTime,
      correctTime,
      calculationMethod,
      madhab,
      description,
      source
    } = req.body;

    // Validate required fields
    if (!location || !date || !prayer || !calculatedTime || !correctTime || !source) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Calculate difference in minutes
    const calc = new Date(calculatedTime);
    const correct = new Date(correctTime);
    const differenceMinutes = Math.round((correct - calc) / (1000 * 60));

    // Create report
    const report = new PrayerTimeReport({
      userId: req.user._id || req.user.id,
      location,
      date: new Date(date),
      prayer,
      calculatedTime: calc,
      correctTime: correct,
      differenceMinutes,
      calculationMethod: calculationMethod || 'auto',
      madhab: madhab || 'auto',
      description,
      source
    });

    await report.save();

    // Update priority based on similar reports
    await report.updatePriority();

    console.log(`[PrayerTimeReport] New report created: ${report._id}`);

    res.json({
      success: true,
      reportId: report._id,
      priority: report.priority,
      message: 'Report submitted successfully. Thank you for helping improve accuracy!'
    });
  } catch (error) {
    console.error('[PrayerTimeReport] Error creating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit report'
    });
  }
});

/**
 * GET /api/prayer-time-reports/my-reports
 * Get current user's reports
 */
router.get('/my-reports', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const reports = await PrayerTimeReport.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('[PrayerTimeReport] Error fetching user reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports'
    });
  }
});

/**
 * GET /api/prayer-time-reports/location
 * Get reports for a specific location
 */
router.get('/location', async (req, res) => {
  try {
    const { lat, lon, radius } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const searchRadius = radius ? parseFloat(radius) : 0.5;

    const reports = await PrayerTimeReport.getByLocation(latitude, longitude, searchRadius);

    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    console.error('[PrayerTimeReport] Error fetching location reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports'
    });
  }
});

/**
 * POST /api/prayer-time-reports/:id/vote
 * Vote on a report (agree/disagree)
 */
router.post('/:id/vote', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { vote } = req.body; // 'agree' or 'disagree'
    const userId = req.user._id || req.user.id;

    if (!['agree', 'disagree'].includes(vote)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vote. Must be "agree" or "disagree"'
      });
    }

    const report = await PrayerTimeReport.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Check if user already voted
    if (report.votes.voters.includes(userId)) {
      return res.status(400).json({
        success: false,
        error: 'You have already voted on this report'
      });
    }

    // Add vote
    if (vote === 'agree') {
      report.votes.agree += 1;
    } else {
      report.votes.disagree += 1;
    }
    report.votes.voters.push(userId);

    await report.save();

    res.json({
      success: true,
      votes: report.votes,
      accuracyPercentage: report.accuracyPercentage
    });
  } catch (error) {
    console.error('[PrayerTimeReport] Error voting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to vote'
    });
  }
});

/**
 * GET /api/prayer-time-reports/admin/pending
 * Get pending reports for admin review
 */
router.get('/admin/pending', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin check
    const { priority, limit } = req.query;

    const query = { status: { $in: ['pending', 'reviewing'] } };
    if (priority) {
      query.priority = priority;
    }

    const reports = await PrayerTimeReport.find(query)
      .populate('userId', 'name email')
      .sort({ priority: -1, createdAt: -1 })
      .limit(parseInt(limit) || 50);

    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    console.error('[PrayerTimeReport] Error fetching pending reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending reports'
    });
  }
});

/**
 * PUT /api/prayer-time-reports/admin/:id/review
 * Admin review a report
 */
router.put('/admin/:id/review', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin check
    const { id } = req.params;
    const { status, reviewNotes, actionTaken } = req.body;

    const report = await PrayerTimeReport.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    report.status = status || report.status;
    report.reviewedBy = req.user._id || req.user.id;
    report.reviewedAt = new Date();
    report.reviewNotes = reviewNotes;
    report.actionTaken = actionTaken || 'none';

    await report.save();

    console.log(`[PrayerTimeReport] Report ${id} reviewed by admin`);

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('[PrayerTimeReport] Error reviewing report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to review report'
    });
  }
});

/**
 * GET /api/prayer-time-reports/admin/summary
 * Get summary statistics for admin dashboard
 */
router.get('/admin/summary', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin check
    const summary = await PrayerTimeReport.getSummary();

    const priorityCounts = await PrayerTimeReport.aggregate([
      { $match: { status: { $in: ['pending', 'reviewing'] } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    const prayerCounts = await PrayerTimeReport.aggregate([
      { $match: { status: { $in: ['pending', 'reviewing'] } } },
      { $group: { _id: '$prayer', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      summary: {
        byStatus: summary,
        byPriority: priorityCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byPrayer: prayerCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('[PrayerTimeReport] Error fetching summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summary'
    });
  }
});

module.exports = router;


